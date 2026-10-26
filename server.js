const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const QUESTIONS = [
  { q: "Which planet is known as the Red Planet?", a: ["Venus", "Mars", "Jupiter", "Mercury"], correct: 1, category: "Science" },
  { q: "What is the capital city of Japan?", a: ["Seoul", "Beijing", "Tokyo", "Bangkok"], correct: 2, category: "Geography" },
  { q: "How many sides does a hexagon have?", a: ["Five", "Six", "Seven", "Eight"], correct: 1, category: "General" },
  { q: "Which language runs natively in web browsers?", a: ["Python", "C++", "Java", "JavaScript"], correct: 3, category: "Technology" },
  { q: "What is the largest ocean on Earth?", a: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3, category: "Geography" },
  { q: "Which gas do plants absorb from the atmosphere?", a: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], correct: 1, category: "Science" },
  { q: "How many minutes are in two hours?", a: ["90", "100", "120", "180"], correct: 2, category: "General" },
  { q: "Which company created the Windows operating system?", a: ["Apple", "Microsoft", "IBM", "Google"], correct: 1, category: "Technology" },
  { q: "What is the chemical symbol for gold?", a: ["Ag", "Gd", "Au", "Go"], correct: 2, category: "Science" },
  { q: "Which animal is the fastest land animal?", a: ["Lion", "Horse", "Cheetah", "Leopard"], correct: 2, category: "Nature" },
  { q: "Which continent is the Sahara Desert in?", a: ["Asia", "Africa", "Australia", "South America"], correct: 1, category: "Geography" },
  { q: "What is 9 × 7?", a: ["56", "63", "72", "69"], correct: 1, category: "Numbers" }
];

