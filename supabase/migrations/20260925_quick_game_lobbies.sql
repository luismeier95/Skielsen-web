create table if not exists public.quick_game_lobbies (
  lobby_id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  game_key text not null check (game_key in ('dna')),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN','LIVE','CLOSED')),
  max_human_players smallint not null default 4 check (max_human_players between 1 and 4),
  bots_filled boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.quick_game_lobby_players (
  lobby_id uuid not null references public.quick_game_lobbies(lobby_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat smallint not null check (seat between 1 and 4),
  display_name text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (lobby_id,user_id),
  unique (lobby_id,seat)
);

create index if not exists quick_game_lobbies_host_user_idx on public.quick_game_lobbies(host_user_id);
create index if not exists quick_game_lobby_players_user_idx on public.quick_game_lobby_players(user_id);

alter table public.quick_game_lobbies enable row level security;
alter table public.quick_game_lobby_players enable row level security;

create or replace function private.is_quick_game_lobby_member(p_lobby_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.quick_game_lobbies l
    where l.lobby_id=p_lobby_id and l.host_user_id=p_user_id
  ) or exists (
    select 1 from public.quick_game_lobby_players p
    where p.lobby_id=p_lobby_id and p.user_id=p_user_id
  );
$$;

revoke all on function private.is_quick_game_lobby_member(uuid,uuid) from public;
grant execute on function private.is_quick_game_lobby_member(uuid,uuid) to authenticated;

drop policy if exists quick_game_lobbies_member_select on public.quick_game_lobbies;
create policy quick_game_lobbies_member_select on public.quick_game_lobbies
for select to authenticated
using (private.is_quick_game_lobby_member(lobby_id,(select auth.uid())));

drop policy if exists quick_game_lobby_players_member_select on public.quick_game_lobby_players;
create policy quick_game_lobby_players_member_select on public.quick_game_lobby_players
for select to authenticated
using (private.is_quick_game_lobby_member(lobby_id,(select auth.uid())));

revoke all on public.quick_game_lobbies from anon, authenticated;
revoke all on public.quick_game_lobby_players from anon, authenticated;
grant select on public.quick_game_lobbies to authenticated;
grant select on public.quick_game_lobby_players to authenticated;

create or replace function private.quick_game_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(nullif(btrim(p.display_name),''),nullif(btrim(p.username),''),'PLAYER')
  from public.profiles p where p.user_id=p_user_id;
$$;

revoke all on function private.quick_game_display_name(uuid) from public, anon, authenticated;

create or replace function public.get_quick_game_lobby(p_lobby_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid:=auth.uid();
  v_lobby public.quick_game_lobbies%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_quick_game_lobby_member(p_lobby_id,v_uid) then raise exception 'LOBBY_FORBIDDEN'; end if;
  select * into v_lobby from public.quick_game_lobbies where lobby_id=p_lobby_id;
  update public.quick_game_lobby_players set last_seen_at=now()
    where lobby_id=p_lobby_id and user_id=v_uid;
  return jsonb_build_object(
    'lobby_id',v_lobby.lobby_id,'join_code',v_lobby.join_code,'game_key',v_lobby.game_key,
    'status',v_lobby.status,'is_host',v_lobby.host_user_id=v_uid,
    'bots_filled',v_lobby.bots_filled,'max_human_players',v_lobby.max_human_players,
    'players',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',p.user_id,'display_name',p.display_name,'seat',p.seat,'is_me',p.user_id=v_uid
    ) order by p.seat) from public.quick_game_lobby_players p where p.lobby_id=p_lobby_id),'[]'::jsonb),
    'launch_path',case when v_lobby.status='LIVE' then '/dna-test/?quick_lobby='||v_lobby.lobby_id::text else null end
  );
end;
$$;

create or replace function public.create_quick_game_lobby(p_game_key text default 'dna')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid:=auth.uid(); v_id uuid; v_code text; v_try int:=0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if lower(coalesce(p_game_key,''))<>'dna' then raise exception 'GAME_NOT_AVAILABLE'; end if;
  loop
    v_try:=v_try+1;
    v_code:='QG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    begin
      insert into public.quick_game_lobbies(join_code,game_key,host_user_id)
      values(v_code,'dna',v_uid) returning lobby_id into v_id;
      exit;
    exception when unique_violation then
      if v_try>=5 then raise; end if;
    end;
  end loop;
  insert into public.quick_game_lobby_players(lobby_id,user_id,seat,display_name)
  values(v_id,v_uid,1,coalesce(private.quick_game_display_name(v_uid),'PLAYER'));
  return public.get_quick_game_lobby(v_id);
end;
$$;

create or replace function public.join_quick_game_lobby(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
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
  select s into v_seat from generate_series(1,4) s
    where not exists(select 1 from public.quick_game_lobby_players p where p.lobby_id=v_id and p.seat=s)
    order by s limit 1;
  if v_seat is null then raise exception 'LOBBY_FULL'; end if;
  insert into public.quick_game_lobby_players(lobby_id,user_id,seat,display_name)
  values(v_id,v_uid,v_seat,coalesce(private.quick_game_display_name(v_uid),'PLAYER'));
  update public.quick_game_lobbies set bots_filled=false,updated_at=now() where lobby_id=v_id;
  return public.get_quick_game_lobby(v_id);
end;
$$;

create or replace function public.fill_quick_game_lobby_bots(p_lobby_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.quick_game_lobbies set bots_filled=true,updated_at=now()
    where lobby_id=p_lobby_id and host_user_id=auth.uid() and status='OPEN';
  if not found then raise exception 'HOST_OPEN_LOBBY_REQUIRED'; end if;
  return public.get_quick_game_lobby(p_lobby_id);
end;
$$;

create or replace function public.start_quick_game_lobby(p_lobby_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_count int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*) into v_count from public.quick_game_lobby_players where lobby_id=p_lobby_id;
  update public.quick_game_lobbies set status='LIVE',started_at=now(),updated_at=now()
    where lobby_id=p_lobby_id and host_user_id=auth.uid() and status='OPEN'
      and (bots_filled or v_count>=max_human_players);
  if not found then raise exception 'FILL_REMAINING_SLOTS_FIRST'; end if;
  return public.get_quick_game_lobby(p_lobby_id);
end;
$$;

revoke all on function public.get_quick_game_lobby(uuid) from public;
revoke all on function public.create_quick_game_lobby(text) from public;
revoke all on function public.join_quick_game_lobby(text) from public;
revoke all on function public.fill_quick_game_lobby_bots(uuid) from public;
revoke all on function public.start_quick_game_lobby(uuid) from public;
grant execute on function public.get_quick_game_lobby(uuid) to authenticated;
grant execute on function public.create_quick_game_lobby(text) to authenticated;
grant execute on function public.join_quick_game_lobby(text) to authenticated;
grant execute on function public.fill_quick_game_lobby_bots(uuid) to authenticated;
grant execute on function public.start_quick_game_lobby(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='quick_game_lobbies'
  ) then alter publication supabase_realtime add table public.quick_game_lobbies; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='quick_game_lobby_players'
  ) then alter publication supabase_realtime add table public.quick_game_lobby_players; end if;
end $$;
