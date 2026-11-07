const $=id=>document.getElementById(id);
const socket=io({autoConnect:true});
let roomCode=null;
let playerId=null;
let playerToken=null;
let current=null;
let clock=null;
let letters=["A","B","C","D"];
let chosen=false;
let selectedAnswer=null;
let activeRound=null;
let activeRevealRound=null;
let celebratedGame=false;
let audioCtx=null;
let soundEnabled=localStorage.getItem("roomRushSoundMuted")!=="true";
let usedFiftyFifty=false;
let usedDoubleDown=false;
let hiddenIndices=new Set();

// Web Audio Procedural Synthesizer
function getAudioContext(){
  if(!audioCtx){
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(AudioContextClass) audioCtx=new AudioContextClass();
  }
  if(audioCtx&&audioCtx.state==="suspended") audioCtx.resume();
  return audioCtx;
}

function playCue(type){
  if(!soundEnabled)return;
  const ctx=getAudioContext();
  if(!ctx)return;
  const now=ctx.currentTime;

  if(type==="tick"){
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type="sine";
    osc.frequency.setValueAtTime(800,now);
    gain.gain.setValueAtTime(0.04,now);
    gain.gain.exponentialRampToValueAtTime(0.001,now+0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now+0.05);
  } else if(type==="correct"){
    [523.25,659.25,783.99].forEach((freq,i)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type="triangle";
      osc.frequency.setValueAtTime(freq,now+i*0.08);
      gain.gain.setValueAtTime(0.12,now+i*0.08);
      gain.gain.exponentialRampToValueAtTime(0.001,now+i*0.08+0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now+i*0.08);
      osc.stop(now+i*0.08+0.25);
    });
  } else if(type==="wrong"){
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type="sawtooth";
    osc.frequency.setValueAtTime(180,now);
    osc.frequency.exponentialRampToValueAtTime(80,now+0.28);
    gain.gain.setValueAtTime(0.12,now);
    gain.gain.exponentialRampToValueAtTime(0.001,now+0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now+0.28);
  } else if(type==="reaction"||type==="lifeline"){
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type="sine";
    osc.frequency.setValueAtTime(type==="lifeline"?600:440,now);
    osc.frequency.exponentialRampToValueAtTime(type==="lifeline"?1200:880,now+0.15);
    gain.gain.setValueAtTime(0.08,now);
    gain.gain.exponentialRampToValueAtTime(0.001,now+0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now+0.15);
  } else if(type==="winner"){
    [523.25,659.25,783.99,1046.5].forEach((freq,i)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type="triangle";
      osc.frequency.setValueAtTime(freq,now+i*0.1);
      gain.gain.setValueAtTime(0.15,now+i*0.1);
      gain.gain.exponentialRampToValueAtTime(0.001,now+i*0.1+0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now+i*0.1);
      osc.stop(now+i*0.1+0.4);
    });
  }
}

function updateSoundButton(){
  const btn=$("soundToggle");
  if(!btn)return;
  btn.textContent=soundEnabled?"♪ SOUND ON":"✕ SOUND MUTED";
  btn.setAttribute("aria-pressed",String(soundEnabled));
  localStorage.setItem("roomRushSoundMuted",String(!soundEnabled));
}

// Floating Reactions Layer
function spawnFloatingReaction(emote, senderName){
  const container=$("reactionContainer");
  if(!container)return;
  const el=document.createElement("div");
  el.className="floating-emote";
  el.textContent=emote;
  el.style.left=Math.max(10,Math.min(90,Math.random()*80+10))+"%";
  container.appendChild(el);
  setTimeout(()=>el.remove(),2400);
}

// Particle Confetti Burst
function confettiBurst(){
  const colors=["#00f0ff","#9d7aff","#ff3366","#ffd700","#10b981"];
  for(let i=0;i<45;i++){
    const piece=document.createElement("div");
    piece.className="confetti-piece";
    piece.style.left=Math.random()*100+"vw";
    piece.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)];
    piece.style.setProperty("--fall",(window.innerHeight+80)+"px");
    piece.style.setProperty("--spin",(Math.random()*720-360)+"deg");
    piece.style.animationDelay=(Math.random()*0.3)+"s";
    piece.style.animationDuration=(1.2+Math.random()*0.8)+"s";
    document.body.appendChild(piece);
    setTimeout(()=>piece.remove(),2500);
  }
}

function setError(id,msg){
  const el=$(id);
  if(el){el.textContent=msg||"";el.classList.toggle("hidden",!msg);}
}

function call(event,data){
  return new Promise(resolve=>{
    socket.emit(event,data,res=>resolve(res||{ok:false,error:"Request timed out."}));
  });
}

