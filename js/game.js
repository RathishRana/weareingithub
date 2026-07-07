"use strict";
/* =====================================================================
   SKY COMMANDER ACADEMY v2 — GAME ENGINE
   Learning-first quiz engine (5 question types, repeat-until-mastery),
   flight-mission orchestration with MAYDAY emergencies, Command Log
   progress tracking, ranks / medals / celebrations.
   ===================================================================== */

/* ---------------- STATE & SAVE ---------------- */
const SAVE_KEY = "skyCommanderSave_v2";
window.__FAST = /[?&]fast=1/.test(location.search);

let save = loadSave();
let session = null;

function loadSave(){
  try{
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if(s && s.missions) return Object.assign({pilot:"",muted:false,mode:"flight",missions:{},log:{}}, s);
  }catch(e){}
  // migrate pilot name from v1
  let pilot = "";
  try{ const v1 = JSON.parse(localStorage.getItem("skyCommanderSave_v1")); if(v1&&v1.pilot) pilot=v1.pilot; }catch(e){}
  return {pilot, muted:false, mode:"flight", missions:{}, log:{}};
}
function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }
function mrec(id){ return save.missions[id] || {stars:0,bestScore:0,mastered:false}; }
function careerPoints(){ return WORLDS.reduce((t,w)=>t+(mrec(w.id).bestScore||0),0); }
function totalStars(){ return WORLDS.reduce((t,w)=>t+(mrec(w.id).stars||0),0); }
function medalsOwned(){ return WORLDS.filter(w=>mrec(w.id).mastered).length; }
function logTopic(topic, ok){
  const rec = save.log[topic] || (save.log[topic]={c:0,w:0});
  ok ? rec.c++ : rec.w++;
  persist();
}

SFX.isMuted = ()=>save.muted;

