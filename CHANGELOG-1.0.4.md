# Room Rush 1.0.4 — Phase 0: stabilization

Behaviour-preserving release. No gameplay rules, question content or scoring
formulas changed.

## Fixed

- **Finished rooms are reaped.** `endRoom()` now schedules deletion on a fixed
  timer (`FINISHED_ROOM_TTL_MS`, default 5 minutes) instead of leaving the room,
  its question list and its player objects in memory until the last player left.
  Final results stay readable for the whole window.
- **Reaction flooding.** The `reaction` handler was the only socket event with no
  rate limit and it fans out to every socket in the room. It is now limited to
  6 per 10 seconds per socket, requires room membership, and validates the emote
  against a fixed allowlist instead of truncating arbitrary input to 4 characters.
- **`toggleBot` and `useLifeline` limits.** Both now have per-socket rate limits
  and room-code validation.
- **Private lifeline state.** `publicRoom()` no longer includes another player's
  `hiddenOptions` or `doubled` flag. Room state is built per seat and emitted on
  the owning socket only.
- **Bot toggle acknowledgement** reported the opposite of the resulting state.
- **Self-rejoin overwrite.** A socket that already held a seat could call
  `joinRoom` on its own room and replace its entry, name and token.
- **Biased shuffles.** `sort(() => Math.random() - 0.5)` replaced with
  Fisher-Yates in question selection and 50:50 option elimination.

## Security

- Room codes are generated with `crypto.randomInt()` and are six characters from
  a 32-symbol alphabet (about 1.07 billion combinations, up from about 1.05
  million with `Math.random()`), making enumeration impractical.
- Joining is limited per socket (12/min) and per client address (120/min). The
  address comes from `X-Forwarded-For` with `trust proxy` set to one hop, which
  matches the Render deployment; the address limit is high enough that a shared
  network can still fill a 20-player room.
- Helmet with a strict Content Security Policy: no inline script, no inline
  style, `object-src 'none'`, `frame-ancestors 'none'`. `connect-src` allows
  `ws:`/`wss:` for Socket.IO. `upgrade-insecure-requests` is production-only so
  local http development still loads its assets.
- `/health` reports version, uptime and live room count only — no hostnames,
  environment values or memory figures.

## Internal

- New `server/store/room-store.js` with `get`, `set`, `has`, `delete`, `list`,
  `values`, `size` and `clear`. `startServer({ roomStore })` accepts an injected
  store, so a Redis implementation later is a one-file swap. The in-memory
  implementation is unchanged in behaviour.
- Room storage moved out of module scope, so two servers started in one process
  no longer share rooms.
- Removed three write-only `socket.data.playerToken` assignments.

## Tests

- New `test/behaviour.test.js`: 16 tests driving a real server over real
  Socket.IO connections — match lifecycle, 21st-player rejection, duplicate and
  invalid answers, host permissions, reconnection, reaction rate limiting and
  allowlist, lifeline privacy, finished-room reaping and bot toggle ack.
- New `test/room-store.test.js`: 3 unit tests for the store contract and
  isolation between stores.
- The seven existing source-text tests in `test/server.test.js` are retained and
  still pass. They are redundant for behaviour coverage and should be deleted
  once the split into `server/` modules begins.
