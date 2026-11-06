const $ = id => document.getElementById(id);
const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  timeout: 20000
});
let current = null, playerId = null, roomCode = sessionStorage.getItem("roomRushRoomCode") || "", playerToken = sessionStorage.getItem("roomRushPlayerToken") || "", isHost = false, chosen = false, selectedAnswer = null, activeRound = 0, activeRevealRound = 0, celebratedGame = false, clock = null, reconnecting = false;
let soundEnabled = localStorage.getItem("roomRushSound") !== "off";
if (localStorage.getItem("roomRushName")) $("name").value = localStorage.getItem("roomRushName");
$("name").addEventListener("input", () => localStorage.setItem("roomRushName", $("name").value.slice(0,18)));
function updateSoundButton() { $("soundToggle").textContent = soundEnabled ? "♫ SOUND ON" : "♫ SOUND OFF"; $("soundToggle").setAttribute("aria-pressed", String(soundEnabled)); }
updateSoundButton();
$("soundToggle").addEventListener("click", () => { soundEnabled = !soundEnabled; localStorage.setItem("roomRushSound", soundEnabled ? "on" : "off"); updateSoundButton(); if (soundEnabled) playCue("correct"); });
function playCue(kind) {
  if (!soundEnabled || !window.AudioContext) return;
  try {
    const context = new AudioContext();
    const notes = kind === "winner" ? [523,659,784,1047] : kind === "correct" ? [660,880] : [330,247];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.12 + 0.18);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(context.currentTime + index * 0.12); oscillator.stop(context.currentTime + index * 0.12 + 0.2);
    });
    setTimeout(() => context.close().catch(() => {}), notes.length * 140 + 300);
  } catch {}
}
function confettiBurst() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#c8ff4d", "#a78bfa", "#ff7bac", "#5de1ff", "#ffe066"];
  for (let index = 0; index < 46; index++) {
    const piece = document.createElement("i"); piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw"; piece.style.background = colors[index % colors.length];
    piece.style.setProperty("--fall", 60 + Math.random() * 70 + "vh"); piece.style.setProperty("--spin", Math.random() * 900 - 450 + "deg");
    piece.style.animationDelay = Math.random() * 350 + "ms"; document.body.appendChild(piece); setTimeout(() => piece.remove(), 2400);
  }
}
const letters = ["A","B","C","D"];
function setError(id, msg=""){ $(id).textContent = msg; }
function playerName(){ return $("name").value.trim().slice(0,18) || "Player"; }
function call(event, data={}) {
  return new Promise(resolve => socket.timeout(5000).emit(event, data, (err, result) => {
    if (err) resolve({ok:false,error:"Server did not respond. Check your connection."});
    else resolve(result || {ok:false,error:"Unexpected server response."});
  }));
}
function showGame(state, host=false) {
  if (roomCode && state.code !== roomCode) { activeRevealRound = 0; celebratedGame = false; }
  current = state; roomCode = state.code; sessionStorage.setItem("roomRushRoomCode", roomCode); playerId = state.myId || playerId; isHost = host || state.hostId === playerId;
  $("home").classList.add("hidden"); $("game").classList.remove("hidden");
  $("codeShow").textContent = roomCode; $("role").textContent = isHost ? "YOU'RE THE HOST" : "YOU'RE PLAYING";
  render();
}
function showHome(){ $("game").classList.add("hidden"); $("home").classList.remove("hidden"); current=null; roomCode=""; playerId=null; playerToken=""; sessionStorage.removeItem("roomRushPlayerToken"); sessionStorage.removeItem("roomRushRoomCode"); isHost=false; chosen=false; selectedAnswer=null; activeRound=0; activeRevealRound=0; celebratedGame=false; clearInterval(clock); }
function rememberSession(result){ playerToken=result.playerToken; sessionStorage.setItem("roomRushPlayerToken",playerToken); sessionStorage.setItem("roomRushRoomCode",result.state.code); }
$("createBtn").addEventListener("click", async () => {
  setError("homeError"); $("createBtn").disabled=true;
  const r=await call("createRoom",{name:playerName(),rounds:Number($("rounds").value),mode:$("mode").value}); $("createBtn").disabled=false;
  if(!r.ok){setError("homeError",r.error);return;} rememberSession(r); showGame(r.state,true);
});
$("joinBtn").addEventListener("click", async () => {
  setError("homeError"); const code=$("roomCode").value.trim().toUpperCase();
  if(code.length!==4){setError("homeError","Enter the 4-character room code.");return;}
  $("joinBtn").disabled=true; const r=await call("joinRoom",{code,name:playerName()}); $("joinBtn").disabled=false;
  if(!r.ok){setError("homeError",r.error);return;} rememberSession(r); showGame(r.state,false);
});
$("roomCode").addEventListener("input",e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4)});
const inviteCode = new URLSearchParams(location.search).get("room");
if (inviteCode && /^[A-Z0-9]{4}$/i.test(inviteCode)) $("roomCode").value = inviteCode.toUpperCase();
$("inviteBtn").addEventListener("click", async () => {
  const invite = new URL(location.href); invite.searchParams.set("room", roomCode);
  const button = $("inviteBtn");
  try {
    if (navigator.share) await navigator.share({ title: "Join my Room Rush game", text: `Join my trivia room: ${roomCode}`, url: invite.toString() });
    else { await navigator.clipboard.writeText(invite.toString()); button.textContent = "✓"; setTimeout(() => button.textContent = "↗", 1400); }
  } catch (error) { if (error.name !== "AbortError") { try { await navigator.clipboard.writeText(invite.toString()); button.textContent = "✓"; setTimeout(() => button.textContent = "↗", 1400); } catch {} } }
});
$("startBtn").addEventListener("click",async()=>{
  setError("gameError");const r=await call("startGame",{code:roomCode});if(!r.ok)setError("gameError",r.error);
});
$("copyBtn").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(roomCode);$("copyBtn").textContent="✓";setTimeout(()=>$("copyBtn").textContent="▣",1200)}
  catch{$("copyBtn").textContent=roomCode}
});
async function leaveRoom(){ if(roomCode) await call("leaveRoom",{code:roomCode}); showHome(); }
$("leaveBtn").addEventListener("click",leaveRoom);
$("playAgainBtn").addEventListener("click",leaveRoom);
socket.on("state", state => {
  if(!current || state.code!==roomCode) return;
  const myId=playerId; current={...state,myId}; isHost=state.hostId===playerId; render();
});
socket.on("connect",async()=>{
  setError("gameError");
  if(!roomCode) roomCode=sessionStorage.getItem("roomRushRoomCode") || "";
  if(!reconnecting && roomCode && playerToken){
    reconnecting=true;
    const r=await call("rejoinRoom",{code:roomCode,playerToken});
    reconnecting=false;
    if(r.ok){playerId=r.state.myId;isHost=r.state.hostId===playerId;showGame(r.state,isHost);setError("gameError");}
    else setError("gameError",`Could not rejoin: ${r.error}`);
  }
});
socket.on("disconnect",()=>setError("gameError","Connection lost. Reconnecting…"));
function render(){
  if(!current)return;
  const connectedCount=current.players.filter(p=>p.connected).length;
  $("playerCount").textContent=`${current.players.length}/${current.maxPlayers || 20}`;
  $("players").innerHTML=[...current.players].sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="player"><div class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</div><div class="pname">${escapeHtml(p.name)}${p.id===current.hostId?' <small>HOST</small>':''}${p.connected?'':' <small>OFFLINE</small>'}</div><span class="score">${p.streak>=2?`🔥${p.streak} · `:""}${current.status==="lobby"?(p.connected?"IN":"OFF"):p.score}</span></div>`).join("");
  ["lobbyContent","questionContent","revealContent","finishedContent"].forEach(id=>$(id).classList.add("hidden"));
  $("role").textContent=isHost?"YOU'RE THE HOST":"YOU'RE PLAYING";
  $("startBtn").classList.toggle("hidden",!isHost);
  $("startBtn").disabled=connectedCount<2;
  const options=$("gameOptions");
  if(options){options.textContent=String(current.totalRounds)+" rounds · "+(current.mode||"classic")+" pace";options.classList.toggle("hidden",current.status!=="lobby");}
  $("startHint").textContent=connectedCount<2?"Waiting for one more connected player…":isHost?`${connectedCount} players connected. Your squad is ready!`:`${connectedCount} players connected. Waiting for the host to start…`;
  $("roundLabel").textContent=current.status==="question"||current.status==="reveal"?`ROUND ${current.round} / ${current.totalRounds}`:"READY WHEN YOU ARE";
  if(current.status==="lobby"){
    $("statusPill").textContent="WAITING ROOM";$("lobbyContent").classList.remove("hidden");
  } else if(current.status==="question"){
    if(activeRound!==current.round){activeRound=current.round;chosen=false;selectedAnswer=null;}
    $("statusPill").textContent="LIVE ROUND";$("questionContent").classList.remove("hidden");
    $("category").textContent=current.question.category.toUpperCase();$("questionText").textContent=current.question.q;
    const me=current.players.find(p=>p.id===playerId);
    $("answerHint").textContent=me?.hasAnswered===true?"Answer locked in — waiting for everyone else.":`Choose one answer. Fast correct answers earn bonus points${me?.streak>=1?` · 🔥 ${me.streak} streak`:""}.`;
    chosen=current.players.find(p=>p.id===playerId)?.hasAnswered===true;
    $("answers").innerHTML=current.question.a.map((a,i)=>`<button class="answer ${selectedAnswer===i?'selected':''}" data-answer="${i}" ${chosen?'disabled':''}><span class="letter">${letters[i]}</span>${escapeHtml(a)}</button>`).join("");
    $("answers").querySelectorAll("button").forEach(b=>b.addEventListener("click",submitAnswer));
    updateTimer();
  } else if(current.status==="reveal"){
    $("statusPill").textContent="ANSWER REVEALED";$("revealContent").classList.remove("hidden");
    const ans=current.question?.a?.[current.reveal?.correct];
    const rightCount=current.players.filter(p=>p.lastCorrect).length;
    $("revealText").textContent=ans?`Correct answer: ${ans} · ${rightCount} player${rightCount===1?"":"s"} got it right!`:"The correct answer has been revealed.";
    if (activeRevealRound !== current.round) { activeRevealRound = current.round; if (current.players.find(p=>p.id===playerId)?.lastCorrect) playCue("correct"); }
    $("roundLabel").textContent=`ROUND ${current.round} / ${current.totalRounds}`;
  } else {
    $("statusPill").textContent="FINAL SCORES";$("finishedContent").classList.remove("hidden");
    const ranked=[...current.players].sort((a,b)=>b.score-a.score);
    const winners=ranked.filter(p=>p.score===ranked[0]?.score);
    $("winnerText").textContent=ranked.length?(winners.length>1?`It is a tie! ${winners.map(p=>p.name).join(" & ")} finish on ${ranked[0].score} points.`:`${ranked[0].name} wins with ${ranked[0].score} points!`):"Game finished.";
    $("finalPodium").innerHTML=ranked.slice(0,3).map((p,i)=>`<div class="podium-place"><span>${["🥇","🥈","🥉"][i]}</span><strong>${escapeHtml(p.name)}</strong><small>${p.score} pts · best streak ${p.bestStreak||0}</small></div>`).join("");
    if (!celebratedGame) { celebratedGame=true; confettiBurst(); if (ranked[0]?.id===playerId) playCue("winner"); }
    $("roundLabel").textContent="GG — NICE PLAY";
  }
}
async function submitAnswer(e){
  if(chosen)return;chosen=true;const answer=Number(e.currentTarget.dataset.answer);selectedAnswer=answer;
  $("answers").querySelectorAll("button").forEach(b=>b.disabled=true);
  e.currentTarget.classList.add("selected");
  const r=await call("answer",{code:roomCode,answer});if(!r.ok)setError("gameError",r.error);
}
function updateTimer(){
  clearInterval(clock);const tick=()=>{
    if(!current||current.status!=="question")return;
    const ms=Math.max(0,current.deadline-Date.now());$("timerBar").style.width=(ms/(current.roundDuration||15000)*100)+"%";
    if(ms<=0)clearInterval(clock);
  };tick();clock=setInterval(tick,100);
}
function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;");}