/* ---------------- DOM HELPERS & FX ---------------- */
const $ = id => document.getElementById(id);
function show(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo(0,0);
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function jetFlyby(){
  const j = $("jetfly");
  j.classList.remove("go"); void j.offsetWidth; j.classList.add("go");
  SFX.whoosh();
}
function confetti(n=120){
  const colors = ["#00e5ff","#ffb300","#ff2ee6","#2bff88","#ffffff","#ff3b5c"];
  for(let i=0;i<n;i++){
    const c = document.createElement("i");
    c.className = "confetti-bit";
    const size = 6+Math.random()*8;
    c.style.cssText = `left:${Math.random()*100}vw;width:${size}px;height:${size*0.5}px;
      background:${colors[i%colors.length]};--spin:${Math.random()>0.5?"":"-"}${360+Math.random()*720}deg;
      animation-duration:${2+Math.random()*2.4}s;animation-delay:${Math.random()*0.8}s;
      border-radius:${Math.random()>0.5?"50%":"2px"}`;
    document.body.appendChild(c);
    setTimeout(()=>c.remove(), 5600);
  }
}
function floatPoints(txt, x, y){
  const p = document.createElement("div");
  p.className = "float-pts"; p.textContent = txt;
  p.style.left = x+"px"; p.style.top = y+"px";
  document.body.appendChild(p);
  setTimeout(()=>p.remove(), 1100);
}
function makeStars(){
  const wrap = $("stars");
  for(let i=0;i<130;i++){
    const s = document.createElement("i");
    const z = Math.random();
    s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;
      width:${1+z*2}px;height:${1+z*2}px;opacity:${.2+z*.7};animation-delay:${Math.random()*3}s;
      animation-duration:${2+Math.random()*3}s`;
    wrap.appendChild(s);
  }
}
let captionTimer = 0;
function caption(txt, hold){
  const c = $("caption");
  c.innerHTML = txt;
  c.classList.add("show");
  clearTimeout(captionTimer);
  if(!hold) captionTimer = setTimeout(()=>c.classList.remove("show"), 2400);
}
function captionOff(){ clearTimeout(captionTimer); $("caption").classList.remove("show"); }

/* ---------------- BASE SCREEN ---------------- */
function setMuted(m){
  save.muted = m; persist();
  document.querySelectorAll("#btn-mute,#btn-mute2").forEach(b=>b.textContent = m ? "🔇" : "🔊");
  if(m) Engine.stop();
}
function setMode(m){
  save.mode = m; persist();
  $("mode-flight").classList.toggle("on", m==="flight");
  $("mode-drill").classList.toggle("on", m==="drill");
}
function renderBase(){
  $("hud-pilot").textContent = save.pilot || "CADET";
  $("hud-total").textContent = careerPoints();
  $("hud-stars").textContent = `${totalStars()}/${WORLDS.length*3}`;

  const pts = careerPoints();
  let rank = RANKS[0], next = null;
  for(const r of RANKS){ if(pts >= r.min) rank = r; else { next = r; break; } }
  $("rank-ico").textContent = rank.ico;
  $("rank-name").textContent = rank.name;
  $("rank-next").textContent = next ? `${next.min - pts} pts to ${next.name}` : "MAXIMUM RANK ACHIEVED!";

  const wrap = $("worlds");
  wrap.innerHTML = "";
  const stars = totalStars();
  WORLDS.forEach((w, idx)=>{
    const rec = mrec(w.id);
    const locked = stars < w.unlockStars;
    const card = document.createElement("div");
    card.className = "mcard" + (locked?" locked":"") + (rec.mastered?" mastered":"") + (w.featured?" featured":"");
    card.innerHTML = `
      ${rec.mastered ? '<span class="m-done">✔ MASTERED</span>' : ''}
      <div class="m-head"><span class="m-ico">${w.icon}</span>
        <div><h3>${w.name}</h3><span class="m-tag">${w.tagline}</span></div></div>
      <p>${w.desc}</p>
      <div class="m-meta">
        <span class="m-stars">${"★".repeat(rec.stars)}${"☆".repeat(3-rec.stars)}</span>
        <span class="m-q">${w.questions.length} TARGETS</span>
      </div>
      ${locked ? `<div class="m-lock">🔒 EARN ${w.unlockStars}★ IN HISTORY TO UNLOCK</div>` : ""}`;
    if(!locked) card.addEventListener("click", ()=>{ SFX.click(); startMission(idx); });
    wrap.appendChild(card);
  });

  const br = $("badge-row");
  br.innerHTML = "";
  WORLDS.forEach(w=>{
    const owned = mrec(w.id).mastered;
    const b = document.createElement("div");
    b.className = "badge" + (owned ? " owned":"");
    b.innerHTML = `<span class="b-ico">${w.badge.ico}</span><small>${w.badge.name}</small>`;
    br.appendChild(b);
  });
  const ace = document.createElement("div");
  const allAce = WORLDS.every(w=>mrec(w.id).stars===3);
  ace.className = "badge" + (allAce ? " owned":"");
  ace.innerHTML = `<span class="b-ico">🏆</span><small>Full-Marks Legend</small>`;
  br.appendChild(ace);
}

/* ---------------- COMMAND LOG (parent progress view) ---------------- */
function renderLog(){
  const wrap = $("log-list");
  wrap.innerHTML = "";
  const topics = Object.entries(save.log)
    .map(([t,r])=>({t, c:r.c, w:r.w, total:r.c+r.w, pct:Math.round(r.c/(r.c+r.w)*100)}))
    .filter(x=>x.total>0)
    .sort((a,b)=>a.pct-b.pct);
  if(!topics.length){
    wrap.innerHTML = `<p class="log-empty">No flights logged yet. Fly a mission and the Command Log fills up automatically!</p>`;
  } else {
    for(const x of topics){
      const cls = x.pct>=80?"good":x.pct>=50?"mid":"low";
      const row = document.createElement("div");
      row.className = "log-row";
      row.innerHTML = `
        <div class="log-top"><b>${x.t}</b><span class="log-pct ${cls}">${x.pct}%</span></div>
        <div class="log-bar"><div class="log-fill ${cls}" style="width:${x.pct}%"></div></div>
        <small>${x.c} correct · ${x.w} to master · ${x.total} answers logged</small>`;
      wrap.appendChild(row);
    }
    const weakest = topics[0];
    $("log-note").innerHTML = weakest.pct<80
      ? `📡 <b>Squadron tip:</b> the weakest signal is <b>${weakest.t}</b> (${weakest.pct}%). One more mission on that topic and it'll be locked in!`
      : `🏆 <b>All systems green!</b> Every topic is above 80%. Outstanding flying!`;
  }
  show("screen-log");
}

/* ---------------- MISSION START ---------------- */
function startMission(idx){
  const w = WORLDS[idx];
  session = {
    idx, w,
    mode: save.mode,
    queue: shuffle(w.questions.map((_,i)=>i)),
    total: w.questions.length,
    attempts: {},
    firstTry: 0,
    locked: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    current: null,
    answered: false,
    answeredCount: 0,
    wrongList: [],
    maydays: 0,
    maydaysOk: 0,
    inMayday: false,
    afterNext: null,
    forceResolve: null,
    mtimer: null
  };
  $("q-mission").textContent = w.icon + " " + w.name.toUpperCase();
  $("q-score").textContent = "0";
  $("q-streak").textContent = "—";
  $("feedback").className = "feedback";
  $("q-card").style.display = "none";
  $("mayday-banner").classList.remove("show");
  captionOff();
  updateAltitude();
  show("screen-quiz");

  const flight = session.mode === "flight";
  $("flight-canvas").style.display = flight ? "" : "none";
  $("fl-tele").style.display = flight ? "" : "none";
  document.body.classList.toggle("in-flight", flight);

  if(flight){
    Flight.init($("flight-canvas"));
    Flight.resize();
    Flight.onTele = tele=>{
      $("hud-alt").textContent = Math.max(0,tele.alt).toLocaleString("en-IN");
      $("hud-spd").textContent = tele.spd;
    };
    Flight.onEvent = ev=>{
      if(ev==="ringmiss") caption("MISSED THE RING — COMING AROUND! 🔁");
    };
    Flight.begin(w.scene);
    // briefing overlay
    $("b-title").textContent = w.icon + "  " + w.name;
    $("b-tag").textContent = w.tagline;
    $("b-desc").textContent = w.desc;
    $("b-count").textContent = w.questions.length + " KNOWLEDGE RINGS ON RADAR";
    $("briefing").classList.add("show");
  } else {
    jetFlyby();
    askNext();
  }
}

function launchFlight(){
  $("briefing").classList.remove("show");
  SFX.radio();
  caption("🛫 THROTTLE UP, "+(save.pilot||"CADET")+"!");
  Flight.phase("taxi", ()=>{
    caption("ROTATE! CLIMBING… ☁️");
    Flight.phase("climb", ()=>{
      cruiseToNext(true);
    });
  });
}

function cruiseToNext(first){
  caption(first ? "FIRST RING AHEAD — FLY THROUGH IT! 🎯" : "NEXT RING AHEAD — GO GET IT! 🎯");
  Flight.phase("cruise", ()=>askNext());
}

/* ---------------- QUIZ FLOW ---------------- */
function askNext(){
  const s = session;
  document.body.classList.toggle("afterburner", s.streak >= 3);
  if(s.queue.length === 0){ return endOfQuestions(); }
  s.current = s.queue.shift();
  s.answered = false;
  s.inMayday = false;
  const q = s.w.questions[s.current];
  const isRetry = (s.attempts[s.current]||0) > 0;
  $("q-num").textContent = `TARGET ${s.locked+1} OF ${s.total}`;
  $("q-retry").style.display = isRetry ? "" : "none";
  renderQuestion(q, false);
}

function endOfQuestions(){
  if(session.mode==="flight"){
    $("q-card").style.display = "none";
    caption("ALL TARGETS LOCKED! RETURNING TO BASE… 🛬", true);
    SFX.radio();
    Flight.phase("approach", evt=>{
      if(evt==="touchdown"){ caption("TOUCHDOWN! 🛬"); }
      else if(evt==="stopped"){ captionOff(); missionComplete(); }
    });
  } else {
    missionComplete();
  }
}

function updateAltitude(){
  const s = session;
  if(!s) return;
  const pct = Math.round((s.locked / s.total) * 100);
  $("alt-fill").style.width = pct + "%";
  $("alt-jet").style.left = pct + "%";
  $("alt-count").textContent = `${s.locked} / ${s.total} targets locked`;
}

/* ---------------- QUESTION RENDERERS ---------------- */
function renderQuestion(q, isMayday){
  const area = $("q-area");
  area.innerHTML = "";
  $("q-text").innerHTML = q.q.replace(/\n/g,"<br>");
  $("feedback").className = "feedback";
  $("q-card").style.display = "";
  session.forceResolve = null;
  const done = correct => resolveAnswer(q, correct, isMayday);
  switch(q.type){
    case "order": renderOrder(q, done); break;
    case "match": renderMatch(q, done); break;
    case "sort":  renderSort(q, done); break;
    case "map":   renderMap(q, done); break;
    default:      renderMcq(q, done); break;
  }
  if(session.mode==="flight") setTimeout(()=>Flight.resize(), 30);
}

let mcqButtons = [];
function renderMcq(q, done){
  const area = $("q-area");
  const opts = document.createElement("div");
  opts.className = "opts";
  mcqButtons = [];
  let settled = false;
  q.o.forEach((opt,i)=>{
    const b = document.createElement("button");
    b.className = "opt";
    b.innerHTML = `<span class="key">${i+1}</span><span>${opt}</span>`;
    b.addEventListener("click", ()=>{
      if(settled) return; settled = true;
      const correct = i===q.a;
      [...opts.children].forEach(o=>o.disabled=true);
      if(correct){
        b.classList.add("correct");
        [...opts.children].forEach((o,oi)=>{ if(oi!==i) o.classList.add("dim"); });
      } else {
        b.classList.add("wrong");
        opts.children[q.a].classList.add("correct");
        [...opts.children].forEach((o,oi)=>{ if(oi!==i && oi!==q.a) o.classList.add("dim"); });
      }
      const r = b.getBoundingClientRect();
      if(correct) floatPoints("HIT!", r.left+r.width/2, r.top);
      done(correct);
    });
    opts.appendChild(b);
    mcqButtons.push(b);
  });
  area.appendChild(opts);
  session.forceResolve = ()=>{           // mayday timer expiry
    if(settled) return; settled = true;
    [...opts.children].forEach(o=>o.disabled=true);
    opts.children[q.a].classList.add("correct");
    done(false);
  };
}

function renderOrder(q, done){
  const area = $("q-area");
  const slots = document.createElement("div"); slots.className = "order-slots";
  q.items.forEach((_,i)=>{
    const sl = document.createElement("div"); sl.className="order-slot";
    sl.innerHTML = `<span class="os-num">${i+1}</span><span class="os-txt">?</span>`;
    slots.appendChild(sl);
  });
  const grid = document.createElement("div"); grid.className = "order-grid";
  let items = shuffle(q.items);
  if(items.join()===q.items.join()) items = items.slice().reverse();
  let picked = 0, settled = false;
  items.forEach(txt=>{
    const b = document.createElement("button");
    b.className = "opt small"; b.innerHTML = `<span>${txt}</span>`;
    b.addEventListener("click", ()=>{
      if(settled || b.disabled) return;
      if(txt === q.items[picked]){
        b.disabled = true; b.classList.add("locked");
        const sl = slots.children[picked];
        sl.querySelector(".os-txt").textContent = txt;
        sl.classList.add("filled");
        SFX.click();
        picked++;
        if(picked === q.items.length){ settled = true; done(true); }
      } else {
        settled = true;
        b.classList.add("wrong");
        [...grid.children].forEach(o=>o.disabled=true);
        q.items.forEach((it,i)=>{
          const sl = slots.children[i];
          sl.querySelector(".os-txt").textContent = it;
          sl.classList.add("revealed");
        });
        done(false);
      }
    });
    grid.appendChild(b);
  });
  area.appendChild(slots); area.appendChild(grid);
}

function renderMatch(q, done){
  const area = $("q-area");
  const prompt = document.createElement("div"); prompt.className = "match-prompt";
  const grid = document.createElement("div"); grid.className = "opts";
  area.appendChild(prompt); area.appendChild(grid);
  let idx = 0, settled = false;
  const rights = shuffle(q.pairs.map(p=>p[1]));
  function setPrompt(){
    prompt.innerHTML = `<span class="mp-label">MATCH ${idx+1}/${q.pairs.length}</span><b>${q.pairs[idx][0]}</b> makes / does…`;
  }
  setPrompt();
  rights.forEach(rt=>{
    const b = document.createElement("button");
    b.className = "opt small"; b.innerHTML = `<span>${rt}</span>`;
    b.addEventListener("click", ()=>{
      if(settled || b.disabled) return;
      if(rt === q.pairs[idx][1]){
        b.disabled = true; b.classList.add("locked"); SFX.click();
        idx++;
        if(idx === q.pairs.length){ settled = true; done(true); }
        else setPrompt();
      } else {
        settled = true;
        b.classList.add("wrong");
        [...grid.children].forEach(o=>o.disabled=true);
        area.appendChild(revealTable(q.pairs.map(p=>[p[0], p[1]])));
        done(false);
      }
    });
    grid.appendChild(b);
  });
}

function renderSort(q, done){
  const area = $("q-area");
  const card = document.createElement("div"); card.className = "sort-card";
  const prog = document.createElement("div"); prog.className = "sort-prog";
  const buckets = document.createElement("div"); buckets.className = "sort-buckets";
  area.appendChild(prog); area.appendChild(card); area.appendChild(buckets);
  const items = shuffle(q.items);
  let idx = 0, settled = false;
  function setCard(){
    prog.textContent = `CLUE ${idx+1} OF ${items.length}`;
    card.innerHTML = `<b>${items[idx][0]}</b>`;
    card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
  }
  setCard();
  q.buckets.forEach((bn,bi)=>{
    const b = document.createElement("button");
    b.className = "opt bucket"; b.innerHTML = `<span class="key">${bi===0?"◀":"▶"}</span><span>${bn}</span>`;
    b.addEventListener("click", ()=>{
      if(settled) return;
      if(items[idx][1] === bi){
        SFX.click();
        idx++;
        if(idx === items.length){ settled = true; done(true); }
        else setCard();
      } else {
        settled = true;
        b.classList.add("wrong");
        [...buckets.children].forEach(o=>o.disabled=true);
        area.appendChild(revealTable(q.items.map(it=>[it[0], q.buckets[it[1]]])));
        done(false);
      }
    });
    buckets.appendChild(b);
  });
}

function renderMap(q, done){
  const area = $("q-area");
  const wrap = document.createElement("div"); wrap.className = "map-wrap";
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS,"svg");
  svg.setAttribute("viewBox","0 0 320 360");
  svg.setAttribute("class","tacmap");
  // grid
  for(let gx=0;gx<=320;gx+=40){
    const l=document.createElementNS(NS,"line");
    l.setAttribute("x1",gx);l.setAttribute("y1",0);l.setAttribute("x2",gx);l.setAttribute("y2",360);
    l.setAttribute("class","map-grid"); svg.appendChild(l);
  }
  for(let gy=0;gy<=360;gy+=40){
    const l=document.createElementNS(NS,"line");
    l.setAttribute("x1",0);l.setAttribute("y1",gy);l.setAttribute("x2",320);l.setAttribute("y2",gy);
    l.setAttribute("class","map-grid"); svg.appendChild(l);
  }
  // stylized India outline
  const outline = document.createElementNS(NS,"path");
  outline.setAttribute("d","M95,20 L120,14 L142,30 L185,40 L230,55 L266,70 L286,96 L256,106 L236,120 L250,140 L230,162 L200,212 L176,262 L150,312 L126,262 L104,212 L85,160 L70,120 L60,90 L76,54 Z");
  outline.setAttribute("class","map-outline");
  svg.appendChild(outline);
  // Ganga river
  const river = document.createElementNS(NS,"path");
  river.setAttribute("d","M104,84 Q140,100 176,112 Q210,120 240,136");
  river.setAttribute("class","map-river");
  svg.appendChild(river);
  const riverLbl = document.createElementNS(NS,"text");
  riverLbl.setAttribute("x",150); riverLbl.setAttribute("y",96);
  riverLbl.setAttribute("class","map-riverlbl"); riverLbl.textContent="~ GANGA ~";
  svg.appendChild(riverLbl);

  let settled = false;
  const spotEls = {};
  Object.entries(MAP_SPOTS).forEach(([key,sp])=>{
    const g = document.createElementNS(NS,"g");
    g.setAttribute("class","map-spot");
    g.setAttribute("data-key",key);
    const halo = document.createElementNS(NS,"circle");
    halo.setAttribute("cx",sp.x); halo.setAttribute("cy",sp.y); halo.setAttribute("r",11);
    halo.setAttribute("class","spot-halo");
    const dot = document.createElementNS(NS,"circle");
    dot.setAttribute("cx",sp.x); dot.setAttribute("cy",sp.y); dot.setAttribute("r",5);
    dot.setAttribute("class","spot-dot");
    const lbl = document.createElementNS(NS,"text");
    lbl.setAttribute("x",sp.x); lbl.setAttribute("y",sp.y-14);
    lbl.setAttribute("class","spot-lbl"); lbl.textContent = sp.label.toUpperCase();
    g.appendChild(halo); g.appendChild(dot); g.appendChild(lbl);
    g.addEventListener("click", ()=>{
      if(settled) return; settled = true;
      const correct = key === q.target;
      g.classList.add(correct ? "hit":"miss");
      spotEls[q.target].classList.add("hit");
      svg.classList.add("resolved");
      done(correct);
    });
    svg.appendChild(g);
    spotEls[key] = g;
  });
  wrap.appendChild(svg);
  const hint = document.createElement("div");
  hint.className = "map-hint";
  hint.textContent = "⌖ TAP A SECTOR ON THE TACTICAL MAP";
  area.appendChild(hint);
  area.appendChild(wrap);
}

