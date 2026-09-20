# SKIELSEN Documentation

This directory contains **current source-of-truth documentation only**. Historical implementation plans, old handoffs and superseded audits belong in Git history, not in the active documentation tree.

## Global contracts

- [Game Design Contract](GAME_DESIGN_CONTRACT.md) — layout, responsive behavior, results, mobile keyboard behavior and data-binding rules for every game.
- [Theme Contract](THEME_CONTRACT.md) — semantic color/token authority and contrast requirements.
- [Theme Template](THEME_TEMPLATE.css) — starting point for a new theme.

## Word Chain

- [Game Contract](WORTKETTE_GAME_CONTRACT.md) — current gameplay and workflow rules.
- [Design Contract](WORTKETTE_DESIGN_CONTRACT.md) — current desktop/mobile visual contract.
- [Database Contract](WORTKETTE_DATABASE.md) — current persistence, RPC and result-state contract.

## Infrastructure

- [Cloudflare Pages](CLOUDFLARE.md) — deployment notes for the secondary hosting target.

## Documentation rule

A document stays here only while it describes the **current system**. Temporary migration plans, coding-agent handoffs and pre-merge audits are removed after their work is complete; Git preserves their history.
