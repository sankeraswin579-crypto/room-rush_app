const $ = id => document.getElementById(id);
const socket = io();
let current = null, playerId = null, roomCode = "", playerToken = sessionStorage.getItem("roomRushPlayerToken") || "", isHost = false, chosen = false, clock = null, reconnecting = false;
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
  current = state; roomCode = state.code; playerId = state.myId || playerId; isHost = host || isHost;
  $("home").classList.add("hidden"); $("game").classList.remove("hidden");
  $("codeShow").textContent = roomCode; $("role").textContent = isHost ? "YOU'RE THE HOST" : "YOU'RE PLAYING";
  render();
}
function showHome(){ $("game").classList.add("hidden"); $("home").classList.remove("hidden"); current=null; roomCode=""; playerId=null; playerToken=""; sessionStorage.removeItem("roomRushPlayerToken"); isHost=false; chosen=false; clearInterval(clock); }
function rememberSession(result){ playerToken=result.playerToken; sessionStorage.setItem("roomRushPlayerToken",playerToken); }
$("createBtn").addEventListener("click", async () => {
  setError("homeError"); $("createBtn").disabled=true;
  const r=await call("createRoom",{name:playerName()}); $("createBtn").disabled=false;
  if(!r.ok){setError("homeError",r.error);return;} rememberSession(r); showGame(r.state,true);
});
$("joinBtn").addEventListener("click", async () => {
  setError("homeError"); const code=$("roomCode").value.trim().toUpperCase();
  if(code.length!==4){setError("homeError","Enter the 4-character room code.");return;}
  $("joinBtn").disabled=true; const r=await call("joinRoom",{code,name:playerName()}); $("joinBtn").disabled=false;
  if(!r.ok){setError("homeError",r.error);return;} rememberSession(r); showGame(r.state,false);
});
$("roomCode").addEventListener("input",e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4)});
$("startBtn").addEventListener("click",async()=>{
  setError("gameError");const r=await call("startGame",{code:roomCode});if(!r.ok)setError("gameError",r.error);
});
$("copyBtn").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(roomCode);$("copyBtn").textContent="✓";setTimeout(()=>$("copyBtn").textContent="▣",1200)}
  catch{$("copyBtn").textContent=roomCode}
});
$("leaveBtn").addEventListener("click",showHome);
$("playAgainBtn").addEventListener("click",showHome);
socket.on("state", state => {
  if(!current || state.code!==roomCode) return;
  const myId=playerId; current={...state,myId}; render();
});
socket.on("connect",async()=>{
  setError("gameError");
  if(!reconnecting && roomCode && playerToken){
    reconnecting=true;
    const r=await call("rejoinRoom",{code:roomCode,playerToken});
    reconnecting=false;
    if(r.ok){playerId=r.state.myId;current=r.state;isHost=r.state.hostId===playerId;render();setError("gameError");}
    else setError("gameError",`Could not rejoin: ${r.error}`);
  }
});
socket.on("disconnect",()=>setError("gameError","Connection lost. Reconnecting…"));
function render(){
  if(!current)return;
  $("playerCount").textContent=current.players.length;
  $("players").innerHTML=[...current.players].sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="player"><div class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</div><div class="pname">${escapeHtml(p.name)}${p.id===current.hostId?' <small>HOST</small>':''}${p.connected?'':' <small>OFFLINE</small>'}</div><span class="score">${current.status==="lobby"?(p.connected?"IN":"OFF"):p.score}</span></div>`).join("");
  ["lobbyContent","questionContent","revealContent","finishedContent"].forEach(id=>$(id).classList.add("hidden"));
  $("startBtn").classList.toggle("hidden",!isHost);
  $("startBtn").disabled=current.players.length<2;
  $("startHint").textContent=current.players.length<2?"Waiting for one more player…":isHost?"Your squad is ready. Start the game!":"Waiting for the host to start…";
  $("roundLabel").textContent=current.status==="question"||current.status==="reveal"?`ROUND ${current.round} / ${current.totalRounds}`:"READY WHEN YOU ARE";
  if(current.status==="lobby"){
    $("statusPill").textContent="WAITING ROOM";$("lobbyContent").classList.remove("hidden");
  } else if(current.status==="question"){
    $("statusPill").textContent="LIVE ROUND";$("questionContent").classList.remove("hidden");
    $("category").textContent=current.question.category.toUpperCase();$("questionText").textContent=current.question.q;
    $("answerHint").textContent=current.players.find(p=>p.id===playerId)?.answered!==null&&current.players.find(p=>p.id===playerId)?.answered!==undefined?"Answer locked in — waiting for everyone else.":"Choose one answer. Faster correct answers earn bonus points.";
    chosen=current.players.find(p=>p.id===playerId)?.answered!==null&&current.players.find(p=>p.id===playerId)?.answered!==undefined;
    $("answers").innerHTML=current.question.a.map((a,i)=>`<button class="answer ${chosen&&current.players.find(p=>p.id===playerId)?.answered===i?'selected':''}" data-answer="${i}" ${chosen?'disabled':''}><span class="letter">${letters[i]}</span>${escapeHtml(a)}</button>`).join("");
    $("answers").querySelectorAll("button").forEach(b=>b.addEventListener("click",submitAnswer));
    updateTimer();
  } else if(current.status==="reveal"){
    $("statusPill").textContent="ANSWER REVEALED";$("revealContent").classList.remove("hidden");
    const ans=current.question?.a?.[current.reveal?.correct];$("revealText").textContent=ans?`Correct answer: ${ans}`:"The correct answer has been revealed.";
    $("roundLabel").textContent=`ROUND ${current.round} / ${current.totalRounds}`;
  } else {
    $("statusPill").textContent="FINAL SCORES";$("finishedContent").classList.remove("hidden");
    const ranked=[...current.players].sort((a,b)=>b.score-a.score);$("winnerText").textContent=ranked.length?`${ranked[0].name} wins with ${ranked[0].score} points!`:"Game finished.";
    $("roundLabel").textContent="GG — NICE PLAY";
  }
}
async function submitAnswer(e){
  if(chosen)return;chosen=true;const answer=Number(e.currentTarget.dataset.answer);
  $("answers").querySelectorAll("button").forEach(b=>b.disabled=true);
  e.currentTarget.classList.add("selected");
  const r=await call("answer",{code:roomCode,answer});if(!r.ok)setError("gameError",r.error);
}
function updateTimer(){
  clearInterval(clock);const tick=()=>{
    if(!current||current.status!=="question")return;
    const ms=Math.max(0,current.deadline-Date.now());$("timerBar").style.width=(ms/15000*100)+"%";
    if(ms<=0)clearInterval(clock);
  };tick();clock=setInterval(tick,100);
}
function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;");}
