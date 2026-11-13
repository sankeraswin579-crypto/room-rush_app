// Behavioural regression suite for Room Rush.
//
// Drives a real server over real Socket.IO connections instead of grepping
// source text, so it catches the class of bug that shipped in 1.0.3: finished
// rooms that were never reaped, a fan-out handler with no rate limit, and a
// broadcast payload that carried every player's private lifeline state.
//
//   npm install
//   npm test
//
// Every test below asserts behaviour the server is expected to have. A failing
// test is a regression, not a wish.

const test = require("node:test");
const assert = require("node:assert/strict");
const { io } = require("socket.io-client");
const { startServer, ROOM_CODE_LENGTH, ROOM_CODE_PATTERN, MAX_PLAYERS } = require("../server.js");

const wait = ms => new Promise(r => setTimeout(r, ms));
const call = (sock, event, payload) =>
  new Promise(res => sock.emit(event, payload, r => res(r ?? { ok: false, error: "no ack" })));

let server, url;
const sockets = [];

// A short finished-room TTL keeps the reaping test fast. Production uses the
// default (5 minutes) so players can read the podium.
const FINISHED_ROOM_TTL_MS = 400;

test.before(async () => {
  const started = await startServer({ port: 0, finishedRoomTtlMs: FINISHED_ROOM_TTL_MS });
  server = started.server;
  url = `http://127.0.0.1:${started.port}`;
});

test.after(() => {
  sockets.forEach(s => s.close());
  server.close();
});

function connect() {
  const s = io(url, { transports: ["websocket"], forceNew: true });
  sockets.push(s);
  return s;
}

// Resolves with the first room state on this socket that satisfies predicate.
function until(sock, predicate, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for state")), timeoutMs);
    const handler = state => {
      if (predicate(state)) {
        clearTimeout(timer);
        sock.off("state", handler);
        resolve(state);
      }
    };
    sock.on("state", handler);
  });
}

async function freshRoom(opts = {}) {
  const host = connect();
  const guest = connect();
  await wait(150);
  const created = await call(host, "createRoom", { name: "Host", rounds: 5, mode: "blitz", ...opts });
  assert.equal(created.ok, true, created.error);
  const code = created.state.code;
  const joined = await call(guest, "joinRoom", { code, name: "Guest" });
  assert.equal(joined.ok, true, joined.error);
  return { host, guest, code, created, joined };
}

// Answers immediately on both seats every round, until the match finishes.
async function playToEnd(host, guest, code) {
  let last = null;
  const handler = s => { last = s; };
  host.on("state", handler);
  const answered = new Set();

  for (let i = 0; i < 600 && last?.status !== "finished"; i++) {
    if (last?.status === "question" && !answered.has(last.round)) {
      answered.add(last.round);
      await call(host, "answer", { code, answer: 0 });
      await call(guest, "answer", { code, answer: 0 });
    }
    await wait(100);
  }

  host.off("state", handler);
  return last;
}

test("room codes use the full six-character alphabet", async () => {
  const host = connect();
  await wait(150);
  const created = await call(host, "createRoom", { name: "Host", rounds: 5 });
  assert.equal(created.ok, true, created.error);
  assert.equal(ROOM_CODE_LENGTH, 6);
  assert.match(created.state.code, ROOM_CODE_PATTERN);
  assert.equal(created.state.code.length, 6);
});

test("a malformed or short room code is rejected", async () => {
  const sock = connect();
  await wait(150);
  for (const code of ["ABCD", "ABC", "ABCDEFG", "ABCD1F", ""]) {
    const r = await call(sock, "joinRoom", { code, name: "X" });
    assert.equal(r.ok, false, `code ${JSON.stringify(code)} should be rejected`);
  }
});

test("a match runs five rounds and reaches a finished state", async () => {
  const { host, guest, code } = await freshRoom();
  assert.equal((await call(host, "startGame", { code })).ok, true);

  const last = await playToEnd(host, guest, code);
  assert.equal(last.status, "finished");
  assert.equal(last.round, 5);
  assert.equal(last.totalRounds, 5);
});

test("a room at capacity rejects the 21st player", async () => {
  const host = connect();
  await wait(150);
  const created = await call(host, "createRoom", { name: "Host", rounds: 5 });
  const code = created.state.code;

  const guests = Array.from({ length: MAX_PLAYERS - 1 }, connect);
  await wait(250);
  for (const [i, g] of guests.entries()) {
    const r = await call(g, "joinRoom", { code, name: `G${i}` });
    assert.equal(r.ok, true, `guest ${i}: ${r.error}`);
  }

  const extra = connect();
  await wait(150);
  const rejected = await call(extra, "joinRoom", { code, name: "TooMany" });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /full/i);
});

test("the same player cannot answer twice in one round", async () => {
  const { host, code } = await freshRoom();
  await call(host, "startGame", { code });
  await until(host, s => s.status === "question");

  assert.equal((await call(host, "answer", { code, answer: 0 })).ok, true);
  const second = await call(host, "answer", { code, answer: 1 });
  assert.equal(second.ok, false);
  assert.match(second.error, /already submitted/i);
});

