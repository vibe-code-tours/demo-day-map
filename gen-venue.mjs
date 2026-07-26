#!/usr/bin/env node
// Demo Day VENUE generator — one big walled hall, community-corner style.
//
// Walk direction is BOTTOM -> TOP:
//
//        [P VOTE]                    [T VOTE]          <- vote band
//   [07][08][09][10][11][12][13][14]                   <- booth horseshoe (top row)
//   [06]                        [15]
//   [05]        ( STAGE )       [16]                   <- stage sits in the plaza
//   [04]                        [17]
//   [01..03]                    [18..20]
//        [P GALLERY]            [T GALLERY]            <- gallery band
//                  [ start ]                           <- spawn, bottom
//
// Booth rooms are walled boxes (cc-templates wallbox) whose door faces the plaza.
// Vote + gallery are open kiosks (no walls) so 98 people don't queue at a door.
// Per-team content comes from teams/team-NN.yaml — see seed-teams.mjs.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseFlatYaml } from "./lib/yaml.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const T = JSON.parse(readFileSync(resolve(HERE, "cc-templates.json"), "utf8")); // {carpet, chairs[], plant, wallbox[][], desk}
const ccTilesets = JSON.parse(readFileSync(resolve(HERE, "cc-tilesets.json"), "utf8"));
const LOGO = JSON.parse(readFileSync(resolve(HERE, "logo-atlas.json"), "utf8"));

// ---------- team data: one YAML per team ----------
const TEAMS_DIR = resolve(HERE, "teams");
const teams = readdirSync(TEAMS_DIR)
  .filter((f) => f.endsWith(".yaml"))
  .sort()
  .map((f) => ({ file: f, ...parseFlatYaml(readFileSync(resolve(TEAMS_DIR, f), "utf8"), f) }))
  .sort((a, b) => a.team_no - b.team_no);

if (teams.length !== 20) throw new Error(`expected 20 team files in teams/, found ${teams.length}`);

// ---------- external URLs ----------
const SITE = "https://vibecode.tours";
const URLS = {
  personalGallery: `${SITE}/projects/personal/`,
  teamGallery: `${SITE}/projects/teams/`,
  gallery: `${SITE}/gallery/`,
  teamVote: "https://proxy.vibecode.tours/vote/vote.html",
  personalVote: "https://proxy.vibecode.tours/vote/pvote.html",
  premiere: "https://www.youtube.com/embed/live_stream?channel=REPLACE_CHANNEL",
};

// ---------- geometry ----------
const TS = 32;
const CHAIRS = T.chairs, WALL = T.wallbox, PLANT = T.plant;
// NOTE: cc-templates.json also has a `desk` block, but its gids (12245+) fall in a gap
// between tilesets — nothing owns them, so they render as empty and WA rejects them.
// These gids were read off the 19_Hospital_32x32 sheet (firstgid 1037) and are all in range.
// check-map.mjs fails the build if any of them ever drift out of a tileset range again.
const FURN = {
  tv: 1306,                                  // wall screen — marks the video zone
  boardGreen: [[1373, 1374], [1389, 1390]],  // 2x2 presentation board — slide zone
  counter: [1326, 1327],                     // low wooden counter — info/kiosk desk
  bench: [1412, 1413],                       // 2-tile bench
  plantTall: 1341,
};
const RW = WALL[0].length, RH = WALL.length; // room 8 x 9
const AISLE = 3, MARGIN = 4;
const hpitch = RW + AISLE, vpitch = RH + AISLE;
const LOGO_FIRSTGID = 20001;
const WA_EXT_FIRSTGID = LOGO_FIRSTGID + LOGO.cols * LOGO.rows + 1;  // 20022
// Grass floor from WA_Exterior (row 0, col 3). The old CARPET gid 218 was blue-gray
// and looked like an indoor floor — wrong for an open-air venue.
const GRASS = WA_EXT_FIRSTGID + 3;  // 20025

const GRID_COLS = 8, GRID_ROWS = 7;          // 7 left + 6 top + 7 right = 20 booths
const gridW = GRID_COLS * RW + (GRID_COLS - 1) * AISLE;
const gridH = GRID_ROWS * RH + (GRID_ROWS - 1) * AISLE;

