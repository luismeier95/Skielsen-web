alter table public.quick_game_lobbies
  drop constraint if exists quick_game_lobbies_max_human_players_check;

alter table public.quick_game_lobbies
  alter column max_human_players set default 8;

update public.quick_game_lobbies
set max_human_players=8
where status='OPEN';

alter table public.quick_game_lobbies
  add constraint quick_game_lobbies_max_human_players_check
  check (max_human_players between 1 and 8);

alter table public.quick_game_lobby_players
  drop constraint if exists quick_game_lobby_players_seat_check;

alter table public.quick_game_lobby_players
  add constraint quick_game_lobby_players_seat_check
  check (seat between 1 and 8);

alter table public.quick_game_lobbies
  add column if not exists setup_status text not null default 'PENDING',
  add column if not exists setup_json jsonb not null default '{}'::jsonb;

alter table public.quick_game_lobbies
  drop constraint if exists quick_game_lobbies_setup_status_check;

alter table public.quick_game_lobbies
  add constraint quick_game_lobbies_setup_status_check
  check (setup_status in ('PENDING','READY'));

create table if not exists private.quick_dna_player_actions (
  lobby_id uuid not null references public.quick_game_lobbies(lobby_id) on delete cascade,
  term_no smallint not null check (term_no between 1 and 15),
  hint_no smallint not null check (hint_no between 1 and 3),
  team_no smallint not null check (team_no between 1 and 4),
  user_id uuid not null references auth.users(id) on delete cascade,
  idea_text text,
  idea_submitted boolean not null default false,
  vote_value text,
  updated_at timestamptz not null default now(),
  primary key (lobby_id,term_no,hint_no,user_id)
);

create table if not exists private.quick_dna_team_submissions (
  lobby_id uuid not null references public.quick_game_lobbies(lobby_id) on delete cascade,
  term_no smallint not null check (term_no between 1 and 15),
  hint_no smallint not null check (hint_no between 1 and 3),
  team_no smallint not null check (team_no between 1 and 4),
  answer text not null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (lobby_id,term_no,hint_no,team_no)
);

revoke all on private.quick_dna_player_actions from public, anon, authenticated;
revoke all on private.quick_dna_team_submissions from public, anon, authenticated;

create or replace function private.quick_game_team_no(p_lobby_id uuid,p_user_id uuid)
returns smallint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (((p.seat-1)/2)+1)::smallint
  from public.quick_game_lobby_players p
  join public.quick_game_lobbies l on l.lobby_id=p.lobby_id and l.status='LIVE'
  where p.lobby_id=p_lobby_id and p.user_id=p_user_id;
$$;

revoke all on function private.quick_game_team_no(uuid,uuid) from public, anon, authenticated;

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
    'setup_status',v_lobby.setup_status,'setup',v_lobby.setup_json,
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
  select s into v_seat from generate_series(1,8) s
    where not exists(select 1 from public.quick_game_lobby_players p where p.lobby_id=v_id and p.seat=s)
    order by s limit 1;
  if v_seat is null then raise exception 'LOBBY_FULL'; end if;
  insert into public.quick_game_lobby_players(lobby_id,user_id,seat,display_name)
  values(v_id,v_uid,v_seat,coalesce(private.quick_game_display_name(v_uid),'PLAYER'));
  update public.quick_game_lobbies set bots_filled=false,updated_at=now() where lobby_id=v_id;
  return public.get_quick_game_lobby(v_id);
end;
$$;