function revealTable(rows){
  const t = document.createElement("div");
  t.className = "reveal";
  t.innerHTML = `<div class="reveal-head">📡 INTEL — THE CORRECT ANSWERS:</div>` +
    rows.map(r=>`<div class="reveal-row"><span>${r[0]}</span><b>→ ${r[1]}</b></div>`).join("");
  return t;
}

/* ---------------- ANSWER RESOLUTION ---------------- */
function resolveAnswer(q, correct, isMayday){
  const s = session;
  if(s.answered) return;
  s.answered = true;
  clearInterval(s.mtimer);
  logTopic(q.topic, correct);

  const fb = $("feedback");
  if(isMayday){
    s.maydays++;
    if(correct){
      s.maydaysOk++;
      s.score += 75;
      SFX.repair();
      fb.className = "feedback show good";
      $("fb-head").textContent = "EMERGENCY HANDLED! 🔧🔥";
      $("fb-pts").innerHTML = "+75 PTS — fire out, engines relit, crisis averted!";
    } else {
      SFX.wrong();
      fb.className = "feedback show bad";
      $("fb-head").textContent = "BACKUP SYSTEMS SAVED US! 😅";
      $("fb-pts").innerHTML = `<span style="color:var(--muted)">No points — but read the intel below so it never happens again.</span>`;
    }
    $("fb-body").innerHTML = q.exp;
    $("q-score").textContent = s.score;
    setTimeout(()=>$("btn-next").focus(), 80);
    return;
  }

  s.answeredCount++;
  s.attempts[s.current] = (s.attempts[s.current]||0) + 1;
  const firstTry = s.attempts[s.current] === 1;

  if(correct){
    s.locked++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if(firstTry) s.firstTry++;
    const streakBonus = firstTry ? Math.min(s.streak-1,5)*20 : 0;
    const pts = (firstTry ? 100 : 50) + streakBonus;
    s.score += pts;
    SFX.correct();
    if(s.streak === 3) SFX.streak();
    document.body.classList.toggle("afterburner", s.streak >= 3);
    fb.className = "feedback show good";
    $("fb-head").textContent = PRAISE[Math.floor(Math.random()*PRAISE.length)];
    $("fb-pts").innerHTML = `+${pts} PTS` +
      (streakBonus ? ` <span style="color:#ff8c42">(includes +${streakBonus} streak bonus)</span>` : "") +
      (!firstTry ? ` <span style="color:var(--muted)">(retry hit — half points)</span>` : "") +
      (s.streak >= 3 ? `<span class="streak-pill">🔥 AFTERBURNER x${s.streak}</span>` : "");
  } else {
    s.streak = 0;
    document.body.classList.remove("afterburner");
    const back = Math.min(2, s.queue.length);
    s.queue.splice(back, 0, s.current);
    const qq = s.w.questions[s.current];
    if(!s.wrongList.includes(qq)) s.wrongList.push(qq);
    SFX.wrong();
    fb.className = "feedback show bad";
    $("fb-head").textContent = OOPS[Math.floor(Math.random()*OOPS.length)];
    $("fb-pts").innerHTML = `<span style="color:var(--muted)">This ring circles back — hit it right to master the mission!</span>`;
  }
  $("fb-body").innerHTML = q.exp;
  $("q-score").textContent = s.score;
  $("q-streak").textContent = s.streak > 0 ? "🔥"+s.streak : "—";
  updateAltitude();
  setTimeout(()=>$("btn-next").focus(), 80);
}

