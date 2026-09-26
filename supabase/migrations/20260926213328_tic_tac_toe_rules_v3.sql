-- TicTacToe v3; stop active v2 games before deployment rather than rewriting them.
do $$ begin
 if exists(select 1 from public.in_app_game_sessions s join public.in_app_game_definitions d using(game_definition_id)
 where d.game_key='tic_tac_toe' and s.status='ACTIVE') then
 raise exception 'Finish active TicTacToe sessions before applying rules v3'; end if;
end $$;
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
  if coalesce(p_deadline_seconds,0) not in (0,3,5,7) then raise exception 'INVALID_TURN_SECONDS'; end if;
  return jsonb_build_object(
    'rules_version',3,'round_number',1,'round_results','[]'::jsonb,
    'match_points',jsonb_build_object(p_participant_a::text,0,p_participant_b::text,0),
    'overtime_block',0,'turn_seconds',coalesce(p_deadline_seconds,0),
    'transition',jsonb_build_object('kind','START','participant_id',p_starting_participant,'starts_at',clock_timestamp(),'ends_at',clock_timestamp()+interval '2 seconds'),
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
$function$
;

-- Pure round accounting shared by normal, parallel and decider boards.
create or replace function private.tic_tac_toe_finish_round(b jsonb, winner uuid, cells jsonb)
returns jsonb language plpgsql set search_path = pg_catalog, public as $$
declare
  ids text[]; r int:=(b->>'round_number')::int; points jsonb:=b->'match_points';
  results jsonb; leader text; trailer text; best int:=0; i int; next_starter text;
  duel_winner text; w1 text; w2 text; reason text;
begin
  select array_agg(key order by key) into ids from jsonb_object_keys(b->'symbols') key;
  if winner is not null then
    points:=jsonb_set(points,array[winner::text],to_jsonb((points->>winner::text)::int+
      case when winner::text=b->>'starting_participant_id' then 1 else 2 end));
  end if;
  results:=(b->'round_results')||jsonb_build_array(jsonb_build_object(
    'round',r,'starter',b->>'starting_participant_id','winner',winner,'tie',winner is null,
    'match_points',case when winner is null then 0 when winner::text=b->>'starting_participant_id' then 1 else 2 end));
  if r<=4 then
    leader:=case when (points->>ids[1])::int>(points->>ids[2])::int then ids[1] else ids[2] end;
    trailer:=case when leader=ids[1] then ids[2] else ids[1] end;
    for i in 1..(4-r) loop
      next_starter:=case when i%2=0 then b->>'starting_participant_id'
        when b->>'starting_participant_id'=ids[1] then ids[2] else ids[1] end;
      best:=best+case when next_starter=trailer then 1 else 2 end;
    end loop;
    if (points->>leader)::int>(points->>trailer)::int+best then
      duel_winner:=leader; reason:=case when r<4 then 'EARLY_CLINCH' else 'REGULATION' end;
    end if;
  elsif r%2=0 then
    w1:=results->(r-2)->>'winner'; w2:=results->(r-1)->>'winner';
    if w1 is not null and (w2 is null or w1=w2) then duel_winner:=w1;
    elsif w1 is null and w2 is not null then duel_winner:=w2; end if;
    if duel_winner is not null then reason:='OVERTIME'; end if;
  end if;
  return b||jsonb_build_object('match_points',points,'round_results',results,
    'winning_cells',coalesce(cells,'[]'::jsonb),'round_winner',winner,
    'winner_participant_id',duel_winner,'completion_reason',reason,'turn_deadline_at',null,
    'transition',jsonb_build_object('kind',case when winner is null then 'TIE' else 'WIN' end,
      'participant_id',winner,'starts_at',clock_timestamp(),'ends_at',clock_timestamp()+interval '2 seconds'));
end;
$$;

-- Advance only from persisted timestamps. Refresh cannot restart an overlay.
create or replace function private.tic_tac_toe_advance_board(b jsonb)
returns jsonb language plpgsql set search_path = pg_catalog, public as $$
declare
  t jsonb; at_time timestamptz; ids text[]; starter text; r int; fresh jsonb; i int;
begin
  for i in 1..4 loop
    t:=b->'transition';
    if t is null or t='null'::jsonb then exit; end if;
    at_time:=(t->>'ends_at')::timestamptz;
    if clock_timestamp()<at_time then exit; end if;
    if t->>'kind'='START' then
      b:=b||jsonb_build_object('transition',null);
    elsif t->>'kind'='OVERTIME' then
      b:=b||jsonb_build_object('transition',jsonb_build_object('kind','START',
        'participant_id',b->>'starting_participant_id','starts_at',at_time,'ends_at',at_time+interval '2 seconds'));
    elsif b->>'winner_participant_id' is not null then
      b:=b||jsonb_build_object('status','COMPLETE','transition',null);
    else
      select array_agg(key order by key) into ids from jsonb_object_keys(b->'symbols') key;
      starter:=case when b->>'starting_participant_id'=ids[1] then ids[2] else ids[1] end;
      r:=(b->>'round_number')::int+1;
      fresh:=private.tic_tac_toe_new_board(ids[1]::uuid,ids[2]::uuid,
        (b->'actors'->>ids[1])::uuid,(b->'actors'->>ids[2])::uuid,starter::uuid,(b->>'turn_seconds')::int);
      b:=fresh||jsonb_build_object('round_number',r,'board_index',r,'symbols',b->'symbols',
        'round_results',b->'round_results','match_points',b->'match_points',
        'overtime_block',greatest(0,(r-3)/2),'transition',jsonb_build_object(
          'kind',case when r>4 and r%2=1 then 'OVERTIME' else 'START' end,
          'participant_id',starter,'starts_at',at_time,'ends_at',at_time+interval '2 seconds'));
    end if;
  end loop;
  return b;
end;
$$;

-- Standalone's deliberately weak timeout policy, including DISAPPEAR removal.
create or replace function private.tic_tac_toe_preview_move(b jsonb, pid text, cell int, variant text)
returns jsonb language plpgsql set search_path = pg_catalog, public as $$
declare board jsonb:=b->'board'; q jsonb;
begin
  board:=jsonb_set(board,array[cell::text],to_jsonb(pid));
  q:=coalesce(b->'active_mark_order'->pid,'[]'::jsonb)||to_jsonb(cell);
  if variant='DISAPPEAR' and jsonb_array_length(q)>3 then
    board:=jsonb_set(board,array[q->>0],'null'::jsonb); q:=q-0;
  end if;
  return jsonb_set(b||jsonb_build_object('board',board),array['active_mark_order',pid],q);
end;
$$;

create or replace function private.tic_tac_toe_worst_move(b jsonb, variant text)
returns int language plpgsql set search_path = pg_catalog, public as $$
declare
  pid text:=b->>'current_turn_participant_id'; other text; i int; j int;
  candidate jsonb; reply jsonb; score int; minimum int:=2147483647; choices int[]:='{}';
begin
  select key into other from jsonb_object_keys(b->'symbols') key where key<>pid;
  for i in 0..8 loop
    if b->'board'->>i is not null then continue; end if;
    candidate:=private.tic_tac_toe_preview_move(b,pid,i,variant);
    score:=case when i=4 then 30 when i in (0,2,6,8) then 15 else 5 end;
    if private.tic_tac_toe_winner(candidate->'board')::text=pid then score:=1000;
    else
      for j in 0..8 loop
        if candidate->'board'->>j is not null then continue; end if;
        reply:=private.tic_tac_toe_preview_move(candidate,other,j,variant);
        if private.tic_tac_toe_winner(reply->'board')::text=other then score:=score-500; exit; end if;
      end loop;
    end if;
    if score<minimum then minimum:=score; choices:=array[i];
    elsif score=minimum then choices:=array_append(choices,i); end if;
  end loop;
  return choices[1+floor(random()*array_length(choices,1))::int];
end;
$$;

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
  if p_board_state->>'status'<>'PLAYING' or p_board_state->'transition' is distinct from 'null'::jsonb and p_board_state ? 'transition'
    then raise exception 'TIC_TAC_TOE_TRANSITION_ACTIVE'; end if;
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


  select count(*) into v_empty from jsonb_array_elements(v_board) e(value) where e.value='null'::jsonb;
  v_draw:=upper(p_variant)='NORMAL' and v_empty=0 and v_win is null;
  p_board_state:=p_board_state||jsonb_build_object('last_move',p_cell_index,'turn_deadline_at',null);
  if v_win is not null or v_draw then
    p_board_state:=private.tic_tac_toe_finish_round(p_board_state,v_win,v_cells);
  else
    p_board_state:=p_board_state||jsonb_build_object(
      'current_turn_participant_id',v_other,
      'current_actor_member_id',v_actor_map->>v_other::text,
      'turn_deadline_at',case when coalesce((p_board_state->>'turn_seconds')::int,0)>0
        then clock_timestamp()+make_interval(secs=>(p_board_state->>'turn_seconds')::int) else null end);
  end if;
  return jsonb_build_object('board_state',p_board_state,'member_cursor',v_cursor,
    'complete',false,'draw',v_draw,'winner_participant_id',null);
end;
$function$;

-- Persist and route completed duels through the existing tournament finalizer.
create or replace function private.tic_tac_toe_store_state(sid uuid, s jsonb)
returns void language plpgsql set search_path = pg_catalog, public as $$
declare w1 text; w2 text; b jsonb;
begin
  if s->>'phase' in ('PLAYING','DECIDER_PLAYING') then
    b:=case when s->>'phase'='PLAYING' then s->'board_state' else s->'decider' end;
    if b->>'status'='COMPLETE' then
      perform private.finalize_tic_tac_toe_match_session(sid,s,(b->>'winner_participant_id')::uuid,
        case when s->>'phase'='PLAYING' then b->>'completion_reason' else 'DECIDER_'||(b->>'completion_reason') end);
      return;
    end if;
  elsif s->>'phase'='PARALLEL_PLAYING' then
    if s->'subgames'->'1'->>'status'='COMPLETE' then w1:=s->'subgames'->'1'->>'winner_participant_id'; end if;
    if s->'subgames'->'2'->>'status'='COMPLETE' then w2:=s->'subgames'->'2'->>'winner_participant_id'; end if;
    s:=s||jsonb_build_object('parallel_results',jsonb_strip_nulls(jsonb_build_object('1',w1,'2',w2)));
    if w1 is not null and w2 is not null then
      if w1=w2 then
        perform private.finalize_tic_tac_toe_match_session(sid,s,w1::uuid,'PARALLEL_2_0'); return;
      else
        delete from public.in_app_team_lineups where session_id=sid and lineup_role='DECIDER';
        s:=s||jsonb_build_object('phase','DECIDER_SELECTION');
      end if;
    end if;
  end if;
  update public.in_app_game_sessions set state_json=s,version=version+1,updated_at=now() where session_id=sid;
end;
$$;

-- Kept at the existing internal entry point so every state read/move advances time.
-- A timeout is one weak legal move, never a forfeit. Row locking prevents duplicates.
create or replace function private.resolve_tic_tac_toe_decider_timeout(p_session_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare s jsonb; old_s jsonb; st text; path text[]; paths text[]; k text; b jsonb; a jsonb; cell int;
begin
  select status,state_json into st,s from public.in_app_game_sessions where session_id=p_session_id for update;
  if st<>'ACTIVE' then return false; end if;
  old_s:=s;
  paths:=case s->>'phase' when 'PLAYING' then array['board_state']
    when 'DECIDER_PLAYING' then array['decider'] when 'PARALLEL_PLAYING' then array['1','2'] else array[]::text[] end;
  foreach k in array paths loop
    path:=case when k in ('1','2') then array['subgames',k] else array[k] end;
    b:=private.tic_tac_toe_advance_board(s#>path);
    if b->>'status'='PLAYING' and (b->'transition' is null or b->'transition'='null'::jsonb)
      and nullif(b->>'turn_deadline_at','')::timestamptz<=clock_timestamp() then
      cell:=private.tic_tac_toe_worst_move(b,s->>'variant');
      a:=private.tic_tac_toe_apply_move(b,(b->>'current_turn_participant_id')::uuid,
        (b->>'current_actor_member_id')::uuid,cell,s->>'variant',s->>'team_mode'='ALTERNATING',
        coalesce(s->'member_order','{}'::jsonb),coalesce(s->'member_cursor','{}'::jsonb),(b->>'turn_seconds')::int);
      b:=(a->'board_state')||jsonb_build_object('last_move_source','TIMEOUT');
      if s->>'team_mode'='ALTERNATING' then s:=jsonb_set(s,array['member_cursor'],a->'member_cursor'); end if;
      s:=s||jsonb_build_object('moves_total',coalesce((s->>'moves_total')::int,0)+1);
    end if;
    s:=jsonb_set(s,path,b);
  end loop;
  if s is distinct from old_s then perform private.tic_tac_toe_store_state(p_session_id,s); return true; end if;
  return false;
end;
$$;

drop function public.submit_tic_tac_toe_move(uuid,integer,uuid);
create function public.submit_tic_tac_toe_move(
 p_session_id uuid,p_cell_index integer,p_client_action_id uuid,
 p_expected_round integer default null,p_expected_move integer default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare uid uuid:=private.request_user_id(); member uuid; pid uuid; s jsonb; st text;
  existing jsonb; b jsonb; a jsonb; path text[]; k text; response jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_client_action_id is null then raise exception 'CLIENT_ACTION_ID_REQUIRED'; end if;
  select sp.tournament_member_id,sp.participant_id into member,pid
    from public.in_app_game_session_players sp join public.tournament_members tm using(tournament_member_id)
    where sp.session_id=p_session_id and tm.user_id=uid and tm.left_at is null limit 1;
  if member is null then raise exception 'NOT_ASSIGNED_TO_SESSION'; end if;
  select gs.status,gs.state_json into st,s from public.in_app_game_sessions gs
    join public.in_app_game_definitions d using(game_definition_id)
    where gs.session_id=p_session_id and d.game_key='tic_tac_toe' for update of gs;
  if st is null then raise exception 'TIC_TAC_TOE_SESSION_NOT_FOUND'; end if;
  select server_result_json into existing from public.in_app_game_actions
    where session_id=p_session_id and action_type='TIC_TAC_TOE_MOVE'
    and payload_json->>'client_action_id'=p_client_action_id::text limit 1;
  if existing is not null then return existing||jsonb_build_object('idempotent_replay',true); end if;
  if st<>'ACTIVE' then return jsonb_build_object('accepted',false,'reason','SESSION_NOT_ACTIVE'); end if;
  perform private.resolve_tic_tac_toe_decider_timeout(p_session_id);
  select status,state_json into st,s from public.in_app_game_sessions where session_id=p_session_id;
  if st<>'ACTIVE' then return jsonb_build_object('accepted',false,'reason','SESSION_COMPLETE'); end if;
  if s->>'phase'='PLAYING' then path:=array['board_state'];
  elsif s->>'phase'='DECIDER_PLAYING' then path:=array['decider'];
  elsif s->>'phase'='PARALLEL_PLAYING' then
    foreach k in array array['1','2'] loop
      if s->'subgames'->k->'actors'->>pid::text=member::text then path:=array['subgames',k]; exit; end if;
    end loop;
  end if;
  if path is null then return jsonb_build_object('accepted',false,'reason','NOT_ACCEPTING_MOVES'); end if;
  b:=s#>path;
  -- Return rather than raise after ticking: an expired deadline must remain persisted.
  if p_expected_round is distinct from (b->>'round_number')::int
    or p_expected_move is distinct from (b->>'board_move_no')::int
    or b->>'status'<>'PLAYING' or b->'transition' is distinct from 'null'::jsonb
    or b->>'current_actor_member_id'<>member::text then
    return jsonb_build_object('accepted',false,'reason','STALE_BOARD');
  end if;
  if p_cell_index is null or p_cell_index not between 0 and 8 or b->'board'->>p_cell_index is not null then
    return jsonb_build_object('accepted',false,'reason','INVALID_CELL');
  end if;
  a:=private.tic_tac_toe_apply_move(b,pid,member,p_cell_index,s->>'variant',
    s->>'team_mode'='ALTERNATING',coalesce(s->'member_order','{}'::jsonb),
    coalesce(s->'member_cursor','{}'::jsonb),(b->>'turn_seconds')::int);
  s:=jsonb_set(s,path,(a->'board_state')||jsonb_build_object('last_move_source','PLAYER'));
  if s->>'team_mode'='ALTERNATING' then s:=jsonb_set(s,array['member_cursor'],a->'member_cursor'); end if;
  s:=s||jsonb_build_object('moves_total',coalesce((s->>'moves_total')::int,0)+1);
  perform private.tic_tac_toe_store_state(p_session_id,s);
  response:=jsonb_build_object('accepted',true);
  insert into public.in_app_game_actions(session_id,tournament_member_id,action_type,payload_json,accepted,server_result_json)
    values(p_session_id,member,'TIC_TAC_TOE_MOVE',
      jsonb_build_object('cell_index',p_cell_index,'client_action_id',p_client_action_id,'phase',s->>'phase',
        'round',p_expected_round,'move',p_expected_move),true,response);
  return response;
end;
$$;
revoke all on function public.submit_tic_tac_toe_move(uuid,integer,uuid,integer,integer) from public,anon;
grant execute on function public.submit_tic_tac_toe_move(uuid,integer,uuid,integer,integer) to authenticated,service_role;

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
    'game_key','tic_tac_toe','rules_version',3,'variant',v_variant,'team_mode',v_team_mode,
    'tournament_mode',v_tournament_mode,'participant_order',jsonb_build_array(v_a::text,v_b::text),
    'member_order',jsonb_build_object(v_a::text,v_members_a,v_b::text,v_members_b),
    'member_cursor',jsonb_build_object(v_a::text,0,v_b::text,0),
    'turn_seconds',coalesce((select (public_state_json->>'tic_tac_toe_turn_seconds')::int from public.in_app_game_sessions where session_id=p_session_id),0),
    'moves_total',0,'winner_participant_id',null,'completion_reason',null,
    'parallel_results','{}'::jsonb,'started_at',clock_timestamp()
  );

  if v_team_mode='SIMULTANEOUS' then
    v_start:=case when random()<0.5 then v_a else v_b end;
    v_start2:=case when random()<0.5 then v_a else v_b end;
    v_sub1:=private.tic_tac_toe_new_board(v_a,v_b,v_actor_a,v_actor_b,v_start,(v_state->>'turn_seconds')::int);
    v_sub2:=private.tic_tac_toe_new_board(v_a,v_b,v_actor_a2,v_actor_b2,v_start2,(v_state->>'turn_seconds')::int);
    v_state:=v_state||jsonb_build_object('phase','PARALLEL_PLAYING','subgames',jsonb_build_object('1',v_sub1,'2',v_sub2));
  else
    v_start:=case when random()<0.5 then v_a else v_b end;
    v_state:=v_state||jsonb_build_object(
      'phase','PLAYING',
      'board_state',private.tic_tac_toe_new_board(v_a,v_b,v_actor_a,v_actor_b,v_start,(v_state->>'turn_seconds')::int)
    );
  end if;

  update public.in_app_team_mode_configs set locked_at=now(),updated_at=now() where session_id=p_session_id;
  update public.tournament_games set game_rule_version=3,
    game_rules_snapshot=(select rules_json from public.available_games where game_id='game.tictactoe.classic_disappear')
  where tournament_game_id=v_tgid;
  update public.in_app_game_sessions
  set status='ACTIVE',state_json=v_state,started_at=coalesce(started_at,now()),version=version+1,updated_at=now()
  where session_id=p_session_id;
  update public.in_app_game_session_players
  set status='PLAYING',connected_at=coalesce(connected_at,now()),updated_at=now()
  where session_id=p_session_id;

  return jsonb_build_object('accepted',true,'session_id',p_session_id,'status','ACTIVE','team_mode',v_team_mode,'variant',v_variant);
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
      private.tic_tac_toe_new_board(v_a,v_b,v_actor_a,v_actor_b,v_start,(v_state->>'turn_seconds')::int),
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
        'tic_tac_toe_rules_version',3,
        'variant_selected_at',clock_timestamp()::text
      ),
      state_json='{}'::jsonb,
      result_json=null,
      version=version+1,
      updated_at=now()
  where session_id=p_session_id;

  return jsonb_build_object('accepted',true,'variant',v_variant,'rules_version',3);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_tic_tac_toe_timer(p_session_id uuid, p_turn_seconds integer)
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
  
  v_rep_count integer:=0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_turn_seconds is null or p_turn_seconds not in (0,3,5,7) then raise exception 'INVALID_TURN_SECONDS'; end if;

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
        'tic_tac_toe_turn_seconds',p_turn_seconds,
        'tic_tac_toe_rules_version',3,
        'timer_selected_at',clock_timestamp()::text
      ),
      state_json='{}'::jsonb,
      result_json=null,
      version=version+1,
      updated_at=now()
  where session_id=p_session_id;

  return jsonb_build_object('accepted',true,'turn_seconds',p_turn_seconds,'rules_version',3);
end;
$function$;
revoke all on function public.set_tic_tac_toe_timer(uuid,integer) from public,anon;
grant execute on function public.set_tic_tac_toe_timer(uuid,integer) to authenticated,service_role;

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
    'turn_seconds',coalesce((select (public_state_json->>'tic_tac_toe_turn_seconds')::int from public.in_app_game_sessions where session_id=p_session_id),0),
    'rules_version',3,'version',v_version,'players',v_players,'lineups',v_lineups,
    'viewer',jsonb_build_object('tournament_member_id',v_member,'participant_id',v_pid,'is_admin',private.in_app_is_admin(v_tid),'my_subgame',v_my_subgame),
    'can_start',v_can_start,'state',coalesce(v_state,'{}'::jsonb),'result',v_result,'server_now',clock_timestamp()
  );
