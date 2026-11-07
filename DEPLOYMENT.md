# Room Rush deployment notes

## Shared multiplayer architecture

The website and Windows desktop client both connect to the same hosted Node.js + Socket.IO service. The Electron client uses `ROOM_RUSH_SERVER_URL` when supplied; otherwise it uses the current Room Rush Render deployment URL.

## Render environment variables

Set these in the Render web service environment:

- `NODE_ENV=production`
- `ALLOWED_ORIGINS=https://room-rush-app.onrender.com,https://YOUR-DOMAIN`

Replace `YOUR-DOMAIN` with the exact HTTPS origin used by the website. If you add `www` or another frontend origin, include each exact origin separated by commas. Do not use a trailing slash in an origin value.

Render should use:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`

The service must support long-lived WebSocket connections for Socket.IO. Confirm the hosting plan's connection, instance, and bandwidth limits before a public launch.

## Windows desktop build

The Windows desktop application uses the same hosted server. To override the default endpoint for a test build, set `ROOM_RUSH_SERVER_URL` in the build environment before running `npm run build:win`.

Do not ship a desktop build pointed at localhost. A localhost endpoint would only work on the developer's own computer and would not connect players to the shared online service.

## Current limitations before production

- Active rooms and scores are held in process memory. A server restart or redeploy ends active rooms. Add persistent storage and a multi-instance coordination strategy before scaling horizontally.
- No account system, persistent player profiles, persistent leaderboard, payment processing, subscription entitlements, or admin moderation tools are included yet.
- Rate limits currently operate per connected socket and are not a substitute for edge-level abuse protection.
- The origin allowlist is not user authentication. Keep the production allowlist restricted to the real website origins.
- Run load tests with 20 simulated clients in one room and several concurrent rooms before marketing a 20-player launch.