function showGame(state,isHost){
  $("home").classList.add("hidden");
  $("game").classList.remove("hidden");
  render(state,isHost);
}

function updateTimer(){
  clearInterval(clock);
  let lastSecond=null;
  const tick=()=>{
    if(!current||current.status!=="question")return;
    const ms=Math.max(0,current.deadline-Date.now());
    const total=current.roundDuration||15000;
    const pct=Math.max(0,Math.min(100,(ms/total)*100));
    const bar=$("timerBar");
    if(bar){
      bar.style.width=pct+"%";
      bar.classList.toggle("warning",pct<50&&pct>=25);
      bar.classList.toggle("critical",pct<25);
    }
    const currentSecond=Math.ceil(ms/1000);
    if(currentSecond<=5&&currentSecond>0&&currentSecond!==lastSecond){
      lastSecond=currentSecond;
      playCue("tick");
    }
    if(ms<=0)clearInterval(clock);
  };
  tick();
  clock=setInterval(tick,100);
}

function render(state,isHost){
  current=state;
  roomCode=current.code;
  $("codeShow").textContent=current.code;
  const connectedPlayers=current.players.filter(p=>p.connected);
  const connectedCount=connectedPlayers.length;
  $("playerCount").textContent=`${connectedCount}/${current.maxPlayers||20}`;

  // Render leaderboard
  $("players").innerHTML=[...current.players].sort((a,b)=>b.score-a.score).map(p=>{
    const answeredBadge=current.status==="question"&&p.hasAnswered?`<span title="Answer submitted">✓</span>`:"";
    const botBadge=p.isBot?`<small style="color:var(--accent)">BOT</small>`:"";
    const hostBadge=p.id===current.hostId?`<small>HOST</small>`:"";
    const offlineBadge=p.connected?"":`<small style="color:#ff5e7e">OFFLINE</small>`;
    return `<div class="player ${p.hasAnswered?'answered':''}">
      <div class="avatar">${p.isBot?'🤖':escapeHtml(p.name.charAt(0).toUpperCase())}</div>
      <div class="pname">${escapeHtml(p.name)} ${botBadge} ${hostBadge} ${offlineBadge}</div>
      <span class="score">${p.streak>=2?`🔥${p.streak} · `:""}${current.status==="lobby"?(p.connected?"IN":"OFF"):p.score} ${answeredBadge}</span>
    </div>`;
  }).join("");

  ["lobbyContent","questionContent","revealContent","finishedContent"].forEach(id=>$(id).classList.add("hidden"));
  $("role").textContent=isHost?"YOU'RE THE HOST":"YOU'RE PLAYING";
  $("startBtn").classList.toggle("hidden",!isHost);
  $("startBtn").disabled=connectedCount<2;

  const botBtn=$("botBtn");
  if(botBtn){
    botBtn.classList.toggle("hidden",!isHost||current.status!=="lobby");
    botBtn.textContent=current.hasBot?"🤖 Remove Practice Bot":"🤖 Add Practice Bot";
  }

  const options=$("gameOptions");
  if(options){
    options.textContent=`${current.totalRounds} rounds · ${current.mode||"classic"} pace`;
    options.classList.toggle("hidden",current.status!=="lobby");
  }

  $("startHint").textContent=connectedCount<2
    ?(isHost?"Add a Practice Bot or share your code with a friend to begin.":"Waiting for one more connected player…")
    :(isHost?`${connectedCount} players ready. Launch the trivia party!`:`${connectedCount} players connected. Waiting for host to start…`);

  $("roundLabel").textContent=["question","reveal"].includes(current.status)
    ?`ROUND ${current.round} / ${current.totalRounds}`
    :"READY WHEN YOU ARE";

  if(current.status==="lobby"){
    $("statusPill").textContent="WAITING ROOM";
    $("lobbyContent").classList.remove("hidden");
    usedFiftyFifty=false;
    usedDoubleDown=false;
  } else if(current.status==="question"){
    if(activeRound!==current.round){
      activeRound=current.round;
      chosen=false;
      selectedAnswer=null;
      hiddenIndices=new Set();
      $("doubleDownBtn")?.classList.remove("active");
    }
    $("statusPill").textContent="LIVE ROUND";
    $("questionContent").classList.remove("hidden");
    $("category").textContent=(current.question.category||"GENERAL").toUpperCase();
    $("questionText").textContent=current.question.q;

    const me=current.players.find(p=>p.id===playerId);
    chosen=me?.hasAnswered===true;
    $("answerHint").textContent=chosen
      ?"Answer locked in — waiting for other players."
      :`Choose one answer. Fast answers earn big speed bonuses!${me?.streak>=1?` · 🔥 ${me.streak} streak`:""}`;

    // Render answer buttons
    $("answers").innerHTML=current.question.a.map((a,i)=>{
      const isEliminated=hiddenIndices.has(i);
      return `<button class="answer ${selectedAnswer===i?'selected':''} ${isEliminated?'eliminated':''}" data-answer="${i}" ${chosen||isEliminated?'disabled':''}>
        <span class="letter">${letters[i]}</span>
        ${escapeHtml(a)}
      </button>`;
    }).join("");

    $("answers").querySelectorAll("button:not(.eliminated)").forEach(b=>b.addEventListener("click",submitAnswer));

    // Lifeline button states
    const fiftyBtn=$("fiftyFiftyBtn");
    if(fiftyBtn){
      fiftyBtn.disabled=chosen||usedFiftyFifty;
      fiftyBtn.classList.toggle("used",usedFiftyFifty);
    }
    const dblBtn=$("doubleDownBtn");
    if(dblBtn){
      dblBtn.disabled=chosen||usedDoubleDown;
      dblBtn.classList.toggle("used",usedDoubleDown);
      if(me?.doubled) dblBtn.classList.add("active");
    }

    updateTimer();
  } else if(current.status==="reveal"){
    $("statusPill").textContent="ANSWER REVEALED";
    $("revealContent").classList.remove("hidden");
    const correctIdx=current.reveal?.correct;
    const ans=current.question?.a?.[correctIdx];
    const rightCount=current.players.filter(p=>p.lastCorrect).length;
    const myPlayer=current.players.find(p=>p.id===playerId);

    $("revealHeading").textContent=myPlayer?.lastCorrect?"Spot On! 🎉":"Not Quite! 💡";
    $("revealIcon").textContent=myPlayer?.lastCorrect?"✓":"✕";
    $("revealIcon").style.color=myPlayer?.lastCorrect?"var(--lime)":"var(--pink)";
    $("revealText").textContent=ans?`Correct answer: "${ans}" · ${rightCount} player${rightCount===1?"":"s"} got it right!`:"Answer revealed.";

    if(activeRevealRound!==current.round){
      activeRevealRound=current.round;
      if(myPlayer?.lastCorrect) playCue("correct");
      else playCue("wrong");
    }
    $("roundLabel").textContent=`ROUND ${current.round} / ${current.totalRounds}`;
  } else {
    $("statusPill").textContent="FINAL PODIUM";
    $("finishedContent").classList.remove("hidden");
    const ranked=[...current.players].sort((a,b)=>b.score-a.score);
    const winners=ranked.filter(p=>p.score===ranked[0]?.score);
    $("winnerText").textContent=ranked.length
      ?(winners.length>1?`It's a tie! ${winners.map(p=>p.name).join(" & ")} finish on ${ranked[0].score} points!`:`${ranked[0].name} wins with ${ranked[0].score} points!`)
      :"Game finished.";

    $("finalPodium").innerHTML=ranked.slice(0,3).map((p,i)=>`
      <div class="podium-place">
        <span>${["🥇","🥈","🥉"][i]}</span>
        <strong>${escapeHtml(p.name)}</strong>
        <small>${p.score} pts · streak ${p.bestStreak||0}</small>
      </div>
    `).join("");

    if(!celebratedGame){
      celebratedGame=true;
      confettiBurst();
      if(ranked[0]?.id===playerId) playCue("winner");
    }
    $("roundLabel").textContent="GG — NICE MATCH";
  }
}

