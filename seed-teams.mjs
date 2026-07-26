#!/usr/bin/env node
// Seed teams/team-NN.yaml from teams.json — ONE file per team, hand-editable after.
// Never overwrites an existing file, so hand-filled logo_url / slide_url survive re-runs.
// Usage: node seed-teams.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEAMS_JSON = resolve(HERE, "../vibe-code-tours-site/src/data/teams.json");
const DIR = resolve(HERE, "teams");

const teams = JSON.parse(readFileSync(TEAMS_JSON, "utf8")).slice().sort((a, b) => a.team_no - b.team_no);
mkdirSync(DIR, { recursive: true });

// YAML-safe scalar: quote anything that could confuse the flat parser.
const s = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const t = String(v);
  return /[:#'"]/.test(t) ? JSON.stringify(t) : t;
};

let written = 0, kept = 0;
for (const t of teams) {
  const nn = String(t.team_no).padStart(2, "0");
  const file = resolve(DIR, `team-${nn}.yaml`);
  if (existsSync(file)) { kept++; continue; }

  const video = t.youtube_url || t.drive_url || "";
  const site = t.live_url || "";

  writeFileSync(file, `# Team ${nn} booth — Demo Day map
# Blank value = that booth area is skipped (no dead zone in the room).
# jitsi room is auto-generated: team-${nn}-booth

team_no: ${t.team_no}
team: ${s(t.team)}
title: ${s(t.title || t.team)}
desc: ${s(t.desc || "")}

# wall banner. blank -> falls back to the generated team badge tile
logo_url: ${s("")}

# demo video. youtube link gets embedded inline; any other link opens in a panel
video_url: ${s(video)}

# live app. blank -> repo_url is used instead
site_url: ${s(site)}
repo_url: ${s(t.repo_url || "")}

# pitch deck / slides. blank -> no slide easel in the booth
slide_url: ${s("")}
`);
  written++;
}

console.log(`teams/: ${written} written, ${kept} kept (existing files untouched)`);