/* ---------------- NEXT / MAYDAY ---------------- */
function onNext(){
  SFX.click();
  const s = session;
  if(!s) return;
  if(s.afterNext){ const fn = s.afterNext; s.afterNext = null; fn(); return; }
  if(s.mode === "drill"){ askNext(); return; }
  // flight mode
  $("q-card").style.display = "none";
  if(s.queue.length === 0){ endOfQuestions(); return; }
  maybeMayday(()=>cruiseToNext(false));
}

function maybeMayday(cont){
  const s = session;
  const pool = maydayPool();
  const force = !!window.__MAYDAY;
  const roll = force || (s.answeredCount >= 2 && s.maydays < 2 && Math.random() < 0.35);
  if(!roll || !pool){ cont(); return; }
  window.__MAYDAY = false;
  runMayday(pool, cont);
}
function maydayPool(){
  const s = session;
  const wrongMcq = s.wrongList.filter(q=>q.type==="mcq" || !q.type);
  if(wrongMcq.length) return wrongMcq[Math.floor(Math.random()*wrongMcq.length)];
  const anyMcq = s.w.questions.filter((q,i)=>(q.type==="mcq") && s.attempts[i]);
  if(anyMcq.length) return anyMcq[Math.floor(Math.random()*anyMcq.length)];
  return null;
}
function runMayday(q, cont){
  const s = session;
  s.inMayday = true;
  s.answered = false;
  const call = MAYDAY_CALLS[Math.floor(Math.random()*MAYDAY_CALLS.length)];
  Flight.phase("mayday");
  Flight.setAlert(true);
  SFX.klaxon();
  $("m-title").textContent = "🚨 " + call.title;
  $("m-sub").textContent = call.sub;
  $("mayday-banner").classList.add("show");
  $("q-num").textContent = "⚠ EMERGENCY CHECK";
  $("q-retry").style.display = "none";
  renderQuestion(q, true);
  // countdown
  const T = window.__FAST ? 4 : 20;
  let left = T;
  $("m-timer-fill").style.width = "100%";
  s.mtimer = setInterval(()=>{
    left -= 0.1;
    $("m-timer-fill").style.width = Math.max(0,(left/T)*100) + "%";
    if(left <= 5 && Math.abs(left%1) < 0.11) SFX.alarmBlip();
    if(left <= 0){
      clearInterval(s.mtimer);
      if(session.forceResolve) session.forceResolve();
    }
  }, 100);
  s.afterNext = ()=>{
    Flight.setAlert(false);
    $("mayday-banner").classList.remove("show");
    $("q-card").style.display = "none";
    caption("SYSTEMS GREEN — BACK ON COURSE! ✅");
    SFX.radio();
    cont();
  };
}