const VOTE_H = 10, GALLERY_H = 10, ENTRY_H = 11;
const BANNER_H = 2;                        // booth name banner sits in the aisle below each room
// even width so centred things land on an exact tile boundary instead of half a tile off
const MAP_W = (MARGIN * 2 + gridW) + ((MARGIN * 2 + gridW) % 2);
const VOTE_Y = MARGIN;
const GRID_Y = VOTE_Y + VOTE_H;
// +BANNER_H+1: the bottom booth row's name banners live below the rooms, and would
// otherwise print straight on top of the gallery band sign
const GALLERY_Y = GRID_Y + gridH + BANNER_H + 1;
const ENTRY_Y = GALLERY_Y + GALLERY_H;
const MAP_H = ENTRY_Y + ENTRY_H + MARGIN;

const colX = (c) => MARGIN + c * hpitch;
const rowY = (r) => GRID_Y + r * vpitch;

// Everything that should read as "centred" is placed through these, so nothing is
// eyeballed against a column index. Odd map widths cost at most half a tile.
const centerX = (w) => Math.round((MAP_W - w) / 2);
// left/right x for a symmetric pair of w-wide things separated by `gap` tiles
const centerPair = (w, gap) => { const x = centerX(2 * w + gap); return [x, x + w + gap]; };

const KIOSK_W = 4, KIOSK_GAP = 22;      // gallery + vote counters, one pair per band
const [KIOSK_L, KIOSK_R] = centerPair(KIOSK_W, KIOSK_GAP);
const STAGE_W = 10;
const STAGE_X = centerX(STAGE_W);

// Horseshoe slot for booth index 0..19 (team 01..20), plus which wall holds the door.
// 0-6 -> left column bottom-to-top | 7-12 -> top row left-to-right | 13-19 -> right column top-to-bottom
function slotFor(i) {
  if (i < 7) return { col: 0, row: 6 - i, door: "right" };
  if (i < 13) return { col: i - 6, row: 0, door: "bottom" };
  return { col: GRID_COLS - 1, row: i - 13, door: "left" };
}

// ---------- tile-layer buffers ----------
const floor = new Array(MAP_W * MAP_H).fill(GRASS);
const walls = new Array(MAP_W * MAP_H).fill(0);
const furniture = new Array(MAP_W * MAP_H).fill(0);
const collide = new Array(MAP_W * MAP_H).fill(0);
const startL = new Array(MAP_W * MAP_H).fill(0);
const idx = (x, y) => y * MAP_W + x;
const setW = (x, y, g) => { if (g) { walls[idx(x, y)] = g; collide[idx(x, y)] = g; } };
const clearW = (x, y) => { walls[idx(x, y)] = 0; collide[idx(x, y)] = 0; };
const setF = (x, y, g) => { if (g) furniture[idx(x, y)] = g; };
// DESK is a multi-tile sprite ([row][col] of gids), so it has to be stamped as a block.
// rows/cols let a caller take just the front slice of it instead of the whole 4x6 desk.
function stampBlock(ox, oy, block, rows = block.length, cols = block[0].length) {
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) setF(ox + x, oy + y, block[y][x]);
}

// ---------- object collectors ----------
let _oid = 0; const oid = () => ++_oid;
const prop = (n, v, t) => ({ name: n, type: t, value: v });
const objects = []; const logoObjs = [];
const add = (...o) => objects.push(...o);

function area(name, x, y, w, h, props) {
  return { id: oid(), name, type: "area", class: "area", x: x * TS, y: y * TS, width: w * TS, height: h * TS,
    rotation: 0, visible: true, ellipse: false, properties: props };
}
function text(name, x, y, w, s, size = 13) {
  return { id: oid(), name, type: "", x: x * TS, y: y * TS, width: w * TS, height: TS * 2, rotation: 0,
    visible: true, text: { text: s, fontfamily: "Sans Serif", pixelsize: size, wrap: true, color: "#ffffff", bold: true } };
}
const web = (name, x, y, w, h, url, extra = []) => area(name, x, y, w, h, [
  prop("openWebsite", url, "string"), prop("openWebsiteTrigger", "onaction", "string"),
  prop("openWebsitePolicy", "autoplay; fullscreen", "string"), prop("openWebsiteWidth", 45, "int"),
  prop("focusable", true, "bool"), ...extra]);