end;
$function$;

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
    'rules_version',3,
    'result_version',3,
    'variant',v_variant,
    'team_mode',v_team_mode,
    'completion_reason',coalesce(p_completion_reason,'WIN'),
    'winner_participant_id',p_winner_participant_id::text,
    'moves_total',v_moves,
    'final_board_moves',v_board_moves,
    'duel_results',jsonb_strip_nulls(jsonb_build_object('main',p_state->'board_state','subgames',p_state->'subgames','decider',p_state->'decider')),
    'turn_seconds',p_state->'turn_seconds',
    'match_points',coalesce(p_state->'decider'->'match_points',p_state->'board_state'->'match_points','{}'::jsonb),
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
      'rules_version',3,
      'result_version',3,
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

-- Internal helpers are never public RPCs.
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
      'rules_version',3,
      'tic_tac_toe_turn_seconds',0
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
$function$
;

-- Catalog metadata must describe the engine, including the decider.
update public.in_app_game_definitions
set config_json=(coalesce(config_json,'{}'::jsonb)-'decider_turn_seconds')||
  jsonb_build_object('rules_version',3,'result_version',3,'regular_rounds',4,
    'turn_seconds_options',jsonb_build_array(0,3,5,7),'variant_locked_after','MATCH_START'),
  updated_at=now()