/* ---------------- MISSION COMPLETE / VICTORY ---------------- */
function missionComplete(){
  const s = session;
  document.body.classList.remove("afterburner");
  document.body.classList.remove("in-flight");
  if(s.mode==="flight") Flight.end();
  const acc = Math.round((s.firstTry / s.total) * 100);
  const stars = acc === 100 ? 3 : acc >= 70 ? 2 : 1;

  const rec = mrec(s.w.id);
  const newBadge = !rec.mastered;
  save.missions[s.w.id] = {
    mastered:true,
    stars:Math.max(rec.stars, stars),
    bestScore:Math.max(rec.bestScore, s.score)
  };
  persist();

  $("d-tag").textContent = s.w.icon + "  " + s.w.name + "  —  Debrief";
  $("d-title").textContent = stars===3 ? "FLAWLESS VICTORY!" : "Mission Mastered!";
  $("d-quote").textContent = stars===3 ? QUOTES3 : stars===2 ? QUOTES2 : QUOTES1;
  $("d-score").textContent = s.score;
  $("d-acc").textContent = acc + "%";
  $("d-streak").textContent = s.bestStreak;
  $("d-mayday").textContent = s.maydays ? `${s.maydaysOk}/${s.maydays}` : "—";

  const starEls = $("d-stars").children;
  [...starEls].forEach(el=>{ el.className=""; });
  const badgeBox = $("d-badge");
  badgeBox.classList.toggle("show", newBadge);
  if(newBadge){
    $("d-badge-ico").textContent = s.w.badge.ico;
    $("d-badge-name").textContent = s.w.badge.name.toUpperCase() + " MEDAL UNLOCKED";
  }
  // did this run unlock a reward world?
  const stTot = totalStars();
  const unlocked = WORLDS.find(w=>w.unlockStars>0 && stTot>=w.unlockStars && stTot-stars<w.unlockStars);
  $("d-unlock").style.display = unlocked ? "" : "none";
  if(unlocked) $("d-unlock").innerHTML = `🔓 NEW WORLD UNLOCKED: <b>${unlocked.icon} ${unlocked.name}</b>`;

  const hasNext = s.idx < WORLDS.length-1 && totalStars() >= WORLDS[Math.min(s.idx+1,WORLDS.length-1)].unlockStars;
  $("btn-nextmission").style.display = hasNext ? "" : "none";

  show("screen-debrief");
  jetFlyby();
  confetti(stars===3 ? 160 : 90);
  SFX.fanfare();
  [...starEls].forEach((el,i)=>{
    setTimeout(()=>{
      if(i < stars){ el.className="on"; }
      else el.className="off";
    }, 500 + i*450);
  });

  if(WORLDS.every(w=>mrec(w.id).mastered)){
    setTimeout(()=>{
      if($("screen-debrief").classList.contains("active")) showVictory();
    }, 4200);
  }
}

