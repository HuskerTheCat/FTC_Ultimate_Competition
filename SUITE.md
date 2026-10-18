# FTC Ultimate suite notes

FTC Ultimate Scout and [FTC Ultimate Inventory](https://github.com/HuskerTheCat/FTC_Ultimate_Inventory) share one Firebase project per team. This file lists what they share and logs changes that affect the other app. Read the other app's `SUITE.md` before changing anything below, and add a dated line to both files when you do.

## Shared

- **Firebase project**: one per team, set up once from either app.
- **Accounts**: the project's Firebase Auth, email and password.
- **Team docs**: `team/info`, `team/owner`, `join/info`, `members/{uid}`. Same shapes and join flow in every app.
- **Join codes**: `<projectId>-<secret>`, link `#join=<code>`. Sign in by team number through the hub's `teams/{key}`.
- **Rules**: one `firestore.rules`, identical in every app's repo, since publishing replaces the whole file. Each app checks its own version number: Inventory `rulesVersion()`, Scout `scoutRulesVersion()`.
- **Hub**: `ultimate-inventory-hub` (`hub.rules` in Inventory's repo). Team-level data only, never anything about a person.
- **Collection names**: Inventory's are unprefixed; Scout's start with `scout`.
- **Device storage**: both websites share `huskerthecat.github.io`. Scout uses `ftc-scout-*` keys and starts Firebase as the named app `scout`.
- **Brand**: the split cube logo (Inventory blue, Scout orange, Design green), Orbitron for names, the topo background.

## Changes

- 2026-10-18: Scout started with Inventory's team, join and hub code. Combined `firestore.rules`: Inventory's rules unchanged (version 5) plus Scout's section (`scoutRulesVersion` 1, only `scoutRulesVersion/{version}` so far). Inventory's repo doesn't have the combined file yet.
