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
  { q: "What is 9 × 7?", a: ["56", "63", "72", "69"], correct: 1, category: "Numbers" },
  { q: "Which instrument usually has 88 keys?", a: ["Violin", "Piano", "Flute", "Drum kit"], correct: 1, category: "Music" },
  { q: "What is the largest mammal on Earth?", a: ["African elephant", "Giraffe", "Blue whale", "Hippopotamus"], correct: 2, category: "Nature" },
  { q: "Which country is home to the city of Kyoto?", a: ["China", "Japan", "Thailand", "Vietnam"], correct: 1, category: "Geography" },
  { q: "How many colors are traditionally named in a rainbow?", a: ["Five", "Six", "Seven", "Eight"], correct: 2, category: "Science" },
  { q: "Which sport uses the terms love, deuce, and ace?", a: ["Tennis", "Golf", "Cricket", "Hockey"], correct: 0, category: "Sports" },
  { q: "What is the main ingredient in guacamole?", a: ["Cucumber", "Avocado", "Peas", "Spinach"], correct: 1, category: "Food" },
  { q: "Which planet has the most prominent ring system?", a: ["Mars", "Venus", "Saturn", "Mercury"], correct: 2, category: "Science" },
  { q: "What is the capital of Canada?", a: ["Toronto", "Vancouver", "Ottawa", "Montreal"], correct: 2, category: "Geography" },
  { q: "Which animal is known for changing color to blend in?", a: ["Chameleon", "Panda", "Otter", "Meerkat"], correct: 0, category: "Nature" },
  { q: "How many players from one team are on court in basketball?", a: ["Four", "Five", "Six", "Seven"], correct: 1, category: "Sports" },
  { q: "Which metal is liquid at typical room temperature?", a: ["Iron", "Mercury", "Copper", "Aluminum"], correct: 1, category: "Science" },
  { q: "What do bees collect from flowers to make honey?", a: ["Nectar", "Dew", "Sap", "Pollen only"], correct: 0, category: "Nature" },
  { q: "Which is the smallest prime number?", a: ["0", "1", "2", "3"], correct: 2, category: "Numbers" },
  { q: "Which ocean lies between Africa and Australia?", a: ["Atlantic", "Indian", "Arctic", "Southern"], correct: 1, category: "Geography" },
  { q: "What is a word that reads the same backward called?", a: ["Acronym", "Palindrome", "Synonym", "Anagram"], correct: 1, category: "Words" },
  { q: "Which gas do humans need to breathe to survive?", a: ["Helium", "Oxygen", "Carbon dioxide", "Neon"], correct: 1, category: "Science" },
  { q: "How many sides does an octagon have?", a: ["Six", "Seven", "Eight", "Nine"], correct: 2, category: "Numbers" },
  { q: "Which instrument measures temperature?", a: ["Barometer", "Thermometer", "Compass", "Altimeter"], correct: 1, category: "Science" },
  { q: "What is the young form of a frog called?", a: ["Cub", "Tadpole", "Calf", "Chick"], correct: 1, category: "Nature" },
  { q: "Which shape has three sides?", a: ["Triangle", "Rectangle", "Pentagon", "Circle"], correct: 0, category: "General" }
];

