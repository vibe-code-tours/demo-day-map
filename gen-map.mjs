#!/usr/bin/env node
// Demo Day venue generator — ONE big WorkAdventure map.
// Bands (top→bottom): Entrance/Info · Main Stage · 20 Team Booths · Personal Gallery Hall
//                     · Vote+Feedback Plaza · Social Wing (Game + Chit-Chat).
// Team data: vibe-code-tours-site/src/data/teams.json (20). Personal = gallery kiosk (all 78).
// Zones = Tiled objects (type "area") in the floorLayer objectgroup (WA convention).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEAMS_JSON = resolve(HERE, "../vibe-code-tours-site/src/data/teams.json");
const TILESETS_JSON = resolve(HERE, "_tilesets.json");
const OUT = resolve(HERE, "demo-day.tmj");

// --- reused starter-kit tile GIDs (guaranteed valid) ---
const GID = { start: 2, collision: 3, floor: 725 };
const TS = 32; // px per tile

// --- external URLs (set the REPLACE_* ones before the event) ---
const SITE = "https://vibecode.tours";
const URLS = {
  vote: `${SITE}/vote`, // team vote page (custom build) — needs openWebsiteAllowApi
  personalGallery: `${SITE}/projects/personal`,
  teamGallery: `${SITE}/projects/teams`,
  home: `${SITE}/`,
  gallery: `${SITE}/gallery`,
  feedbackForm: "https://forms.gle/REPLACE_FEEDBACK_FORM", // Google Form
  premiere: "https://www.youtube.com/embed/live_stream?channel=REPLACE_CHANNEL", // stage reel screen
  game: "https://REPLACE_WEB_GAME", // embeddable web game for the Game Room
};

// --- booth block geometry (tiles) ---
const COLS = 4, ROWS = 5, BOOTH_W = 8, BOOTH_H = 7, AISLE = 2, MARGIN = 3;
const blockW = COLS * BOOTH_W + (COLS - 1) * AISLE; // 38
const MAP_W = MARGIN * 2 + blockW; // 44

const teams = JSON.parse(readFileSync(TEAMS_JSON, "utf8")).slice().sort((a, b) => a.team_no - b.team_no);
const tilesets = JSON.parse(readFileSync(TILESETS_JSON, "utf8"));

// ---------- object builders ----------
let _oid = 0;
const oid = () => ++_oid;
const prop = (name, value, type) => ({ name, type, value });
const CX = Math.floor(MAP_W / 2);

function area(name, x, y, w, h, props) {
  return { id: oid(), name, type: "area", class: "area",
    x: x * TS, y: y * TS, width: w * TS, height: h * TS,
    rotation: 0, visible: true, ellipse: false, properties: props };
}
function label(name, x, y, w, text, size = 14) {
  return { id: oid(), name, type: "", x: x * TS, y: y * TS, width: w * TS, height: TS * 2,
    rotation: 0, visible: true,
    text: { text, fontfamily: "Sans Serif", pixelsize: size, wrap: true, color: "#ffffff", bold: true } };
}
const web = (name, x, y, w, h, url, extra = []) => area(name, x, y, w, h, [
  prop("openWebsite", url, "string"), prop("openWebsiteTrigger", "onaction", "string"),
  prop("openWebsitePolicy", "autoplay; fullscreen", "string"), prop("openWebsiteWidth", 50, "int"),
  prop("focusable", true, "bool"), ...extra ]);
const jitsi = (name, x, y, w, h, room) => area(name, x, y, w, h, [
  prop("jitsiRoom", room, "string"), prop("jitsiTrigger", "onaction", "string"),
  prop("jitsiConfig", '{"startWithAudioMuted":true}', "string"), prop("focusable", true, "bool") ]);

const objects = [];
const add = (...o) => objects.push(...o);

// running vertical cursor (tiles); each band advances it
let cy = MARGIN;
const band = (h) => { const y = cy; cy += h; return y; };