const jitsi = (name, x, y, w, h, room) => area(name, x, y, w, h, [
  prop("jitsiRoom", room, "string"), prop("jitsiTrigger", "onaction", "string"),
  prop("jitsiConfig", '{"startWithAudioMuted":true}', "string"), prop("focusable", true, "bool")]);

// A YouTube link becomes an inline autoplaying embed; anything else (Drive, Vimeo…) opens as-is.
const YT = /(?:youtu\.be\/|[?&]v=|youtube\.com\/embed\/)([\w-]{11})/;
function videoEmbed(url) {
  const m = url && YT.exec(url);
  if (!m) return url || null;
  const id = m[1];
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}`;
}

// stamp a walled room box at (ox,oy); door = 2 clear tiles in the named wall
function stampRoom(ox, oy, door = "bottom") {
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) setW(ox + x, oy + y, WALL[y][x]);
  if (door === "bottom") {
    const dc = ox + Math.floor(RW / 2);
    clearW(dc, oy + RH - 1); clearW(dc - 1, oy + RH - 1);
  } else {
    const dx = door === "right" ? ox + RW - 1 : ox;
    const dy = oy + Math.floor(RH / 2);
    clearW(dx, dy); clearW(dx, dy + 1);
  }
}
function logoAt(ox, oy, tileIndex, name) {
  logoObjs.push({ id: oid(), gid: LOGO_FIRSTGID + tileIndex, name,
    x: (ox + 3) * TS, y: (oy + 1) * TS + TS * 2, width: TS * 2, height: TS * 2, visible: true, rotation: 0 });
}

// ---------- booth rooms (the horseshoe) ----------
const missing = { logo: [], video: [], site: [], slide: [] };
teams.forEach((t, i) => {
  const { col, row, door } = slotFor(i);
  const ox = colX(col), oy = rowY(row);
  const nn = String(t.team_no).padStart(2, "0");
  stampRoom(ox, oy, door);

  // logo banner on the back wall — always the atlas tile.
  // logo_url in the YAML is the SOURCE for fetch-logos.py, not a live image the map loads.
  logoAt(ox, oy, i, `logo-t${nn}`);
  if (!t.logo_url) missing.logo.push(nn);

  // furniture marks each zone so a visitor can see what a spot does before pressing SPACE
  setF(ox + 2, oy + 2, FURN.tv);                       // video screen
  stampBlock(ox + 5, oy + 1, FURN.boardGreen);         // slide board
  setF(ox + 1, oy + 6, FURN.counter[0]); setF(ox + 2, oy + 6, FURN.counter[1]); // info desk
  setF(ox + 1, oy + 4, FURN.bench[0]); setF(ox + 2, oy + 4, FURN.bench[1]);
  setF(ox + 4, oy + 5, CHAIRS[0]); setF(ox + 6, oy + 5, CHAIRS[1]);             // Q&A seats
  setF(ox + 6, oy + 7, FURN.plantTall);

  // --- the five booth areas. Blank field -> area omitted, so no dead zone. ---
  const video = videoEmbed(t.video_url);
  if (video) add(web(`video-t${nn}`, ox + 1, oy + 2, 3, 2, video));
  else missing.video.push(nn);

  if (t.slide_url) add(web(`slide-t${nn}`, ox + 5, oy + 2, 2, 2, t.slide_url));
  else missing.slide.push(nn);

  const site = t.site_url || t.repo_url;
  if (site) add(web(`site-t${nn}`, ox + 1, oy + 6, 2, 2, site));
  else missing.site.push(nn);

  add(jitsi(`qa-t${nn}`, ox + 4, oy + 5, 3, 3, `team-${nn}-booth`));

  // name banner in the aisle below the room
  add(text(`name-t${nn}`, ox, oy + RH, RW, `${nn} · ${t.title || t.team}`, 12));
});

// ---------- open kiosks (no walls) ----------
// A kiosk is a desk run + screen area + sign. Used for gallery and vote so there is no door bottleneck.
function kiosk(name, ox, oy, label, url, extra = []) {
  setF(ox + 1, oy + 1, FURN.tv); setF(ox + 2, oy + 1, FURN.tv);
  for (let x = 0; x < 4; x++) setF(ox + x, oy + 2, FURN.counter[x % 2]);
  setF(ox - 1, oy + 2, FURN.plantTall); setF(ox + 4, oy + 2, FURN.plantTall);
  add(text(`l-${name}`, ox - 2, oy, 8, label, 14));
  add(web(name, ox, oy + 3, 4, 2, url, extra));
}

// vote band (top of the map — last stop on the way up)
{
  const y = VOTE_Y;
  add(text("sign-vote", MARGIN, y, gridW, "🗳️ VOTE — walk up to a counter and press SPACE", 16));
  // Both ballots read WA.player.* for the uuid audit trail, so both need the iframe API.
  // Without it the page stalls for 2.5s and falls back to a localStorage id.
  const allowApi = [prop("openWebsiteAllowApi", true, "bool")];
  kiosk("vote-personal", KIOSK_L, y + BANNER_H, "⭐ PERSONAL People's Choice", URLS.personalVote, allowApi);
  kiosk("vote-team", KIOSK_R, y + BANNER_H, "🏆 TEAM People's Choice", URLS.teamVote, allowApi);
}

// gallery band (below the horseshoe — first stop after the entrance)
{
  const y = GALLERY_Y;
  add(text("sign-gallery", MARGIN, y, gridW, "🖼️ GALLERY — browse every project before you vote", 16));
  kiosk("gallery-personal", KIOSK_L, y + BANNER_H, "🖼️ PERSONAL projects (78)", URLS.personalGallery);
  kiosk("gallery-team", KIOSK_R, y + BANNER_H, "🏗️ TEAM projects (20)", URLS.teamGallery);
}

// ---------- main stage: centred in the plaza inside the horseshoe ----------
{
  const plazaY = rowY(1), plazaH = rowY(GRID_ROWS) - rowY(1);
  const sx = STAGE_X;
  const sy = plazaY + Math.floor(plazaH / 2) - 3;
  add(text("sign-stage", sx - 2, sy - 2, 16, "🎬 MAIN STAGE — reels + awards", 18));
  // big board behind the stage room, screens on the reel side, counters along the front
  stampBlock(sx + 1, sy + 1, FURN.boardGreen);
  setF(sx + 7, sy + 1, FURN.tv); setF(sx + 8, sy + 1, FURN.tv);
  for (let x = 0; x < 10; x++) setF(sx + x, sy + 5, FURN.counter[x % 2]);
  setF(sx - 1, sy + 2, FURN.plantTall); setF(sx + 10, sy + 2, FURN.plantTall);
  setF(sx - 1, sy + 5, PLANT); setF(sx + 10, sy + 5, PLANT);
  // a few benches so the plaza reads as an auditorium, not an empty field
  for (let r = 0; r < 3; r++) for (let b = 0; b < 4; b++) {
    const bx = sx + b * 3, by = sy + 8 + r * 2;
    setF(bx, by, FURN.bench[0]); setF(bx + 1, by, FURN.bench[1]);
  }
  add(area("stage-bbb", sx, sy + 1, 5, 4, [prop("bbbMeeting", "demo-day-stage", "string"),
    prop("bbbTrigger", "onaction", "string"), prop("focusable", true, "bool")]));
  add(web("stage-reel", sx + 6, sy + 1, 4, 4, URLS.premiere));
  add(text("l-stage-bbb", sx, sy + 7, 6, "🎤 Stage room", 12));
  add(text("l-stage-reel", sx + 6, sy + 7, 5, "▶️ Reel screen", 12));
}

// ---------- entrance (bottom): spawn + welcome ----------
{
  const y = ENTRY_Y;
  add(text("welcome", MARGIN, y + 1, gridW, "🎉 Vibe Code Tours — Cohort 1 Demo Day", 20));
  add(text("wayfinding", MARGIN, y + 3, gridW,
    "⬆️ Walk UP: gallery → stage → 20 team booths → vote. SPACE opens a screen.", 14));
  add(text("sponsor", MARGIN, y + 5, gridW, "🤝 Venue by WorkAdventure", 12));
}

// spawn strip at the very bottom, centred
const START_GID = 1; // WA reads the layer named "start"; any nonzero tile marks a spawn point
const spawnX = centerX(4);
const spawnY = MAP_H - MARGIN - 1;
for (let x = spawnX; x < spawnX + 4; x++) startL[idx(x, spawnY)] = START_GID;

// ---------- no perimeter boundary wall ----------
// WA already blocks walking off the map edge. Drawing a collision border
// around the whole venue added a visible wall line in the render even though
// the collisions layer is invisible in WA. Removing it so the venue reads
// as an open field.

// ---------- tilesets (cc + WA exterior + logo atlas) ----------
// WA_Exterior provides the grass floor; it was not in cc-tilesets.json.
const waExtCols = 25, waExtRows = 34;
const tilesets = [...ccTilesets, {
  firstgid: WA_EXT_FIRSTGID, name: "WA_Exterior", image: "tilesets/WA_Exterior.png",
  imagewidth: waExtCols * 32, imageheight: waExtRows * 32,
  tilewidth: 32, tileheight: 32, columns: waExtCols,
  tilecount: waExtCols * waExtRows, margin: 0, spacing: 0,
}, {
  firstgid: LOGO_FIRSTGID, name: "logos", image: "logo-atlas.png",
  imagewidth: LOGO.cols * LOGO.cell, imageheight: LOGO.rows * LOGO.cell,
  tilewidth: LOGO.cell, tileheight: LOGO.cell, columns: LOGO.cols,
  tilecount: LOGO.cols * LOGO.rows, margin: 0, spacing: 0,
}];

const layer = (name, data, visible = true) => ({ name, type: "tilelayer", visible, opacity: 1,
  x: 0, y: 0, width: MAP_W, height: MAP_H, data });

const map = {
  compressionlevel: -1, width: MAP_W, height: MAP_H, tilewidth: TS, tileheight: TS,
  infinite: false, orientation: "orthogonal", renderorder: "right-down", type: "map",
  version: "1.10", tiledversion: "1.10.2", nextlayerid: 100, nextobjectid: _oid + 1, tilesets,
  layers: [
    layer("floor", floor), layer("furniture", furniture), layer("walls", walls),
    layer("collisions", collide, false), layer("start", startL, false),
    { id: 90, name: "floorLayer", type: "objectgroup", class: "floorLayer", visible: true, opacity: 1,
      x: 0, y: 0, draworder: "topdown", objects },
    { id: 91, name: "logos", type: "objectgroup", visible: true, opacity: 1,
      x: 0, y: 0, draworder: "topdown", objects: logoObjs },
  ],
  properties: [prop("mapName", "Vibe Code Tours — Demo Day", "string"),
    prop("mapDescription", "Cohort 1 finale: entrance → gallery → stage → 20 team booths → vote", "string"),
    prop("mapImage", "demo-day.png", "string")],
};

const OUT = resolve(HERE, "demo-day.tmj");
writeFileSync(OUT, JSON.stringify(map, null, 1));

const count = (p) => objects.filter((o) => o.properties?.some((q) => q.name === p)).length;
console.log(`venue ${MAP_W}x${MAP_H} tiles | ${teams.length} booths + 4 kiosks + stage`);
console.log(`objects ${objects.length} (web ${count("openWebsite")}, jitsi ${count("jitsiRoom")}) | logos ${logoObjs.length}`);
for (const [k, v] of Object.entries(missing)) {
  if (v.length) console.log(`  no ${k}_url (${v.length}): ${v.join(" ")}`);
}
console.log(`wrote ${OUT}`);
