#!/usr/bin/env node
// Structural checks on a generated .tmj before it goes anywhere near WorkAdventure.
// Usage: node check-map.mjs [demo-day.tmj]      exit 1 on any failure
//
// Catches the failure modes that are invisible in a render:
//   - gids that fall in a GAP between tilesets (they draw nothing and WA rejects them)
//   - interactive areas sitting on collision tiles, so nobody can trigger them
//   - areas walled off from the spawn point
//   - objects outside the map bounds
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, process.argv[2] || "demo-day.tmj");
const m = JSON.parse(readFileSync(FILE, "utf8"));
const { width: W, height: H, tilewidth: TS } = m;

const tileLayers = Object.fromEntries(m.layers.filter((l) => l.type === "tilelayer").map((l) => [l.name, l]));
const objects = m.layers.filter((l) => l.type === "objectgroup").flatMap((l) => l.objects);
const areas = objects.filter((o) => o.class === "area");
const collide = tileLayers.collisions.data;
const start = tileLayers.start.data;

const fail = [];
const check = (label, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`); if (!ok) fail.push(label); };

// --- gid ranges: every used gid must land inside a real tileset, not a gap between two ---
const ranges = m.tilesets
  .map((t) => ({ lo: t.firstgid, hi: t.firstgid + (t.tilecount ?? 0) - 1, name: t.name }))
  .sort((a, b) => a.lo - b.lo);
const usedGids = new Set();
for (const l of Object.values(tileLayers)) for (const g of l.data) if (g) usedGids.add(g);
for (const o of objects) if (o.gid) usedGids.add(o.gid);
const orphan = [...usedGids].filter((g) => !ranges.some((r) => g >= r.lo && g <= r.hi)).sort((a, b) => a - b);
check("every gid belongs to a tileset", orphan.length === 0,
  orphan.length ? `${orphan.length} orphan gids: ${orphan.slice(0, 12).join(", ")}` : `${usedGids.size} distinct gids`);

// --- object bounds ---
const oob = objects.filter((o) => o.x < 0 || o.y < 0 || o.x + (o.width ?? 0) > W * TS || o.y + (o.height ?? 0) > H * TS);
check("objects inside map bounds", oob.length === 0, oob.map((o) => o.name).join(", "));

// --- areas must not sit on collision tiles ---
const tileRect = (o) => ({ x0: o.x / TS, y0: o.y / TS, x1: (o.x + o.width) / TS, y1: (o.y + o.height) / TS });
const blocked = areas.filter((a) => {
  const r = tileRect(a);
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) if (collide[y * W + x]) return true;
  return false;
});
check("no area overlaps a collision tile", blocked.length === 0, blocked.map((a) => a.name).join(", "));

// --- spawn must be walkable, and every area reachable from it ---
const spawns = [];
start.forEach((v, i) => { if (v) spawns.push([i % W, Math.floor(i / W)]); });
check("spawn tiles exist and are walkable", spawns.length > 0 && spawns.every(([x, y]) => !collide[y * W + x]),
  `${spawns.length} spawn tiles`);

const seen = new Set();
if (spawns.length) {
  const q = [spawns[0]];
  seen.add(spawns[0].join(","));
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen.has(k) && !collide[ny * W + nx]) { seen.add(k); q.push([nx, ny]); }
    }
  }
}
const unreachable = areas.filter((a) => {
  const r = tileRect(a);
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) if (seen.has(`${x},${y}`)) return false;
  return true;
});
check("every area reachable on foot from spawn", unreachable.length === 0, unreachable.map((a) => a.name).join(", "));

// --- every booth keeps its Q&A + at least one screen ---
const booths = {};
for (const a of areas) {
  const mm = /^(video|slide|site|qa)-t(\d\d)$/.exec(a.name);
  if (mm) (booths[mm[2]] ??= new Set()).add(mm[1]);
}
const boothIds = Object.keys(booths).sort();
check("20 booths present", boothIds.length === 20, `found ${boothIds.length}`);
const noScreen = boothIds.filter((n) => !["video", "slide", "site"].some((k) => booths[n].has(k)));
check("every booth has at least one screen", noScreen.length === 0, noScreen.join(" "));
const noQa = boothIds.filter((n) => !booths[n].has("qa"));
check("every booth has a Q&A room", noQa.length === 0, noQa.join(" "));

console.log(`\n${FILE.split("/").pop()}: ${W}x${H} tiles, ${areas.length} areas, ${objects.length} objects`);
if (fail.length) { console.error(`\n${fail.length} check(s) failed`); process.exit(1); }
console.log("all checks passed");
