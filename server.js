const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const helmet = require("helmet");
const { Server } = require("socket.io");
const { createMemoryRoomStore } = require("./server/store/room-store");

const QUESTIONS = [
  // Science & Tech
  { q: "Which planet is known as the Red Planet?", a: ["Venus", "Mars", "Jupiter", "Mercury"], correct: 1, category: "Science" },
  { q: "Which language runs natively in web browsers?", a: ["Python", "C++", "Java", "JavaScript"], correct: 3, category: "Technology" },
  { q: "Which gas do plants absorb from the atmosphere?", a: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], correct: 1, category: "Science" },
  { q: "Which company created the Windows operating system?", a: ["Apple", "Microsoft", "IBM", "Google"], correct: 1, category: "Technology" },
  { q: "What is the chemical symbol for gold?", a: ["Ag", "Gd", "Au", "Go"], correct: 2, category: "Science" },
  { q: "Which metal is liquid at typical room temperature?", a: ["Iron", "Mercury", "Copper", "Aluminum"], correct: 1, category: "Science" },
  { q: "Which gas do humans need to breathe to survive?", a: ["Helium", "Oxygen", "Carbon dioxide", "Neon"], correct: 1, category: "Science" },
  { q: "Which instrument measures atmospheric pressure?", a: ["Thermometer", "Barometer", "Speedometer", "Altimeter"], correct: 1, category: "Science" },
  { q: "What does 'HTTP' stand for in web addresses?", a: ["Hypertext Transfer Protocol", "High Text Transmission Path", "Hyperlink Total Transfer Process", "Host Terminal Tele-Protocol"], correct: 0, category: "Technology" },
  { q: "What is the hardest natural substance on Earth?", a: ["Titanium", "Granite", "Diamond", "Quartz"], correct: 2, category: "Science" },
  { q: "Which planet has the most prominent ring system?", a: ["Mars", "Venus", "Saturn", "Mercury"], correct: 2, category: "Science" },
  { q: "In computer science, how many bits make up one byte?", a: ["4", "8", "16", "32"], correct: 1, category: "Technology" },
  { q: "What is the center of an atom called?", a: ["Electron", "Proton", "Nucleus", "Photon"], correct: 2, category: "Science" },
  { q: "Who is widely considered the father of computer science?", a: ["Alan Turing", "Charles Babbage", "Nikola Tesla", "Ada Lovelace"], correct: 0, category: "Technology" },
  { q: "What is the primary power source for the Earth's climate?", a: ["The Moon", "The Sun", "Geothermal vents", "The Core"], correct: 1, category: "Science" },

  // Geography & World
  { q: "What is the capital city of Japan?", a: ["Seoul", "Beijing", "Tokyo", "Bangkok"], correct: 2, category: "Geography" },
  { q: "What is the largest ocean on Earth?", a: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3, category: "Geography" },
  { q: "Which continent is the Sahara Desert in?", a: ["Asia", "Africa", "Australia", "South America"], correct: 1, category: "Geography" },
  { q: "Which country is home to the city of Kyoto?", a: ["China", "Japan", "Thailand", "Vietnam"], correct: 1, category: "Geography" },
  { q: "What is the capital of Canada?", a: ["Toronto", "Vancouver", "Ottawa", "Montreal"], correct: 2, category: "Geography" },
  { q: "Which ocean lies between Africa and Australia?", a: ["Atlantic", "Indian", "Arctic", "Southern"], correct: 1, category: "Geography" },
  { q: "What is the longest river in the world?", a: ["Amazon", "Nile", "Yangtze", "Mississippi"], correct: 1, category: "Geography" },
  { q: "Which mountain is the highest peak above sea level?", a: ["K2", "Mount Kilimanjaro", "Mount Everest", "Denali"], correct: 2, category: "Geography" },
  { q: "What is the capital city of Australia?", a: ["Sydney", "Melbourne", "Canberra", "Brisbane"], correct: 2, category: "Geography" },
  { q: "Which country has the most natural lakes in the world?", a: ["Russia", "Canada", "USA", "Finland"], correct: 1, category: "Geography" },
  { q: "Which strait separates Europe and Africa?", a: ["Strait of Hormuz", "Strait of Gibraltar", "Bering Strait", "Bosporus"], correct: 1, category: "Geography" },
  { q: "What is the smallest independent state in the world by area?", a: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"], correct: 2, category: "Geography" },

  // Nature & Animals
  { q: "Which animal is the fastest land mammal?", a: ["Lion", "Horse", "Cheetah", "Leopard"], correct: 2, category: "Nature" },
  { q: "What is the largest mammal on Earth?", a: ["African elephant", "Giraffe", "Blue whale", "Hippopotamus"], correct: 2, category: "Nature" },
  { q: "Which animal is known for changing color to blend into its environment?", a: ["Chameleon", "Panda", "Otter", "Meerkat"], correct: 0, category: "Nature" },
  { q: "What do bees collect from flowers to make honey?", a: ["Nectar", "Dew", "Sap", "Pollen only"], correct: 0, category: "Nature" },
  { q: "What is the young form of a frog called?", a: ["Cub", "Tadpole", "Calf", "Chick"], correct: 1, category: "Nature" },
  { q: "How many arms does a typical octopus have?", a: ["Six", "Eight", "Ten", "Twelve"], correct: 1, category: "Nature" },
  { q: "Which bird is known for its ability to mimic human speech?", a: ["Eagle", "Parrot", "Pelican", "Flamingo"], correct: 1, category: "Nature" },
  { q: "What type of tree produces acorns?", a: ["Pine", "Oak", "Maple", "Birch"], correct: 1, category: "Nature" },
  { q: "Which marine creature has three hearts and blue blood?", a: ["Shark", "Octopus", "Jellyfish", "Sea Turtle"], correct: 1, category: "Nature" },

  // General Knowledge & Culture
  { q: "How many sides does a hexagon have?", a: ["Five", "Six", "Seven", "Eight"], correct: 1, category: "General" },
  { q: "How many minutes are in two hours?", a: ["90", "100", "120", "180"], correct: 2, category: "General" },
  { q: "What is 9 × 7?", a: ["56", "63", "72", "69"], correct: 1, category: "Numbers" },
  { q: "Which instrument usually has 88 keys?", a: ["Violin", "Piano", "Flute", "Drum kit"], correct: 1, category: "Music" },
  { q: "How many colors are traditionally named in a rainbow?", a: ["Five", "Six", "Seven", "Eight"], correct: 2, category: "General" },
  { q: "Which sport uses the terms love, deuce, and ace?", a: ["Tennis", "Golf", "Cricket", "Hockey"], correct: 0, category: "Sports" },
  { q: "What is the main ingredient in guacamole?", a: ["Cucumber", "Avocado", "Peas", "Spinach"], correct: 1, category: "Food" },
  { q: "How many players from one team are on court in basketball?", a: ["Four", "Five", "Six", "Seven"], correct: 1, category: "Sports" },
  { q: "Which is the smallest prime number?", a: ["0", "1", "2", "3"], correct: 2, category: "Numbers" },
  { q: "What is a word that reads the same backward called?", a: ["Acronym", "Palindrome", "Synonym", "Anagram"], correct: 1, category: "Words" },
  { q: "How many sides does an octagon have?", a: ["Six", "Seven", "Eight", "Nine"], correct: 2, category: "Numbers" },
  { q: "Which shape has three sides?", a: ["Triangle", "Rectangle", "Pentagon", "Circle"], correct: 0, category: "General" },
  { q: "Who painted the Mona Lisa?", a: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Claude Monet"], correct: 2, category: "General" },
  { q: "How many bones are in the adult human body?", a: ["186", "206", "226", "246"], correct: 1, category: "Science" },
  { q: "Which classical composer became deaf later in life?", a: ["Mozart", "Beethoven", "Bach", "Chopin"], correct: 1, category: "Music" }
];

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_PATTERN = new RegExp(`^[${alphabet}]{${ROOM_CODE_LENGTH}}$`);
const MAX_PLAYERS = 20;
const GAME_MODES = Object.freeze({ classic: 15000, blitz: 9000, relaxed: 25000 });
const ALLOWED_ROUNDS = new Set([5, 8, 12, 16]);
const RECONNECT_GRACE_MS = 30000;
const ROOM_IDLE_MS = 5 * 60 * 1000;
const FINISHED_ROOM_TTL_MS = 5 * 60 * 1000;
const PLAYER_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_EMOTES = new Set(["\u{1F525}", "\u{1F44F}", "\u{1F602}", "\u{1F9E0}", "\u{1F480}", "\u{1F3AF}"]);
const REACTION_LIMIT = 6;
const REACTION_WINDOW_MS = 10 * 1000;

const normalizeName = value => typeof value === "string" ? value.trim().slice(0, 18) || "Player" : "Player";
const makePlayerToken = () => crypto.randomBytes(32).toString("hex");

// Codes are generated with crypto.randomInt so they are not predictable from
// previously observed codes, and are long enough that enumerating the space is
// not practical. 32^6 is roughly 1.07 billion combinations.
// Fisher-Yates. Unbiased, unlike sort(() => Math.random() - 0.5), which
// systematically favours some positions over others.
const shuffle = items => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const makeCode = roomStore => {
  let code;
  do { code = Array.from({length: ROOM_CODE_LENGTH}, () => alphabet[crypto.randomInt(alphabet.length)]).join(""); }
  while (roomStore.has(code));
  return code;
};

// playerId is the viewer. Lifeline state is only ever included for the player
// who owns it; everyone else sees the neutral defaults. This payload is built
// per seat by emitRoom, never broadcast to the whole room.
const publicRoom = (room, playerId) => {
  const isSelf = p => playerId !== null && playerId !== undefined && p.id === playerId;

  return {
  code: room.code, hostId: room.hostId, status: room.status, round: room.round,
  totalRounds: room.totalRounds, deadline: room.deadline,
  mode: room.mode, roundDuration: room.roundDuration,
  maxPlayers: MAX_PLAYERS,
  hasBot: [...room.players.values()].some(p => p.isBot),
  players: [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    streak: p.streak || 0,
    bestStreak: p.bestStreak || 0,
    lastCorrect: room.status === "reveal" && p.answered === room.current?.correct,
    hasAnswered:p.answered !== null,
    connected: p.connected,
    isBot: Boolean(p.isBot),
    doubled: isSelf(p) && Boolean(p.doubled),
    hiddenOptions: isSelf(p) ? (p.hiddenOptions || []) : []
  })),
  question: ["question", "reveal"].includes(room.status) ? { q: room.current.q, a: room.current.a, category: room.current.category } : null,
  reveal: room.status === "reveal" ? { correct: room.current.correct, explanation: "The correct answer is highlighted below." } : null,
  myId: playerId || null
  };
};