async function submitAnswer(e){
  if(chosen)return;
  chosen=true;
  const answer=Number(e.currentTarget.dataset.answer);
  selectedAnswer=answer;
  $("answers").querySelectorAll("button").forEach(b=>b.disabled=true);
  e.currentTarget.classList.add("selected");
  playCue("tick");
  const r=await call("answer",{code:roomCode,answer});
  if(!r.ok)setError("gameError",r.error);
}

function escapeHtml(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// Socket Event Handlers
socket.on("state",state=>{
  playerId=state.myId||socket.id;
  render(state,state.hostId===playerId);
});

socket.on("reaction",({name,emote})=>{
  spawnFloatingReaction(emote,name);
  playCue("reaction");
});

// UI Event Listeners
document.addEventListener("DOMContentLoaded",()=>{
  updateSoundButton();
  $("soundToggle")?.addEventListener("click",()=>{
    soundEnabled=!soundEnabled;
    updateSoundButton();
    if(soundEnabled) playCue("reaction");
  });

  $("createBtn")?.addEventListener("click",async()=>{
    setError("homeError","");
    const name=$("name").value.trim()||"Host";
    const rounds=Number($("rounds").value)||8;
    const mode=$("mode").value||"classic";
    const category=$("categorySelect")?.value||"all";
    const r=await call("createRoom",{name,rounds,mode,category});
    if(!r.ok)return setError("homeError",r.error);
    roomCode=r.state.code;
    playerToken=r.playerToken;
    playerId=r.state.myId||socket.id;
    sessionStorage.setItem("roomRushRoomCode",roomCode);
    sessionStorage.setItem("roomRushPlayerToken",playerToken);
    showGame(r.state,true);
  });

  $("joinBtn")?.addEventListener("click",async()=>{
    setError("homeError","");
    const name=$("name").value.trim()||"Player";
    const code=($("roomCode").value||"").trim().toUpperCase();
    if(!code)return setError("homeError","Please enter a room code.");
    const r=await call("joinRoom",{code,name});
    if(!r.ok)return setError("homeError",r.error);
    roomCode=r.state.code;
    playerToken=r.playerToken;
    playerId=r.state.myId||socket.id;
    sessionStorage.setItem("roomRushRoomCode",roomCode);
    sessionStorage.setItem("roomRushPlayerToken",playerToken);
    showGame(r.state,false);
  });

  $("botBtn")?.addEventListener("click",async()=>{
    if(!roomCode)return;
    const r=await call("toggleBot",{code:roomCode});
    if(!r.ok)setError("gameError",r.error);
  });

  $("startBtn")?.addEventListener("click",async()=>{
    if(!roomCode)return;
    const r=await call("startGame",{code:roomCode});
    if(!r.ok)setError("gameError",r.error);
  });

  $("leaveBtn")?.addEventListener("click",async()=>{
    if(roomCode) await call("leaveRoom",{code:roomCode});
    sessionStorage.removeItem("roomRushRoomCode");
    sessionStorage.removeItem("roomRushPlayerToken");
    window.location.reload();
  });

  $("playAgainBtn")?.addEventListener("click",()=>{
    window.location.reload();
  });

  $("copyBtn")?.addEventListener("click",()=>{
    if(!roomCode)return;
    navigator.clipboard?.writeText(roomCode);
    $("copyBtn").textContent="✓";
    setTimeout(()=>$("copyBtn").textContent="📋",1500);
  });

  $("inviteBtn")?.addEventListener("click",()=>{
    if(!roomCode)return;
    const inviteUrl=window.location.origin+"/?join="+roomCode;
    navigator.clipboard?.writeText(inviteUrl);
    $("inviteBtn").textContent="✓ Link Copied";
    setTimeout(()=>$("inviteBtn").textContent="↗",2000);
  });

  // Reaction buttons
  document.querySelectorAll(".reaction-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const emote=btn.dataset.emote;
      if(!emote||!roomCode)return;
      socket.emit("reaction",{code:roomCode,emote});
      spawnFloatingReaction(emote,"Me");
      playCue("reaction");
    });
  });

  // Lifelines
  $("fiftyFiftyBtn")?.addEventListener("click",async()=>{
    if(!roomCode||usedFiftyFifty||chosen)return;
    const r=await call("useLifeline",{code:roomCode,type:"fiftyFifty"});
    if(r.ok&&r.hiddenOptions){
      usedFiftyFifty=true;
      r.hiddenOptions.forEach(idx=>hiddenIndices.add(idx));
      r.hiddenOptions.forEach(idx=>{
        const btn=document.querySelector(`button[data-answer="${idx}"]`);
        if(btn){btn.classList.add("eliminated");btn.disabled=true;}
      });
      playCue("lifeline");
    } else if(!r.ok){
      setError("gameError",r.error);
    }
  });

  $("doubleDownBtn")?.addEventListener("click",async()=>{
    if(!roomCode||usedDoubleDown||chosen)return;
    const r=await call("useLifeline",{code:roomCode,type:"doubleDown"});
    if(r.ok){
      usedDoubleDown=true;
      $("doubleDownBtn").classList.add("active");
      playCue("lifeline");
    } else if(!r.ok){
      setError("gameError",r.error);
    }
  });

  // Auto-fill room code from URL params
  const params=new URLSearchParams(window.location.search);
  const joinParam=params.get("join");
  if(joinParam&&$("roomCode")){
    $("roomCode").value=joinParam.trim().toUpperCase();
  }

  // Auto Reconnection
  const savedCode=sessionStorage.getItem("roomRushRoomCode");
  const savedToken=sessionStorage.getItem("roomRushPlayerToken");
  if(savedCode&&savedToken){
    call("rejoinRoom",{code:savedCode,playerToken:savedToken}).then(r=>{
      if(r.ok&&r.state){
        roomCode=savedCode;
        playerToken=savedToken;
        playerId=r.state.myId||socket.id;
        const isHost=r.state.hostId===playerId;
        showGame(r.state,isHost);
      }
    });
  }
});
