const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const server = read("server.js");
const client = read("public/app.js");
const html = read("public/index.html");
const electron = read("electron/main.js");

test("server room capacity is 20 players", () => {
  assert.match(server, /const MAX_PLAYERS = 20;/);
});

test("server publishes player answer status without exposing the answer index", () => {
  assert.match(server, /hasAnswered:p\.answered !== null/);
  assert.doesNotMatch(server, /score:p\.score, answered:p\.answered/);
});

test("room join rejects rooms at capacity", () => {
  assert.match(server, /room\.players\.size >= MAX_PLAYERS/);
});

test("server origin allowlist is configurable", () => {
  assert.match(server, /process\.env\.ALLOWED_ORIGINS/);
  assert.doesNotMatch(server, /cors: \{ origin: "\*" \}/);
});

test("web interface communicates the 20-player limit", () => {
  assert.match(html, /Up to 20 players per room/);
  assert.match(html, /up to 19 friends/);
});

test("web client restores the room code and reconnects with the player token", () => {
  assert.match(client, /roomRushRoomCode/);
  assert.match(client, /rejoinRoom/);
  assert.match(client, /showGame\(r\.state,isHost\)/);
});

test("desktop client uses the shared hosted service configuration", () => {
  assert.match(electron, /ROOM_RUSH_SERVER_URL/);
  assert.match(electron, /https:\/\/room-rush-app\.onrender\.com/);
  assert.match(electron, /nodeIntegration: false/);
});
