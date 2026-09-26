-- Isolated PostgreSQL fixture: real column types, minimal keys; no production data.
create schema private;
create role anon;
create role authenticated;
create type public.tournament_game_status as enum ('ACTIVE','COMPLETED');
create table public.game_placements(tournament_game_id uuid, participant_id uuid, placement integer, base_points integer, multiplier numeric, final_points integer, created_at timestamp with time zone);
create table public.in_app_game_actions(action_id uuid, session_id uuid, tournament_member_id uuid, action_type text, payload_json jsonb, accepted boolean, server_result_json jsonb, created_at timestamp with time zone);
create table public.in_app_game_definitions(game_definition_id uuid, available_game_id text, game_key text, name text, module_key text, min_players integer, max_players integer, config_json jsonb, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone);
create table public.in_app_game_session_players(session_id uuid, tournament_member_id uuid, participant_id uuid, seat integer, role text, status text, private_state_json jsonb, connected_at timestamp with time zone, ready_at timestamp with time zone, last_seen_at timestamp with time zone, finished_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone);
create table public.in_app_game_sessions(session_id uuid, tournament_id uuid, tournament_game_id uuid, match_id uuid, game_definition_id uuid, status text, current_round integer, version bigint, state_json jsonb, public_state_json jsonb, result_json jsonb, created_by_member_id uuid, started_at timestamp with time zone, finished_at timestamp with time zone, cancelled_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone);
create table public.in_app_team_lineups(session_id uuid, participant_id uuid, lineup_role text, lineup_slot integer, tournament_member_id uuid, selected_by_member_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone);
create table public.in_app_team_mode_configs(session_id uuid, mode text, selected_by_member_id uuid, selected_at timestamp with time zone, locked_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone);
create table public.participants(participant_id uuid, tournament_id uuid, participant_type text, identity_color text, team_id uuid, solo_member_id uuid, seed integer, status text, created_at timestamp with time zone);
create table public.scoring_placement_points(scoring_profile_id text, placement integer, points integer);
create table public.teams(team_id uuid, tournament_id uuid, name text, created_at timestamp with time zone, name_updated_at timestamp with time zone, name_updated_by_member_id uuid);
create table public.tournament_game_participants(tournament_game_id uuid, participant_id uuid, seed integer, created_at timestamp with time zone);
create table public.tournament_game_representatives(tournament_game_id uuid, participant_id uuid, tournament_member_id uuid, representative_role text, counts_for_personal_stats boolean, created_at timestamp with time zone);
create table public.tournament_game_results(tournament_game_id uuid, participant_id uuid, primary_value numeric, secondary_value numeric, result_status text, result_payload jsonb, submitted_by_member_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone);
create table public.tournament_games(tournament_game_id uuid, tournament_id uuid, game_id text, sequence_no integer, format_template text, status tournament_game_status, started_at timestamp with time zone, completed_at timestamp with time zone, created_at timestamp with time zone, play_mode text, game_rule_version integer, game_rules_snapshot jsonb, joker_resolution_state text, joker_locked_at timestamp with time zone, joker_resolved_at timestamp with time zone, accepted_joker_submission_id uuid, joker_pick_completed_at timestamp with time zone);
create table public.tournament_members(tournament_member_id uuid, tournament_id uuid, user_id uuid, display_name_snapshot text, participation_status text, membership_status text, joined_at timestamp with time zone, left_at timestamp with time zone, created_at timestamp with time zone);
create table public.tournaments(tournament_id uuid, creator_user_id uuid, parent_tournament_id uuid, creation_type text, name text, mode text, status text, expected_active_players integer, scoring_profile_id text, theme_pack_id text, base_feature_pack_id text, bet_starting_credits bigint, checkout_completed_at timestamp with time zone, lobby_opened_at timestamp with time zone, community_rating_opened_at timestamp with time zone, community_rating_completed_at timestamp with time zone, play_started_at timestamp with time zone, completed_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, game_order_finalized_at timestamp with time zone, settings_confirmed_at timestamp with time zone, test_mode boolean);

alter table public.in_app_game_actions alter column created_at set default now();
alter table public.in_app_team_mode_configs add primary key(session_id);
alter table public.tournament_game_participants add primary key(tournament_game_id,participant_id);
alter table public.tournament_game_representatives add primary key(tournament_game_id,participant_id,tournament_member_id);
create function private.request_user_id() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function private.in_app_current_member(tid uuid) returns uuid language sql as $$select tournament_member_id from public.tournament_members where tournament_id=tid and user_id=private.request_user_id() limit 1$$;
create function private.in_app_is_admin(tid uuid) returns boolean language sql as $$select exists(select 1 from public.tournaments where tournament_id=tid and creator_user_id=private.request_user_id())$$;
-- Handoff boundaries: assert calls while keeping unrelated Joker/Ledger engines out of this fixture.
create table private.test_handoff_calls(kind text, id uuid);
create function private.apply_tournament_game_joker_effect(id uuid) returns void language sql as $$insert into private.test_handoff_calls values('joker',id)$$;
create function private.sync_game_placement_points_to_ledger(id uuid) returns void language sql as $$insert into private.test_handoff_calls values('ledger',id)$$;
create function private.build_tournament_game_joker_reveal(id uuid) returns jsonb language sql as $$select jsonb_build_object('test_fixture',true)$$;

