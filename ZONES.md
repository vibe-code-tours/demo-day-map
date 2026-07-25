# Booth zones — build one room, clone 1→20, fill per team

You hand-build ONE booth room (walls, chairs, desk, screen art) with the interactive **areas**
below, then clone it 20× and set each clone's URLs from `booth-zones.json` (one row per team).

In WA / Tiled an **area** = a rectangle object in the `floorLayer` object group with properties.

## Area types per booth

| Zone | Purpose | Object properties (key = value) |
|---|---|---|
| **Video / slides** | play the team's demo video (or slides) | `openWebsite` = `<video_embed>` · `openWebsiteTrigger` = `onaction` · `openWebsitePolicy` = `autoplay; fullscreen` · `openWebsiteWidth` = `45` · `focusable` = `true` |
| **Live URL** | open the team's live app | `openWebsite` = `<live_url>` · `openWebsiteTrigger` = `onaction` · `focusable` = `true` |
| **Repo** (fallback if no live) | open GitHub repo | `openWebsite` = `<repo_url>` · `openWebsiteTrigger` = `onaction` |
| **Jitsi Q&A** | live booth chat | `jitsiRoom` = `<jitsi_room>` · `jitsiTrigger` = `onaction` · `jitsiConfig` = `{"startWithAudioMuted":true}` · `focusable` = `true` |
| **Name sign** | team label (text object) | text = `NN · <title>` |
| **Logo** | team logo (tile object) | gid = logo-atlas tile `logo_tile` (or your own logo art) |

Notes:
- `openWebsiteTrigger = onaction` → opens only when the avatar presses **Space** inside the zone
  (not on walk-through). Use it for every openWebsite so booths don't auto-spam.
- `autoplay` needs `mute=1` in the YouTube embed URL (already in `video_embed`).
- **Slides/screenshots are personal-project only** — teams have video + live + repo (no slide/screenshot data).
  For team booths use video_embed. The personal slides/screenshots live in the Gallery room (site page).
- 10/20 teams have a real YouTube embed; 10 are Drive-only (`video_embed` = the Drive URL) — those open
  the Drive page instead of an inline player until re-uploaded to YouTube.

## Data: `booth-zones.json`

One object per team with everything to fill a cloned room:
`team_no, team, title, desc, video_embed, live_url, repo_url, jitsi_room, logo_tile, has_video`

If you'd rather I inject all 20 automatically: build one room with areas **named** `video`, `live`,
`repo`, `qa`, `name`, `logo`, export the `.tmj`, hand it to me, and I'll stamp it 20× with each
team's data (the clone-1→20 step, scripted).