function showVictory(){
  const allAce = WORLDS.every(w=>mrec(w.id).stars===3);
  $("v-text").innerHTML = allAce
    ? `<b style="color:var(--amber)">FULL MARKS ON EVERY MISSION!</b> ${save.pilot||"Commander"}, you flew every sortie, hit every ring and mastered ALL the knowledge — from the first villages to the mightiest empires. The Academy salutes you: LEGEND OF THE SKIES! 🇮🇳🛩️`
    : `${save.pilot||"Commander"}, you've mastered every world! Now chase the ultimate prize: replay missions and hit <b style="color:var(--amber)">every ring on the first try</b> to collect all ${WORLDS.length*3} stars and become a FULL-MARKS LEGEND!`;
  $("v-pts").textContent = careerPoints();
  $("v-stars").textContent = `${totalStars()}/${WORLDS.length*3}`;
  $("v-medals").textContent = medalsOwned();
  show("screen-victory");
  jetFlyby();
  confetti(220);
  SFX.bigwin();
  setTimeout(()=>confetti(140), 1500);
}

function abortMission(){
  SFX.click();
  clearInterval(session && session.mtimer);
  document.body.classList.remove("afterburner","in-flight");
  captionOff();
  $("mayday-banner").classList.remove("show");
  $("briefing").classList.remove("show");
  Flight.end();
  renderBase();
  show("screen-base");
}

