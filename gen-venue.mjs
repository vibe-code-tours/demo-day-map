#!/usr/bin/env node
// Demo Day VENUE generator — one big walled hall, community-corner style.
// 20 walled team booth-rooms (logo banner + chairs + video/live/Q&A zones) in a 4x5 grid,
// + entrance/stage band + special rooms (vote, gallery, feedback, social).
// Reuses community-corner LimeZu tilesets (cc-tilesets.json) + wall-box template (cc-templates.json)
// + team logo atlas (logo-atlas.*). Team data from teams.json. Render with render_tmj.py.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const teams = JSON.parse(readFileSync(resolve(HERE, "../vibe-code-tours-site/src/data/teams.json"), "utf8"))
  .slice().sort((a, b) => a.team_no - b.team_no);
const T = JSON.parse(readFileSync(resolve(HERE, "cc-templates.json"), "utf8"));  // {carpet, chairs[], wallbox[][]}
const ccTilesets = JSON.parse(readFileSync(resolve(HERE, "cc-tilesets.json"), "utf8"));
const LOGO = JSON.parse(readFileSync(resolve(HERE, "logo-atlas.json"), "utf8"));

const TS = 32;
const CARPET = T.carpet, CHAIRS = T.chairs, WALL = T.wallbox; // wallbox is 8w x 9h
const RW = WALL[0].length, RH = WALL.length; // room 8 x 9
const LOGO_FIRSTGID = 20001;

// --- layout ---
const COLS = 4, ROWS = 5, AISLE = 3, MARGIN = 4;
const TOP = 11;                        // entrance + stage band
const hpitch = RW + AISLE, vpitch = RH + AISLE;
const gridW = COLS * RW + (COLS - 1) * AISLE;
const MAP_W = MARGIN * 2 + gridW;
const SPECIAL_ROW_Y = TOP + ROWS * vpitch;      // special rooms below booths
const MAP_H = SPECIAL_ROW_Y + vpitch + MARGIN;

// --- external URLs ---
const SITE = "https://vibecode.tours";
const URLS = {
  vote: `${SITE}/vote`, personalGallery: `${SITE}/projects/personal`, teamGallery: `${SITE}/projects/teams`,
  home: `${SITE}/`, gallery: `${SITE}/gallery`,
  feedbackForm: "https://forms.gle/REPLACE_FEEDBACK_FORM",
  premiere: "https://www.youtube.com/embed/live_stream?channel=REPLACE_CHANNEL",
};

// --- tile-layer buffers ---
const floor = new Array(MAP_W * MAP_H).fill(CARPET);
const walls = new Array(MAP_W * MAP_H).fill(0);
const furniture = new Array(MAP_W * MAP_H).fill(0);
const collide = new Array(MAP_W * MAP_H).fill(0);
const startL = new Array(MAP_W * MAP_H).fill(0);
const idx = (x, y) => y * MAP_W + x;
const setW = (x, y, g) => { if (g) { walls[idx(x, y)] = g; collide[idx(x, y)] = g; } };
const setF = (x, y, g) => { if (g) furniture[idx(x, y)] = g; };

// --- object collectors ---
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

// stamp a walled room box at (ox,oy); door = clear bottom-center 2 tiles
function stampRoom(ox, oy) {
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) setW(ox + x, oy + y, WALL[y][x]);
  const dc = ox + Math.floor(RW / 2);
  walls[idx(dc, oy + RH - 1)] = 0; collide[idx(dc, oy + RH - 1)] = 0;
  walls[idx(dc - 1, oy + RH - 1)] = 0; collide[idx(dc - 1, oy + RH - 1)] = 0;
}
function logoAt(ox, oy, tileIndex, name) {
  logoObjs.push({ id: oid(), gid: LOGO_FIRSTGID + tileIndex, name,
    x: (ox + 2) * TS, y: (oy + 1) * TS + TS * 2, width: TS * 2, height: TS * 2, visible: true, rotation: 0 });
}

// ---------- booth rooms ----------
teams.forEach((t, i) => {
  const c = i % COLS, r = Math.floor(i / COLS);
  const ox = MARGIN + c * hpitch, oy = TOP + r * vpitch;
  const nn = String(t.team_no).padStart(2, "0");
  const yt = t.youtube_id ? `https://www.youtube.com/embed/${t.youtube_id}?autoplay=1&mute=1&loop=1&playlist=${t.youtube_id}` : null;
  stampRoom(ox, oy);
  logoAt(ox, oy, i, `logo-t${nn}`);
  // two chairs flanking the interior
  setF(ox + 2, oy + 5, CHAIRS[0]); setF(ox + 5, oy + 5, CHAIRS[1]);
  // interactive zones (invisible triggers)
  if (yt) add(web(`video-t${nn}`, ox + 1, oy + 1, 3, 2, yt));
  else add(text(`novideo-t${nn}`, ox + 1, oy + 3, 4, "video pending", 11));
  if (t.live_url) add(web(`kiosk-t${nn}`, ox + 4, oy + 3, 2, 2, t.live_url));
  else if (t.repo_url) add(web(`repo-t${nn}`, ox + 4, oy + 3, 2, 2, t.repo_url));
  add(jitsi(`qa-t${nn}`, ox + 1, oy + 5, 2, 2, `team-${nn}-booth`));
  // team name banner below the door (in the aisle)
  add(text(`name-t${nn}`, ox, oy + RH, RW, `${nn} · ${t.title || t.team}`, 12));
});

