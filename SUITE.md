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
- 2026-10-18: Home page: the line between Sign in and Join code is now exactly centered (it was 6px right of center). CSS only (`.split` in `src/style.css`, computers and tablets block). Same fix made in Inventory, Scout and Design.
- 2026-10-20: Topographic background: new smooth `src/topo.svg` (1200x2400 seamless tile, repeats down the page) and the lines drift at exactly 30% of the scroll speed, pure CSS (scroll-driven animation on `body::after` with `will-change: transform`; gradient is a fixed `100lvh` layer; still when reduced motion is on). CSS and `topo.svg` only (`src/style.css`, "first screens sit on the topographic map" block). Same change in Inventory, Scout and Design; Inventory also glides to guide sections.
- 2026-10-20: Rules: `scoutRulesVersion` 2 adds `scoutRoutes/{id}` (team members read, write and delete; fields checked by `validRoute()`). Inventory's rules unchanged. The team admin republishes the combined file. Copy it into Inventory's repo when this merges.
- 2026-10-21: App switcher: the home page's cube is a button (`#apps-toggle`) opening a menu "FTC Ultimate" with Inventory, Scout and Design, each with its cube (the other two apps' `public/icon.svg` copied into `src/`). The current app is highlighted; the others link to `https://huskerthecat.github.io/FTC_Ultimate_<App>/`. Inventory has the same menu on its home page and main screen, and on Windows and Android opens the installed app instead (scheme `ftc-ultimate-<app>`, package id `io.github.huskerthecat.ftc<app>`; see Inventory's SUITE.md). Give Scout's Windows and Android apps the same when they are built.
- 2026-10-21: Rules: `scoutRulesVersion` 3 adds `scoutMatches/{id}` (one team's result in one match; members read, add their own, delete) `scoutButtons/{id}` (team-wide custom Scout buttons: label, points, period) and `scoutPits/{team}` (pit interviews by team number). Inventory's rules unchanged. Copy the combined file into Inventory's repo when this merges.
- 2026-10-21: Rules: `scoutRulesVersion` 4 adds `scoutSettings/robot` (the team’s robot size and speeds that new routes start with; members read and write). Inventory’s rules unchanged. Copy the combined file into Inventory’s repo when this merges.
- 2026-10-21: Rules: `scoutRulesVersion` 5 lets `scoutMatches` records carry `events` (each tap in order: period, id and seconds since Start match, or null without the match clock). Inventory’s rules unchanged. Copy the combined file into Inventory’s repo when this merges.
- 2026-10-21: Scout's signed-in screens now use Inventory's layout: the header (cube with the app switcher, team name in Orbitron with "Scout" under it on phones, an icon-only Scan on phones, the ☰ menu) and the contour lines behind it, a picker under the header (Scout: events, like Inventory's inventory picker), a search row, and the main action as a floating button on phones. Scout keeps its bottom tab bar.
