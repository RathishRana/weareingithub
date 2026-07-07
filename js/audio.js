"use strict";
/* =====================================================================
   SKY COMMANDER ACADEMY v2 — AUDIO ENGINE
   Everything is synthesized with Web Audio — zero asset files.
   Globals: SFX (one-shots), Engine (throttle-reactive loop),
   audioMuted() is provided by game.js via SFX.isMuted hook.
   ===================================================================== */

let AC = null;
function audioCtx(){
  if(!AC){ AC = new (window.AudioContext||window.webkitAudioContext)(); }
  if(AC.state === "suspended") AC.resume();
  return AC;
}

function tone(freq, t0, dur, {type="sine", vol=0.18, slide=null}={}){
  if(SFX.isMuted()) return;
  const ctx = audioCtx();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime + t0);
  if(slide) o.frequency.exponentialRampToValueAtTime(slide, ctx.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.05);
}

function noiseBurst(t0, dur, {fStart=400, fEnd=3000, vol=0.25, q=1, type="bandpass"}={}){
  if(SFX.isMuted()) return;
  const ctx = audioCtx();
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type=type; bp.Q.value=q;
  bp.frequency.setValueAtTime(fStart, ctx.currentTime + t0);
  bp.frequency.exponentialRampToValueAtTime(Math.max(fEnd,20), ctx.currentTime + t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + t0); src.stop(ctx.currentTime + t0 + dur + 0.05);
}

const SFX = {
  isMuted(){ return false; },      // overridden by game.js
  unlock(){ audioCtx(); },
  click(){ tone(900, 0, .07, {type:"square", vol:.06}); },
  correct(){ [523,659,784,1047].forEach((f,i)=>tone(f, i*0.09, .16, {type:"triangle", vol:.2})); },
  wrong(){ tone(180, 0, .22, {type:"sawtooth", vol:.14, slide:110}); tone(140, .22, .3, {type:"sawtooth", vol:.12, slide:80}); },
  whoosh(){ noiseBurst(0, .55, {fStart:300, fEnd:4200, vol:.2, q:1.2}); },
  ring(){ tone(880, 0, .12, {type:"sine", vol:.2}); tone(1320, .08, .22, {type:"sine", vol:.22}); noiseBurst(0, .35, {fStart:800, fEnd:5000, vol:.12, q:1.5}); },
  streak(){ tone(600, 0, .1, {type:"square", vol:.1, slide:1400}); tone(1400, .1, .12, {type:"square", vol:.1, slide:2200}); },
  radio(){ noiseBurst(0, .12, {fStart:1800, fEnd:2400, vol:.05, q:4}); tone(1200, .05, .06, {type:"square", vol:.05}); },
  klaxon(){
    for(let i=0;i<3;i++){
      tone(660, i*0.5, .24, {type:"square", vol:.14, slide:440});
      tone(440, i*0.5+0.25, .22, {type:"square", vol:.12, slide:330});
    }
  },
  alarmBlip(){ tone(880, 0, .1, {type:"square", vol:.08}); },
  repair(){ [330,440,554,659,880].forEach((f,i)=>tone(f, i*0.07, .12, {type:"triangle", vol:.16})); noiseBurst(.35,.3,{fStart:3000,fEnd:6000,vol:.08,q:2}); },
  screech(){ noiseBurst(0, .8, {fStart:2400, fEnd:500, vol:.22, q:2}); noiseBurst(.1, .5, {fStart:1600, fEnd:300, vol:.16, q:3}); },
  thud(){ tone(70, 0, .25, {type:"sine", vol:.35, slide:40}); noiseBurst(0,.2,{fStart:200,fEnd:80,vol:.2,q:.8,type:"lowpass"}); },
  thunder(){ noiseBurst(0, 1.4, {fStart:400, fEnd:60, vol:.22, q:.6, type:"lowpass"}); tone(55, 0, 1.0, {type:"sine", vol:.18, slide:35}); },
  fanfare(){
    const seq=[[523,0],[659,.14],[784,.28],[1047,.42],[784,.6],[1047,.74],[1319,.9]];
    seq.forEach(([f,t])=>{ tone(f,t,.3,{type:"triangle",vol:.22}); tone(f/2,t,.3,{type:"sine",vol:.12}); });
    noiseBurst(.9,.8,{fStart:2000,fEnd:600,vol:.12,q:.7});
  },
  bigwin(){
    SFX.fanfare();
    [1047,1319,1568,2093].forEach((f,i)=>tone(f, 1.2+i*.12, .4, {type:"triangle", vol:.2}));
  }
};

