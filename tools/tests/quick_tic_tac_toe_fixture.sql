-- Isolated lobby fixture; no production users or data.
create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table public.quick_game_lobbies(
 lobby_id uuid primary key default gen_random_uuid(),join_code text unique not null,
 game_key text not null constraint quick_game_lobbies_game_key_check check(game_key in ('dna','minority')),
 host_user_id uuid not null,status text not null default 'OPEN',
 max_human_players smallint not null default 8,bots_filled boolean not null default false,
 setup_status text default 'PENDING',setup_json jsonb default '{}',bot_scores jsonb default '{}',
 created_at timestamptz default now(),started_at timestamptz,updated_at timestamptz default now()
);
create table public.quick_game_lobby_players(
 lobby_id uuid references public.quick_game_lobbies(lobby_id),user_id uuid,seat smallint,
 display_name text,joined_at timestamptz default now(),last_seen_at timestamptz default now(),
 primary key(lobby_id,user_id),unique(lobby_id,seat)
);
create table public.quick_game_results(lobby_id uuid,user_id uuid,score numeric,primary key(lobby_id,user_id));
create function private.quick_game_display_name(uid uuid) returns text language sql as $$select 'PLAYER '||right(uid::text,2)$$;
create function private.is_quick_game_lobby_member(lid uuid,uid uuid)
returns boolean language sql as $$select exists(select 1 from public.quick_game_lobby_players where lobby_id=lid and user_id=uid)$$;
