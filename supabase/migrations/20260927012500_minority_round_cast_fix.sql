
create or replace function public.configure_quick_minority_game(
  p_lobby_id uuid,p_difficulty text,p_round_count smallint
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  uid uuid:=auth.uid(); diff text:=upper(coalesce(p_difficulty,'')); qid bigint; opts jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if diff not in ('EASY','NORMAL','HARDCORE') then raise exception 'INVALID_DIFFICULTY'; end if;
  if p_round_count not in (5,10,15) then raise exception 'INVALID_ROUND_COUNT'; end if;
  perform 1 from public.quick_game_lobbies l
    where l.lobby_id=p_lobby_id and l.host_user_id=uid and l.game_key='minority' and l.status='LIVE'
    for update;
  if not found then raise exception 'HOST_LIVE_LOBBY_REQUIRED'; end if;
  select * into qid,opts from private.quick_minority_pick_question(p_lobby_id,diff,1::smallint);
  delete from private.quick_minority_choices where lobby_id=p_lobby_id;
  delete from private.quick_minority_ready where lobby_id=p_lobby_id;
  insert into private.quick_minority_games(lobby_id,difficulty,round_count,round_no,round_value,stage,question_id,question_options,scores,reveal,revision)
  values(p_lobby_id,diff,p_round_count,1,1,'READY',qid,opts,'[0,0,0,0]'::jsonb,null,1)
  on conflict(lobby_id) do update set difficulty=excluded.difficulty,round_count=excluded.round_count,
    round_no=1,round_value=1,stage='READY',question_id=excluded.question_id,question_options=excluded.question_options,
    scores='[0,0,0,0]'::jsonb,reveal=null,revision=private.quick_minority_games.revision+1,updated_at=now();
  update public.quick_game_lobbies set setup_status='READY',
    setup_json=jsonb_build_object('difficulty',diff,'roundCount',p_round_count),updated_at=now()
    where lobby_id=p_lobby_id;
  return public.get_quick_minority_game(p_lobby_id);
end;
$$;

create or replace function public.advance_quick_minority_game(p_lobby_id uuid)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare uid uuid:=auth.uid(); g private.quick_minority_games%rowtype; qid bigint; opts jsonb; next_value int;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_quick_game_lobby_member(p_lobby_id,uid) then raise exception 'LOBBY_FORBIDDEN'; end if;
  select * into g from private.quick_minority_games where lobby_id=p_lobby_id for update;
  if not found or g.stage<>'RESOLVED' then raise exception 'RESOLVED_STAGE_REQUIRED'; end if;
  if g.round_no>=g.round_count then
    update private.quick_minority_games set stage='FINISHED',revision=revision+1,updated_at=now()
    where lobby_id=p_lobby_id;
    return public.get_quick_minority_game(p_lobby_id);
  end if;
  next_value:=coalesce((g.reveal->>'nextRoundValue')::int,1);
  select * into qid,opts from private.quick_minority_pick_question(p_lobby_id,g.difficulty,(g.round_no+1)::smallint);
  update private.quick_minority_games set round_no=g.round_no+1,round_value=next_value,stage='PLAYING',
    question_id=qid,question_options=opts,reveal=null,revision=revision+1,updated_at=now()
  where lobby_id=p_lobby_id;
  return public.get_quick_minority_game(p_lobby_id);
end;
$$;
