#!/usr/bin/env node
// Draw a top-down schematic SVG of demo-day.tmj so the layout can be eyeballed before decorating.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const m = JSON.parse(readFileSync(resolve(HERE, "demo-day.tmj"), "utf8"));
const S = 7; // px per tile in preview
const W = m.width * S, H = m.height * S;
const fl = m.layers.find((L) => L.name === "floorLayer").objects;

const color = (o) => {
  const p = (n) => o.properties?.some((x) => x.name === n);
  if (p("bbbMeeting")) return "#e5484d";      // stage red
  if (p("jitsiRoom")) return "#8b5cf6";        // jitsi purple
  if (p("playAudio")) return "#f59e0b";        // audio amber
  if (p("openWebsiteAllowApi")) return "#12a594"; // vote teal
  if (p("openWebsite")) return "#3b82f6";      // web blue
  return null;                                  // label / text
};
const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

let rects = "", texts = "";
for (const o of fl) {
  const c = color(o);
  const x = (o.x / 32) * S, y = (o.y / 32) * S, w = (o.width / 32) * S, h = (o.height / 32) * S;
  if (c) rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" opacity="0.85" rx="2"/>`;
  else if (o.text) { // signage
    const t = esc(o.text.text.split("\n")[0]);
    texts += `<text x="${x + 2}" y="${y + 8}" font-size="9" font-weight="bold" fill="#e5e7eb">${t}</text>`;
  }
}
const legend = [
  ["#3b82f6", "web kiosk (gallery / live app / video / info)"],
  ["#12a594", "team vote (WA API)"],
  ["#8b5cf6", "jitsi (booth Q&A / chit-chat)"],
  ["#e5484d", "main stage (BBB)"],
  ["#f59e0b", "audio zone"],
].map(([c, t], i) => `<rect x="10" y="${H + 16 + i * 16}" width="12" height="12" fill="${c}"/><text x="28" y="${H + 26 + i * 16}" font-size="11" fill="#cbd5e1">${t}</text>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 20}" height="${H + 16 + 5 * 16 + 10}" viewBox="0 0 ${W + 20} ${H + 16 + 5 * 16 + 10}">
<rect width="100%" height="100%" fill="#0b1220"/>
<g transform="translate(10,10)"><rect width="${W}" height="${H}" fill="#1e293b" stroke="#334155"/>${rects}${texts}</g>
${legend}
<text x="10" y="${H + 12}" font-size="10" fill="#64748b">Vibe Code Tours — Demo Day venue · ${m.width}x${m.height} tiles · spawn at top center, walk down</text>
</svg>`;
writeFileSync(resolve(HERE, "demo-day-preview.svg"), svg);
console.log("wrote demo-day-preview.svg");
