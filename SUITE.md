# FTC Ultimate suite notes

The FTC Ultimate apps, [Inventory](https://github.com/HuskerTheCat/FTC_Ultimate_Inventory), Competition and [Design](https://github.com/HuskerTheCat/FTC_Ultimate_Design), share one Firebase project per team. This file lists what they share and what the other apps still have to copy. Before a change, read only Shared and Open here and in the other apps' `SUITE.md`. Finished changes are in [docs/SUITE-HISTORY.md](docs/SUITE-HISTORY.md) (no need to read it).

## Shared

- **Firebase project**: one per team, set up once from either app (SETUP.md in Inventory).
- **Accounts**: the project's Firebase Auth, email and password.
- **Team docs**: `team/info`, `team/owner`, `join/info`, `members/{uid}`. Same shapes and join flow in every app.
- **Join codes**: `<projectId>-<secret>`, link `#join=<code>`. Sign in by team number through the hub's `teams/{key}`.
- **Rules**: one `firestore.rules`, identical in every app's repo, since publishing replaces the whole file. Each app checks its own version number: Inventory `rulesVersion()`, Competition `scoutRulesVersion()`, Design `designRulesVersion()`.
- **Hub**: `ultimate-inventory-hub` (`hub.rules` in Inventory). Team-level data only, never anything about a person.
- **Collection names**: Inventory's are unprefixed; Competition's start with `scout` (kept from its old name, Scout), Design's with `design`.
- **Brand**: the split cube logo, Orbitron for names, Saira for all other text (`@fontsource/saira`, weights 400-700), the topo background. App colors, dark mode / light mode: Inventory blue `#5b9bff` / `#2563d9`, Competition orange `#ffa53d` / `#c25f08`, Design green `#45d08f` / `#16804d`. The app switcher shows each app's name in Orbitron in its color. New screens in any app use these.

## Open for other apps

Add one line when a change needs the other apps to act; delete it once every app has it.

| Change | Who | Copy from |
|---|---|---|
| Inventory rules v9 (v8: custom parts, `builds`, order `status`; v9: condition `'damaged'`; includes v7) | Competition, Design | `validPart()`, `validBuild()`, `validOrder()`, `builds` match, log action `'made'`, `rulesVersion()` in Inventory's `firestore.rules` |
| Competition rules v7 (`scoutRoutes`, `scoutMatches`, `scoutButtons`, `scoutPits`, `scoutSettings`, `scoutAlliances`, `scoutCheckIns`, `scoutPings`) | Inventory, Design | `scoutRulesVersion()` and every `scout*` match in Competition's `firestore.rules` |
