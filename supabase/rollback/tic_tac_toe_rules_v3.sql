-- Restore pre-v3 RPC definitions. Stop v3 sessions before using this rollback.
do $$ begin
 if exists(select 1 from public.in_app_game_sessions s join public.in_app_game_definitions d using(game_definition_id)
 where d.game_key='tic_tac_toe' and s.status='ACTIVE') then
 raise exception 'Finish active TicTacToe sessions before rollback'; end if;
end $$;
drop function if exists public.set_tic_tac_toe_timer(uuid,integer);
drop function if exists public.submit_tic_tac_toe_move(uuid,integer,uuid,integer,integer);
CREATE OR REPLACE FUNCTION private.finalize_tic_tac_toe_match_session(p_session_id uuid, p_state jsonb, p_winner_participant_id uuid, p_completion_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_participants uuid[];
  v_loser uuid;
  v_result jsonb;
  v_variant text;
  v_team_mode text;
  v_moves integer;
  v_board_moves integer;
  v_parallel jsonb;
  v_decider jsonb;
begin
  v_participants:=private.tic_tac_toe_session_participants(p_session_id);
  if coalesce(array_length(v_participants,1),0)<>2 then raise exception 'TIC_TAC_TOE_PARTICIPANTS_INVALID'; end if;
  if p_winner_participant_id=v_participants[1] then v_loser:=v_participants[2];
  elsif p_winner_participant_id=v_participants[2] then v_loser:=v_participants[1];
  else raise exception 'TIC_TAC_TOE_WINNER_INVALID';
  end if;

  v_variant:=upper(coalesce(p_state->>'variant','NORMAL'));
  v_team_mode:=upper(coalesce(p_state->>'team_mode','SOLO'));
  v_moves:=coalesce((p_state->>'moves_total')::integer,0);
  v_parallel:=coalesce(p_state->'parallel_results','{}'::jsonb);
  v_decider:=coalesce(p_state->'decider','{}'::jsonb);

  if p_state ? 'board_state' then
    v_board_moves:=coalesce((p_state->'board_state'->>'board_move_no')::integer,0);
  elsif p_state ? 'decider' then
    v_board_moves:=coalesce((p_state->'decider'->>'board_move_no')::integer,0);
  else
    v_board_moves:=0;
  end if;

  p_state:=jsonb_set(p_state,array['phase'],'"COMPLETE"'::jsonb,true);
  p_state:=jsonb_set(p_state,array['winner_participant_id'],to_jsonb(p_winner_participant_id::text),true);
  p_state:=jsonb_set(p_state,array['completion_reason'],to_jsonb(coalesce(p_completion_reason,'WIN')),true);
  p_state:=jsonb_set(p_state,array['completed_at'],to_jsonb(clock_timestamp()::text),true);

  v_result:=jsonb_build_object(
    'game_key','tic_tac_toe',
    'rules_version',2,
    'result_version',2,
    'variant',v_variant,
    'team_mode',v_team_mode,
    'completion_reason',coalesce(p_completion_reason,'WIN'),
    'winner_participant_id',p_winner_participant_id::text,
    'moves_total',v_moves,
    'final_board_moves',v_board_moves,
    'parallel_results',v_parallel,
    'decider',v_decider,
    'primary_score_type','WIN_POINTS',
    'primary_score_direction','HIGHER_IS_BETTER',
    'counts_for_personal_stats',false,
    'standings',jsonb_build_array(
      jsonb_build_object(
        'participant_id',p_winner_participant_id::text,'placement',1,'primary_score',1,'outcome','WIN',
        'variant',v_variant,'team_mode',v_team_mode,'moves_total',v_moves,'final_board_moves',v_board_moves
      ),
      jsonb_build_object(
        'participant_id',v_loser::text,'placement',2,'primary_score',0,'outcome','LOSS',
        'variant',v_variant,'team_mode',v_team_mode,'moves_total',v_moves,'final_board_moves',v_board_moves
      )
    ),
    'tournament_handoff',jsonb_build_object('status','MATCH_COMPLETE','finalized',false),
    'finalized_at',clock_timestamp()
  );

  update public.in_app_game_sessions
  set state_json=p_state,
      result_json=v_result,
      status='FINISHED',
      finished_at=coalesce(finished_at,now()),
      version=version+1,
      updated_at=now()
  where session_id=p_session_id;

  update public.in_app_game_session_players
  set status='FINISHED',finished_at=coalesce(finished_at,now()),updated_at=now()
  where session_id=p_session_id;

  v_result:=private.finalize_tic_tac_toe_tournament_result(p_session_id,v_result);
  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.finalize_tic_tac_toe_tournament_result(p_session_id uuid, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_tid uuid;
  v_tgid uuid;
  v_game_status public.tournament_game_status;
  v_game_id text;
  v_result jsonb:=coalesce(p_result,'{}'::jsonb);
  v_current_count integer;
  v_expected_matches integer;
  v_participant_count integer;
  v_scoring_profile_id text;
  v_final jsonb;
  v_third jsonb;
  v_final_winner uuid;
  v_final_loser uuid;
  v_third_winner uuid;
  v_third_loser uuid;
  v_other uuid;
  v_distinct integer;
  v_placements jsonb;
  v_handoff jsonb;
  v_joker jsonb;
begin
  select s.tournament_id,s.tournament_game_id,tg.status,tg.game_id
    into v_tid,v_tgid,v_game_status,v_game_id
  from public.in_app_game_sessions s
  join public.tournament_games tg on tg.tournament_game_id=s.tournament_game_id
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id
  where s.session_id=p_session_id and d.game_key='tic_tac_toe'
  for update of s,tg;

  if v_tid is null then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;
  if v_game_id<>'game.tictactoe.classic_disappear' then raise exception 'TIC_TAC_TOE_TOURNAMENT_GAME_MISMATCH'; end if;
  if jsonb_typeof(v_result->'standings')<>'array' or jsonb_array_length(v_result->'standings')<>2 then
    raise exception 'TIC_TAC_TOE_MATCH_RESULT_INCOMPLETE';
  end if;

  select count(distinct (x.item->>'participant_id')::uuid)
    into v_distinct
  from jsonb_array_elements(v_result->'standings') x(item);
  if v_distinct<>2 then raise exception 'TIC_TAC_TOE_MATCH_RESULT_DUPLICATE_PARTICIPANT'; end if;

  if exists(
    select 1
    from jsonb_array_elements(v_result->'standings') x(item)
    where nullif(x.item->>'placement','') is null
       or (x.item->>'placement')::integer not between 1 and 2
       or not exists(
         select 1 from public.in_app_game_session_players sp
         where sp.session_id=p_session_id
           and sp.participant_id=(x.item->>'participant_id')::uuid
       )
  ) then raise exception 'TIC_TAC_TOE_MATCH_RESULT_INVALID'; end if;

  insert into public.tournament_game_participants(tournament_game_id,participant_id,seed)
  select v_tgid,sp.participant_id,p.seed
  from public.in_app_game_session_players sp
  join public.participants p on p.participant_id=sp.participant_id
  where sp.session_id=p_session_id
  group by sp.participant_id,p.seed
  on conflict(tournament_game_id,participant_id) do nothing;

  insert into public.tournament_game_representatives(
    tournament_game_id,participant_id,tournament_member_id,representative_role,counts_for_personal_stats
  )
  select
    v_tgid,l.participant_id,l.tournament_member_id,
    case when l.lineup_role='DECIDER' then 'DECIDER' else 'PRIMARY' end,
    false
  from public.in_app_team_lineups l
  where l.session_id=p_session_id
    and l.lineup_role in ('REPRESENTATIVE','DECIDER')
  on conflict(tournament_game_id,participant_id,tournament_member_id)
  do update set
    representative_role=excluded.representative_role,
    counts_for_personal_stats=false;

  select count(*)::integer into v_participant_count
  from public.participants p
  where p.tournament_id=v_tid and p.status='ACTIVE';

  if v_participant_count not in (2,3,4) then
    raise exception 'TIC_TAC_TOE_PARTICIPANT_COUNT_UNSUPPORTED';
  end if;
  v_expected_matches:=case when v_participant_count=2 then 1 else 4 end;

  select count(*)::integer into v_current_count
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id
  where s.tournament_game_id=v_tgid
    and d.game_key='tic_tac_toe'
    and s.status='FINISHED'
    and s.result_json is not null;

  if v_current_count>v_expected_matches then
    raise exception 'TIC_TAC_TOE_MATCH_COUNT_EXCEEDED';
  end if;

  if v_current_count<v_expected_matches then
    v_handoff:=jsonb_build_object(
      'status','MATCH_COMPLETE',
      'finalized',false,
      'tournament_game_id',v_tgid,
      'match_number',v_current_count,
      'expected_matches',v_expected_matches
    );
    v_result:=v_result||jsonb_build_object('tournament_handoff',v_handoff);
    update public.in_app_game_sessions
    set result_json=v_result,version=version+1,updated_at=now()
    where session_id=p_session_id;
    return v_result;
  end if;

  select s.result_json into v_final
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id
  where s.tournament_game_id=v_tgid
    and d.game_key='tic_tac_toe'
    and s.status='FINISHED'
    and s.result_json is not null
  order by s.finished_at desc nulls last,s.created_at desc
  limit 1;

  v_final_winner:=nullif(v_final->>'winner_participant_id','')::uuid;
  select (x.item->>'participant_id')::uuid into v_final_loser
  from jsonb_array_elements(v_final->'standings') x(item)
  where (x.item->>'placement')::integer=2
  limit 1;

  if v_final_winner is null or v_final_loser is null or v_final_winner=v_final_loser then
    raise exception 'TIC_TAC_TOE_FINAL_RESULT_INVALID';
  end if;

  if v_participant_count=2 then
    v_placements:=jsonb_build_array(
      jsonb_build_object('participant_id',v_final_winner,'placement',1),
      jsonb_build_object('participant_id',v_final_loser,'placement',2)
    );
  elsif v_participant_count=3 then
    select p.participant_id into v_other
    from public.participants p
    where p.tournament_id=v_tid and p.status='ACTIVE'
      and p.participant_id not in (v_final_winner,v_final_loser)
    order by p.seed nulls last,p.created_at
    limit 1;
    if v_other is null then raise exception 'TIC_TAC_TOE_THIRD_PLACE_UNRESOLVED'; end if;
    v_placements:=jsonb_build_array(
      jsonb_build_object('participant_id',v_final_winner,'placement',1),
      jsonb_build_object('participant_id',v_final_loser,'placement',2),
      jsonb_build_object('participant_id',v_other,'placement',3)
    );
  else
    select s.result_json into v_third
    from public.in_app_game_sessions s
    join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id
    where s.tournament_game_id=v_tgid
      and d.game_key='tic_tac_toe'
      and s.status='FINISHED'
      and s.result_json is not null
    order by s.finished_at desc nulls last,s.created_at desc
    offset 1 limit 1;

    v_third_winner:=nullif(v_third->>'winner_participant_id','')::uuid;
    select (x.item->>'participant_id')::uuid into v_third_loser
    from jsonb_array_elements(v_third->'standings') x(item)
    where (x.item->>'placement')::integer=2
    limit 1;
    if v_third_winner is null or v_third_loser is null or v_third_winner=v_third_loser then
      raise exception 'TIC_TAC_TOE_THIRD_PLACE_RESULT_INVALID';
    end if;
    v_placements:=jsonb_build_array(
      jsonb_build_object('participant_id',v_final_winner,'placement',1),
      jsonb_build_object('participant_id',v_final_loser,'placement',2),
      jsonb_build_object('participant_id',v_third_winner,'placement',3),
      jsonb_build_object('participant_id',v_third_loser,'placement',4)
    );
  end if;

  select count(distinct (x.item->>'participant_id')::uuid)
    into v_distinct
  from jsonb_array_elements(v_placements) x(item);
  if v_distinct<>v_participant_count then
    raise exception 'TIC_TAC_TOE_FINAL_PLACEMENTS_INVALID';
  end if;

  select coalesce(t.scoring_profile_id,'scoring.skielsen.default')
    into v_scoring_profile_id
  from public.tournaments t where t.tournament_id=v_tid;

  if (
    select count(*) from public.scoring_placement_points spp
    where spp.scoring_profile_id=v_scoring_profile_id
      and spp.placement between 1 and v_participant_count
  )<>v_participant_count then raise exception 'SCORING_PROFILE_INCOMPLETE'; end if;

  delete from public.game_placements where tournament_game_id=v_tgid;
  insert into public.game_placements(
    tournament_game_id,participant_id,placement,base_points,multiplier,final_points
  )
  select
    v_tgid,
    (x.item->>'participant_id')::uuid,
    (x.item->>'placement')::integer,
    spp.points,1,spp.points
  from jsonb_array_elements(v_placements) x(item)
  join public.scoring_placement_points spp
    on spp.scoring_profile_id=v_scoring_profile_id
   and spp.placement=(x.item->>'placement')::integer;

  delete from public.tournament_game_results where tournament_game_id=v_tgid;
  insert into public.tournament_game_results(
    tournament_game_id,participant_id,primary_value,secondary_value,result_status,result_payload,
    submitted_by_member_id,created_at,updated_at
  )
  select
    v_tgid,
    (x.item->>'participant_id')::uuid,
    case when (x.item->>'placement')::integer=1 then 1 else 0 end,
    (x.item->>'placement')::numeric,
    'FINAL',
    jsonb_build_object(
      'game_key','tic_tac_toe',
      'rules_version',2,
      'placement',(x.item->>'placement')::integer,
      'team_result',true,
      'counts_for_personal_stats',false,
      'primary_score_type','WIN_POINTS',
      'primary_score_direction','HIGHER_IS_BETTER'
    ),
    null,now(),now()
  from jsonb_array_elements(v_placements) x(item);

  update public.tournament_games
  set status='COMPLETED'::public.tournament_game_status,
      completed_at=coalesce(completed_at,now())
  where tournament_game_id=v_tgid;

  perform private.apply_tournament_game_joker_effect(v_tgid);
  perform private.sync_game_placement_points_to_ledger(v_tgid);
  v_joker:=private.build_tournament_game_joker_reveal(v_tgid);

  v_handoff:=jsonb_build_object(
    'status','COMPLETED',
    'finalized',true,
    'tournament_game_id',v_tgid,
    'completed_at',now(),
    'match_number',v_current_count,
    'expected_matches',v_expected_matches,
    'placements',v_placements,
    'joker_reveal',v_joker
  );
  v_result:=v_result||jsonb_build_object('tournament_handoff',v_handoff);

  update public.in_app_game_sessions
  set result_json=v_result,version=version+1,updated_at=now()
  where session_id=p_session_id;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.resolve_tic_tac_toe_decider_timeout(p_session_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_status text;
  v_state jsonb;
  v_deadline timestamptz;
  v_loser uuid;
  v_participants uuid[];
  v_winner uuid;
  v_decider jsonb;
begin
  select status,state_json into v_status,v_state
  from public.in_app_game_sessions
  where session_id=p_session_id
  for update;

  if v_status<>'ACTIVE' or v_state->>'phase'<>'DECIDER_PLAYING' then return false; end if;
  v_deadline:=nullif(v_state->'decider'->>'turn_deadline_at','')::timestamptz;
  if v_deadline is null or clock_timestamp()<v_deadline then return false; end if;

  v_loser:=nullif(v_state->'decider'->>'current_turn_participant_id','')::uuid;
  v_participants:=private.tic_tac_toe_session_participants(p_session_id);
  v_winner:=case when v_loser=v_participants[1] then v_participants[2] else v_participants[1] end;
  v_decider:=v_state->'decider';
  v_decider:=jsonb_set(v_decider,array['status'],'"TIMEOUT"'::jsonb,true);
  v_decider:=jsonb_set(v_decider,array['winner_participant_id'],to_jsonb(v_winner::text),true);
  v_decider:=jsonb_set(v_decider,array['timeout_participant_id'],to_jsonb(v_loser::text),true);
  v_decider:=jsonb_set(v_decider,array['timeout_member_id'],v_decider->'current_actor_member_id',true);
  v_decider:=jsonb_set(v_decider,array['turn_deadline_at'],'null'::jsonb,true);
  v_state:=jsonb_set(v_state,array['decider'],v_decider,true);

  perform private.finalize_tic_tac_toe_match_session(p_session_id,v_state,v_winner,'DECIDER_TIMEOUT');
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION private.tic_tac_toe_apply_move(p_board_state jsonb, p_participant_id uuid, p_member_id uuid, p_cell_index integer, p_variant text, p_alternating boolean, p_member_order jsonb, p_member_cursor jsonb, p_deadline_seconds integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_board jsonb:=p_board_state->'board';
  v_queue jsonb;
  v_old integer;
  v_win uuid;
  v_cells jsonb;
  v_current uuid:=nullif(p_board_state->>'current_turn_participant_id','')::uuid;
  v_actor uuid:=nullif(p_board_state->>'current_actor_member_id','')::uuid;
  v_participants text[];
  v_other uuid;
  v_empty integer;
  v_board_index integer:=coalesce((p_board_state->>'board_index')::integer,1);
  v_board_moves integer:=coalesce((p_board_state->>'board_move_no')::integer,0)+1;
  v_start uuid:=nullif(p_board_state->>'starting_participant_id','')::uuid;
  v_next_start uuid;
  v_actor_map jsonb:=coalesce(p_board_state->'actors','{}'::jsonb);
  v_cursor jsonb:=coalesce(p_member_cursor,'{}'::jsonb);
  v_order jsonb;
  v_idx integer;
  v_next_actor uuid;
  v_deadline timestamptz;
  v_draw boolean:=false;
begin
  if p_cell_index<0 or p_cell_index>8 then raise exception 'INVALID_TIC_TAC_TOE_CELL'; end if;
  if v_current is distinct from p_participant_id then raise exception 'NOT_YOUR_TURN'; end if;
  if v_actor is distinct from p_member_id then raise exception 'NOT_YOUR_TURN'; end if;
  if v_board->>p_cell_index is not null then raise exception 'TIC_TAC_TOE_CELL_OCCUPIED'; end if;

  select array_agg(key order by key) into v_participants
  from jsonb_object_keys(coalesce(p_board_state->'symbols','{}'::jsonb)) key;
  if array_length(v_participants,1)<>2 then raise exception 'TIC_TAC_TOE_BOARD_PARTICIPANTS_INVALID'; end if;
  v_other:=case when v_participants[1]::uuid=p_participant_id then v_participants[2]::uuid else v_participants[1]::uuid end;

  v_board:=jsonb_set(v_board,array[p_cell_index::text],to_jsonb(p_participant_id::text),true);
  v_queue:=coalesce(p_board_state->'active_mark_order'->(p_participant_id::text),'[]'::jsonb)||to_jsonb(p_cell_index);

  if upper(p_variant)='DISAPPEAR' and jsonb_array_length(v_queue)>3 then
    v_old:=(v_queue->>0)::integer;
    v_board:=jsonb_set(v_board,array[v_old::text],'null'::jsonb,true);
    select coalesce(jsonb_agg(x.value order by x.ord),'[]'::jsonb)
      into v_queue
    from jsonb_array_elements(v_queue) with ordinality x(value,ord)
    where x.ord>1;
  end if;

  p_board_state:=jsonb_set(p_board_state,array['board'],v_board,true);
  p_board_state:=jsonb_set(p_board_state,array['active_mark_order',p_participant_id::text],v_queue,true);
  p_board_state:=jsonb_set(p_board_state,array['board_move_no'],to_jsonb(v_board_moves),true);

  if p_alternating then
    v_order:=coalesce(p_member_order->(p_participant_id::text),'[]'::jsonb);
    if jsonb_array_length(v_order)<1 then raise exception 'ALTERNATING_MEMBER_ORDER_MISSING'; end if;
    v_idx:=coalesce((v_cursor->>p_participant_id::text)::integer,0);
    v_idx:=(v_idx+1)%jsonb_array_length(v_order);
    v_cursor:=jsonb_set(v_cursor,array[p_participant_id::text],to_jsonb(v_idx),true);
    v_next_actor:=(v_order->>v_idx)::uuid;
    v_actor_map:=jsonb_set(v_actor_map,array[p_participant_id::text],to_jsonb(v_next_actor::text),true);
    p_board_state:=jsonb_set(p_board_state,array['actors'],v_actor_map,true);
  end if;

  v_cells:=private.tic_tac_toe_winning_cells(v_board);
  v_win:=private.tic_tac_toe_winner(v_board);

  if v_win is not null then
    p_board_state:=jsonb_set(p_board_state,array['winner_participant_id'],to_jsonb(v_win::text),true);
    p_board_state:=jsonb_set(p_board_state,array['winning_cells'],v_cells,true);
    p_board_state:=jsonb_set(p_board_state,array['status'],'"COMPLETE"'::jsonb,true);
    p_board_state:=jsonb_set(p_board_state,array['turn_deadline_at'],'null'::jsonb,true);
    return jsonb_build_object(
      'board_state',p_board_state,'member_cursor',v_cursor,
      'complete',true,'draw',false,'winner_participant_id',v_win::text
    );
  end if;

  select count(*) into v_empty from jsonb_array_elements(v_board) e(value) where e.value='null'::jsonb;
  if upper(p_variant)='NORMAL' and v_empty=0 then
    v_draw:=true;
    v_next_start:=case when v_start=p_participant_id then v_other else p_participant_id end;
    -- alternate from the previous board's starter, independent of the final mover
    v_next_start:=case when v_start=(v_participants[1])::uuid then (v_participants[2])::uuid else (v_participants[1])::uuid end;
    p_board_state:=jsonb_set(p_board_state,array['board_index'],to_jsonb(v_board_index+1),true);
    p_board_state:=jsonb_set(p_board_state,array['board_move_no'],'0'::jsonb,true);
    p_board_state:=jsonb_set(p_board_state,array['board'],jsonb_build_array(null,null,null,null,null,null,null,null,null),true);
    p_board_state:=jsonb_set(p_board_state,array['active_mark_order'],jsonb_build_object(
      v_participants[1],'[]'::jsonb,v_participants[2],'[]'::jsonb
    ),true);
    p_board_state:=jsonb_set(p_board_state,array['starting_participant_id'],to_jsonb(v_next_start::text),true);
    p_board_state:=jsonb_set(p_board_state,array['current_turn_participant_id'],to_jsonb(v_next_start::text),true);
    p_board_state:=jsonb_set(p_board_state,array['symbols'],jsonb_build_object(
      v_next_start::text,'X',
      (case when v_next_start=(v_participants[1])::uuid then v_participants[2] else v_participants[1] end),'O'
    ),true);
    p_board_state:=jsonb_set(p_board_state,array['winning_cells'],'[]'::jsonb,true);
    p_board_state:=jsonb_set(p_board_state,array['winner_participant_id'],'null'::jsonb,true);
    p_board_state:=jsonb_set(p_board_state,array['status'],'"PLAYING"'::jsonb,true);
    v_next_actor:=nullif(v_actor_map->>v_next_start::text,'')::uuid;
    p_board_state:=jsonb_set(p_board_state,array['current_actor_member_id'],to_jsonb(v_next_actor::text),true);
    if p_deadline_seconds is not null then
      v_deadline:=clock_timestamp()+make_interval(secs=>p_deadline_seconds);
      p_board_state:=jsonb_set(p_board_state,array['turn_deadline_at'],to_jsonb(v_deadline::text),true);
    end if;
    return jsonb_build_object(
      'board_state',p_board_state,'member_cursor',v_cursor,
      'complete',false,'draw',true,'winner_participant_id',null
    );
  end if;

  p_board_state:=jsonb_set(p_board_state,array['current_turn_participant_id'],to_jsonb(v_other::text),true);
  v_next_actor:=nullif(v_actor_map->>v_other::text,'')::uuid;
  p_board_state:=jsonb_set(p_board_state,array['current_actor_member_id'],to_jsonb(v_next_actor::text),true);
  if p_deadline_seconds is not null then
    v_deadline:=clock_timestamp()+make_interval(secs=>p_deadline_seconds);
    p_board_state:=jsonb_set(p_board_state,array['turn_deadline_at'],to_jsonb(v_deadline::text),true);
  end if;

  return jsonb_build_object(
    'board_state',p_board_state,'member_cursor',v_cursor,
    'complete',false,'draw',false,'winner_participant_id',null
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.tic_tac_toe_ensure_state(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_state jsonb;
  v_status text;
  v_game_key text;
begin
  select s.state_json,s.status,d.game_key into v_state,v_status,v_game_key
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id
  where s.session_id=p_session_id
  for update of s;

  if v_game_key is distinct from 'tic_tac_toe' then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;
  if v_status not in ('ACTIVE','FINISHED') then raise exception 'TIC_TAC_TOE_SESSION_NOT_ACTIVE'; end if;

  if coalesce(v_state,'{}'::jsonb)='{}'::jsonb or v_state->>'game_key'<>'tic_tac_toe' then
    if v_status='FINISHED' then raise exception 'TIC_TAC_TOE_STATE_MISSING'; end if;
    v_state:=private.tic_tac_toe_initial_state(p_session_id);
    update public.in_app_game_sessions
    set state_json=v_state,version=version+1,current_round=1,updated_at=now()
    where session_id=p_session_id;
  end if;
  return v_state;
end;
$function$;

CREATE OR REPLACE FUNCTION private.tic_tac_toe_initial_state(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_variant text;
  v_status text;
  v_game_key text;
  v_participants uuid[];
  v_member_counts integer[];
  v_p1 uuid;
  v_p2 uuid;
  v_start uuid;
  v_other uuid;
begin
  select upper(nullif(s.public_state_json->>'tic_tac_toe_variant','')),s.status,d.game_key
    into v_variant,v_status,v_game_key
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id
  where s.session_id=p_session_id;

  if v_game_key is distinct from 'tic_tac_toe' then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;
  if v_status<>'ACTIVE' then raise exception 'TIC_TAC_TOE_SESSION_NOT_ACTIVE'; end if;
  if v_variant not in ('NORMAL','DISAPPEAR') then raise exception 'TIC_TAC_TOE_VARIANT_REQUIRED'; end if;

  select array_agg(x.participant_id order by x.first_seat),
         array_agg(x.member_count order by x.first_seat)
    into v_participants,v_member_counts
  from (
    select sp.participant_id,min(sp.seat) as first_seat,count(*)::integer as member_count
    from public.in_app_game_session_players sp
    where sp.session_id=p_session_id
    group by sp.participant_id
  ) x;

  if coalesce(array_length(v_participants,1),0)<>2 then raise exception 'TIC_TAC_TOE_REQUIRES_EXACTLY_TWO_PARTICIPANTS'; end if;
  if v_member_counts[1]<>1 or v_member_counts[2]<>1 then raise exception 'TIC_TAC_TOE_REQUIRES_ONE_PLAYER_PER_PARTICIPANT'; end if;

  v_p1:=v_participants[1]; v_p2:=v_participants[2];
  if random()<0.5 then v_start:=v_p1; v_other:=v_p2; else v_start:=v_p2; v_other:=v_p1; end if;

  return jsonb_build_object(
    'game_key','tic_tac_toe','rules_version',1,'variant',v_variant,'phase','PLAYING',
    'participant_order',jsonb_build_array(v_p1::text,v_p2::text),
    'symbols',jsonb_build_object(v_start::text,'X',v_other::text,'O'),
    'starting_participant_id',v_start::text,'current_turn_participant_id',v_start::text,
    'board_index',1,'board_move_no',0,'move_no',0,'moves_total',0,
    'board',jsonb_build_array(null,null,null,null,null,null,null,null,null),
    'active_mark_order',jsonb_build_object(v_p1::text,'[]'::jsonb,v_p2::text,'[]'::jsonb),
    'winning_cells','[]'::jsonb,'winner_participant_id',null,'board_history','[]'::jsonb,
    'started_at',clock_timestamp()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.tic_tac_toe_member_order(p_session_id uuid, p_participant_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  select coalesce(jsonb_agg(sp.tournament_member_id::text order by sp.seat),'[]'::jsonb)
  from public.in_app_game_session_players sp
  where sp.session_id=p_session_id
    and sp.participant_id=p_participant_id
$function$;

CREATE OR REPLACE FUNCTION private.tic_tac_toe_new_board(p_participant_a uuid, p_participant_b uuid, p_actor_a uuid, p_actor_b uuid, p_starting_participant uuid, p_deadline_seconds integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_other uuid;
  v_deadline timestamptz;
begin
  if p_starting_participant not in (p_participant_a,p_participant_b) then
    raise exception 'INVALID_STARTING_PARTICIPANT';
  end if;
  v_other:=case when p_starting_participant=p_participant_a then p_participant_b else p_participant_a end;
  if p_deadline_seconds is not null then v_deadline:=clock_timestamp()+make_interval(secs=>p_deadline_seconds); end if;
  return jsonb_build_object(
    'board_index',1,
    'board_move_no',0,
    'board',jsonb_build_array(null,null,null,null,null,null,null,null,null),
    'active_mark_order',jsonb_build_object(p_participant_a::text,'[]'::jsonb,p_participant_b::text,'[]'::jsonb),
    'symbols',jsonb_build_object(p_starting_participant::text,'X',v_other::text,'O'),
    'actors',jsonb_build_object(p_participant_a::text,p_actor_a::text,p_participant_b::text,p_actor_b::text),
    'starting_participant_id',p_starting_participant::text,
    'current_turn_participant_id',p_starting_participant::text,
    'current_actor_member_id',case when p_starting_participant=p_participant_a then p_actor_a::text else p_actor_b::text end,
    'winning_cells','[]'::jsonb,
    'winner_participant_id',null,
    'status','PLAYING',
    'turn_deadline_at',case when v_deadline is null then null else v_deadline::text end
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.tic_tac_toe_session_participants(p_session_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  select array_agg(x.participant_id order by x.first_seat)
  from (
    select sp.participant_id,min(sp.seat) first_seat
    from public.in_app_game_session_players sp
    where sp.session_id=p_session_id
    group by sp.participant_id
  ) x
$function$;

CREATE OR REPLACE FUNCTION private.tic_tac_toe_winner(p_board jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_cells jsonb;
  v_pid text;
begin
  v_cells:=private.tic_tac_toe_winning_cells(p_board);
  if jsonb_array_length(v_cells)=0 then return null; end if;
  v_pid:=p_board->>(v_cells->>0)::integer;
  return nullif(v_pid,'')::uuid;
end;
$function$;

CREATE OR REPLACE FUNCTION private.tic_tac_toe_winning_cells(p_board jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_line integer[];
  v_a text;
begin
  if jsonb_typeof(p_board)<>'array' or jsonb_array_length(p_board)<>9 then return '[]'::jsonb; end if;
  foreach v_line slice 1 in array array[
    array[0,1,2],array[3,4,5],array[6,7,8],
    array[0,3,6],array[1,4,7],array[2,5,8],
    array[0,4,8],array[2,4,6]
  ]
  loop
    v_a:=p_board->>v_line[1];
    if v_a is not null and v_a=p_board->>v_line[2] and v_a=p_board->>v_line[3] then
      return jsonb_build_array(v_line[1],v_line[2],v_line[3]);
    end if;
  end loop;
  return '[]'::jsonb;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_tic_tac_toe_match_session(p_tournament_game_id uuid, p_participant_a_id uuid, p_participant_b_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_tid uuid;
  v_mode text;
  v_game_id text;
  v_def uuid;
  v_existing uuid;
  v_session uuid;
  v_creator uuid;
  v_pa public.participants%rowtype;
  v_pb public.participants%rowtype;
  v_member record;
  v_seat integer:=0;
  v_count_a integer:=0;
  v_count_b integer:=0;
begin
  select tg.tournament_id,t.mode::text,tg.game_id
    into v_tid,v_mode,v_game_id
  from public.tournament_games tg
  join public.tournaments t on t.tournament_id=tg.tournament_id
  where tg.tournament_game_id=p_tournament_game_id;

  if v_tid is null then raise exception 'TOURNAMENT_GAME_NOT_FOUND'; end if;
  if v_game_id<>'game.tictactoe.classic_disappear' then raise exception 'TIC_TAC_TOE_GAME_REQUIRED'; end if;
  if not private.in_app_is_admin(v_tid) then raise exception 'TOURNAMENT_ADMIN_REQUIRED'; end if;
  if p_participant_a_id is null or p_participant_b_id is null or p_participant_a_id=p_participant_b_id then
    raise exception 'TIC_TAC_TOE_REQUIRES_TWO_PARTICIPANTS';
  end if;

  select * into v_pa from public.participants
  where participant_id=p_participant_a_id and tournament_id=v_tid and status='ACTIVE';
  select * into v_pb from public.participants
  where participant_id=p_participant_b_id and tournament_id=v_tid and status='ACTIVE';
  if v_pa.participant_id is null or v_pb.participant_id is null then raise exception 'PARTICIPANT_NOT_ACTIVE'; end if;

  if v_mode='SOLO' and (v_pa.participant_type::text<>'SOLO' or v_pb.participant_type::text<>'SOLO') then
    raise exception 'SOLO_PARTICIPANTS_REQUIRED';
  end if;
  if v_mode='TEAM' and (v_pa.participant_type::text<>'TEAM' or v_pb.participant_type::text<>'TEAM') then
    raise exception 'TEAM_PARTICIPANTS_REQUIRED';
  end if;

  select s.session_id into v_existing
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id
  where s.tournament_game_id=p_tournament_game_id
    and d.game_key='tic_tac_toe'
    and s.status not in ('FINISHED','CANCELLED')
  order by s.created_at desc
  limit 1
  for update of s;

  if v_existing is not null then
    if (select public_state_json->>'participant_a_id' from public.in_app_game_sessions where session_id=v_existing)=p_participant_a_id::text
       and (select public_state_json->>'participant_b_id' from public.in_app_game_sessions where session_id=v_existing)=p_participant_b_id::text then
      return v_existing;
    end if;
    raise exception 'ANOTHER_TIC_TAC_TOE_MATCH_SESSION_IS_OPEN';
  end if;

  select game_definition_id into v_def
  from public.in_app_game_definitions
  where game_key='tic_tac_toe' and is_active=true
  limit 1;
  if v_def is null then raise exception 'TIC_TAC_TOE_DEFINITION_NOT_FOUND'; end if;

  v_creator:=private.in_app_current_member(v_tid);

  insert into public.in_app_game_sessions(
    tournament_id,tournament_game_id,match_id,game_definition_id,status,
    public_state_json,created_by_member_id
  )
  values(
    v_tid,p_tournament_game_id,null,v_def,'WAITING_FOR_PLAYERS',
    jsonb_build_object(
      'source','TIC_TAC_TOE_PRESTART',
      'participant_a_id',p_participant_a_id::text,
      'participant_b_id',p_participant_b_id::text,
      'tournament_mode',v_mode,
      'team_mode',case when v_mode='SOLO' then 'SOLO' else null end,
      'difficulty',null,
      'tic_tac_toe_variant',null,
      'rules_version',2,
      'decider_turn_seconds',5
    ),
    v_creator
  )
  returning session_id into v_session;

  if v_mode='SOLO' then
    if v_pa.solo_member_id is null or v_pb.solo_member_id is null then raise exception 'SOLO_MEMBER_MISSING'; end if;
    insert into public.in_app_game_session_players(session_id,tournament_member_id,participant_id,seat,status)
    values
      (v_session,v_pa.solo_member_id,p_participant_a_id,1,'ASSIGNED'),
      (v_session,v_pb.solo_member_id,p_participant_b_id,2,'ASSIGNED');
    insert into public.in_app_team_mode_configs(session_id,mode,selected_by_member_id)
    values(v_session,'SOLO',v_creator);
  else
    for v_member in
      select tm.tournament_member_id,p.participant_id,
             row_number() over(partition by p.participant_id order by x.joined_at,tm.tournament_member_id) as team_slot
      from public.participants p
      join public.team_members x on x.team_id=p.team_id and x.left_at is null
      join public.tournament_members tm on tm.tournament_member_id=x.tournament_member_id
      where p.participant_id in (p_participant_a_id,p_participant_b_id)
        and tm.tournament_id=v_tid
        and tm.left_at is null
        and tm.membership_status='JOINED'
        and tm.participation_status='ACTIVE'
      order by case when p.participant_id=p_participant_a_id then 0 else 1 end,
               x.joined_at,tm.tournament_member_id
    loop
      v_seat:=v_seat+1;
      if v_member.participant_id=p_participant_a_id then v_count_a:=v_count_a+1; else v_count_b:=v_count_b+1; end if;
      insert into public.in_app_game_session_players(session_id,tournament_member_id,participant_id,seat,status)
      values(v_session,v_member.tournament_member_id,v_member.participant_id,v_seat,'ASSIGNED');
    end loop;
    if v_count_a<>2 or v_count_b<>2 then
      raise exception 'TIC_TAC_TOE_TEAM_MODE_REQUIRES_TWO_PLAYERS_PER_TEAM';
    end if;
  end if;

  return v_session;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_tic_tac_toe_result(p_tournament_game_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_uid uuid:=private.request_user_id();
  v_tid uuid;
  v_session uuid;
  v_result jsonb;
  v_finished timestamptz;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select tournament_id into v_tid
  from public.tournament_games
  where tournament_game_id=p_tournament_game_id
    and game_id='game.tictactoe.classic_disappear';
  if v_tid is null then return null; end if;
  if not exists(
    select 1 from public.tournament_members tm
    where tm.tournament_id=v_tid and tm.user_id=v_uid and tm.left_at is null
  ) then raise exception 'NOT_AUTHORIZED'; end if;

  select s.session_id,s.result_json,s.finished_at
    into v_session,v_result,v_finished
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id
  where s.tournament_game_id=p_tournament_game_id
    and d.game_key='tic_tac_toe'
    and s.result_json is not null
  order by s.finished_at desc nulls last,s.updated_at desc
  limit 1;

  if v_result is null then return null; end if;
  return jsonb_build_object(
    'tournament_game_id',p_tournament_game_id,
    'session_id',v_session,
    'finished_at',v_finished,
    'result',v_result
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_tic_tac_toe_state(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_uid uuid:=private.request_user_id();
  v_tid uuid;
  v_status text;
  v_tournament_mode text;
  v_team_mode text;
  v_variant text;
  v_state jsonb;
  v_result jsonb;
  v_version bigint;
  v_member uuid;
  v_pid uuid;
  v_players jsonb;
  v_lineups jsonb;
  v_phase text;
  v_rep_count integer:=0;
  v_can_start boolean:=false;
  v_my_subgame text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select s.tournament_id,s.status,s.public_state_json->>'tournament_mode',
         cfg.mode,upper(nullif(s.public_state_json->>'tic_tac_toe_variant','')),
         s.state_json,s.result_json,s.version
    into v_tid,v_status,v_tournament_mode,v_team_mode,v_variant,v_state,v_result,v_version
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id and d.game_key='tic_tac_toe'
  left join public.in_app_team_mode_configs cfg on cfg.session_id=s.session_id
  where s.session_id=p_session_id;

  if v_tid is null then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;

  select sp.tournament_member_id,sp.participant_id into v_member,v_pid
  from public.in_app_game_session_players sp
  join public.tournament_members tm on tm.tournament_member_id=sp.tournament_member_id
  where sp.session_id=p_session_id and tm.user_id=v_uid and tm.left_at is null
  limit 1;

  if v_member is null and not private.in_app_is_admin(v_tid) then raise exception 'NOT_ASSIGNED_TO_SESSION'; end if;

  if v_status='ACTIVE' then
    perform private.resolve_tic_tac_toe_decider_timeout(p_session_id);
    select status,state_json,result_json,version into v_status,v_state,v_result,v_version
    from public.in_app_game_sessions where session_id=p_session_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'tournament_member_id',sp.tournament_member_id,'participant_id',sp.participant_id,
    'display_name',tm.display_name_snapshot,'identity_color',p.identity_color::text,
    'team_id',p.team_id,'team_name',coalesce(t.name,tm.display_name_snapshot),
    'seat',sp.seat,'status',sp.status
  ) order by sp.seat),'[]'::jsonb)
  into v_players
  from public.in_app_game_session_players sp
  join public.tournament_members tm on tm.tournament_member_id=sp.tournament_member_id
  join public.participants p on p.participant_id=sp.participant_id
  left join public.teams t on t.team_id=p.team_id
  where sp.session_id=p_session_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'participant_id',l.participant_id,'lineup_role',l.lineup_role,'lineup_slot',l.lineup_slot,
    'tournament_member_id',l.tournament_member_id,'display_name',tm.display_name_snapshot
  ) order by l.lineup_role,l.participant_id,l.lineup_slot),'[]'::jsonb)
  into v_lineups
  from public.in_app_team_lineups l
  join public.tournament_members tm on tm.tournament_member_id=l.tournament_member_id
  where l.session_id=p_session_id;

  if v_status in ('WAITING_FOR_PLAYERS','READY') then
    if v_tournament_mode='TEAM' and coalesce(v_team_mode,'')='' then
      v_phase:='TEAM_MODE';
    elsif v_team_mode='SELECTED_PLAYER' then
      select count(distinct participant_id) into v_rep_count
      from public.in_app_team_lineups where session_id=p_session_id and lineup_role='REPRESENTATIVE';
      if v_rep_count<2 then v_phase:='PLAYER_SELECTION';
      elsif coalesce(v_variant,'') not in ('NORMAL','DISAPPEAR') then v_phase:='DIFFICULTY';
      else v_phase:='READY_TO_START';
      end if;
    elsif coalesce(v_variant,'') not in ('NORMAL','DISAPPEAR') then
      v_phase:='DIFFICULTY';
    else
      v_phase:='READY_TO_START';
    end if;
    v_can_start:=v_phase='READY_TO_START';
  else
    v_phase:=coalesce(v_state->>'phase',case when v_status='FINISHED' then 'COMPLETE' else 'WAITING' end);
  end if;

  if v_phase='PARALLEL_PLAYING' and v_member is not null then
    if v_state->'subgames'->'1'->'actors' @> jsonb_build_object(v_pid::text,v_member::text) then v_my_subgame:='1';
    elsif v_state->'subgames'->'2'->'actors' @> jsonb_build_object(v_pid::text,v_member::text) then v_my_subgame:='2';
    end if;
  end if;

  return jsonb_build_object(
    'session_id',p_session_id,'status',v_status,'phase',v_phase,'tournament_mode',v_tournament_mode,
    'team_mode',coalesce(v_team_mode,case when v_tournament_mode='SOLO' then 'SOLO' else null end),
    'team_mode_options',case when v_tournament_mode='TEAM' then jsonb_build_array('ALTERNATING','SELECTED_PLAYER','SIMULTANEOUS') else '[]'::jsonb end,
    'variant',v_variant,'difficulty_options',jsonb_build_array('NORMAL','DISAPPEAR'),
    'rules_version',2,'version',v_version,'players',v_players,'lineups',v_lineups,
    'viewer',jsonb_build_object('tournament_member_id',v_member,'participant_id',v_pid,'is_admin',private.in_app_is_admin(v_tid),'my_subgame',v_my_subgame),
    'can_start',v_can_start,'state',coalesce(v_state,'{}'::jsonb),'result',v_result,'server_now',clock_timestamp()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.select_tic_tac_toe_player(p_session_id uuid, p_tournament_member_id uuid, p_selection text DEFAULT 'MATCH'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_uid uuid:=private.request_user_id();
  v_tid uuid;
  v_status text;
  v_phase text;
  v_mode text;
  v_selection text:=upper(trim(coalesce(p_selection,'MATCH')));
  v_caller_member uuid;
  v_caller_pid uuid;
  v_selected_pid uuid;
  v_role text;
  v_ready integer;
  v_participant_count integer;
  v_participants uuid[];
  v_a uuid;
  v_b uuid;
  v_actor_a uuid;
  v_actor_b uuid;
  v_start uuid;
  v_state jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_selection not in ('MATCH','DECIDER') then raise exception 'INVALID_SELECTION_TYPE'; end if;

  select s.tournament_id,s.status,coalesce(s.state_json->>'phase',''),cfg.mode,s.state_json
    into v_tid,v_status,v_phase,v_mode,v_state
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id and d.game_key='tic_tac_toe'
  left join public.in_app_team_mode_configs cfg on cfg.session_id=s.session_id
  where s.session_id=p_session_id
  for update of s;

  if v_tid is null then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;

  select sp.tournament_member_id,sp.participant_id
    into v_caller_member,v_caller_pid
  from public.in_app_game_session_players sp
  join public.tournament_members tm on tm.tournament_member_id=sp.tournament_member_id
  where sp.session_id=p_session_id and tm.user_id=v_uid and tm.left_at is null
  limit 1;
  if v_caller_member is null then raise exception 'NOT_ASSIGNED_TO_SESSION'; end if;

  select sp.participant_id into v_selected_pid
  from public.in_app_game_session_players sp
  where sp.session_id=p_session_id and sp.tournament_member_id=p_tournament_member_id;
  if v_selected_pid is null or v_selected_pid<>v_caller_pid then raise exception 'CAN_ONLY_SELECT_OWN_TEAM_MEMBER'; end if;

  if v_selection='MATCH' then
    if v_status not in ('WAITING_FOR_PLAYERS','READY') or v_mode<>'SELECTED_PLAYER' then
      raise exception 'MATCH_PLAYER_SELECTION_NOT_OPEN';
    end if;
    v_role:='REPRESENTATIVE';
  else
    if v_status<>'ACTIVE' or v_phase<>'DECIDER_SELECTION' or v_mode<>'SIMULTANEOUS' then
      raise exception 'DECIDER_SELECTION_NOT_OPEN';
    end if;
    v_role:='DECIDER';
  end if;

  delete from public.in_app_team_lineups
  where session_id=p_session_id and participant_id=v_caller_pid and lineup_role=v_role;

  insert into public.in_app_team_lineups(
    session_id,participant_id,lineup_role,lineup_slot,tournament_member_id,selected_by_member_id
  )
  values(p_session_id,v_caller_pid,v_role,1,p_tournament_member_id,v_caller_member);

  select count(distinct participant_id) into v_ready
  from public.in_app_team_lineups
  where session_id=p_session_id and lineup_role=v_role;
  select count(distinct participant_id) into v_participant_count
  from public.in_app_game_session_players
  where session_id=p_session_id;

  if v_selection='DECIDER' and v_ready=v_participant_count then
    v_participants:=private.tic_tac_toe_session_participants(p_session_id);
    v_a:=v_participants[1];v_b:=v_participants[2];
    select tournament_member_id into v_actor_a from public.in_app_team_lineups
    where session_id=p_session_id and participant_id=v_a and lineup_role='DECIDER' and lineup_slot=1;
    select tournament_member_id into v_actor_b from public.in_app_team_lineups
    where session_id=p_session_id and participant_id=v_b and lineup_role='DECIDER' and lineup_slot=1;
    v_start:=case when random()<0.5 then v_a else v_b end;
    v_state:=jsonb_set(v_state,array['phase'],'"DECIDER_PLAYING"'::jsonb,true);
    v_state:=jsonb_set(
      v_state,array['decider'],
      private.tic_tac_toe_new_board(v_a,v_b,v_actor_a,v_actor_b,v_start,5),
      true
    );
    v_state:=jsonb_set(v_state,array['decider_started_at'],to_jsonb(clock_timestamp()::text),true);
    update public.in_app_game_sessions
    set state_json=v_state,version=version+1,updated_at=now()
    where session_id=p_session_id;
  end if;

  return jsonb_build_object(
    'accepted',true,'selection',v_selection,'participant_id',v_caller_pid,
    'tournament_member_id',p_tournament_member_id,
    'all_teams_ready',v_ready=v_participant_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_tic_tac_toe_team_mode(p_session_id uuid, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_uid uuid:=private.request_user_id();
  v_tid uuid;
  v_status text;
  v_tournament_mode text;
  v_mode text:=upper(trim(coalesce(p_mode,'')));
  v_admin_member uuid;
  v_participants uuid[];
  v_pid uuid;
  v_row record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_mode not in ('ALTERNATING','SELECTED_PLAYER','SIMULTANEOUS') then raise exception 'INVALID_TEAM_MODE'; end if;

  select s.tournament_id,s.status,t.mode::text
    into v_tid,v_status,v_tournament_mode
  from public.in_app_game_sessions s
  join public.tournaments t on t.tournament_id=s.tournament_id
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id and d.game_key='tic_tac_toe'
  where s.session_id=p_session_id
  for update of s;

  if v_tid is null then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;
  if v_tournament_mode<>'TEAM' then raise exception 'TEAM_MODE_ONLY_IN_TEAM_TOURNAMENT'; end if;
  if v_status not in ('WAITING_FOR_PLAYERS','READY') then raise exception 'TEAM_MODE_LOCKED'; end if;
  if not private.in_app_is_admin(v_tid) then raise exception 'TOURNAMENT_ADMIN_REQUIRED'; end if;

  v_admin_member:=private.in_app_current_member(v_tid);

  insert into public.in_app_team_mode_configs(session_id,mode,selected_by_member_id,selected_at,locked_at,updated_at)
  values(p_session_id,v_mode,v_admin_member,now(),null,now())
  on conflict(session_id) do update set
    mode=excluded.mode,selected_by_member_id=excluded.selected_by_member_id,
    selected_at=excluded.selected_at,locked_at=null,updated_at=now();

  delete from public.in_app_team_lineups where session_id=p_session_id;

  if v_mode in ('ALTERNATING','SIMULTANEOUS') then
    v_participants:=private.tic_tac_toe_session_participants(p_session_id);
    foreach v_pid in array v_participants loop
      for v_row in
        select sp.tournament_member_id,row_number() over(order by sp.seat)::integer as slot
        from public.in_app_game_session_players sp
        where sp.session_id=p_session_id and sp.participant_id=v_pid
        order by sp.seat
      loop
        insert into public.in_app_team_lineups(
          session_id,participant_id,lineup_role,lineup_slot,tournament_member_id,selected_by_member_id
        )
        values(p_session_id,v_pid,'ACTIVE',v_row.slot,v_row.tournament_member_id,v_admin_member);
      end loop;
    end loop;
  end if;

  update public.in_app_game_sessions
  set public_state_json=coalesce(public_state_json,'{}'::jsonb)
      ||jsonb_build_object('team_mode',v_mode,'difficulty',null,'tic_tac_toe_variant',null),
      state_json='{}'::jsonb,result_json=null,version=version+1,updated_at=now()
  where session_id=p_session_id;

  return jsonb_build_object('accepted',true,'team_mode',v_mode);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_tic_tac_toe_variant(p_session_id uuid, p_variant text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_uid uuid:=private.request_user_id();
  v_tid uuid;
  v_status text;
  v_tournament_mode text;
  v_team_mode text;
  v_variant text:=upper(trim(coalesce(p_variant,'')));
  v_rep_count integer:=0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_variant not in ('NORMAL','DISAPPEAR') then raise exception 'INVALID_TIC_TAC_TOE_VARIANT'; end if;

  select s.tournament_id,s.status,s.public_state_json->>'tournament_mode',cfg.mode
    into v_tid,v_status,v_tournament_mode,v_team_mode
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id and d.game_key='tic_tac_toe'
  left join public.in_app_team_mode_configs cfg on cfg.session_id=s.session_id
  where s.session_id=p_session_id
  for update of s;

  if v_tid is null then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;
  if not private.in_app_is_admin(v_tid) then raise exception 'TOURNAMENT_ADMIN_REQUIRED'; end if;
  if v_status not in ('WAITING_FOR_PLAYERS','READY') then raise exception 'TIC_TAC_TOE_VARIANT_LOCKED'; end if;

  if v_tournament_mode='TEAM' and coalesce(v_team_mode,'')='' then raise exception 'TEAM_MODE_REQUIRED'; end if;
  if v_team_mode='SELECTED_PLAYER' then
    select count(distinct participant_id) into v_rep_count
    from public.in_app_team_lineups
    where session_id=p_session_id and lineup_role='REPRESENTATIVE';
    if v_rep_count<>2 then raise exception 'TEAM_REPRESENTATIVES_REQUIRED'; end if;
  end if;

  update public.in_app_game_sessions
  set public_state_json=coalesce(public_state_json,'{}'::jsonb)
      ||jsonb_build_object(
        'tic_tac_toe_variant',v_variant,
        'difficulty',v_variant,
        'tic_tac_toe_rules_version',2,
        'variant_selected_at',clock_timestamp()::text
      ),
      state_json='{}'::jsonb,
      result_json=null,
      version=version+1,
      updated_at=now()
  where session_id=p_session_id;

  return jsonb_build_object('accepted',true,'variant',v_variant,'rules_version',2);
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_tic_tac_toe_match(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_uid uuid:=private.request_user_id();
  v_tid uuid;
  v_tgid uuid;
  v_status text;
  v_game_status text;
  v_tournament_mode text;
  v_variant text;
  v_team_mode text;
  v_participants uuid[];
  v_a uuid;
  v_b uuid;
  v_members_a jsonb;
  v_members_b jsonb;
  v_actor_a uuid;
  v_actor_b uuid;
  v_actor_a2 uuid;
  v_actor_b2 uuid;
  v_start uuid;
  v_start2 uuid;
  v_state jsonb;
  v_sub1 jsonb;
  v_sub2 jsonb;
  v_rep_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select s.tournament_id,s.tournament_game_id,s.status,tg.status::text,
         s.public_state_json->>'tournament_mode',
         upper(nullif(s.public_state_json->>'tic_tac_toe_variant','')),
         cfg.mode
    into v_tid,v_tgid,v_status,v_game_status,v_tournament_mode,v_variant,v_team_mode
  from public.in_app_game_sessions s
  join public.tournament_games tg on tg.tournament_game_id=s.tournament_game_id
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id and d.game_key='tic_tac_toe'
  left join public.in_app_team_mode_configs cfg on cfg.session_id=s.session_id
  where s.session_id=p_session_id
  for update of s,tg;

  if v_tid is null then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;
  if not private.in_app_is_admin(v_tid) then raise exception 'TOURNAMENT_ADMIN_REQUIRED'; end if;
  if v_status not in ('WAITING_FOR_PLAYERS','READY') then raise exception 'TIC_TAC_TOE_SESSION_NOT_STARTABLE'; end if;
  if v_status<>'READY' then raise exception 'TIC_TAC_TOE_PLAYERS_NOT_READY'; end if;
  if v_game_status<>'ACTIVE' then raise exception 'TOURNAMENT_GAME_NOT_ACTIVE'; end if;
  if coalesce(v_variant,'') not in ('NORMAL','DISAPPEAR') then raise exception 'TIC_TAC_TOE_VARIANT_REQUIRED'; end if;

  v_participants:=private.tic_tac_toe_session_participants(p_session_id);
  if coalesce(array_length(v_participants,1),0)<>2 then raise exception 'TIC_TAC_TOE_REQUIRES_TWO_PARTICIPANTS'; end if;
  v_a:=v_participants[1];v_b:=v_participants[2];

  if v_tournament_mode='SOLO' then
    v_team_mode:='SOLO';
    select sp.tournament_member_id into v_actor_a
    from public.in_app_game_session_players sp where sp.session_id=p_session_id and sp.participant_id=v_a order by sp.seat limit 1;
    select sp.tournament_member_id into v_actor_b
    from public.in_app_game_session_players sp where sp.session_id=p_session_id and sp.participant_id=v_b order by sp.seat limit 1;
    v_members_a:=jsonb_build_array(v_actor_a::text);
    v_members_b:=jsonb_build_array(v_actor_b::text);
  else
    if coalesce(v_team_mode,'') not in ('ALTERNATING','SELECTED_PLAYER','SIMULTANEOUS') then raise exception 'TEAM_MODE_REQUIRED'; end if;
    if v_team_mode='SELECTED_PLAYER' then
      select count(distinct participant_id) into v_rep_count
      from public.in_app_team_lineups where session_id=p_session_id and lineup_role='REPRESENTATIVE';
      if v_rep_count<>2 then raise exception 'TEAM_REPRESENTATIVES_REQUIRED'; end if;
      select tournament_member_id into v_actor_a from public.in_app_team_lineups
      where session_id=p_session_id and participant_id=v_a and lineup_role='REPRESENTATIVE' and lineup_slot=1;
      select tournament_member_id into v_actor_b from public.in_app_team_lineups
      where session_id=p_session_id and participant_id=v_b and lineup_role='REPRESENTATIVE' and lineup_slot=1;
      v_members_a:=jsonb_build_array(v_actor_a::text);
      v_members_b:=jsonb_build_array(v_actor_b::text);
    else
      select coalesce(jsonb_agg(tournament_member_id::text order by lineup_slot),'[]'::jsonb) into v_members_a
      from public.in_app_team_lineups where session_id=p_session_id and participant_id=v_a and lineup_role='ACTIVE';
      select coalesce(jsonb_agg(tournament_member_id::text order by lineup_slot),'[]'::jsonb) into v_members_b
      from public.in_app_team_lineups where session_id=p_session_id and participant_id=v_b and lineup_role='ACTIVE';
      if jsonb_array_length(v_members_a)<>2 or jsonb_array_length(v_members_b)<>2 then raise exception 'TWO_ACTIVE_TEAM_MEMBERS_REQUIRED'; end if;
      v_actor_a:=(v_members_a->>0)::uuid;v_actor_b:=(v_members_b->>0)::uuid;
      v_actor_a2:=(v_members_a->>1)::uuid;v_actor_b2:=(v_members_b->>1)::uuid;
    end if;
  end if;

  v_state:=jsonb_build_object(
    'game_key','tic_tac_toe','rules_version',2,'variant',v_variant,'team_mode',v_team_mode,
    'tournament_mode',v_tournament_mode,'participant_order',jsonb_build_array(v_a::text,v_b::text),
    'member_order',jsonb_build_object(v_a::text,v_members_a,v_b::text,v_members_b),
    'member_cursor',jsonb_build_object(v_a::text,0,v_b::text,0),
    'moves_total',0,'winner_participant_id',null,'completion_reason',null,
    'parallel_results','{}'::jsonb,'started_at',clock_timestamp()
  );

  if v_team_mode='SIMULTANEOUS' then
    v_start:=case when random()<0.5 then v_a else v_b end;
    v_start2:=case when random()<0.5 then v_a else v_b end;
    v_sub1:=private.tic_tac_toe_new_board(v_a,v_b,v_actor_a,v_actor_b,v_start,null);
    v_sub2:=private.tic_tac_toe_new_board(v_a,v_b,v_actor_a2,v_actor_b2,v_start2,null);
    v_state:=v_state||jsonb_build_object('phase','PARALLEL_PLAYING','subgames',jsonb_build_object('1',v_sub1,'2',v_sub2));
  else
    v_start:=case when random()<0.5 then v_a else v_b end;
    v_state:=v_state||jsonb_build_object(
      'phase','PLAYING',
      'board_state',private.tic_tac_toe_new_board(v_a,v_b,v_actor_a,v_actor_b,v_start,null)
    );
  end if;

  update public.in_app_team_mode_configs set locked_at=now(),updated_at=now() where session_id=p_session_id;
  update public.in_app_game_sessions
  set status='ACTIVE',state_json=v_state,started_at=coalesce(started_at,now()),version=version+1,updated_at=now()
  where session_id=p_session_id;
  update public.in_app_game_session_players
  set status='PLAYING',connected_at=coalesce(connected_at,now()),updated_at=now()
  where session_id=p_session_id;

  return jsonb_build_object('accepted',true,'session_id',p_session_id,'status','ACTIVE','team_mode',v_team_mode,'variant',v_variant);
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_tic_tac_toe_move(p_session_id uuid, p_cell_index integer, p_client_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_uid uuid:=private.request_user_id();
  v_status text;
  v_state jsonb;
  v_phase text;
  v_variant text;
  v_team_mode text;
  v_member uuid;
  v_pid uuid;
  v_board jsonb;
  v_apply jsonb;
  v_subkey text;
  v_sub1 jsonb;
  v_sub2 jsonb;
  v_w1 uuid;
  v_w2 uuid;
  v_winner uuid;
  v_result jsonb;
  v_response jsonb;
  v_existing jsonb;
  v_cursor jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_client_action_id is null then raise exception 'CLIENT_ACTION_ID_REQUIRED'; end if;

  select s.status,s.state_json into v_status,v_state
  from public.in_app_game_sessions s
  join public.in_app_game_definitions d on d.game_definition_id=s.game_definition_id and d.game_key='tic_tac_toe'
  where s.session_id=p_session_id
  for update of s;
  if v_status is null then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;

  select a.server_result_json into v_existing
  from public.in_app_game_actions a
  where a.session_id=p_session_id
    and a.action_type='TIC_TAC_TOE_MOVE'
    and a.payload_json->>'client_action_id'=p_client_action_id::text
  order by a.created_at limit 1;
  if v_existing is not null then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  if v_status<>'ACTIVE' then raise exception 'TIC_TAC_TOE_SESSION_NOT_ACTIVE'; end if;
  perform private.resolve_tic_tac_toe_decider_timeout(p_session_id);
  select status,state_json into v_status,v_state from public.in_app_game_sessions where session_id=p_session_id;
  if v_status<>'ACTIVE' then
    return jsonb_build_object('accepted',false,'complete',true,'reason','DECIDER_TIMEOUT');
  end if;

  select sp.tournament_member_id,sp.participant_id into v_member,v_pid
  from public.in_app_game_session_players sp
  join public.tournament_members tm on tm.tournament_member_id=sp.tournament_member_id
  where sp.session_id=p_session_id and tm.user_id=v_uid and tm.left_at is null
  limit 1;
  if v_member is null then raise exception 'NOT_ASSIGNED_TO_SESSION'; end if;

  v_phase:=v_state->>'phase';
  v_variant:=upper(v_state->>'variant');
  v_team_mode:=upper(v_state->>'team_mode');
  v_cursor:=coalesce(v_state->'member_cursor','{}'::jsonb);

  if v_phase='PLAYING' then
    v_board:=v_state->'board_state';
    v_apply:=private.tic_tac_toe_apply_move(
      v_board,v_pid,v_member,p_cell_index,v_variant,
      v_team_mode='ALTERNATING',
      coalesce(v_state->'member_order','{}'::jsonb),
      v_cursor,
      null
    );
    v_state:=jsonb_set(v_state,array['board_state'],v_apply->'board_state',true);
    v_state:=jsonb_set(v_state,array['member_cursor'],v_apply->'member_cursor',true);
    v_state:=jsonb_set(v_state,array['moves_total'],to_jsonb(coalesce((v_state->>'moves_total')::integer,0)+1),true);

    if coalesce((v_apply->>'complete')::boolean,false) then
      v_winner:=(v_apply->>'winner_participant_id')::uuid;
      v_result:=private.finalize_tic_tac_toe_match_session(p_session_id,v_state,v_winner,'WIN');
      v_response:=jsonb_build_object('accepted',true,'complete',true,'result',v_result);
    else
      update public.in_app_game_sessions set state_json=v_state,version=version+1,updated_at=now() where session_id=p_session_id;
      v_response:=jsonb_build_object('accepted',true,'complete',false,'draw',coalesce((v_apply->>'draw')::boolean,false));
    end if;

  elsif v_phase='PARALLEL_PLAYING' then
    for v_subkey in select unnest(array['1','2']) loop
      v_board:=v_state->'subgames'->v_subkey;
      if v_board->'actors'->>v_pid::text=v_member::text then exit; end if;
      v_board:=null;
    end loop;
    if v_board is null then raise exception 'PLAYER_NOT_ASSIGNED_TO_PARALLEL_DUEL'; end if;

    v_apply:=private.tic_tac_toe_apply_move(
      v_board,v_pid,v_member,p_cell_index,v_variant,false,'{}'::jsonb,'{}'::jsonb,null
    );
    v_state:=jsonb_set(v_state,array['subgames',v_subkey],v_apply->'board_state',true);
    v_state:=jsonb_set(v_state,array['moves_total'],to_jsonb(coalesce((v_state->>'moves_total')::integer,0)+1),true);

    if coalesce((v_apply->>'complete')::boolean,false) then
      v_state:=jsonb_set(v_state,array['parallel_results',v_subkey],to_jsonb(v_apply->>'winner_participant_id'),true);
    end if;

    v_w1:=nullif(v_state->'parallel_results'->>'1','')::uuid;
    v_w2:=nullif(v_state->'parallel_results'->>'2','')::uuid;

    if v_w1 is not null and v_w2 is not null then
      if v_w1=v_w2 then
        v_result:=private.finalize_tic_tac_toe_match_session(p_session_id,v_state,v_w1,'PARALLEL_2_0');
        v_response:=jsonb_build_object('accepted',true,'complete',true,'result',v_result);
      else
        delete from public.in_app_team_lineups where session_id=p_session_id and lineup_role='DECIDER';
        v_state:=jsonb_set(v_state,array['phase'],'"DECIDER_SELECTION"'::jsonb,true);
        update public.in_app_game_sessions set state_json=v_state,version=version+1,updated_at=now() where session_id=p_session_id;
        v_response:=jsonb_build_object('accepted',true,'complete',false,'decider_required',true);
      end if;
    else
      update public.in_app_game_sessions set state_json=v_state,version=version+1,updated_at=now() where session_id=p_session_id;
      v_response:=jsonb_build_object('accepted',true,'complete',false,'duel',v_subkey);
    end if;

  elsif v_phase='DECIDER_PLAYING' then
    v_board:=v_state->'decider';
    v_apply:=private.tic_tac_toe_apply_move(
      v_board,v_pid,v_member,p_cell_index,v_variant,false,'{}'::jsonb,'{}'::jsonb,5
    );
    v_state:=jsonb_set(v_state,array['decider'],v_apply->'board_state',true);
    v_state:=jsonb_set(v_state,array['moves_total'],to_jsonb(coalesce((v_state->>'moves_total')::integer,0)+1),true);

    if coalesce((v_apply->>'complete')::boolean,false) then
      v_winner:=(v_apply->>'winner_participant_id')::uuid;
      v_result:=private.finalize_tic_tac_toe_match_session(p_session_id,v_state,v_winner,'DECIDER_WIN');
      v_response:=jsonb_build_object('accepted',true,'complete',true,'result',v_result);
    else
      update public.in_app_game_sessions set state_json=v_state,version=version+1,updated_at=now() where session_id=p_session_id;
      v_response:=jsonb_build_object('accepted',true,'complete',false,'decider',true,'draw',coalesce((v_apply->>'draw')::boolean,false));
    end if;
  else
    raise exception 'TIC_TAC_TOE_NOT_ACCEPTING_MOVES';
  end if;

  insert into public.in_app_game_actions(
    session_id,tournament_member_id,action_type,payload_json,accepted,server_result_json
  )
  values(
    p_session_id,v_member,'TIC_TAC_TOE_MOVE',
    jsonb_build_object('cell_index',p_cell_index,'client_action_id',p_client_action_id::text,'phase',v_phase),
    true,v_response
  );

  return v_response;
end;
$function$;
revoke all on function public.submit_tic_tac_toe_move(uuid,integer,uuid) from public,anon;
grant execute on function public.submit_tic_tac_toe_move(uuid,integer,uuid) to authenticated,service_role;

-- Restore only affected catalog metadata, never historical session results.
update public.in_app_game_definitions set config_json='{"variants":["NORMAL","DISAPPEAR"],"team_size":2,"team_modes":["ALTERNATING","SELECTED_PLAYER","SIMULTANEOUS"],"mobile_first":true,"rules_version":2,"variant_default":"NORMAL","participant_mode":"BOTH","individual_devices":true,"decider_turn_seconds":5,"variant_locked_after":"FIRST_MOVE","require_variant_selection":true,"disappear_max_active_marks":3,"variant_selection_authority":"TOURNAMENT_ADMIN"}'::jsonb,updated_at=now() where game_key='tic_tac_toe';
update public.available_games set rule_version=2,rules_json='{"teamPlay":{"decider":{"trigger":"PARALLEL_SPLIT_1_1","selection":"ONE_PLAYER_PER_TEAM","timeoutResult":"OPPONENT_WINS","turnTimeSeconds":5},"teamSize":2,"supported":true,"supportedModes":["ALTERNATING","SELECTED_PLAYER","SIMULTANEOUS"],"selectedPlayerAuthority":"TEAM"},"turnMode":"SEQUENTIAL","variants":["NORMAL","DISAPPEAR"],"boardSize":3,"normalDraw":"NEW_BOARD_ALTERNATE_STARTER","participants":2,"resultEntity":"PARTICIPANT","rulesVersion":2,"participantMode":"BOTH","primaryScoreType":"WIN_POINTS","variantSelection":"TOURNAMENT_ADMIN","disappearWinCheck":"AFTER_OLDEST_MARK_REMOVAL","variantLockedAfter":"FIRST_MOVE","playersPerParticipant":1,"primaryScoreDirection":"HIGHER_IS_BETTER","disappearMaxActiveMarks":3}'::jsonb,rules_text='Zwei Player spielen abwechselnd auf einem 3×3-Feld. NORMAL nutzt die klassischen Regeln. In DISAPPEAR bleiben pro Player maximal drei eigene Symbole aktiv; beim Setzen des vierten verschwindet das älteste eigene Symbol, danach wird der Sieg geprüft.',updated_at=now() where game_id='game.tictactoe.classic_disappear';