/* ---------------- WIRING ---------------- */
$("btn-start").addEventListener("click", ()=>{
  const name = $("pilot-name").value.trim().toUpperCase();
  if(name) save.pilot = name;
  persist();
  SFX.unlock(); SFX.whoosh(); jetFlyby();
  renderBase();
  show("screen-base");
});
$("pilot-name").addEventListener("keydown", e=>{ if(e.key==="Enter") $("btn-start").click(); });

$("btn-launch").addEventListener("click", ()=>{ SFX.click(); launchFlight(); });
$("btn-next").addEventListener("click", onNext);
$("btn-abort").addEventListener("click", abortMission);
$("btn-replay").addEventListener("click", ()=>{ SFX.click(); startMission(session.idx); });
$("btn-base").addEventListener("click", ()=>{ SFX.click(); renderBase(); show("screen-base"); });
$("btn-nextmission").addEventListener("click", ()=>{ SFX.click(); startMission(session.idx+1); });
$("btn-victory-base").addEventListener("click", ()=>{ SFX.click(); renderBase(); show("screen-base"); });
$("btn-log").addEventListener("click", ()=>{ SFX.click(); renderLog(); });
$("btn-log-back").addEventListener("click", ()=>{ SFX.click(); renderBase(); show("screen-base"); });
$("mode-flight").addEventListener("click", ()=>{ SFX.click(); setMode("flight"); });
$("mode-drill").addEventListener("click", ()=>{ SFX.click(); setMode("drill"); });

$("btn-reset").addEventListener("click", ()=>{
  if(confirm("Reset ALL progress, points, medals and the Command Log?")){
    save = {pilot:save.pilot, muted:save.muted, mode:save.mode, missions:{}, log:{}};
    persist(); renderBase();
  }
});
document.querySelectorAll("#btn-mute,#btn-mute2").forEach(b=>{
  b.addEventListener("click", ()=>setMuted(!save.muted));
});

document.addEventListener("keydown", e=>{
  if(!$("screen-quiz").classList.contains("active")) return;
  if(["1","2","3","4"].includes(e.key) && session && !session.answered){
    const idx = +e.key - 1;
    if(mcqButtons[idx] && !mcqButtons[idx].disabled && $("q-card").style.display!=="none"
       && mcqButtons[idx].isConnected) mcqButtons[idx].click();
  } else if(e.key === "Enter" && session && session.answered && $("feedback").classList.contains("show")){
    e.preventDefault();
    onNext();
  }
});

/* ---------------- INIT ---------------- */
makeStars();
setMuted(save.muted);
setMode(save.mode || "flight");
if(save.pilot) $("pilot-name").value = save.pilot;

/* test hook */
window.__game = {
  get session(){ return session; },
  startMission, askNext, get save(){ return save; }
};
