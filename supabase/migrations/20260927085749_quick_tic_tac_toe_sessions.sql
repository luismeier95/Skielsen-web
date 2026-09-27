-- Block 1: a Quick Games session reuses the production v3 duel primitives.
-- No tournament, tournament member, placement or ledger record is created.
alter table public.quick_game_lobbies drop constraint if exists quick_game_lobbies_game_key_check;
alter table public.quick_game_lobbies add constraint quick_game_lobbies_game_key_check
check (game_key in ('dna','minority','tic_tac_toe'));

create table private.quick_tic_tac_toe_games (
  lobby_id uuid primary key references public.quick_game_lobbies(lobby_id) on delete cascade,
  participant_mode text not null check(participant_mode in ('SOLO','TEAM')),
  phase text not null default 'SETUP',
  players jsonb not null,
  state_json jsonb not null default '{}'::jsonb,
  result_json jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.quick_tic_tac_toe_games enable row level security;
revoke all on private.quick_tic_tac_toe_games from public,anon,authenticated;

-- Caller holds the lobby lock; create the immutable virtual roster only once.
create or replace function private.quick_tic_tac_toe_prepare(lid uuid)
returns void language plpgsql set search_path=pg_catalog,public,private as $$
declare l public.quick_game_lobbies%rowtype; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
  roster jsonb; mode text;
begin
  select * into l from public.quick_game_lobbies where lobby_id=lid for update;
  if l.game_key is distinct from 'tic_tac_toe' then raise exception 'TIC_TAC_TOE_LOBBY_REQUIRED'; end if;
  if exists(select 1 from private.quick_tic_tac_toe_games where lobby_id=lid) then return; end if;
  mode:=coalesce(l.setup_json->>'participant_mode','SOLO');
  if l.max_human_players<>(case when mode='SOLO' then 2 else 4 end) then raise exception 'INVALID_ROSTER_SIZE'; end if;
  select jsonb_agg(jsonb_build_object(
    'tournament_member_id',gen_random_uuid(), -- compatible key, no tournament row
    'participant_id',case when (mode='SOLO' and seats.seat=1) or (mode='TEAM' and seats.seat<=2) then a else b end,
    'user_id',p.user_id,'seat',seats.seat,'is_bot',p.user_id is null,
    'display_name',coalesce(p.display_name,'BOT '||seats.seat),
    'identity_color',case when (mode='SOLO' and seats.seat=1) or (mode='TEAM' and seats.seat<=2) then 'RED' else 'BLUE' end,
    'team_name',case when mode='SOLO' then coalesce(p.display_name,'BOT '||seats.seat)
      when seats.seat<=2 then 'TEAM ROT' else 'TEAM BLAU' end,
    'status',case when p.user_id is null then 'READY' else 'ASSIGNED' end
  ) order by seats.seat) into roster
  from generate_series(1,l.max_human_players) seats(seat)
  left join public.quick_game_lobby_players p on p.lobby_id=lid and p.seat=seats.seat;
  insert into private.quick_tic_tac_toe_games(lobby_id,participant_mode,players)
    values(lid,mode,roster);
end;
$$;
revoke all on function private.quick_tic_tac_toe_prepare(uuid) from public,anon,authenticated;

-- Adapter only: all round/points/timer/transition rules remain in new_board.
create or replace function private.quick_tic_tac_toe_new_duel(roster jsonb, actor_a uuid, actor_b uuid, seconds int)
returns jsonb language plpgsql set search_path=pg_catalog,public,private as $$
declare pa uuid; pb uuid;
begin
  select (x->>'participant_id')::uuid into pa from jsonb_array_elements(roster) x where x->>'tournament_member_id'=actor_a::text;
  select (x->>'participant_id')::uuid into pb from jsonb_array_elements(roster) x where x->>'tournament_member_id'=actor_b::text;
  if pa is null or pb is null or pa=pb then raise exception 'INVALID_DUEL_ACTORS'; end if;
  return private.tic_tac_toe_new_board(pa,pb,actor_a,actor_b,
    case when random()<0.5 then pa else pb end,seconds);
end;
$$;
revoke all on function private.quick_tic_tac_toe_new_duel(jsonb,uuid,uuid,integer) from public,anon,authenticated;

create or replace function public.set_quick_tic_tac_toe_format(p_lobby_id uuid,p_mode text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare l public.quick_game_lobbies%rowtype; mode text:=upper(trim(p_mode)); capacity int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if mode is null or mode not in ('SOLO','TEAM') then raise exception 'INVALID_PARTICIPANT_MODE'; end if;
  select * into l from public.quick_game_lobbies where lobby_id=p_lobby_id for update;
  if not found or l.host_user_id<>auth.uid() or l.status<>'OPEN' or l.game_key<>'tic_tac_toe'
    then raise exception 'HOST_OPEN_TIC_TAC_TOE_LOBBY_REQUIRED'; end if;
  capacity:=case when mode='SOLO' then 2 else 4 end;
  if exists(select 1 from public.quick_game_lobby_players where lobby_id=p_lobby_id and seat>capacity)
    then raise exception 'OCCUPIED_SEATS_PREVENT_FORMAT_CHANGE'; end if;
  update public.quick_game_lobbies set max_human_players=capacity,bots_filled=false,
    setup_json=coalesce(setup_json,'{}'::jsonb)||jsonb_build_object('participant_mode',mode),updated_at=now()
  where lobby_id=p_lobby_id;
  return public.get_quick_game_lobby(p_lobby_id);
end;
$$;
revoke all on function public.set_quick_tic_tac_toe_format(uuid,text) from public,anon;
grant execute on function public.set_quick_tic_tac_toe_format(uuid,text) to authenticated;

create or replace function public.get_quick_tic_tac_toe_state(p_lobby_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare g private.quick_tic_tac_toe_games%rowtype; l public.quick_game_lobbies%rowtype; me jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_quick_game_lobby_member(p_lobby_id,auth.uid()) then raise exception 'LOBBY_FORBIDDEN'; end if;
  select * into l from public.quick_game_lobbies where lobby_id=p_lobby_id;
  if l.game_key<>'tic_tac_toe' then raise exception 'TIC_TAC_TOE_LOBBY_REQUIRED'; end if;
  select * into g from private.quick_tic_tac_toe_games where lobby_id=p_lobby_id;
  if not found then raise exception 'QUICK_GAME_NOT_STARTED'; end if;
  select x into me from jsonb_array_elements(g.players) x where x->>'user_id'=auth.uid()::text;
  return jsonb_build_object(
    'session_id',p_lobby_id,'quick_game',true,'phase',g.phase,
    'status',case when g.result_json is not null then 'FINISHED' else 'WAITING_FOR_PLAYERS' end,
    'tournament_mode',g.participant_mode,'rules_version',3,'version',g.revision,
    'players',g.players,'state',g.state_json,'result',g.result_json,
    'viewer',jsonb_build_object('tournament_member_id',me->'tournament_member_id',
      'participant_id',me->'participant_id','is_admin',l.host_user_id=auth.uid()),
    'server_now',clock_timestamp()
  );
end;
$$;
revoke all on function public.get_quick_tic_tac_toe_state(uuid) from public,anon;
grant execute on function public.get_quick_tic_tac_toe_state(uuid) to authenticated;
CREATE OR REPLACE FUNCTION public.create_quick_game_lobby(p_game_key text DEFAULT 'dna'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare uid uuid:=auth.uid(); gid text:=lower(coalesce(p_game_key,'')); lid uuid; code text; tries int:=0; max_players smallint;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if gid not in ('dna','minority','tic_tac_toe') then raise exception 'GAME_NOT_AVAILABLE'; end if;
  max_players:=case when gid='tic_tac_toe' then 2 when gid='minority' then 4 else 8 end;
  loop
    tries:=tries+1; code:='QG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    begin
      insert into public.quick_game_lobbies(join_code,game_key,host_user_id,max_human_players)
      values(code,gid,uid,max_players) returning lobby_id into lid;
      exit;
    exception when unique_violation then if tries>=5 then raise; end if; end;
  end loop;
  insert into public.quick_game_lobby_players(lobby_id,user_id,seat,display_name)
  values(lid,uid,1,coalesce(private.quick_game_display_name(uid),'PLAYER'));
  return public.get_quick_game_lobby(lid);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_quick_game_lobby(p_lobby_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare uid uuid:=auth.uid(); l public.quick_game_lobbies%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_quick_game_lobby_member(p_lobby_id,uid) then raise exception 'LOBBY_FORBIDDEN'; end if;
  select * into l from public.quick_game_lobbies where lobby_id=p_lobby_id;
  update public.quick_game_lobby_players set last_seen_at=now() where lobby_id=p_lobby_id and user_id=uid;
  return jsonb_build_object(
    'lobby_id',l.lobby_id,'join_code',l.join_code,'game_key',l.game_key,'status',l.status,
    'is_host',l.host_user_id=uid,'bots_filled',l.bots_filled,'max_human_players',l.max_human_players,
    'participant_mode',case when l.game_key='tic_tac_toe' then coalesce(l.setup_json->>'participant_mode','SOLO') else null end,
    'setup_status',l.setup_status,'setup',l.setup_json,
    'players',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',p.user_id,'display_name',p.display_name,'seat',p.seat,'is_me',p.user_id=uid,'score',r.score
    ) order by p.seat) from public.quick_game_lobby_players p
      left join public.quick_game_results r on r.lobby_id=p.lobby_id and r.user_id=p.user_id
      where p.lobby_id=p_lobby_id),'[]'::jsonb),
    'bot_scores',l.bot_scores,'result_count',(select count(*) from public.quick_game_results r where r.lobby_id=p_lobby_id),
    'launch_path',case when l.status='LIVE' and l.game_key='dna' then '/dna-test/?quick_lobby='||l.lobby_id::text
                       when l.status='LIVE' and l.game_key='minority' then '/minority-test/?quick_lobby='||l.lobby_id::text
                       when l.status='LIVE' and l.game_key='tic_tac_toe' then '/quick-games/tic-tac-toe/?quick_lobby='||l.lobby_id::text
                       else null end
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.join_quick_game_lobby(p_join_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_uid uuid:=auth.uid(); v_id uuid; v_seat smallint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select lobby_id into v_id from public.quick_game_lobbies
    where join_code=upper(btrim(p_join_code)) and status='OPEN' for update;
  if v_id is null then raise exception 'LOBBY_NOT_FOUND'; end if;
  if exists(select 1 from public.quick_game_lobby_players where lobby_id=v_id and user_id=v_uid) then
    return public.get_quick_game_lobby(v_id);
  end if;
  select s into v_seat from generate_series(1,(select max_human_players from public.quick_game_lobbies where lobby_id=v_id)) s
    where not exists(select 1 from public.quick_game_lobby_players p where p.lobby_id=v_id and p.seat=s)
    order by s limit 1;
  if v_seat is null then raise exception 'LOBBY_FULL'; end if;
  insert into public.quick_game_lobby_players(lobby_id,user_id,seat,display_name)
  values(v_id,v_uid,v_seat,coalesce(private.quick_game_display_name(v_uid),'PLAYER'));
  update public.quick_game_lobbies set bots_filled=false,updated_at=now() where lobby_id=v_id;
  return public.get_quick_game_lobby(v_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_quick_game_seat(p_lobby_id uuid, p_seat smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_seat is null or p_seat not between 1 and 8 then raise exception 'INVALID_SEAT'; end if;
  perform 1 from public.quick_game_lobbies where lobby_id=p_lobby_id and status='OPEN' for update;
  if not found then raise exception 'OPEN_LOBBY_REQUIRED'; end if;
  if p_seat>(select max_human_players from public.quick_game_lobbies where lobby_id=p_lobby_id) then raise exception 'INVALID_SEAT'; end if;
  if exists(select 1 from public.quick_game_lobby_players where lobby_id=p_lobby_id and seat=p_seat and user_id<>auth.uid()) then
    raise exception 'SEAT_TAKEN';
  end if;
  update public.quick_game_lobby_players set seat=p_seat,last_seen_at=now()
    where lobby_id=p_lobby_id and user_id=auth.uid();
  if not found then raise exception 'LOBBY_FORBIDDEN'; end if;
  update public.quick_game_lobbies set bots_filled=false,updated_at=now() where lobby_id=p_lobby_id;
  return public.get_quick_game_lobby(p_lobby_id);
end;
$function$
;

create or replace function public.start_quick_game_lobby(p_lobby_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare l public.quick_game_lobbies%rowtype; humans int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.quick_game_lobbies where lobby_id=p_lobby_id for update;
  if not found or l.host_user_id<>auth.uid() then raise exception 'HOST_OPEN_LOBBY_REQUIRED'; end if;
  if l.status='LIVE' then return public.get_quick_game_lobby(p_lobby_id); end if;
  if l.status<>'OPEN' then raise exception 'OPEN_LOBBY_REQUIRED'; end if;
  select count(*) into humans from public.quick_game_lobby_players where lobby_id=p_lobby_id;
  if not l.bots_filled and humans<l.max_human_players then raise exception 'FILL_REMAINING_SLOTS_FIRST'; end if;
  if l.game_key='tic_tac_toe' then perform private.quick_tic_tac_toe_prepare(p_lobby_id); end if;
  update public.quick_game_lobbies set status='LIVE',started_at=now(),updated_at=now() where lobby_id=p_lobby_id;
  return public.get_quick_game_lobby(p_lobby_id);
end;
$$;
