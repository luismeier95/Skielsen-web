-- One authoritative session per locked Quick Games lobby. Only the authenticated
-- Edge Function's database connection reads/writes this private document.
create table private.quick_dna_games (
  lobby_id uuid primary key references public.quick_game_lobbies(lobby_id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object')
);
alter table private.quick_dna_games enable row level security;
revoke all on private.quick_dna_games from public, anon, authenticated;