// ---------- BAND: Entrance / Info ----------
{
  const y = band(6);
  add(label("sign-welcome", MARGIN, y, blockW, "🎉 Vibe Code Tours — Cohort 1 Demo Day", 18));
  add(label("sign-sponsor", MARGIN, y + 1, blockW, "🤝 Venue by WorkAdventure — thank you!"));
  add(web("info-personal", CX - 8, y + 3, 3, 2, URLS.personalGallery)); // browse 78 personal
  add(label("l-info-personal", CX - 8, y + 2, 4, "🖼️ Personal projects"));
  add(web("info-teams", CX - 2, y + 3, 3, 2, URLS.teamGallery));
  add(label("l-info-teams", CX - 2, y + 2, 4, "🏗️ Team projects"));
  add(web("info-home", CX + 5, y + 3, 3, 2, URLS.home));
  add(label("l-info-home", CX + 5, y + 2, 3, "🌐 Site / map"));
}

// ---------- BAND: Main Stage ----------
const stage = {};
{
  const y = band(8);
  add(label("sign-stage", MARGIN, y, blockW, "🎬 MAIN STAGE — reels + awards", 16));
  add(area("stage-bbb", MARGIN + 2, y + 1, blockW - 4, 4, [
    prop("bbbMeeting", "demo-day-stage", "string"), prop("bbbTrigger", "onaction", "string"),
    prop("focusable", true, "bool") ]));
  add(web("stage-reel", CX - 3, y + 5, 6, 2, URLS.premiere));
  add(label("l-stage-reel", CX - 3, y + 4, 6, "▶️ Reel screen (Premiere)"));
  stage.spawnY = y + 6; // spawn just below stage sign area, near entrance top actually
}

// ---------- BAND: Team Avenue (20 booths) ----------
{
  const top = band(ROWS * BOOTH_H + (ROWS - 1) * AISLE + 1);
  add(label("sign-teams", MARGIN, top, blockW, "🏗️ TEAM AVENUE — 20 booths (SPACE to open)", 16));
  const boothY0 = top + 1;
  teams.forEach((t, i) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    const x = MARGIN + c * (BOOTH_W + AISLE);
    const yb = boothY0 + r * (BOOTH_H + AISLE);
    const nn = String(t.team_no).padStart(2, "0");
    const yt = t.youtube_id
      ? `https://www.youtube.com/embed/${t.youtube_id}?autoplay=1&mute=1&loop=1&playlist=${t.youtube_id}` : null;
    add(label(`label-t${nn}`, x, yb, BOOTH_W, `Booth ${nn} · ${t.title || t.team}\n${t.desc || ""}`, 12));
    if (yt) add(web(`video-t${nn}`, x + 1, yb + 2, 3, 2, yt));
    else add(label(`novideo-t${nn}`, x + 1, yb + 2, 3, "(video pending)"));
    if (t.live_url) add(web(`kiosk-t${nn}`, x + 5, yb + 2, 2, 2, t.live_url));
    else if (t.repo_url) add(web(`repo-t${nn}`, x + 5, yb + 2, 2, 2, t.repo_url));
    add(jitsi(`qa-t${nn}`, x + 2, yb + 5, 4, 2, `team-${nn}-booth`));
  });
}

// ---------- BAND: Personal Gallery Hall ----------
{
  const y = band(7);
  add(label("sign-personal", MARGIN, y, blockW, "🖼️ PERSONAL GALLERY HALL — 78 student projects", 16));
  // three kiosks all embed the same live gallery (browse/filter all 78)
  add(web("gallery-a", MARGIN + 4, y + 2, 4, 3, URLS.personalGallery));
  add(web("gallery-b", CX - 2, y + 2, 4, 3, URLS.gallery));
  add(web("gallery-c", MAP_W - MARGIN - 8, y + 2, 4, 3, URLS.personalGallery));
  add(label("l-gallery", MARGIN, y + 1, blockW, "Walk to a screen · SPACE to browse slides, screenshots, live demos"));
}