const rooms = new Map();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
const MAX_PLAYERS = 2;
const RECONNECT_GRACE_MS = 30000;
const ROOM_IDLE_MS = 5 * 60 * 1000;
const PLAYER_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const normalizeName = value => typeof value === "string" ? value.trim().slice(0, 18) || "Player" : "Player";
const makePlayerToken = () => require("crypto").randomBytes(32).toString("hex");
const makeCode = () => {
  let code;
  do { code = Array.from({length: 4}, () => alphabet[Math.floor(Math.random()*alphabet.length)]).join(""); }
  while (rooms.has(code));
  return code;
};
const publicRoom = (room, playerId) => ({
  code: room.code, hostId: room.hostId, status: room.status, round: room.round,
  totalRounds: room.totalRounds, deadline: room.deadline,
  players: [...room.players.values()].map(p => ({ id:p.id, name:p.name, score:p.score, answered:p.answered, connected:p.connected })),
  question: ["question", "reveal"].includes(room.status) ? { q: room.current.q, a: room.current.a, category: room.current.category } : null,
  reveal: room.status === "reveal" ? { correct: room.current.correct, explanation: "The correct answer is highlighted below." } : null,
  myId: playerId || null
});
function startServer({ port = Number(process.env.PORT) || 3000, host = "0.0.0.0" } = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });
  app.use(express.static(path.join(__dirname, "public")));
  app.get("/health", (_req,res) => res.json({ ok:true, game:"Room Rush" }));

  function emitRoom(room) { io.to(room.code).emit("state", publicRoom(room)); }
  function scheduleRoomCleanup(room, delay = ROOM_IDLE_MS) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = setTimeout(() => {
      if (rooms.get(room.code) !== room) return;
      if ([...room.players.values()].some(p => p.connected)) return;
      clearTimeout(room.timer);
      rooms.delete(room.code);
    }, delay);
    room.cleanupTimer.unref?.();
  }
  function removePlayer(room, player) {
    clearTimeout(player.disconnectTimer);
    room.players.delete(player.id);
    if (room.hostId === player.id) {
      room.hostId = [...room.players.values()].find(p => p.connected)?.id || null;
    }
    if (room.status === "question" && [...room.players.values()].filter(p => p.connected).every(p => p.answered !== null)) reveal(room);
    else emitRoom(room);
    if (![...room.players.values()].some(p => p.connected)) scheduleRoomCleanup(room);
  }
  function endRoom(room) {
    clearTimeout(room.timer);
    room.status = "finished";
    room.deadline = null;
    emitRoom(room);
  }
  function reveal(room) {
    if (!room || room.status !== "question") return;
    clearTimeout(room.timer);
    room.status = "reveal";
    room.deadline = Date.now() + 2500;
    emitRoom(room);
    room.timer = setTimeout(() => {
      if (!rooms.has(room.code) || room.status !== "reveal") return;
      if (room.round >= room.totalRounds) return endRoom(room);
      nextQuestion(room);
    }, 2500);
  }
  function nextQuestion(room) {
    room.round += 1;
    room.current = room.questions[room.round - 1];
    room.status = "question";
    room.deadline = Date.now() + 15000;
    for (const p of room.players.values()) p.answered = null;
    emitRoom(room);
    room.timer = setTimeout(() => reveal(room), 15000);
  }
  io.on("connection", socket => {
    socket.on("createRoom", (payload, cb = () => {}) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return cb({ ok:false, error:"Invalid room details." });
      const clean = normalizeName(payload.name);
      const code = makeCode();
      const id = socket.id;
      const playerToken = makePlayerToken();
      const room = { code, hostId:id, status:"lobby", round:0, totalRounds:8, deadline:null, timer:null, cleanupTimer:null,
        players:new Map([[id,{id,token:playerToken,name:clean,score:0,answered:null,connected:true,disconnectTimer:null}]]),
        questions:[...QUESTIONS].sort(() => Math.random()-.5).slice(0,8), current:null };
      rooms.set(code, room); socket.data.playerToken = playerToken; socket.join(code);
      cb({ ok:true, playerToken, state:publicRoom(room,id) }); emitRoom(room);
    });
    socket.on("rejoinRoom", (payload, cb = () => {}) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return cb({ ok:false, error:"Invalid reconnection details." });
      const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
      const token = payload.playerToken;
      if (!ROOM_CODE_PATTERN.test(code) || typeof token !== "string" || !PLAYER_TOKEN_PATTERN.test(token)) return cb({ ok:false, error:"Invalid reconnection details." });
      const room = rooms.get(code);
      const player = room && [...room.players.values()].find(p => p.token === token);
      if (!room || !player || player.connected) return cb({ ok:false, error:"This player session can no longer rejoin the room." });
      clearTimeout(player.disconnectTimer);
      clearTimeout(room.cleanupTimer);
      room.players.delete(player.id);
      player.id = socket.id;
      player.connected = true;
      player.disconnectTimer = null;
      room.players.set(player.id, player);
      if (!room.hostId || room.hostId !== player.id && ![...room.players.values()].some(p => p.id === room.hostId && p.connected)) room.hostId = player.id;
      socket.data.playerToken = token;
      socket.join(code);
      cb({ ok:true, state:publicRoom(room,player.id) });
      emitRoom(room);
    });
    socket.on("joinRoom", (payload, cb = () => {}) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return cb({ ok:false, error:"Invalid room details." });
      const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
      if (!ROOM_CODE_PATTERN.test(code)) return cb({ ok:false, error:"Room codes must be 4 letters or numbers. Check the code and try again." });
      const room = rooms.get(code);
      if (!room) return cb({ ok:false, error:"Room not found. Check the code and try again." });
      if (room.status !== "lobby") return cb({ ok:false, error:"This game has already started." });
      if ([...room.players.values()].filter(p => p.connected).length >= MAX_PLAYERS) return cb({ ok:false, error:`This room is full (${MAX_PLAYERS} players max).` });
      for (const offlinePlayer of [...room.players.values()]) {
        if (!offlinePlayer.connected) removePlayer(room,offlinePlayer);
      }
      const clean = normalizeName(payload.name);
      const id = socket.id;
      const playerToken = makePlayerToken();
      room.players.set(id,{id,token:playerToken,name:clean,score:0,answered:null,connected:true,disconnectTimer:null});
      socket.data.playerToken = playerToken;
      socket.join(code); cb({ok:true,playerToken,state:publicRoom(room,id)}); emitRoom(room);
    });
    socket.on("startGame", (payload, cb=()=>{}) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.code !== "string") return cb({ok:false,error:"Invalid room code."});
      const code = payload.code.trim().toUpperCase();
      if (!ROOM_CODE_PATTERN.test(code)) return cb({ok:false,error:"Invalid room code."});
      const room = rooms.get(code);
      if (!room) return cb({ok:false,error:"Room no longer exists."});
      if (socket.id !== room.hostId) return cb({ok:false,error:"Only the host can start the game."});
      if ([...room.players.values()].filter(p => p.connected).length < 2) return cb({ok:false,error:"Invite at least one more connected player to start."});
      if (room.status !== "lobby") return cb({ok:false,error:"The game has already started."});
      nextQuestion(room); cb({ok:true});
    });
    socket.on("answer", (payload, cb=()=>{}) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.code !== "string") return cb({ok:false,error:"Invalid answer details."});
      const code = payload.code.trim().toUpperCase();
      const answer = payload.answer;
      if (!ROOM_CODE_PATTERN.test(code)) return cb({ok:false,error:"Invalid room code."});
      const room = rooms.get(code);
      if (!room || room.status !== "question") return cb({ok:false,error:"This question is no longer active."});
      const p = room.players.get(socket.id);
      if (!p) return cb({ok:false,error:"You are not in this room."});
      if (p.answered !== null) return cb({ok:false,error:"Answer already submitted."});
      if (!Number.isInteger(answer) || answer < 0 || answer > 3) return cb({ok:false,error:"Invalid answer."});
      p.answered = answer;
      if (answer === room.current.correct) {
        const remaining = Math.max(0, room.deadline - Date.now());
        p.score += 100 + Math.round(remaining / 15000 * 50);
      }
      emitRoom(room); cb({ok:true});
      if ([...room.players.values()].every(x => x.answered !== null)) reveal(room);
    });
    socket.on("disconnect", () => {
      for (const room of rooms.values()) {
        if (room.players.has(socket.id)) {
          const p = room.players.get(socket.id); p.connected = false;
          if (room.status === "lobby" && room.hostId === p.id) {
            room.hostId = [...room.players.values()].find(candidate => candidate.connected)?.id || null;
          }
          p.disconnectTimer = setTimeout(() => {
            if (room.players.get(p.id) === p && !p.connected) removePlayer(room,p);
          }, RECONNECT_GRACE_MS);
          p.disconnectTimer.unref?.();
          if (![...room.players.values()].some(player => player.connected)) scheduleRoomCleanup(room);
          emitRoom(room);
        }
      }
    });
  });
  return new Promise(resolve => server.listen(port, host, () => resolve({app,server,io,port:server.address().port})));
}
if (require.main === module) startServer().then(({port}) => console.log(`Room Rush server running at http://localhost:${port}`));
module.exports = { startServer, ROOM_CODE_PATTERN, MAX_PLAYERS, RECONNECT_GRACE_MS };