test("answers outside 0-3 and non-integers are rejected", async () => {
  const { host, code } = await freshRoom();
  await call(host, "startGame", { code });
  await until(host, s => s.status === "question");

  for (const bad of [-1, 4, 1.5, "2", null]) {
    const r = await call(host, "answer", { code, answer: bad });
    assert.equal(r.ok, false, `answer ${JSON.stringify(bad)} should be rejected`);
  }
});

test("joining a running game is refused", async () => {
  const { host, code } = await freshRoom();
  await call(host, "startGame", { code });
  const late = connect();
  await wait(150);
  const r = await call(late, "joinRoom", { code, name: "Late" });
  assert.equal(r.ok, false);
  assert.match(r.error, /already started/i);
});

test("a socket already seated cannot join the same room again", async () => {
  const { guest, code } = await freshRoom();
  const again = await call(guest, "joinRoom", { code, name: "Impostor" });
  assert.equal(again.ok, false);
  assert.match(again.error, /already in this room/i);
});

test("only the host can start the game or toggle the bot", async () => {
  const { guest, code } = await freshRoom();
  const start = await call(guest, "startGame", { code });
  assert.equal(start.ok, false);
  assert.match(start.error, /host/i);

  const bot = await call(guest, "toggleBot", { code });
  assert.equal(bot.ok, false);
  assert.match(bot.error, /host/i);
});

test("the bot toggle ack reports the resulting state", async () => {
  const { host, code } = await freshRoom();
  const added = await call(host, "toggleBot", { code });
  assert.equal(added.ok, true);
  assert.equal(added.hasBot, true);

  const removed = await call(host, "toggleBot", { code });
  assert.equal(removed.ok, true);
  assert.equal(removed.hasBot, false);
});

test("a player reconnects with their token and keeps their seat", async () => {
  const { guest, code, joined } = await freshRoom();

  guest.close();
  await wait(400);

  const back = connect();
  await wait(150);
  const rejoined = await call(back, "rejoinRoom", { code, playerToken: joined.playerToken });
  assert.equal(rejoined.ok, true, rejoined.error);
  assert.equal(rejoined.state.players.filter(p => p.name === "Guest").length, 1);
  assert.equal(rejoined.state.players.filter(p => p.connected).length, 2);
});

test("reconnect is refused with a bad token", async () => {
  const { code } = await freshRoom();
  const sock = connect();
  await wait(150);
  const r = await call(sock, "rejoinRoom", { code, playerToken: "0".repeat(64) });
  assert.equal(r.ok, false);
});

test("reactions are rate limited and allowlisted", async () => {
  const { host, guest, code } = await freshRoom();
  let delivered = 0;
  guest.on("reaction", () => delivered++);

  for (let i = 0; i < 200; i++) host.emit("reaction", { code, emote: "\u{1F525}" });
  await wait(800);

  assert.ok(delivered > 0, "expected the allowed reactions to be delivered");
  assert.ok(delivered <= 6, `expected the burst to be throttled, got ${delivered}/200`);

  // Checked on the other seat, whose own bucket is still empty, so this
  // asserts the allowlist rather than the limiter.
  const bogus = await call(guest, "reaction", { code, emote: "<script>" });
  assert.equal(bogus.ok, false);
  assert.match(bogus.error, /not available/i);
});

test("a lifeline does not leak another player's hidden options", async () => {
  const { host, guest, code } = await freshRoom();
  await call(host, "toggleBot", { code });
  await call(host, "startGame", { code });
  await until(host, s => s.status === "question");

  let hostState = null;
  let guestState = null;
  host.on("state", s => { hostState = s; });
  guest.on("state", s => { guestState = s; });
  await wait(200);

  const ack = await call(host, "useLifeline", { code, type: "fiftyFifty" });
  assert.equal(ack.ok, true, ack.error);
  assert.equal(ack.hiddenOptions.length, 2);
  await wait(400);

  const mine = hostState.players.find(p => p.id === hostState.myId);
  assert.equal(mine.hiddenOptions.length, 2, "the owner must still see their own 50:50");

  const asSeenByGuest = guestState.players.find(p => !p.isBot && p.id !== guestState.myId);
  assert.deepEqual(asSeenByGuest.hiddenOptions, [], "another player must not see the eliminated options");
  assert.equal(asSeenByGuest.doubled, false);
});

test("a finished room is reaped instead of staying resident", async () => {
  const { host, guest, code } = await freshRoom();
  await call(host, "startGame", { code });

  const last = await playToEnd(host, guest, code);
  assert.equal(last.status, "finished");

  await wait(FINISHED_ROOM_TTL_MS + 700);

  const late = connect();
  await wait(150);
  const r = await call(late, "joinRoom", { code, name: "Late" });
  assert.equal(r.ok, false);
  assert.match(r.error, /not found/i);
});

test("both seats keep receiving state after one of them reconnects", async () => {
  const { host, guest, code, joined } = await freshRoom();
  await call(host, "startGame", { code });
  await until(host, s => s.status === "question");

  guest.close();
  await wait(400);

  const back = connect();
  await wait(150);
  const rejoined = await call(back, "rejoinRoom", { code, playerToken: joined.playerToken });
  assert.equal(rejoined.ok, true, rejoined.error);

  const seen = await until(host, s => s.status === "question" && s.players.filter(p => p.connected).length === 2, 4000);
  assert.equal(seen.players.filter(p => p.connected).length, 2);
  assert.equal(seen.players.find(p => p.id === seen.myId).hiddenOptions.length, 0);
});
