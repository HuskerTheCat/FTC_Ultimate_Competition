# FTC Ultimate suite notes

The FTC Ultimate apps, [Inventory](https://github.com/HuskerTheCat/FTC_Ultimate_Inventory), Competition and [Design](https://github.com/HuskerTheCat/FTC_Ultimate_Design), share one Firebase project per team. This file lists what they share and what the other apps still have to copy. Before a change, read only Shared and Open here and in the other apps' `SUITE.md`. Finished changes are in [docs/SUITE-HISTORY.md](docs/SUITE-HISTORY.md) (no need to read it).

## Shared

- **Firebase project**: one per team, set up once from either app (SETUP.md in Inventory).
- **Accounts**: the project's Firebase Auth, email and password.
- **Team docs**: `team/info`, `team/owner`, `join/info`, `members/{uid}`. Same shapes and join flow in every app.
- **Join codes**: `<projectId>-<secret>`, link `#join=<code>`. Sign in by team number through the hub's `teams/{key}`.
- **Rules**: one `firestore.rules`, byte-for-byte identical in every app's repo, since publishing replaces the whole file. Whoever changes it copies the whole file into every other app's repo in the same change (never only your own section), so publishing from any app gives the team every app's rules. Each app checks its own version number in that file: Inventory `rulesVersion()`, Competition `scoutRulesVersion()`, Design `designRulesVersion()`. Current: Inventory 10, Competition 7 (2026-11-15).
- **Hub**: `ultimate-inventory-hub` (`hub.rules` in Inventory). Team-level data only, never anything about a person.
- **Collection names**: Inventory's are unprefixed; Competition's start with `scout` (kept from its old name, Scout), Design's with `design`.
- **Brand**: the split cube logo, Orbitron for names, Saira for all other text (`@fontsource/saira`, weights 400-700), the topo background. App colors, dark mode / light mode: Inventory blue `#5b9bff` / `#2563d9`, Competition orange `#ffa53d` / `#c25f08`, Design green `#45d08f` / `#16804d`. The app switcher shows each app's name in Orbitron in its color. New screens in any app use these.

## Open for other apps

Add one line when a change needs the other apps to act; delete it once every app has it.

| Change | Who | Copy from |
|---|---|---|