// ---------- entrance + stage band (top) ----------
{
  add(text("welcome", MARGIN, 1, gridW, "🎉 Vibe Code Tours — Cohort 1 Demo Day", 18));
  add(text("sponsor", MARGIN, 2, gridW, "🤝 Venue by WorkAdventure", 12));
  // info kiosks
  add(web("info-personal", MARGIN + 2, 4, 2, 2, URLS.personalGallery));
  add(text("l-ip", MARGIN + 2, 3, 6, "🖼️ Personal projects (78)"));
  add(web("info-teams", MARGIN + 10, 4, 2, 2, URLS.teamGallery));
  add(text("l-it", MARGIN + 10, 3, 6, "🏗️ Team projects (20)"));
  // stage: BBB + reel screen
  add(text("l-stage", MARGIN + 20, 3, 12, "🎬 MAIN STAGE — reels + awards"));
  add(area("stage-bbb", MARGIN + 20, 4, 6, 3, [prop("bbbMeeting", "demo-day-stage", "string"),
    prop("bbbTrigger", "onaction", "string"), prop("focusable", true, "bool")]));
  add(web("stage-reel", MARGIN + 27, 4, 4, 3, URLS.premiere));
  // spawn tiles at top center
  const sx = Math.floor(MAP_W / 2) - 1;
  for (let x = sx; x < sx + 2; x++) startL[idx(x, 1)] = T.wallbox ? 0 : 0; // start uses object-less tile; WA reads 'start' layer name
  for (let x = sx; x < sx + 2; x++) startL[idx(x, 1)] = 1; // placeholder gid; overwritten below with real start gid
}

// ---------- special rooms (bottom): vote · gallery · feedback · social ----------
const specials = [
  { name: "vote", label: "🗳️ VOTE ROOM", build: (ox, oy) => {
      add(web("vote-team", ox + 2, oy + 3, 3, 2, URLS.vote, [prop("openWebsiteAllowApi", true, "bool")]));
      add(text("l-vote", ox, oy + RH, RW, "🗳️ Vote — team People's Choice")); } },
  { name: "gallery", label: "🖼️ GALLERY ROOM", build: (ox, oy) => {
      add(web("gallery-a", ox + 1, oy + 2, 2, 2, URLS.personalGallery));
      add(web("gallery-b", ox + 4, oy + 2, 2, 2, URLS.gallery));
      add(text("l-gal", ox, oy + RH, RW, "🖼️ Browse all 78 personal projects")); } },
  { name: "feedback", label: "💬 FEEDBACK", build: (ox, oy) => {
      add(web("feedback", ox + 2, oy + 3, 3, 2, URLS.feedbackForm));
      add(text("l-fb", ox, oy + RH, RW, "💬 Leave feedback")); } },
  { name: "social", label: "🎮 SOCIAL", build: (ox, oy) => {
      add(jitsi("chitchat", ox + 1, oy + 2, 4, 4, "demo-day-chitchat"));
      add(area("social-audio", ox + 1, oy + 1, 6, 6, [prop("playAudio", "https://REPLACE_AMBIENT.mp3", "string"),
        prop("audioLoop", true, "bool"), prop("audioVolume", 0.3, "float")]));
      add(text("l-social", ox, oy + RH, RW, "☕ Chit-chat lounge")); } },
];
specials.forEach((s, i) => {
  const ox = MARGIN + i * hpitch, oy = SPECIAL_ROW_Y;
  stampRoom(ox, oy);
  add(text(`sp-${s.name}`, ox + 1, oy + 1, RW - 2, s.label, 12));
  s.build(ox, oy);
});

// ---------- outer boundary wall (collision border) ----------
const START_GID = 1; // WA start tiles read from a layer named "start"; any nonzero marks spawn
const spawnX = Math.floor(MAP_W / 2) - 1;
startL.fill(0);
startL[idx(spawnX, 1)] = START_GID; startL[idx(spawnX + 1, 1)] = START_GID;

// ---------- tilesets (cc + logo atlas) ----------
const tilesets = [...ccTilesets, {
  firstgid: LOGO_FIRSTGID, name: "logos", image: "logo-atlas.png",
  imagewidth: LOGO.cols * LOGO.cell, imageheight: LOGO.rows * LOGO.cell,
  tilewidth: LOGO.cell, tileheight: LOGO.cell, columns: LOGO.cols,
  tilecount: LOGO.cols * LOGO.rows, margin: 0, spacing: 0,
}];

const layer = (name, data, visible = true) => ({ name, type: "tilelayer", visible, opacity: 1, x: 0, y: 0, width: MAP_W, height: MAP_H, data });
const map = {
  compressionlevel: -1, width: MAP_W, height: MAP_H, tilewidth: TS, tileheight: TS,
  infinite: false, orientation: "orthogonal", renderorder: "right-down", type: "map",
  version: "1.10", tiledversion: "1.10.2", nextlayerid: 100, nextobjectid: _oid + 1, tilesets,
  layers: [
    layer("floor", floor), layer("furniture", furniture), layer("walls", walls),
    layer("collisions", collide, false), layer("start", startL, false),
    { id: 90, name: "floorLayer", type: "objectgroup", class: "floorLayer", visible: true, opacity: 1, x: 0, y: 0, draworder: "topdown", objects },
    { id: 91, name: "logos", type: "objectgroup", visible: true, opacity: 1, x: 0, y: 0, draworder: "topdown", objects: logoObjs },
  ],
  properties: [prop("mapName", "Vibe Code Tours — Demo Day", "string"),
    prop("mapDescription", "Cohort 1 finale: 20 team rooms + stage + vote + gallery + social", "string"),
    prop("mapImage", "demo-day.png", "string")],
};
writeFileSync(resolve(HERE, "demo-day.tmj"), JSON.stringify(map, null, 1));
console.log(`venue ${MAP_W}x${MAP_H} tiles | ${teams.length} booth rooms + ${specials.length} special | objects ${objects.length} logos ${logoObjs.length}`);
