# Demo Day Map — Vibe Code Tours

One big WorkAdventure map for the Cohort 1 Demo Day (2026-07-26): main stage, 20 team booths,
personal gallery hall, vote + feedback plaza, social wing.

- **Regenerate:** `node gen-map.mjs` (reads `../vibe-code-tours-site/src/data/teams.json`)
- **Preview:** `node gen-preview.mjs` → `demo-day-preview.svg`
- **Play (global):** https://play.workadventu.re/_/global/vibe-code-tours.github.io/demo-day-map/demo-day.tmj
- For SaaS (needed for in-WA vote `userRoomToken`): point the SaaS world at the same `demo-day.tmj` URL.

Map is script-free static: just `demo-day.tmj` + `tilesets/`. Flat floor + border walls; decorate in Tiled / WA map-editor.