const rooms = new Map();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
const MAX_PLAYERS = 20;
const GAME_MODES = Object.freeze({ classic: 15000, blitz: 9000, relaxed: 25000 });
const ALLOWED_ROUNDS = new Set([5, 8, 12]);
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
  mode: room.mode, roundDuration: room.roundDuration,
  maxPlayers: MAX_PLAYERS,
  players: [...room.players.values()].map(p => ({ id:p.id, name:p.name, score:p.score, streak:p.streak || 0, bestStreak:p.bestStreak || 0, lastCorrect:room.status === "reveal" && p.answered === room.current?.correct, hasAnswered:p.answered !== null, connected:p.connected })),
  question: ["question", "reveal"].includes(room.status) ? { q: room.current.q, a: room.current.a, category: room.current.category } : null,
  reveal: room.status === "reveal" ? { correct: room.current.correct, explanation: "The correct answer is highlighted below." } : null,
  myId: playerId || null
});
function startServer({ port = Number(process.env.PORT) || 3000, host = "0.0.0.0" } = {}) {
  const app = express();
  const server = http.createServer(app);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://room-rush-app.onrender.com,http://localhost:3000,http://127.0.0.1:3000")
    .split(",").map(origin => origin.trim()).filter(Boolean);
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed by Room Rush."));
      }
    },
    maxHttpBufferSize: 1e5,
    pingInterval: 25000,
    pingTimeout: 20000
  });
  app.use(express.static(path.join(__dirname, "public")));
  app.get("/health", (_req,res) => res.json({ ok:true, game:"Room Rush" }));

  function emitRoom(room) { io.to(room.code).emit("state", publicRoom(room)); }
  function rateLimit(socket, event, callback, limit, windowMs = 60000) {
    const now = Date.now();
    socket.data.rateLimits ||= new Map();
    const bucket = socket.data.rateLimits.get(event) || { startedAt: now, count: 0 };
    if (now - bucket.startedAt >= windowMs) {
      bucket.startedAt = now;
      bucket.count = 0;
    }
    bucket.count += 1;
    socket.data.rateLimits.set(event, bucket);
    if (bucket.count > limit) {
      callback({ ok: false, error: "Too many requests. Please wait a moment and try again." });
      return false;
    }
    return true;
  }
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
    const connectedPlayers = [...room.players.values()].filter(p => p.connected);
    if (room.status === "question" && connectedPlayers.length > 0 && connectedPlayers.every(p => p.answered !== null)) reveal(room);
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
    for (const player of room.players.values()) {
      if (player.answered !== room.current.correct) player.streak = 0;
    }
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
    room.deadline = Date.now() + room.roundDuration;
    for (const p of room.players.values()) p.answered = null;
    emitRoom(room);
    room.timer = setTimeout(() => reveal(room), room.roundDuration);
  }
  io.on("connection", socket => {
    socket.on("createRoom", (payload, cb = () => {}) => {
      if (!rateLimit(socket, "createRoom", cb, 5)) return;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return cb({ ok:false, error:"Invalid room details." });
      const clean = normalizeName(payload.name);
      const totalRounds = ALLOWED_ROUNDS.has(payload.rounds) ? payload.rounds : 8;
      const mode = Object.hasOwn(GAME_MODES, payload.mode) ? payload.mode : "classic";
      const roundDuration = GAME_MODES[mode];
      const code = makeCode();
      const id = socket.id;
      const playerToken = makePlayerToken();
      const room = { code, hostId:id, status:"lobby", round:0, totalRounds, mode, roundDuration, deadline:null, timer:null, cleanupTimer:null,
        players:new Map([[id,{id,token:playerToken,name:clean,score:0,streak:0,bestStreak:0,answered:null,connected:true,disconnectTimer:null}]]),
        questions:[...QUESTIONS].sort(() => Math.random()-.5).slice(0,totalRounds), current:null };
      rooms.set(code, room); socket.data.playerToken = playerToken; socket.join(code);
      cb({ ok:true, playerToken, state:publicRoom(room,id) }); emitRoom(room);
    });
    socket.on("rejoinRoom", (payload, cb = () => {}) => {
      if (!rateLimit(socket, "rejoinRoom", cb, 12)) return;
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
      if (!rateLimit(socket, "joinRoom", cb, 12)) return;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return cb({ ok:false, error:"Invalid room details." });
      const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
      if (!ROOM_CODE_PATTERN.test(code)) return cb({ ok:false, error:"Room codes must be 4 letters or numbers. Check the code and try again." });
      const room = rooms.get(code);
      if (!room) return cb({ ok:false, error:"Room not found. Check the code and try again." });
      if (room.status !== "lobby") return cb({ ok:false, error:"This game has already started." });
      for (const offlinePlayer of [...room.players.values()]) {
        if (!offlinePlayer.connected) removePlayer(room,offlinePlayer);
      }
      if (room.players.size >= MAX_PLAYERS) return cb({ ok:false, error:`This room is full (${MAX_PLAYERS} players max).` });
      const clean = normalizeName(payload.name);
      const id = socket.id;
      const playerToken = makePlayerToken();
      room.players.set(id,{id,token:playerToken,name:clean,score:0,streak:0,bestStreak:0,answered:null,connected:true,disconnectTimer:null});
      socket.data.playerToken = playerToken;
      socket.join(code); cb({ok:true,playerToken,state:publicRoom(room,id)}); emitRoom(room);
    });
    socket.on("leaveRoom", (payload, cb=()=>{}) => {
      if (!rateLimit(socket, "leaveRoom", cb, 10)) return;
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.code !== "string") return cb({ok:false,error:"Invalid room code."});
      const code = payload.code.trim().toUpperCase();
      const room = rooms.get(code);
      const player = room && room.players.get(socket.id);
      if (!room || !player) return cb({ok:false,error:"You are not in this room."});
      clearTimeout(player.disconnectTimer);
      room.players.delete(player.id);
      socket.leave(code);
      if (room.hostId === player.id) room.hostId = [...room.players.values()].find(candidate => candidate.connected)?.id || null;
      const connectedPlayers = [...room.players.values()].filter(candidate => candidate.connected);
      if (room.status === "question" && connectedPlayers.length > 0 && connectedPlayers.every(candidate => candidate.answered !== null)) reveal(room);
      else emitRoom(room);
      if (connectedPlayers.length === 0) scheduleRoomCleanup(room);
      cb({ok:true});
    });
    socket.on("startGame", (payload, cb=()=>{}) => {
      if (!rateLimit(socket, "startGame", cb, 5)) return;
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
      if (!rateLimit(socket, "answer", cb, 20)) return;
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
        p.streak = (p.streak || 0) + 1;
        p.bestStreak = Math.max(p.bestStreak || 0, p.streak);
        const streakBonus = Math.min(Math.max(0, p.streak - 1), 5) * 10;
        p.score += 100 + Math.round(remaining / room.roundDuration * 50) + streakBonus;
      } else {
        p.streak = 0;
      }
      emitRoom(room); cb({ok:true});
      const connectedPlayers = [...room.players.values()].filter(x => x.connected);
      if (connectedPlayers.length > 0 && connectedPlayers.every(x => x.answered !== null)) reveal(room);
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
          const connectedPlayers = [...room.players.values()].filter(player => player.connected);
          if (room.status === "question" && connectedPlayers.length > 0 && connectedPlayers.every(player => player.answered !== null)) reveal(room);
          else emitRoom(room);
        }
      }
    });
  });
  return new Promise(resolve => server.listen(port, host, () => resolve({app,server,io,port:server.address().port})));
}
if (require.main === module) startServer().then(({port}) => console.log(`Room Rush server running at http://localhost:${port}`));
module.exports = { startServer, ROOM_CODE_PATTERN, MAX_PLAYERS, RECONNECT_GRACE_MS };
