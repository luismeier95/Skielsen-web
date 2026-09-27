-- Block 2: Quick Games orchestration around the existing v3 duel engine.
-- The game row is the single lock for configuration, READY, moves and polling.
create function private.quick_ttt_lock(lid uuid)
returns private.quick_tic_tac_toe_games language plpgsql
set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_quick_game_lobby_member(lid,auth.uid()) then raise exception 'LOBBY_FORBIDDEN'; end if;
  select * into g from private.quick_tic_tac_toe_games where lobby_id=lid for update;
  if not found then raise exception 'QUICK_GAME_NOT_STARTED'; end if;
  if not exists(select 1 from jsonb_array_elements(g.players) p where p->>'user_id'=auth.uid()::text)
    then raise exception 'ROSTER_REQUIRED'; end if;
  return g;
end;
$$;

-- A regular bot prefers an immediate win, then avoids immediate opponent wins.
-- Timeout penalties still use tic_tac_toe_worst_move, including for bot actors.
create function private.quick_ttt_bot_move(b jsonb, variant text)
returns integer language plpgsql set search_path=pg_catalog,public,private as $$
declare pid text:=b->>'current_turn_participant_id'; other text; candidate jsonb;
  i int; j int; score int; best int:=-10000; choices int[]:=array[]::int[];
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
        if private.tic_tac_toe_winner(private.tic_tac_toe_preview_move(candidate,other,j,variant)->'board')::text=other
          then score:=score-500; exit; end if;
      end loop;
    end if;
    if score>best then best:=score; choices:=array[i];
    elsif score=best then choices:=array_append(choices,i); end if;
  end loop;
  return choices[1+floor(random()*array_length(choices,1))::int];
end;
$$;

