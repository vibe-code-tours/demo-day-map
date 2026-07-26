# Demo Day Map — Vibe Code Tours

One big WorkAdventure map for the Cohort 1 Demo Day (2026-07-26).

Visitors spawn at the **bottom** and walk **up**:

```
        [P VOTE]                    [T VOTE]        vote counters
   [07][08][09][10][11][12][13][14]                 20 team booths, horseshoe
   [06]                        [15]
   [05]        ( STAGE )       [16]                 stage in the plaza
   [04]                        [17]
   [01..03]                    [18..20]
        [P GALLERY]            [T GALLERY]          gallery kiosks
                  [ start ]                         spawn
```

Booth rooms are walled boxes with the door facing the plaza. Gallery and vote are **open kiosks** —
no doors, so 98 people don't queue at a doorway when voting opens.

## Commands

```bash
node seed-teams.mjs     # create teams/team-NN.yaml (skips files that already exist)
node gen-venue.mjs      # teams/*.yaml -> demo-day.tmj
node check-map.mjs      # structural validation — run before publishing
python3 render_tmj.py demo-day.tmj demo-day-render.png   # visual check
```

`check-map.mjs` exits non-zero on: gids that fall in a gap between tilesets, areas sitting on
collision tiles, areas walled off from spawn, objects out of bounds, or a booth losing its Q&A room.
Run it after every change — a bad gid renders as *nothing*, so a render alone will not catch it.

## Per-team content: `teams/team-NN.yaml`

One flat file per team, hand-editable. Blank value = that booth area is **omitted**, so an empty
field never leaves a dead zone in the room.

| Field | Booth area | Blank behaviour |
|---|---|---|
| `video_url` | screen on the wall | no video area (YouTube links auto-embed, others open as a link) |
| `slide_url` | presentation board | no slide area |
| `site_url` | info counter | falls back to `repo_url` |
| `repo_url` | (fallback for `site_url`) | — |
| `logo_url` | wall banner | falls back to the generated team badge |
| — | Q&A jitsi room | always present, room name is `team-NN-booth` |

`logo_url` is the **source for `fetch-logos.py`**, which bakes logos into `logo-atlas.png`. The map
draws the atlas tile, not the remote image — WA cannot load a logo straight from a URL as a tile.
After editing `logo_url`, re-run `fetch-logos.py`, then `gen-venue.mjs`.

Only flat `key: value` lines are supported. Indentation or a list makes the generator fail loudly
with the file and line number rather than silently producing an empty booth.

## Publishing

- **Play (global):** https://play.workadventu.re/_/global/vibecode.tours/demo-day-map/demo-day.tmj
- For SaaS (needed for the in-WA vote `userRoomToken`): point the SaaS world at the same
  `demo-day.tmj` URL.
- `demo-day-v1.tmj.bak` is the previous 4x5-grid venue, kept as a rollback until the new map is
  confirmed live in WorkAdventure.

## Vote kiosks

Both ballots are live and **public** — anyone may vote, cohort membership is not required.
One vote per email address per ballot, inside the 19:00–21:45 MMT window.

| Kiosk | Opens | Needs |
|---|---|---|
| ⭐ PERSONAL People's Choice | `proxy.vibecode.tours/vote/pvote.html` | `openWebsiteAllowApi` |
| 🏆 TEAM People's Choice | `proxy.vibecode.tours/vote/vote.html` | `openWebsiteAllowApi` |

Both pages read `WA.player.*` for the uuid audit trail, so both kiosks set
`openWebsiteAllowApi = true`. Without it the page stalls ~2.5s and falls back to a localStorage id.

## Known gaps

- `URLS.premiere` in `gen-venue.mjs` still has a `REPLACE_CHANNEL` placeholder — the stage reel
  screen will not play until that is set.
- Teams 02 and 05 have no demo video in `teams.json`, so their booths have no video area.
- All 20 `logo_url` and `slide_url` are blank; booths fall back to the generated badge and skip
  the slide board until they are filled in.