function startServer({
  port = Number(process.env.PORT) || 3000,
  host = "0.0.0.0",
  roomStore = createMemoryRoomStore(),
  finishedRoomTtlMs = FINISHED_ROOM_TTL_MS
} = {}) {
  const rooms = roomStore;
  const app = express();
  const server = http.createServer(app);

  // Render terminates TLS in front of the app, so the client address for rate
  // limiting comes from X-Forwarded-For. Exactly one proxy hop.
  app.set("trust proxy", 1);
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

  // The client ships no inline scripts or inline style attributes, so the
  // policy can stay strict. Socket.IO needs connect-src to cover ws/wss.
  // upgrade-insecure-requests is production-only: on plain http://localhost it
  // would rewrite asset requests to https and break local development.
  const isProduction = process.env.NODE_ENV === "production";

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.static(path.join(__dirname, "public")));

  // Public liveness data only: no hostnames, no environment values, no memory
  // figures. Room count is a game statistic, not internal infrastructure.
  app.get("/health", (_req, res) => res.json({
    ok: true,
    game: "Room Rush",
    version: "1.0.4",
    uptimeSeconds: Math.round(process.uptime()),
    rooms: rooms.size
  }));

  // One payload per seat, because the payload now carries private lifeline
  // state. player.id is the socket id, so the live socket is a direct lookup;
  // a player inside the reconnect grace window has no socket and gets their
  // state from the rejoin ack instead.
  function emitRoom(room) {
    for (const player of room.players.values()) {
      const socket = io.sockets.sockets.get(player.id);
      if (!socket) continue;
      socket.emit("state", publicRoom(room, player.id));
    }
  }

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

  // Per-address limiter. The per-socket limiter above is trivially bypassed by
  // reconnecting, which matters for room codes because a code is the only
  // access control on joining a lobby.
  const addressBuckets = new Map();

  function clientAddress(socket) {
    const forwarded = socket.handshake.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length) return forwarded.split(",")[0].trim();
    return socket.handshake.address || "unknown";
  }

  function addressRateLimit(socket, event, limit, windowMs = 60000) {
    const now = Date.now();
    const address = clientAddress(socket);

    // Bound the map so it cannot grow without limit on a busy or hostile host.
    if (addressBuckets.size > 10000) addressBuckets.clear();

    const bucket = addressBuckets.get(address) || { startedAt: now, count: 0 };
    if (now - bucket.startedAt >= windowMs) {
      bucket.startedAt = now;
      bucket.count = 0;
    }
    bucket.count += 1;
    addressBuckets.set(address, bucket);
    return bucket.count <= limit;
  }

  function scheduleRoomCleanup(room, delay = ROOM_IDLE_MS) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = setTimeout(() => {
      if (rooms.get(room.code) !== room) return;
      if ([...room.players.values()].some(p => p.connected && !p.isBot)) return;
      clearTimeout(room.timer);
      clearTimeout(room.botTimer);
      clearTimeout(room.reapTimer);
      rooms.delete(room.code);
    }, delay);
    room.cleanupTimer.unref?.();
  }

  // A finished room is deleted on a fixed timer whether or not players are
  // still connected. Without this the results screen keeps the whole room,
  // its questions and its player objects resident until the last player leaves.
  function scheduleFinishedRoomReap(room, delay = finishedRoomTtlMs) {
    clearTimeout(room.reapTimer);
    room.reapTimer = setTimeout(() => {
      if (rooms.get(room.code) !== room) return;
      clearTimeout(room.timer);
      clearTimeout(room.botTimer);
      clearTimeout(room.cleanupTimer);
      rooms.delete(room.code);
    }, delay);
    room.reapTimer.unref?.();
  }

  function removePlayer(room, player) {
    clearTimeout(player.disconnectTimer);
    room.players.delete(player.id);
    if (room.hostId === player.id) {
      room.hostId = [...room.players.values()].find(p => p.connected && !p.isBot)?.id || null;
    }
    const activeHumans = [...room.players.values()].filter(p => p.connected && !p.isBot);
    if (activeHumans.length === 0) {
      for (const [id, p] of room.players.entries()) {
        if (p.isBot) room.players.delete(id);
      }
    }
    const connectedPlayers = [...room.players.values()].filter(p => p.connected);
    if (room.status === "question" && connectedPlayers.length > 0 && connectedPlayers.every(p => p.answered !== null)) reveal(room);
    else emitRoom(room);
    if (![...room.players.values()].some(p => p.connected && !p.isBot)) scheduleRoomCleanup(room);
  }

  function endRoom(room) {
    clearTimeout(room.timer);
    clearTimeout(room.botTimer);
    room.status = "finished";
    room.deadline = null;
    emitRoom(room);
    scheduleFinishedRoomReap(room);
  }

  function reveal(room) {
    if (!room || room.status !== "question") return;
    clearTimeout(room.timer);
    clearTimeout(room.botTimer);
    for (const player of room.players.values()) {
      if (player.answered !== room.current.correct) player.streak = 0;
    }
    room.status = "reveal";
    room.deadline = Date.now() + 2800;
    emitRoom(room);
    room.timer = setTimeout(() => {
      if (!rooms.has(room.code) || room.status !== "reveal") return;
      if (room.round >= room.totalRounds) return endRoom(room);
      nextQuestion(room);
    }, 2800);
  }

  function handleBotAnswer(room) {
    const bot = [...room.players.values()].find(p => p.isBot && p.connected);
    if (!bot || room.status !== "question") return;
    const delay = Math.floor(Math.random() * Math.min(room.roundDuration - 2000, 5000)) + 2000;
    room.botTimer = setTimeout(() => {
      if (room.status !== "question" || bot.answered !== null) return;
      const isCorrect = Math.random() < 0.75;
      let botAnswer = room.current.correct;
      if (!isCorrect) {
        const wrongAnswers = [0, 1, 2, 3].filter(idx => idx !== room.current.correct);
        botAnswer = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
      }
      bot.answered = botAnswer;
      if (botAnswer === room.current.correct) {
        bot.streak = (bot.streak || 0) + 1;
        bot.bestStreak = Math.max(bot.bestStreak || 0, bot.streak);
        const remaining = Math.max(0, room.deadline - Date.now());
        const streakBonus = Math.min(Math.max(0, bot.streak - 1), 5) * 10;
        bot.score += 100 + Math.round(remaining / room.roundDuration * 50) + streakBonus;
      } else {
        bot.streak = 0;
      }
      emitRoom(room);
      const connectedPlayers = [...room.players.values()].filter(p => p.connected);
      if (connectedPlayers.length > 0 && connectedPlayers.every(p => p.answered !== null)) reveal(room);
    }, delay);
  }

  function nextQuestion(room) {
    room.round += 1;
    room.current = room.questions[room.round - 1];
    room.status = "question";
    room.deadline = Date.now() + room.roundDuration;
    for (const p of room.players.values()) {
      p.answered = null;
      p.doubled = false;
      p.hiddenOptions = [];
    }
    emitRoom(room);
    handleBotAnswer(room);
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
      const code = makeCode(rooms);
      const id = socket.id;
      const playerToken = makePlayerToken();

      let questionPool = [...QUESTIONS];
      if (payload.category && payload.category !== "all") {
        const filtered = QUESTIONS.filter(q => q.category.toLowerCase() === payload.category.toLowerCase());
        if (filtered.length >= totalRounds) questionPool = filtered;
      }

      const room = {
        code, hostId: id, status: "lobby", round: 0, totalRounds, mode, roundDuration,
        deadline: null, timer: null, botTimer: null, cleanupTimer: null, reapTimer: null,
        players: new Map([[id, {
          id, token: playerToken, name: clean, score: 0, streak: 0, bestStreak: 0,
          answered: null, connected: true, disconnectTimer: null,
          lifelines: { fiftyFifty: true, doubleDown: true }
        }]]),
        questions: shuffle(questionPool).slice(0, totalRounds),
        current: null
      };

      rooms.set(code, room);
      socket.join(code);
      cb({ ok: true, playerToken, state: publicRoom(room, id) });
      emitRoom(room);
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
      if (!room.hostId || room.hostId !== player.id && ![...room.players.values()].some(p => p.id === room.hostId && p.connected && !p.isBot)) room.hostId = player.id;
      socket.join(code);
      cb({ ok: true, state: publicRoom(room, player.id) });
      emitRoom(room);
    });

    socket.on("joinRoom", (payload, cb = () => {}) => {
      if (!rateLimit(socket, "joinRoom", cb, 12)) return;
      if (!addressRateLimit(socket, "joinRoom", 120)) return cb({ ok:false, error:"Too many join attempts from this network. Please wait a minute." });
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return cb({ ok:false, error:"Invalid room details." });
      const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
      if (!ROOM_CODE_PATTERN.test(code)) return cb({ ok:false, error:"Room codes must be 6 letters or numbers. Check the code and try again." });
      const room = rooms.get(code);
      if (!room) return cb({ ok:false, error:"Room not found. Check the code and try again." });
      // A socket that already holds a seat must not rejoin the same room: it
      // would overwrite its own entry with a fresh token and a new name.
      if (room.players.has(socket.id)) return cb({ ok:false, error:"You are already in this room." });
      if (room.status !== "lobby") return cb({ ok:false, error:"This game has already started." });
      for (const offlinePlayer of [...room.players.values()]) {
        if (!offlinePlayer.connected && !offlinePlayer.isBot) removePlayer(room, offlinePlayer);
      }
      if (room.players.size >= MAX_PLAYERS) return cb({ ok:false, error:`This room is full (${MAX_PLAYERS} players max).` });
      const clean = normalizeName(payload.name);
      const id = socket.id;
      const playerToken = makePlayerToken();
      room.players.set(id, {
        id, token: playerToken, name: clean, score: 0, streak: 0, bestStreak: 0,
        answered: null, connected: true, disconnectTimer: null,
        lifelines: { fiftyFifty: true, doubleDown: true }
      });
      socket.join(code);
      cb({ ok: true, playerToken, state: publicRoom(room, id) });
      emitRoom(room);
    });

    // Add / Toggle AI Bot for solo practice
    socket.on("toggleBot", (payload, cb = () => {}) => {
      if (!rateLimit(socket, "toggleBot", cb, 10)) return;
      if (!payload || typeof payload.code !== "string") return cb({ ok:false, error:"Invalid code." });
      const code = payload.code.trim().toUpperCase();
      if (!ROOM_CODE_PATTERN.test(code)) return cb({ ok:false, error:"Invalid room code." });
      const room = rooms.get(code);
      if (!room || room.hostId !== socket.id) return cb({ ok:false, error:"Only the host can add or remove AI bots." });
      if (room.status !== "lobby") return cb({ ok:false, error:"Cannot change bots once game has started." });

      const existingBot = [...room.players.values()].find(p => p.isBot);
      if (existingBot) {
        room.players.delete(existingBot.id);
      } else {
        if (room.players.size >= MAX_PLAYERS) return cb({ ok:false, error:"Room is full." });
        const botId = "bot_" + Math.random().toString(36).slice(2, 8);
        room.players.set(botId, {
          id: botId,
          token: makePlayerToken(),
          name: "RushBot 🤖",
          score: 0,
          streak: 0,
          bestStreak: 0,
          answered: null,
          connected: true,
          isBot: true,
          disconnectTimer: null
        });
      }
      emitRoom(room);
      cb({ ok: true, hasBot: [...room.players.values()].some(p => p.isBot) });
    });

    // Live Emoji Reaction Broadcast
    socket.on("reaction", (payload, cb = () => {}) => {
      // This handler is a fan-out: every accepted reaction is broadcast to up
      // to 20 sockets, so it must be the most tightly limited one on the server.
      if (!rateLimit(socket, "reaction", cb, REACTION_LIMIT, REACTION_WINDOW_MS)) return;
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.code !== "string" || typeof payload.emote !== "string") {
        return cb({ ok: false, error: "Invalid reaction." });
      }
      const room = rooms.get(payload.code.trim().toUpperCase());
      if (!room) return cb({ ok: false, error: "Room not found." });
      const player = room.players.get(socket.id);
      if (!player) return cb({ ok: false, error: "You are not in this room." });
      if (!ALLOWED_EMOTES.has(payload.emote)) return cb({ ok: false, error: "That reaction is not available." });
      io.to(room.code).emit("reaction", { name: player.name, emote: payload.emote });
      cb({ ok: true });
    });

    // Lifeline: 50-50 or Double Down
    socket.on("useLifeline", (payload, cb = () => {}) => {
      if (!rateLimit(socket, "useLifeline", cb, 6)) return;
      if (!payload || typeof payload.code !== "string" || !["fiftyFifty", "doubleDown"].includes(payload.type)) {
        return cb({ ok: false, error: "Invalid lifeline request." });
      }
      const room = rooms.get(payload.code.trim().toUpperCase());
      if (!room || room.status !== "question") return cb({ ok: false, error: "Lifelines can only be used during an active question." });
      const p = room.players.get(socket.id);
      if (!p || p.answered !== null) return cb({ ok: false, error: "Cannot use lifeline after answering." });
      if (!p.lifelines || !p.lifelines[payload.type]) return cb({ ok: false, error: "Lifeline already used in this match." });

      p.lifelines[payload.type] = false;

      if (payload.type === "fiftyFifty") {
        const correctIdx = room.current.correct;
        const wrongIndices = shuffle([0, 1, 2, 3].filter(i => i !== correctIdx));
        const toHide = wrongIndices.slice(0, 2);
        p.hiddenOptions = toHide;
        cb({ ok: true, type: "fiftyFifty", hiddenOptions: toHide });
      } else if (payload.type === "doubleDown") {
        p.doubled = true;
        cb({ ok: true, type: "doubleDown" });
      }
      emitRoom(room);
    });

    socket.on("leaveRoom", (payload, cb = () => {}) => {
      if (!rateLimit(socket, "leaveRoom", cb, 10)) return;
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.code !== "string") return cb({ok:false,error:"Invalid room code."});
      const code = payload.code.trim().toUpperCase();
      const room = rooms.get(code);
      const player = room && room.players.get(socket.id);
      if (!room || !player) return cb({ok:false,error:"You are not in this room."});
      clearTimeout(player.disconnectTimer);
      room.players.delete(player.id);
      socket.leave(code);
      if (room.hostId === player.id) room.hostId = [...room.players.values()].find(candidate => candidate.connected && !candidate.isBot)?.id || null;
      const connectedPlayers = [...room.players.values()].filter(candidate => candidate.connected);
      if (room.status === "question" && connectedPlayers.length > 0 && connectedPlayers.every(candidate => candidate.answered !== null)) reveal(room);
      else emitRoom(room);
      if (![...room.players.values()].some(p => p.connected && !p.isBot)) scheduleRoomCleanup(room);
      cb({ok:true});
    });

    socket.on("startGame", (payload, cb = () => {}) => {
      if (!rateLimit(socket, "startGame", cb, 5)) return;
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.code !== "string") return cb({ok:false,error:"Invalid room code."});
      const code = payload.code.trim().toUpperCase();
      if (!ROOM_CODE_PATTERN.test(code)) return cb({ok:false,error:"Invalid room code."});
      const room = rooms.get(code);
      if (!room) return cb({ok:false,error:"Room no longer exists."});
      if (socket.id !== room.hostId) return cb({ok:false,error:"Only the host can start the game."});
      const connectedCount = [...room.players.values()].filter(p => p.connected).length;
      if (connectedCount < 2) return cb({ok:false,error:"Invite at least one more player (or add an AI Practice Bot) to start."});
      if (room.status !== "lobby") return cb({ok:false,error:"The game has already started."});
      nextQuestion(room);
      cb({ok:true});
    });

    socket.on("answer", (payload, cb = () => {}) => {
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
        const streakBonus = Math.min(Math.max(0, p.streak - 1), 5) * 15;
        let points = 100 + Math.round((remaining / room.roundDuration) * 75) + streakBonus;
        if (p.doubled) points *= 2;
        p.score += points;
      } else {
        if (p.doubled) p.score = Math.max(0, p.score - 50);
        p.streak = 0;
      }

      emitRoom(room);
      cb({ok:true});
      const connectedPlayers = [...room.players.values()].filter(x => x.connected);
      if (connectedPlayers.length > 0 && connectedPlayers.every(x => x.answered !== null)) reveal(room);
    });

    socket.on("disconnect", () => {
      for (const room of rooms.values()) {
        if (room.players.has(socket.id)) {
          const p = room.players.get(socket.id);
          p.connected = false;
          if (room.status === "lobby" && room.hostId === p.id) {
            room.hostId = [...room.players.values()].find(candidate => candidate.connected && !candidate.isBot)?.id || null;
          }
          p.disconnectTimer = setTimeout(() => {
            if (room.players.get(p.id) === p && !p.connected) removePlayer(room, p);
          }, RECONNECT_GRACE_MS);
          p.disconnectTimer.unref?.();
          if (![...room.players.values()].some(player => player.connected && !player.isBot)) scheduleRoomCleanup(room);
          const connectedPlayers = [...room.players.values()].filter(player => player.connected);
          if (room.status === "question" && connectedPlayers.length > 0 && connectedPlayers.every(player => player.answered !== null)) reveal(room);
          else emitRoom(room);
        }
      }
    });
  });

  return new Promise(resolve => server.listen(port, host, () => resolve({app, server, io, port: server.address().port})));
}

if (require.main === module) startServer().then(({port}) => console.log(`Room Rush server running at http://localhost:${port}`));

module.exports = { startServer, createMemoryRoomStore, ROOM_CODE_PATTERN, ROOM_CODE_LENGTH, MAX_PLAYERS, RECONNECT_GRACE_MS };