where game_key='tic_tac_toe';
update public.available_games
set rule_version=3,
 rules_json=jsonb_set(coalesce(rules_json,'{}'::jsonb)||jsonb_build_object(
   'rulesVersion',3,'resultVersion',3,'regularRounds',4,'earlyClinch',true,
   'normalDraw','TIE_ROUND_ALTERNATE_STARTER','variantLockedAfter','MATCH_START',
   'overtime','COMPLETE_TWO_ROUND_BLOCKS_BY_WINS',
   'matchPoints',jsonb_build_object('starterWin',1,'opponentStartWin',2),
   'timer',jsonb_build_object('options',jsonb_build_array(0,3,5,7),'firstMoveUntimed',true,
     'authority','SERVER','timeoutResult','WORST_LEGAL_MOVE')
 ),array['teamPlay'],coalesce(rules_json->'teamPlay','{}'::jsonb)||jsonb_build_object(
   'decider',jsonb_build_object('trigger','PARALLEL_SPLIT_1_1','selection','ONE_PLAYER_PER_TEAM',
      'engine','SAME_FOUR_PLUS_ROUND_DUEL','timer','SHARED_MATCH_CONFIGURATION'))),
 rules_text='Direkte Duelle spielen 4+ Runden mit wechselndem Starter. Siege als Starter geben 1 Matchpunkt, sonst 2. Uneinholbarer Vorsprung entscheidet vorzeitig. Gleichstand nach Runde 4 führt zu vollständigen Overtime-Zweierblöcken: zwei Siege oder Sieg plus TIE entscheiden; geteilte Siege und zwei TIEs verlängern. NORMAL und DISAPPEAR (maximal drei eigene Steine) nutzen dieselbe Engine. Timer AUS/3/5/7: erster Zug jeder Runde unbefristet, Timeout setzt einen schwachen legalen Zug. Matchpunkte und Turnierpunkte sind getrennt.',
 updated_at=now()
where game_id='game.tictactoe.classic_disappear';

-- Internal helpers are never public RPCs.
revoke all on function private.tic_tac_toe_finish_round(jsonb,uuid,jsonb),
 private.tic_tac_toe_advance_board(jsonb),private.tic_tac_toe_preview_move(jsonb,text,integer,text),
 private.tic_tac_toe_worst_move(jsonb,text),private.tic_tac_toe_store_state(uuid,jsonb),
 private.resolve_tic_tac_toe_decider_timeout(uuid) from public,anon,authenticated;
