alter table public.quick_game_lobbies
  add column if not exists bot_scores jsonb not null default '{}'::jsonb;

create table if not exists public.quick_game_results (
  lobby_id uuid not null references public.quick_game_lobbies(lobby_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  submitted_at timestamptz not null default now(),
  primary key (lobby_id,user_id)
);

create index if not exists quick_game_results_user_idx on public.quick_game_results(user_id);

alter table public.quick_game_results enable row level security;
revoke all on public.quick_game_results from anon, authenticated;
grant select on public.quick_game_results to authenticated;

drop policy if exists quick_game_results_member_select on public.quick_game_results;
create policy quick_game_results_member_select on public.quick_game_results
for select to authenticated
using (private.is_quick_game_lobby_member(lobby_id,(select auth.uid())));

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
      'user_id',p.user_id,'display_name',p.display_name,'seat',p.seat,'is_me',p.user_id=v_uid,
      'score',r.score
    ) order by p.seat) from public.quick_game_lobby_players p
      left join public.quick_game_results r on r.lobby_id=p.lobby_id and r.user_id=p.user_id
      where p.lobby_id=p_lobby_id),'[]'::jsonb),
    'bot_scores',v_lobby.bot_scores,
    'result_count',(select count(*) from public.quick_game_results r where r.lobby_id=p_lobby_id),
    'launch_path',case when v_lobby.status='LIVE' then '/dna-test/?quick_lobby='||v_lobby.lobby_id::text else null end
  );
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='quick_game_results'
  ) then alter publication supabase_realtime add table public.quick_game_results; end if;
end $$;