-- Automatic representative only for teams containing no human player.
create function private.quick_ttt_bot_selections(roster jsonb, selections jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public,private as $$
declare p record;
begin
  for p in select x->>'participant_id' pid,
      (array_agg(x->>'tournament_member_id' order by (x->>'seat')::int))[1] actor
    from jsonb_array_elements(roster) x group by x->>'participant_id'
    having bool_and((x->>'is_bot')::boolean)
  loop
    if not selections ? p.pid then selections:=selections||jsonb_build_object(p.pid,p.actor); end if;
  end loop;
  return selections;
end;
$$;

-- Route completed boards and persist the final Quick result exactly once.
-- No tournament finalizer, ledger, joker or merge is called here.
create function private.quick_ttt_settle(lid uuid, s jsonb)
returns void language plpgsql set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype; winner text; a text; b text;
  picks jsonb; standings jsonb; result jsonb;
begin
  select * into g from private.quick_tic_tac_toe_games where lobby_id=lid for update;
  if g.result_json is not null then return; end if;
  if s->>'phase'='PARALLEL_PLAYING' and s->'subgames'->'1'->>'status'='COMPLETE'
      and s->'subgames'->'2'->>'status'='COMPLETE' then
    a:=s->'subgames'->'1'->>'winner_participant_id'; b:=s->'subgames'->'2'->>'winner_participant_id';
    s:=s||jsonb_build_object('parallel_results',jsonb_build_object('1',a,'2',b));
    if a=b then winner:=a;
    else s:=s||jsonb_build_object('phase','DECIDER_SELECTION','decider_selections',
      private.quick_ttt_bot_selections(g.players,'{}')); end if;
  end if;
  if s->>'phase'='DECIDER_SELECTION' then
    picks:=s->'decider_selections';
    if (select count(*) from jsonb_object_keys(picks))=2 then
      select value into a from jsonb_each_text(picks) order by key limit 1;
      select value into b from jsonb_each_text(picks) order by key desc limit 1;
      s:=s||jsonb_build_object('phase','DECIDER_PLAYING','decider',
        private.quick_tic_tac_toe_new_duel(g.players,a::uuid,b::uuid,(s->>'turn_seconds')::int));
    end if;
  end if;
  if s->>'phase'='PLAYING' and s->'board_state'->>'status'='COMPLETE' then winner:=s->'board_state'->>'winner_participant_id'; end if;
  if s->>'phase'='DECIDER_PLAYING' and s->'decider'->>'status'='COMPLETE' then winner:=s->'decider'->>'winner_participant_id'; end if;
  if winner is not null then
    s:=s||jsonb_build_object('phase','COMPLETE','winner_participant_id',winner);
    select jsonb_agg(jsonb_build_object('participant_id',pid,'display_name',name,'identity_color',color,
      'rank',case when pid=winner then 1 else 2 end) order by case when pid=winner then 1 else 2 end)
      into standings from (select x->>'participant_id' pid,max(x->>'team_name') name,max(x->>'identity_color') color
        from jsonb_array_elements(g.players) x group by x->>'participant_id') teams;
    result:=jsonb_build_object('rules_version',3,'result_version',3,'quick_game',true,
      'winner_participant_id',winner,'standings',standings,'completed_at',clock_timestamp(),
      'team_mode',s->'team_mode','variant',s->'variant','turn_seconds',s->'turn_seconds',
      'duel_results',jsonb_build_object('main',s->'board_state','subgames',s->'subgames','decider',s->'decider'),
      'match_points',jsonb_build_object('main',s->'board_state'->'match_points',
        '1',s->'subgames'->'1'->'match_points','2',s->'subgames'->'2'->'match_points',
        'decider',s->'decider'->'match_points'));
  end if;
  if s is distinct from g.state_json or result is not null then
    update private.quick_tic_tac_toe_games set state_json=s,phase=coalesce(s->>'phase',phase),
      result_json=result,revision=revision+1,updated_at=clock_timestamp() where lobby_id=lid;
  end if;
end;
$$;

-- At most one automatic move per board per request. Polling frequency cannot
-- accelerate bots: their next opportunity is a persisted server timestamp.
create function private.quick_ttt_tick(lid uuid)
returns void language plpgsql set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype; s jsonb; b jsonb; applied jsonb;
  path text[]; key text; keys text[]; bot boolean; cell int; expired boolean;
begin
  select * into g from private.quick_tic_tac_toe_games where lobby_id=lid for update;
  if g.result_json is not null or g.phase='SETUP' then return; end if;
  s:=g.state_json;
  keys:=case g.phase when 'PARALLEL_PLAYING' then array['1','2']
    when 'PLAYING' then array['board_state'] when 'DECIDER_PLAYING' then array['decider'] else array[]::text[] end;
  foreach key in array keys loop
    path:=case when g.phase='PARALLEL_PLAYING' then array['subgames',key] else array[key] end;
    b:=private.tic_tac_toe_advance_board(s#>path);
    if b->>'status'='PLAYING' and coalesce(b->'transition','null'::jsonb)='null'::jsonb then
      select (p->>'is_bot')::boolean into bot from jsonb_array_elements(g.players) p
        where p->>'tournament_member_id'=b->>'current_actor_member_id';
      expired:=nullif(b->>'turn_deadline_at','')::timestamptz<=clock_timestamp();
      if expired or (bot and coalesce(nullif(b->>'bot_due_at','')::timestamptz,'-infinity'::timestamptz)<=clock_timestamp()) then
        cell:=case when expired then private.tic_tac_toe_worst_move(b,s->>'variant')
          else private.quick_ttt_bot_move(b,s->>'variant') end;
        applied:=private.tic_tac_toe_apply_move(b,(b->>'current_turn_participant_id')::uuid,
          (b->>'current_actor_member_id')::uuid,cell,s->>'variant',s->>'team_mode'='ALTERNATING',
          s->'member_order',s->'member_cursor',(s->>'turn_seconds')::int);
        b:=applied->'board_state'||jsonb_build_object('bot_due_at',clock_timestamp()+interval '700 milliseconds');
        s:=s||jsonb_build_object('member_cursor',applied->'member_cursor','moves_total',coalesce((s->>'moves_total')::int,0)+1);
      end if;
    end if;
    s:=jsonb_set(s,path,b);
  end loop;
  perform private.quick_ttt_settle(lid,s);
end;
$$;

create function private.quick_ttt_view(p_lobby_id uuid)
returns jsonb language plpgsql set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype; s jsonb; me jsonb; host boolean; phase text;
  lineups jsonb; subgame text; all_ready boolean;
begin
  g:=private.quick_ttt_lock(p_lobby_id);
  s:=g.state_json; phase:=g.phase;
  select host_user_id=auth.uid() into host from public.quick_game_lobbies where lobby_id=p_lobby_id;
  select p into me from jsonb_array_elements(g.players) p where p->>'user_id'=auth.uid()::text;
  select bool_and(p->>'status'='READY') into all_ready from jsonb_array_elements(g.players) p;
  if phase='SETUP' then
    phase:=case when g.participant_mode='TEAM' and s->>'team_mode' is null then 'TEAM_MODE'
      when s->>'team_mode'='SELECTED_PLAYER' and (select count(*) from jsonb_object_keys(coalesce(s->'selections','{}')))<2 then 'PLAYER_SELECTION'
      when s->>'variant' is null then 'DIFFICULTY' else 'READY_TO_START' end;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('participant_id',p->'participant_id',
    'tournament_member_id',p->'tournament_member_id','display_name',p->'display_name',
    'lineup_role',sel.role,'lineup_slot',1)),'[]') into lineups
  from (select 'REPRESENTATIVE' role,value actor from jsonb_each_text(coalesce(s->'selections','{}'))
    union all select 'DECIDER',value from jsonb_each_text(coalesce(s->'decider_selections','{}'))) sel
  join jsonb_array_elements(g.players) p on p->>'tournament_member_id'=sel.actor;
  if phase='PARALLEL_PLAYING' then
    select key into subgame from jsonb_each(s->'subgames')
      where value->'actors'->>(me->>'participant_id')=me->>'tournament_member_id';
  end if;
  return jsonb_build_object('session_id',p_lobby_id,'quick_game',true,'phase',phase,
    'status',case when g.result_json is not null then 'FINISHED' when g.phase='SETUP' then 'WAITING_FOR_PLAYERS' else 'IN_PROGRESS' end,
    'tournament_mode',g.participant_mode,'team_mode',coalesce(s->>'team_mode',case when g.participant_mode='SOLO' then 'SOLO' end),
    'team_mode_options',jsonb_build_array('ALTERNATING','SELECTED_PLAYER','SIMULTANEOUS'),
    'variant',s->'variant','difficulty_options',jsonb_build_array('NORMAL','DISAPPEAR'),
    'turn_seconds',coalesce((s->>'turn_seconds')::int,0),'rules_version',3,'version',g.revision,
    'players',g.players,'lineups',lineups,'state',s,'result',g.result_json,
    'can_start',host and phase='READY_TO_START' and all_ready,
    'viewer',jsonb_build_object('tournament_member_id',me->'tournament_member_id',
      'participant_id',me->'participant_id','is_admin',host,'my_subgame',subgame),
    'server_now',clock_timestamp());