create or replace function public.set_quick_game_seat(p_lobby_id uuid,p_seat smallint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_seat not between 1 and 8 then raise exception 'INVALID_SEAT'; end if;
  perform 1 from public.quick_game_lobbies where lobby_id=p_lobby_id and status='OPEN' for update;
  if not found then raise exception 'OPEN_LOBBY_REQUIRED'; end if;
  if exists(select 1 from public.quick_game_lobby_players where lobby_id=p_lobby_id and seat=p_seat and user_id<>auth.uid()) then
    raise exception 'SEAT_TAKEN';
  end if;
  update public.quick_game_lobby_players set seat=p_seat,last_seen_at=now()
    where lobby_id=p_lobby_id and user_id=auth.uid();
  if not found then raise exception 'LOBBY_FORBIDDEN'; end if;
  update public.quick_game_lobbies set bots_filled=false,updated_at=now() where lobby_id=p_lobby_id;
  return public.get_quick_game_lobby(p_lobby_id);
end;
$$;

create or replace function public.configure_quick_game_lobby(
  p_lobby_id uuid,p_categories text[],p_term_count smallint,p_pool text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_categories text[];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(p_term_count,0) not in (5,10,15) then raise exception 'INVALID_TERM_COUNT'; end if;
  if coalesce(upper(p_pool),'') not in ('CASUAL','BALANCED','EXPERT') then raise exception 'INVALID_POOL'; end if;
  select array_agg(c.category_id order by c.sort_order) into v_categories
  from public.dna_categories c
  where c.is_active=true and c.category_id=any(coalesce(p_categories,array[]::text[]));
  if coalesce(array_length(v_categories,1),0)=0 then raise exception 'SELECT_CATEGORY'; end if;
  update public.quick_game_lobbies
  set setup_status='READY',setup_json=jsonb_build_object(
    'categories',to_jsonb(v_categories),'termCount',p_term_count,'pool',upper(p_pool)
  ),updated_at=now()
  where lobby_id=p_lobby_id and host_user_id=auth.uid() and status='LIVE';
  if not found then raise exception 'HOST_LIVE_LOBBY_REQUIRED'; end if;
  return public.get_quick_game_lobby(p_lobby_id);
end;
$$;

create or replace function public.submit_quick_dna_idea(
  p_lobby_id uuid,p_term_no smallint,p_hint_no smallint,p_idea text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_uid uuid:=auth.uid(); v_team smallint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_team:=private.quick_game_team_no(p_lobby_id,v_uid);
  if v_team is null then raise exception 'LOBBY_FORBIDDEN'; end if;
  insert into private.quick_dna_player_actions(lobby_id,term_no,hint_no,team_no,user_id,idea_text,idea_submitted)
  values(p_lobby_id,p_term_no,p_hint_no,v_team,v_uid,nullif(left(btrim(coalesce(p_idea,'')),80),''),true)
  on conflict(lobby_id,term_no,hint_no,user_id) do update
    set idea_text=excluded.idea_text,idea_submitted=true,updated_at=now();
  return public.get_quick_dna_team_state(p_lobby_id,p_term_no,p_hint_no);
end;
$$;

create or replace function public.submit_quick_dna_vote(
  p_lobby_id uuid,p_term_no smallint,p_hint_no smallint,p_vote text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_uid uuid:=auth.uid(); v_team smallint; v_vote text:=left(btrim(coalesce(p_vote,'')),80);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_team:=private.quick_game_team_no(p_lobby_id,v_uid);
  if v_team is null then raise exception 'LOBBY_FORBIDDEN'; end if;
  if v_vote='' then v_vote:=null; end if;
  if v_vote is not null and v_vote<>'__NO__' and not exists(
    select 1 from private.quick_dna_player_actions a
    where a.lobby_id=p_lobby_id and a.term_no=p_term_no and a.hint_no=p_hint_no
      and a.team_no=v_team and upper(a.idea_text)=upper(v_vote)
  ) then raise exception 'INVALID_TEAM_VOTE'; end if;
  insert into private.quick_dna_player_actions(lobby_id,term_no,hint_no,team_no,user_id,idea_submitted,vote_value)
  values(p_lobby_id,p_term_no,p_hint_no,v_team,v_uid,true,v_vote)
  on conflict(lobby_id,term_no,hint_no,user_id) do update
    set vote_value=excluded.vote_value,updated_at=now();
  return public.get_quick_dna_team_state(p_lobby_id,p_term_no,p_hint_no);
end;
$$;

create or replace function public.submit_quick_dna_team_answer(
  p_lobby_id uuid,p_term_no smallint,p_hint_no smallint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_uid uuid:=auth.uid(); v_team smallint; v_answer text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_team:=private.quick_game_team_no(p_lobby_id,v_uid);
  if v_team is null then raise exception 'LOBBY_FORBIDDEN'; end if;
  select min(a.vote_value) into v_answer
  from private.quick_dna_player_actions a
  where a.lobby_id=p_lobby_id and a.term_no=p_term_no and a.hint_no=p_hint_no and a.team_no=v_team
    and a.vote_value is not null
  having count(*)=2 and count(distinct upper(a.vote_value))=1;
  if v_answer is null then raise exception 'TEAM_CONSENSUS_REQUIRED'; end if;
  insert into private.quick_dna_team_submissions(lobby_id,term_no,hint_no,team_no,answer,submitted_by)
  values(p_lobby_id,p_term_no,p_hint_no,v_team,v_answer,v_uid)
  on conflict(lobby_id,term_no,hint_no,team_no) do nothing;
  return public.get_quick_dna_team_state(p_lobby_id,p_term_no,p_hint_no);
end;
$$;

create or replace function public.get_quick_dna_team_state(
  p_lobby_id uuid,p_term_no smallint,p_hint_no smallint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_uid uuid:=auth.uid(); v_team smallint; v_humans int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_team:=private.quick_game_team_no(p_lobby_id,v_uid);
  if v_team is null then raise exception 'LOBBY_FORBIDDEN'; end if;
  select count(*) into v_humans from public.quick_game_lobby_players p
  where p.lobby_id=p_lobby_id and (((p.seat-1)/2)+1)=v_team;
  return jsonb_build_object(
    'human_count',v_humans,
    'ideas',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',a.user_id,'is_me',a.user_id=v_uid,
      'idea',case when a.user_id=v_uid or (select count(*) from private.quick_dna_player_actions ready
        where ready.lobby_id=p_lobby_id and ready.term_no=p_term_no and ready.hint_no=p_hint_no
          and ready.team_no=v_team and ready.idea_submitted)>=v_humans then a.idea_text else null end,
      'submitted',a.idea_submitted
    ) order by a.user_id) from private.quick_dna_player_actions a
      where a.lobby_id=p_lobby_id and a.term_no=p_term_no and a.hint_no=p_hint_no and a.team_no=v_team),'[]'::jsonb),
    'votes',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',a.user_id,'is_me',a.user_id=v_uid,'vote',a.vote_value
    ) order by a.user_id) from private.quick_dna_player_actions a
      where a.lobby_id=p_lobby_id and a.term_no=p_term_no and a.hint_no=p_hint_no and a.team_no=v_team),'[]'::jsonb),
    'submission',(select jsonb_build_object('answer',s.answer,'submitted_by',s.submitted_by)
      from private.quick_dna_team_submissions s where s.lobby_id=p_lobby_id and s.term_no=p_term_no
        and s.hint_no=p_hint_no and s.team_no=v_team)
  );
end;
$$;

revoke all on function public.set_quick_game_seat(uuid,smallint) from public;
revoke all on function public.configure_quick_game_lobby(uuid,text[],smallint,text) from public;
revoke all on function public.submit_quick_dna_idea(uuid,smallint,smallint,text) from public;
revoke all on function public.submit_quick_dna_vote(uuid,smallint,smallint,text) from public;
revoke all on function public.submit_quick_dna_team_answer(uuid,smallint,smallint) from public;
revoke all on function public.get_quick_dna_team_state(uuid,smallint,smallint) from public;
grant execute on function public.set_quick_game_seat(uuid,smallint) to authenticated;
grant execute on function public.configure_quick_game_lobby(uuid,text[],smallint,text) to authenticated;
grant execute on function public.submit_quick_dna_idea(uuid,smallint,smallint,text) to authenticated;
grant execute on function public.submit_quick_dna_vote(uuid,smallint,smallint,text) to authenticated;
grant execute on function public.submit_quick_dna_team_answer(uuid,smallint,smallint) to authenticated;
grant execute on function public.get_quick_dna_team_state(uuid,smallint,smallint) to authenticated;