// ---------- BAND: Vote + Feedback Plaza ----------
{
  const y = band(7);
  add(label("sign-vote", MARGIN, y, blockW, "🗳️ VOTE + FEEDBACK", 16));
  // team vote (custom page — needs the WA iframe API)
  add(web("vote-team", CX - 9, y + 2, 4, 3, URLS.vote, [prop("openWebsiteAllowApi", true, "bool")]));
  add(label("l-vote-team", CX - 9, y + 1, 6, "🏆 Vote — team People's Choice (rank 3, not your own)"));
  // personal vote deferred → placeholder sign only
  add(label("l-vote-personal", CX - 2, y + 1, 5, "⭐ Personal vote — coming soon"));
  // feedback Google Form
  add(web("feedback-form", CX + 5, y + 2, 4, 3, URLS.feedbackForm));
  add(label("l-feedback", CX + 5, y + 1, 6, "💬 Leave feedback (personal + team)"));
}

// ---------- BAND: Social Wing ----------
{
  const y = band(8);
  add(label("sign-social", MARGIN, y, blockW, "🎮 SOCIAL WING", 16));
  // Game room: web game embed + audio + jitsi lounge
  add(web("game-embed", MARGIN + 4, y + 2, 4, 3, URLS.game));
  add(label("l-game", MARGIN + 3, y + 1, 8, "🕹️ Game Room"));
  add(area("game-audio", MARGIN + 2, y + 1, 12, 6, [
    prop("playAudio", "https://REPLACE_AMBIENT_MUSIC.mp3", "string"), prop("audioLoop", true, "bool"),
    prop("audioVolume", 0.3, "float") ]));
  // Chit-chat jitsi lounge
  add(jitsi("chitchat", MAP_W - MARGIN - 10, y + 2, 6, 4, "demo-day-chitchat"));
  add(label("l-chitchat", MAP_W - MARGIN - 11, y + 1, 8, "☕ Chit-Chat Lounge"));
}

const TOTAL_H = cy + MARGIN;

// ---------- tile layers ----------
function fill(name, gidAt) {
  const data = new Array(MAP_W * TOTAL_H).fill(0);
  for (let y = 0; y < TOTAL_H; y++) for (let x = 0; x < MAP_W; x++) {
    const g = gidAt(x, y); if (g) data[y * MAP_W + x] = g;
  }
  return { name, type: "tilelayer", visible: name !== "collisions", opacity: 1,
    x: 0, y: 0, width: MAP_W, height: TOTAL_H, data };
}
const border = (x, y) => x === 0 || y === 0 || x === MAP_W - 1 || y === TOTAL_H - 1;
const spawnX0 = CX - 2, spawnY = 1; // spawn at very top, walk down into venue
const startLayer = fill("start", (x, y) => (y === spawnY && x >= spawnX0 && x < spawnX0 + 4) ? GID.start : 0);
const collisions = fill("collisions", (x, y) => (border(x, y) ? GID.collision : 0));
const floor = fill("floor", () => GID.floor);

const map = {
  compressionlevel: -1, width: MAP_W, height: TOTAL_H, tilewidth: TS, tileheight: TS,
  infinite: false, orientation: "orthogonal", renderorder: "right-down", type: "map",
  version: "1.10", tiledversion: "1.10.2", nextlayerid: 100, nextobjectid: _oid + 1, tilesets,
  layers: [ floor, collisions, startLayer,
    { id: 90, name: "floorLayer", type: "objectgroup", class: "floorLayer",
      visible: true, opacity: 1, x: 0, y: 0, draworder: "topdown", objects } ],
  properties: [
    prop("mapName", "Vibe Code Tours — Demo Day", "string"),
    prop("mapDescription", "Cohort 1 finale: stage · 20 team booths · personal gallery · vote · social", "string"),
    prop("mapImage", "demo-day.png", "string"),
    prop("mapCopyright", "Tilesets: WorkAdventure CC-BY-SA 3.0", "string") ],
};

writeFileSync(OUT, JSON.stringify(map, null, 1));
const zc = (t) => objects.filter((o) => o.name.startsWith(t)).length;
console.log(`wrote ${OUT}`);
console.log(`map ${MAP_W}x${TOTAL_H} tiles (${MAP_W * TS}x${TOTAL_H * TS}px)`);
console.log(`objects ${objects.length} | booths ${teams.length} | web ${objects.filter(o=>o.properties?.some(p=>p.name==='openWebsite')).length} | jitsi ${objects.filter(o=>o.properties?.some(p=>p.name==='jitsiRoom')).length}`);
