-- Existing shared lobby RPCs, captured before the TicTacToe integration.
CREATE OR REPLACE FUNCTION public.create_quick_game_lobby(p_game_key text DEFAULT 'dna'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare uid uuid:=auth.uid(); gid text:=lower(coalesce(p_game_key,'')); lid uuid; code text; tries int:=0; max_players smallint;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if gid not in ('dna','minority') then raise exception 'GAME_NOT_AVAILABLE'; end if;
  max_players:=case when gid='minority' then 4 else 8 end;
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
CREATE OR REPLACE FUNCTION public.fill_quick_game_lobby_bots(p_lobby_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.quick_game_lobbies set bots_filled=true,updated_at=now()
    where lobby_id=p_lobby_id and host_user_id=auth.uid() and status='OPEN';
  if not found then raise exception 'HOST_OPEN_LOBBY_REQUIRED'; end if;
  return public.get_quick_game_lobby(p_lobby_id);
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
    'setup_status',l.setup_status,'setup',l.setup_json,
    'players',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',p.user_id,'display_name',p.display_name,'seat',p.seat,'is_me',p.user_id=uid,'score',r.score
    ) order by p.seat) from public.quick_game_lobby_players p
      left join public.quick_game_results r on r.lobby_id=p.lobby_id and r.user_id=p.user_id
      where p.lobby_id=p_lobby_id),'[]'::jsonb),
    'bot_scores',l.bot_scores,'result_count',(select count(*) from public.quick_game_results r where r.lobby_id=p_lobby_id),
    'launch_path',case when l.status='LIVE' and l.game_key='dna' then '/dna-test/?quick_lobby='||l.lobby_id::text
                       when l.status='LIVE' and l.game_key='minority' then '/minority-test/?quick_lobby='||l.lobby_id::text
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
  select s into v_seat from generate_series(1,8) s
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
$function$
;
CREATE OR REPLACE FUNCTION public.start_quick_game_lobby(p_lobby_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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
$function$
;