end;
$$;

create or replace function public.get_quick_tic_tac_toe_state(p_lobby_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  perform private.quick_ttt_lock(p_lobby_id);
  perform private.quick_ttt_tick(p_lobby_id);
  return private.quick_ttt_view(p_lobby_id);
end;
$$;

-- Incremental settings let the production UI retain its mode/difficulty steps.
-- Any effective settings change invalidates human READY acknowledgements.
create function public.configure_quick_tic_tac_toe(p_lobby_id uuid,p_team_mode text default null,
  p_variant text default null,p_turn_seconds int default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype; s jsonb; roster jsonb; mode text;
begin
  g:=private.quick_ttt_lock(p_lobby_id);
  if not exists(select 1 from public.quick_game_lobbies where lobby_id=p_lobby_id and host_user_id=auth.uid()) then raise exception 'HOST_REQUIRED'; end if;
  if g.phase<>'SETUP' then raise exception 'SETUP_CLOSED'; end if;
  s:=g.state_json; mode:=coalesce(p_team_mode,s->>'team_mode',case when g.participant_mode='SOLO' then 'SOLO' end);
  if mode is not null and ((g.participant_mode='SOLO' and mode<>'SOLO') or
    (g.participant_mode='TEAM' and mode not in ('ALTERNATING','SELECTED_PLAYER','SIMULTANEOUS'))) then raise exception 'INVALID_TEAM_MODE'; end if;
  if p_variant is not null and p_variant not in ('NORMAL','DISAPPEAR') then raise exception 'INVALID_VARIANT'; end if;
  if p_turn_seconds is not null and p_turn_seconds not in (0,3,5,7) then raise exception 'INVALID_TIMER'; end if;
  if mode is distinct from s->>'team_mode' then s:=s||jsonb_build_object('team_mode',mode,'selections','{}'::jsonb); end if;
  if mode='SELECTED_PLAYER' then s:=s||jsonb_build_object('selections',private.quick_ttt_bot_selections(g.players,coalesce(s->'selections','{}'))); end if;
  if p_variant is not null then s:=s||jsonb_build_object('variant',p_variant); end if;
  s:=s||jsonb_build_object('turn_seconds',coalesce(p_turn_seconds,(s->>'turn_seconds')::int,0));
  if s is distinct from g.state_json then
    select jsonb_agg(p||jsonb_build_object('status',case when (p->>'is_bot')::boolean then 'READY' else 'ASSIGNED' end)
      order by (p->>'seat')::int) into roster from jsonb_array_elements(g.players) p;
    update private.quick_tic_tac_toe_games set state_json=s,players=roster,revision=revision+1,updated_at=clock_timestamp() where lobby_id=p_lobby_id;
  end if;
  return public.get_quick_tic_tac_toe_state(p_lobby_id);
end;
$$;

create function public.select_quick_tic_tac_toe_player(p_lobby_id uuid,p_member_id uuid,p_selection text default 'MATCH')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype; me jsonb; chosen jsonb; s jsonb; field text; roster jsonb;
begin
  g:=private.quick_ttt_lock(p_lobby_id); s:=g.state_json;
  select p into me from jsonb_array_elements(g.players) p where p->>'user_id'=auth.uid()::text;
  select p into chosen from jsonb_array_elements(g.players) p where p->>'tournament_member_id'=p_member_id::text;
  if chosen is null or chosen->>'participant_id'<>me->>'participant_id' then raise exception 'OWN_TEAM_PLAYER_REQUIRED'; end if;
  if p_selection='MATCH' and g.phase='SETUP' and s->>'team_mode'='SELECTED_PLAYER' then field:='selections';
  elsif p_selection='DECIDER' and g.phase='DECIDER_SELECTION' then field:='decider_selections';
  else raise exception 'SELECTION_CLOSED'; end if;
  s:=jsonb_set(s,array[field],coalesce(s->field,'{}')||jsonb_build_object(me->>'participant_id',p_member_id));
  if s is distinct from g.state_json then
    if field='selections' then
      select jsonb_agg(p||jsonb_build_object('status',case when (p->>'is_bot')::boolean then 'READY' else 'ASSIGNED' end)
        order by (p->>'seat')::int) into roster from jsonb_array_elements(g.players) p;
      update private.quick_tic_tac_toe_games set players=roster where lobby_id=p_lobby_id;
    end if;
    perform private.quick_ttt_settle(p_lobby_id,s);
  end if;
  return public.get_quick_tic_tac_toe_state(p_lobby_id);
end;
$$;

create function public.ready_quick_tic_tac_toe(p_lobby_id uuid,p_ready boolean default true)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype; roster jsonb; v jsonb;
begin
  g:=private.quick_ttt_lock(p_lobby_id);
  if g.phase<>'SETUP' or p_ready is null then raise exception 'READY_CLOSED'; end if;
  v:=public.get_quick_tic_tac_toe_state(p_lobby_id);
  if v->>'phase'<>'READY_TO_START' then raise exception 'SETUP_INCOMPLETE'; end if;
  select jsonb_agg(case when p->>'user_id'=auth.uid()::text then
    p||jsonb_build_object('status',case when p_ready then 'READY' else 'ASSIGNED' end) else p end
    order by (p->>'seat')::int) into roster from jsonb_array_elements(g.players) p;
  if roster is distinct from g.players then
    update private.quick_tic_tac_toe_games set players=roster,revision=revision+1,updated_at=clock_timestamp() where lobby_id=p_lobby_id;
  end if;
  return public.get_quick_tic_tac_toe_state(p_lobby_id);
end;
$$;

create function public.start_quick_tic_tac_toe(p_lobby_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype; s jsonb; v jsonb; orders jsonb; cursors jsonb;
  a text; b text; aa text; bb text; seconds int;
begin
  g:=private.quick_ttt_lock(p_lobby_id);
  if not exists(select 1 from public.quick_game_lobbies where lobby_id=p_lobby_id and host_user_id=auth.uid()) then raise exception 'HOST_REQUIRED'; end if;
  if g.phase<>'SETUP' then return public.get_quick_tic_tac_toe_state(p_lobby_id); end if;
  v:=public.get_quick_tic_tac_toe_state(p_lobby_id);
  if not (v->>'can_start')::boolean then raise exception 'ALL_PLAYERS_READY_REQUIRED'; end if;
  s:=g.state_json; seconds:=coalesce((s->>'turn_seconds')::int,0);
  select jsonb_object_agg(pid,members),jsonb_object_agg(pid,0) into orders,cursors from
    (select p->>'participant_id' pid,jsonb_agg(p->'tournament_member_id' order by (p->>'seat')::int) members
      from jsonb_array_elements(g.players) p group by p->>'participant_id') teams;
  a:=g.players->0->>'participant_id'; b:=g.players->(jsonb_array_length(g.players)-1)->>'participant_id';
  aa:=orders->a->>0; bb:=orders->b->>0;
  s:=s||jsonb_build_object('team_mode',coalesce(s->>'team_mode','SOLO'),'member_order',orders,'member_cursor',cursors,'moves_total',0);
  if s->>'team_mode'='SIMULTANEOUS' then
    s:=s||jsonb_build_object('phase','PARALLEL_PLAYING','subgames',jsonb_build_object(
      '1',private.quick_tic_tac_toe_new_duel(g.players,aa::uuid,bb::uuid,seconds),
      '2',private.quick_tic_tac_toe_new_duel(g.players,(orders->a->>1)::uuid,(orders->b->>1)::uuid,seconds)));
  else
    if s->>'team_mode'='SELECTED_PLAYER' then aa:=s->'selections'->>a; bb:=s->'selections'->>b; end if;
    s:=s||jsonb_build_object('phase','PLAYING','board_state',private.quick_tic_tac_toe_new_duel(g.players,aa::uuid,bb::uuid,seconds));
  end if;
  perform private.quick_ttt_settle(p_lobby_id,s);
  return public.get_quick_tic_tac_toe_state(p_lobby_id);
end;
$$;

create function public.submit_quick_tic_tac_toe_move(p_lobby_id uuid,p_cell_index int,p_duel text,
  p_expected_round int,p_expected_move int,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype; s jsonb; b jsonb; me jsonb; path text[]; applied jsonb; previous jsonb;
begin
  g:=private.quick_ttt_lock(p_lobby_id);
  if p_client_action_id is null or p_expected_round is null or p_expected_move is null
    or p_cell_index is null or p_cell_index not between 0 and 8 then raise exception 'INVALID_MOVE_REQUEST'; end if;
  -- Store the latest receipt per human, not an unbounded list of client IDs.
  previous:=g.state_json->'receipts'->auth.uid()::text;
  if previous->>'id'=p_client_action_id::text then
    if previous->'request' is distinct from jsonb_build_array(p_duel,p_expected_round,p_expected_move,p_cell_index) then
      return public.get_quick_tic_tac_toe_state(p_lobby_id)||jsonb_build_object('move_accepted',false,'move_error','ACTION_ID_REUSED');
    end if;
    return public.get_quick_tic_tac_toe_state(p_lobby_id)||jsonb_build_object('move_accepted',true,'duplicate',true);
  end if;
  perform private.quick_ttt_tick(p_lobby_id);
  select * into g from private.quick_tic_tac_toe_games where lobby_id=p_lobby_id;
  s:=g.state_json;
  path:=case when g.phase='PLAYING' and p_duel='main' then array['board_state']
    when g.phase='PARALLEL_PLAYING' and p_duel in ('1','2') then array['subgames',p_duel]
    when g.phase='DECIDER_PLAYING' and p_duel='decider' then array['decider'] end;
  b:=s#>path;
  select p into me from jsonb_array_elements(g.players) p where p->>'user_id'=auth.uid()::text;
  -- Return, do not RAISE: an automatic expired move must survive a stale request.
  if b is null or b->>'status'<>'PLAYING' or coalesce(b->'transition','null'::jsonb)<>'null'::jsonb
    or b->>'current_actor_member_id' is distinct from me->>'tournament_member_id'
    or (b->>'round_number')::int<>p_expected_round or (b->>'board_move_no')::int<>p_expected_move
    or b->'board'->>p_cell_index is not null then
    return private.quick_ttt_view(p_lobby_id)||jsonb_build_object('move_accepted',false,'move_error','STALE_OR_ILLEGAL_MOVE');
  end if;
  applied:=private.tic_tac_toe_apply_move(b,(me->>'participant_id')::uuid,(me->>'tournament_member_id')::uuid,
    p_cell_index,s->>'variant',s->>'team_mode'='ALTERNATING',s->'member_order',s->'member_cursor',(s->>'turn_seconds')::int);
  b:=applied->'board_state'||jsonb_build_object('bot_due_at',clock_timestamp()+interval '700 milliseconds');
  s:=jsonb_set(s,path,b)||jsonb_build_object('member_cursor',applied->'member_cursor','moves_total',coalesce((s->>'moves_total')::int,0)+1,
    'receipts',coalesce(s->'receipts','{}')||jsonb_build_object(auth.uid()::text,jsonb_build_object('id',p_client_action_id,
      'request',jsonb_build_array(p_duel,p_expected_round,p_expected_move,p_cell_index))));
  perform private.quick_ttt_settle(p_lobby_id,s);
  return private.quick_ttt_view(p_lobby_id)||jsonb_build_object('move_accepted',true);
end;
$$;

revoke all on function private.quick_ttt_lock(uuid),private.quick_ttt_bot_move(jsonb,text),
  private.quick_ttt_bot_selections(jsonb,jsonb),private.quick_ttt_settle(uuid,jsonb),private.quick_ttt_tick(uuid),private.quick_ttt_view(uuid)
  from public,anon,authenticated;
revoke all on function public.get_quick_tic_tac_toe_state(uuid),public.configure_quick_tic_tac_toe(uuid,text,text,int),
  public.select_quick_tic_tac_toe_player(uuid,uuid,text),public.ready_quick_tic_tac_toe(uuid,boolean),
  public.start_quick_tic_tac_toe(uuid),public.submit_quick_tic_tac_toe_move(uuid,int,text,int,int,uuid) from public,anon;
grant execute on function public.get_quick_tic_tac_toe_state(uuid),public.configure_quick_tic_tac_toe(uuid,text,text,int),
  public.select_quick_tic_tac_toe_player(uuid,uuid,text),public.ready_quick_tic_tac_toe(uuid,boolean),
  public.start_quick_tic_tac_toe(uuid),public.submit_quick_tic_tac_toe_move(uuid,int,text,int,int,uuid) to authenticated;
