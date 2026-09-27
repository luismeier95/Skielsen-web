# SKIELSEN Game App Architecture

Status: Scaffold / migration draft
Date: 2026-09-27

## Goal

Each game can run as an isolated mini app. The Skielsen full app becomes the host and loads a selected game build in an iframe. CSS and JavaScript experiments inside one game must not mutate the full app or another working game.

## Build lifecycle

- lab: disposable development copy; may break.
- candidate: feature-complete build under multiplayer/mobile/theme QA.
- stable: frozen build used by production routes; do not edit directly.

Promotion: stable -> copy to lab -> develop -> candidate -> new stable.

## Current scaffold

No production route was changed.

- Current Minority remains at /minority-test/.
- Minority LAB is at /games/minority/lab/.
- Generic host harness is at /game-host/lab.html.
- /game-host/manifest.js resolves stable/lab URLs.
- /game-host/bridge.js defines protocol v1.

The current Minority LAB is a compatibility copy. It announces itself to the host and receives SKIELSEN_GAME_INIT, but the copied legacy game logic does not consume that init payload yet.

## Host responsibilities

The full app owns tournament navigation/lifecycle, selected game/build, player/team/tournament identifiers, theme/context, cross-game betting/joker/MVP/LVP orchestration, tournament result merge, and close/minimize behavior.

## Game app responsibilities

An isolated game owns game-specific setup/difficulty, ready page, active mechanic, game animations/tools, game ranking/result, and game-specific authoritative RPCs while active. A game app must not reach into the parent DOM.

## Protocol v1

Transport: same-origin window.postMessage().

Message types:
- SKIELSEN_GAME_READY
- SKIELSEN_GAME_INIT
- SKIELSEN_GAME_STATE
- SKIELSEN_SCORE_UPDATE
- SKIELSEN_JOKER_REQUIRED
- SKIELSEN_GAME_FINISHED
- SKIELSEN_GAME_CLOSE
- SKIELSEN_GAME_ERROR

## Minority migration plan

1. Verify /games/minority/lab/ behaves like /minority-test/.
2. Move runtime input to SKIELSEN_GAME_INIT.
3. Emit SKIELSEN_GAME_FINISHED instead of owning tournament merge/close.
4. Introduce candidate build.
5. Multi-device QA.
6. Only then change full-app routing to the new stable build.

Existing production and Quick Games routes stay unchanged until promotion.