/* -------- Radio chatter garble: band-passed noise pulsed in syllable
   rhythms through a walkie-talkie filter — unintelligible ATC babble -------- */
SFX.chatter = function(){
  if(SFX.isMuted()) return;
  const ctx = audioCtx();
  const dur = 1.2 + Math.random()*1.0;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type="bandpass"; bp.Q.value=5.5;
  bp.frequency.value = 1050 + Math.random()*250;
  const g = ctx.createGain();
  const t0 = ctx.currentTime;
  // squelch open
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0+0.02);
  // syllable envelope: talk / gap / talk…
  let t = 0.05;
  while(t < dur-0.15){
    const syl = 0.06 + Math.random()*0.14;
    g.gain.exponentialRampToValueAtTime(0.028+Math.random()*0.03, t0+t);
    t += syl;
    g.gain.exponentialRampToValueAtTime(Math.random()<0.3?0.003:0.012, t0+t);
    t += 0.03 + Math.random()*0.09;
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t0); src.stop(t0+dur+0.05);
  // squelch close click
  tone(1400, dur, .05, {type:"square", vol:.04});
};

/* -------- Voice: human radio calls via the browser's built-in speech
   synthesis (offline, zero assets). Wrapped in radio squelch clicks. -------- */
const Voice = (()=>{
  const ok = typeof window !== "undefined" && "speechSynthesis" in window;
  let voice = null;
  function pick(){
    try{
      const vs = speechSynthesis.getVoices();
      voice = vs.find(v=>/en[-_](IN|GB)/i.test(v.lang))
           || vs.find(v=>/^en/i.test(v.lang)) || vs[0] || null;
    }catch(e){}
  }
  if(ok){ pick(); try{ speechSynthesis.onvoiceschanged = pick; }catch(e){} }
  function say(text, {rate=1.04, pitch=0.8, urgent=false}={}){
    if(!ok || SFX.isMuted()) return;
    try{
      speechSynthesis.cancel();                  // never stack transmissions
      const u = new SpeechSynthesisUtterance(text);
      if(voice) u.voice = voice;
      u.rate = urgent ? 1.18 : rate;
      u.pitch = pitch;
      u.volume = 1;
      SFX.radio();                               // squelch open
      u.onend = ()=>SFX.radio();                 // squelch close
      speechSynthesis.speak(u);
    }catch(e){}
  }
  function stop(){ if(ok){ try{ speechSynthesis.cancel(); }catch(e){} } }
  return {say, stop};
})();

/* -------- Engine loop: detuned saws through a lowpass; throttle 0..1 -------- */
const Engine = (()=>{
  let nodes = null, throttleVal = 0;
  function start(){
    if(SFX.isMuted() || nodes) return;
    const ctx = audioCtx();
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type="sawtooth"; o2.type="sawtooth";
    o1.frequency.value = 42; o2.frequency.value = 42.6;
    const lp = ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=160;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.4;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.006;
    lfo.connect(lfoG).connect(g.gain);
    o1.connect(lp); o2.connect(lp); lp.connect(g).connect(ctx.destination);
    o1.start(); o2.start(); lfo.start();
    nodes = {o1,o2,lp,g,lfo};
    setThrottle(throttleVal);
  }
  function setThrottle(t){          // 0 idle … 1 full afterburner
    throttleVal = Math.max(0, Math.min(1, t));
    if(!nodes) return;
    const ctx = audioCtx(), now = ctx.currentTime;
    const f = 42 + throttleVal*70;
    nodes.o1.frequency.linearRampToValueAtTime(f, now+0.25);
    nodes.o2.frequency.linearRampToValueAtTime(f*1.014, now+0.25);
    nodes.lp.frequency.linearRampToValueAtTime(160 + throttleVal*720, now+0.25);
    nodes.g.gain.linearRampToValueAtTime(0.015 + throttleVal*0.05, now+0.25);
  }
  function stop(){
    if(!nodes) return;
    const ctx = audioCtx();
    try{ nodes.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime+0.4); }catch(e){}
    const n = nodes; nodes = null;
    setTimeout(()=>{ ["o1","o2","lfo"].forEach(k=>{ try{n[k].stop()}catch(e){} }); }, 500);
  }
  return {start, setThrottle, stop, get running(){ return !!nodes; }};
})();
