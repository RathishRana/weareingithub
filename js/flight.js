"use strict";
/* =====================================================================
   SKY COMMANDER ACADEMY v2 — FLIGHT ENGINE
   A 2.5D perspective canvas flight sim: taxi → takeoff → cruise
   (steer through rings) → hold (questions) → approach → touchdown.
   Explicit phase machine; per-world scene palettes; pointer + arrow
   steering with adaptive auto-assist so a 9-year-old always succeeds.
   Global: Flight
   ===================================================================== */

const SCENES = {
  river:   {skyTop:"#0b2a52", skyBot:"#ff9e5e", sun:{c:"#ffd98a",x:.68,y:.16,r:.16},
            groundTop:"#173a2a", groundBot:"#0a1d14", grid:"rgba(120,255,190,.16)",
            mtnFar:"#12294a", mtnNear:"#0d3a2c", cloud:"rgba(255,230,200,.8)",
            river:true, forts:false, funnel:false},
  forts:   {skyTop:"#241038", skyBot:"#ff7e4a", sun:{c:"#ffc46b",x:.34,y:.2,r:.2},
            groundTop:"#3a2413", groundBot:"#160c06", grid:"rgba(255,190,110,.14)",
            mtnFar:"#2b1540", mtnNear:"#241105", cloud:"rgba(255,210,170,.75)",
            river:false, forts:true, funnel:false},
  dawn:    {skyTop:"#0a1c4a", skyBot:"#ffb37a", sun:{c:"#ffe3a0",x:.5,y:.14,r:.18},
            groundTop:"#22304a", groundBot:"#0b1222", grid:"rgba(0,229,255,.18)",
            mtnFar:"#152548", mtnNear:"#0e1b33", cloud:"rgba(255,235,215,.8)",
            river:false, forts:false, funnel:false},
  dusk:    {skyTop:"#1c0b33", skyBot:"#ffae4e", sun:{c:"#ffd06b",x:.62,y:.18,r:.22},
            groundTop:"#33230f", groundBot:"#120b04", grid:"rgba(255,200,80,.16)",
            mtnFar:"#2a1445", mtnNear:"#1c1206", cloud:"rgba(255,215,160,.75)",
            river:false, forts:false, funnel:false},
  highalt: {skyTop:"#03102e", skyBot:"#4dc3ff", sun:{c:"#ffffff",x:.76,y:.12,r:.13},
            groundTop:"#274a6b", groundBot:"#0d1d30", grid:"rgba(150,220,255,.16)",
            mtnFar:"#1b3a5c", mtnNear:"#122a44", cloud:"rgba(255,255,255,.92)",
            river:false, forts:false, funnel:false},
  mountain:{skyTop:"#0d2138", skyBot:"#9fd3e8", sun:{c:"#fff3d0",x:.3,y:.15,r:.14},
            groundTop:"#2c4a33", groundBot:"#101f14", grid:"rgba(170,255,190,.13)",
            mtnFar:"#1d3a55", mtnNear:"#28442e", cloud:"rgba(255,255,255,.85)",
            river:false, forts:false, funnel:false, snowcaps:true},
  storm:   {skyTop:"#0a0d1c", skyBot:"#3d4a63", sun:{c:"#8fa3c4",x:.5,y:.1,r:.1},
            groundTop:"#1c2433", groundBot:"#07090f", grid:"rgba(140,170,220,.14)",
            mtnFar:"#141b2c", mtnNear:"#0e1420", cloud:"rgba(90,105,135,.9)",
            river:false, forts:false, funnel:true, lightning:true}
};

const Flight = (()=>{
  let cv=null, cx2=null, W=0, H=0, dpr=1, raf=0, running=false;
  let scene=null, sceneId="dawn";
  let phase="off", phaseT=0, phaseCb=null, touchdownFired=false;

  const jet = {x:0, y:1.0, tx:0, ty:1.0, roll:0};
  let ring = null, misses = 0, ringsSpawned = 0;
  let clouds=[], parts=[], smoke=[];
  let speed=0, throttle=0, camAlt=0, dist=0, shake=0, alertOn=false;
  let flash=0, boltPts=null, boltT=0, nextBolt=4;
  let pointerActiveT=-99, t=0, lastTele=0;
  const keys = new Set();
  const K = ()=>W*0.55;               // projection constant
  const FAST = ()=>!!window.__FAST;

  let onTele = null, onEvent = null;

  /* ---------- setup ---------- */
  function init(canvas){
    cv = canvas; cx2 = cv.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    cv.addEventListener("pointermove", onPointer);
    cv.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", e=>{
      if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","a","d","w","s"].includes(e.key)){
        keys.add(e.key); pointerActiveT = t;
        if(phase==="cruise") e.preventDefault();
      }
    });
    window.addEventListener("keyup", e=>keys.delete(e.key));
  }
  function resize(){
    if(!cv) return;
    dpr = Math.min(window.devicePixelRatio||1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W*dpr; cv.height = H*dpr;
    cx2.setTransform(dpr,0,0,dpr,0,0);
  }
  function onPointer(e){
    if(phase!=="cruise") return;
    const r = cv.getBoundingClientRect();
    const nx = (e.clientX - r.left)/r.width*2 - 1;   // -1..1
    const ny = (e.clientY - r.top)/r.height;         // 0..1
    jet.tx = nx*1.6;
    jet.ty = 0.4 + (1-ny)*1.4;                       // low on screen = low alt
    pointerActiveT = t;
  }

  function begin(id){
    sceneId = SCENES[id] ? id : "dawn";
    scene = SCENES[sceneId];
    jet.x=0; jet.y=1; jet.tx=0; jet.ty=1; jet.roll=0;
    ring=null; misses=0; ringsSpawned=0;
    parts=[]; smoke=[]; shake=0; alertOn=false; flash=0; boltPts=null;
    speed=0; throttle=0; camAlt=0; dist=0; t=0; nextBolt=4;
    clouds=[];
    for(let i=0;i<14;i++) clouds.push(newCloud(true));
    setPh("parked");
    if(!running){ running=true; last=performance.now(); raf=requestAnimationFrame(loop); }
    Engine.start();
  }
  function end(){
    running=false; cancelAnimationFrame(raf); phase="off"; phaseCb=null;
    Engine.stop();
  }
  function newCloud(anyZ){
    return {x:(Math.random()*12-6), y:0.5+Math.random()*2.2, z:anyZ?2+Math.random()*36:34+Math.random()*6,
            s:0.7+Math.random()*1.3};
  }

  /* ---------- phase machine ---------- */
  function setPh(name, cb){
    phase=name; phaseT=0; phaseCb=cb||null; touchdownFired=false;
    if(name==="cruise"){ spawnRing(); }
    if(name==="taxi"){ dist=0; }
  }
  function spawnRing(){
    ringsSpawned++;
    ring = {x:(Math.random()*2-1)*1.1, y:0.6+Math.random()*0.9, z:FAST()?6:32};
  }
  const DUR = {taxi:()=>FAST()?0.25:2.6, climb:()=>FAST()?0.25:2.2, approach:()=>FAST()?0.3:2.6, roll:()=>FAST()?0.3:1.6};

  /* ---------- main loop ---------- */
  let last=0;
  function loop(now){
    if(!running) return;
    const dt = Math.min((now-last)/1000, 0.05); last=now; t+=dt; phaseT+=dt;
    update(dt);
    draw();
    if(onTele && t-lastTele>0.12){
      lastTele=t;
      onTele({alt:Math.round(camAlt*11000 + (jet.y-1)*900 + Math.sin(t*1.3)*18),
              spd:Math.round(140 + throttle*760 + speed*8), phase});
    }
    raf=requestAnimationFrame(loop);
  }

  function update(dt){
    shake = Math.max(0, shake - dt*3);
    flash = Math.max(0, flash - dt*2.4);

    switch(phase){
      case "parked":
        throttle += (0.06-throttle)*dt*2; Engine.setThrottle(throttle*0.3);
        break;
      case "taxi":{
        const p = Math.min(phaseT/DUR.taxi(), 1);
        throttle = p; Engine.setThrottle(0.3+p*0.7);
        speed = p*p*14; dist += speed*dt;
        if(p>=1){ const cb=phaseCb; setPh("climb", null); if(cb) cb(); }
        break;
      }
      case "climb":{
        const p = Math.min(phaseT/DUR.climb(), 1);
        camAlt = p*p*(3-2*p)*1 + 0; // smoothstep 0→1
        camAlt = p<1 ? (p*p*(3-2*p)) : 1;
        speed = 14 - p*4; throttle = 1 - p*0.35; Engine.setThrottle(1-p*0.3);
        if(p>=1){ camAlt=1; const cb=phaseCb; phase="cruiseWait"; if(cb) cb(); }
        break;
      }
      case "cruise":{
        camAlt = 1;
        steer(dt, true);
        const zSpeed = FAST()?26:(8.5 + Math.min(misses,3));
        speed = zSpeed; throttle += (0.72-throttle)*dt*2; Engine.setThrottle(0.62);
        if(ring){
          ring.z -= zSpeed*dt;
          if(ring.z <= 1.15){
            const rr = 0.62 + misses*0.15 + (FAST()?5:0);
            if(Math.abs(jet.x-ring.x)<rr && Math.abs(jet.y-ring.y)<rr){
              SFX.ring(); shake=0.5;
              const cb=phaseCb; ring=null; setPh("hold", null);
              if(onEvent) onEvent("ringhit");
              if(cb) cb();
            } else {
              misses++; ring.z = FAST()?6:26;
              ring.x = jet.x*0.5 + ring.x*0.5;      // drift ring toward player
              if(onEvent) onEvent("ringmiss");
            }
          }
        }
        break;
      }
      case "cruiseWait":
      case "hold":
      case "mayday":{
        camAlt = 1;
        steer(dt, false);
        speed = 6; throttle += ((phase==="mayday"?0.4:0.55)-throttle)*dt*2;
        Engine.setThrottle(phase==="mayday"?0.35:0.5);
        if(phase==="mayday" && Math.random()<dt*10) spawnSmoke();
        break;
      }
      case "approach":{
        const p = Math.min(phaseT/DUR.approach(), 1);
        camAlt = 1 - (p*p*(3-2*p));
        speed = 10 - p*3; throttle = 0.5 - p*0.3; Engine.setThrottle(0.45-p*0.3);
        jet.x += (0-jet.x)*dt*2.5; jet.tx=0; jet.ty=1;
        if(p>=1 && !touchdownFired){
          touchdownFired = true;
          camAlt=0; shake=1; SFX.thud(); SFX.screech();
          if(phaseCb) phaseCb("touchdown");
          setPh("rollout", phaseCb);
        }
        break;
      }
      case "rollout":{
        const p = Math.min(phaseT/DUR.roll(), 1);
        speed = 14*(1-p); dist += speed*dt; throttle = 0.2*(1-p); Engine.setThrottle(0.15*(1-p));
        if(p>=1){ const cb=phaseCb; setPh("parked", null); if(cb) cb("stopped"); }
        break;
      }
    }

    // shared world updates
    dist += (phase==="cruise"||phase==="hold"||phase==="mayday"||phase==="cruiseWait") ? speed*dt : 0;
    for(const c of clouds){
      c.z -= speed*dt*0.55;
      if(c.z<0.7) Object.assign(c, newCloud(false));
    }
    for(const p of parts){ p.age+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; }
    parts = parts.filter(p=>p.age<p.life);
    for(const s of smoke){ s.age+=dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.r+=dt*26; }
    smoke = smoke.filter(s=>s.age<s.life);
    if(throttle>0.15 && camAlt>0.05) spawnFlameParts();

    // lightning
    if(scene && scene.lightning){
      nextBolt -= dt;
      if(nextBolt<=0){
        nextBolt = 5 + Math.random()*6;
        flash = 1; boltT = 0.35;
        boltPts = makeBolt();
        SFX.thunder();
      }
      boltT = Math.max(0, boltT-dt);
    }
  }

  function steer(dt, toRing){
    // adaptive assist: recent player input → mostly manual; idle → autopilot
    const idle = (t - pointerActiveT) > 1.6;
    let assist = idle ? 0.9 : Math.min(0.2 + misses*0.3, 0.85);
    if(FAST()) assist = 1;
    let tx = jet.tx, ty = jet.ty;
    const spd = 2.4*dt;
    if(keys.has("ArrowLeft")||keys.has("a"))  tx -= spd*2.2;
    if(keys.has("ArrowRight")||keys.has("d")) tx += spd*2.2;
    if(keys.has("ArrowUp")||keys.has("w"))    ty += spd*1.8;
    if(keys.has("ArrowDown")||keys.has("s"))  ty -= spd*1.8;
    jet.tx = Math.max(-1.7, Math.min(1.7, tx));
    jet.ty = Math.max(0.35, Math.min(1.9, ty));
    let gx = jet.tx, gy = jet.ty;
    if(toRing && ring){ gx = jet.tx*(1-assist) + ring.x*assist; gy = jet.ty*(1-assist) + ring.y*assist; }
    const px = jet.x;
    jet.x += (gx - jet.x)*Math.min(dt*3.2,1);
    jet.y += (gy - jet.y)*Math.min(dt*3.0,1);
    const vx = (jet.x - px)/Math.max(dt,0.001);
    jet.roll += ((vx*0.55) - jet.roll)*Math.min(dt*5,1);
    jet.roll = Math.max(-0.6, Math.min(0.6, jet.roll));
  }

  function spawnFlameParts(){
    const n = throttle>0.8?3:1;
    for(let i=0;i<n;i++){
      parts.push({x:(Math.random()*14-7), y:20+Math.random()*6,
        vx:(Math.random()*30-15), vy:70+Math.random()*80,
        age:0, life:0.25+Math.random()*0.2, r:2+Math.random()*3,
        c:Math.random()>0.4?"#ff9d2e":"#4df3ff"});
    }
  }
  function spawnSmoke(){
    smoke.push({x:(Math.random()>0.5?-9:9)+Math.random()*4, y:14,
      vx:Math.random()*24-12, vy:60+Math.random()*40,
      age:0, life:1.1, r:6+Math.random()*6});
  }
  function makeBolt(){
    const x0 = W*(0.2+Math.random()*0.6);
    const pts=[[x0, 0]];
    let x=x0, y=0;
    const hy = horizonY();
    while(y<hy-10){ y += 14+Math.random()*22; x += Math.random()*44-22; pts.push([x,y]); }
    return pts;
  }

  const horizonY = ()=> H*(0.78 - camAlt*0.36);

  /* ---------- drawing ---------- */
  function draw(){
    if(!scene) return;
    const hy = horizonY();
    cx2.save();
    if(shake>0) cx2.translate((Math.random()-0.5)*shake*14, (Math.random()-0.5)*shake*10);

    // SKY
    let g = cx2.createLinearGradient(0,0,0,hy);
    g.addColorStop(0, scene.skyTop); g.addColorStop(1, scene.skyBot);
    cx2.fillStyle=g; cx2.fillRect(0,0,W,hy+2);

    // sun glow
    const sx = scene.sun.x*W - jet.x*30, sy = hy - scene.sun.y*H*1.6;
    const sr = scene.sun.r*W;
    g = cx2.createRadialGradient(sx,sy,2, sx,sy,sr);
    g.addColorStop(0, scene.sun.c); g.addColorStop(0.25, scene.sun.c+"aa"); g.addColorStop(1, "transparent");
    cx2.fillStyle=g; cx2.beginPath(); cx2.arc(sx,sy,sr,0,7); cx2.fill();

    // mountains (air view only, fade with camAlt)
    if(camAlt>0.15){
      drawMountains(hy, 0.02, scene.mtnFar, 0.55*camAlt, 42, 0.5);
      drawMountains(hy, 0.05, scene.mtnNear, 0.8*camAlt, 66, 0.8);
    }
    if(scene.forts && camAlt>0.3) drawForts(hy);
    if(scene.funnel && camAlt>0.3) drawFunnel(hy);

    // clouds behind ground? draw above-horizon clouds first
    drawClouds(hy);

    // GROUND
    g = cx2.createLinearGradient(0,hy,0,H);
    g.addColorStop(0, scene.groundTop); g.addColorStop(1, scene.groundBot);
    cx2.fillStyle=g; cx2.fillRect(0,hy,W,H-hy);

    if(camAlt>0.35) drawGrid(hy);
    if(scene.river && camAlt>0.35) drawRiver(hy);
    if(camAlt<0.6) drawRunway(hy, 1-camAlt/0.6);

    // ring
    if(ring && phase==="cruise") drawRing(hy);

    // lightning bolt + flash
    if(boltPts && boltT>0){
      cx2.strokeStyle="rgba(220,235,255,"+(boltT*2.2)+")"; cx2.lineWidth=2.5;
      cx2.shadowColor="#bfe0ff"; cx2.shadowBlur=14;
      cx2.beginPath(); boltPts.forEach((p,i)=> i?cx2.lineTo(p[0],p[1]):cx2.moveTo(p[0],p[1])); cx2.stroke();
      cx2.shadowBlur=0;
    }
    if(flash>0){ cx2.fillStyle="rgba(200,220,255,"+flash*0.16+")"; cx2.fillRect(0,0,W,H); }

    // speed streaks
    if(speed>7 && camAlt>0.5){
      cx2.strokeStyle="rgba(255,255,255,.10)";
      for(let i=0;i<8;i++){
        const yy=Math.random()*H, xx=Math.random()*W;
        cx2.beginPath(); cx2.moveTo(xx,yy); cx2.lineTo(xx-30-speed*2, yy); cx2.lineWidth=1; cx2.stroke();
      }
    }

    drawJet(hy);

    // mayday red pulse
    if(alertOn){
      const a = 0.10 + Math.sin(t*7)*0.07;
      g = cx2.createRadialGradient(W/2,H/2,H*0.3, W/2,H/2,H*0.85);
      g.addColorStop(0,"transparent"); g.addColorStop(1,"rgba(255,40,60,"+a+")");
      cx2.fillStyle=g; cx2.fillRect(0,0,W,H);
    }
    cx2.restore();
  }

  function drawMountains(hy, parx, color, alpha, amp, freq){
    cx2.globalAlpha = alpha;
    cx2.fillStyle = color;
    cx2.beginPath(); cx2.moveTo(-20, hy);
    const off = dist*parx*30 + jet.x*20*(parx*40);
    for(let x=-20;x<=W+20;x+=26){
      const k = (x+off)*0.013*freq;
      const h = (Math.sin(k)*0.5 + Math.sin(k*2.7)*0.3 + Math.sin(k*0.6)*0.4)*amp;
      cx2.lineTo(x, hy - Math.max(4, h+amp*0.5));
    }
    cx2.lineTo(W+20,hy); cx2.closePath(); cx2.fill();
    if(scene.snowcaps){
      cx2.fillStyle="rgba(255,255,255,.35)";
      for(let x=-20;x<=W+20;x+=26){
        const k=(x+off)*0.013*freq;
        const h=(Math.sin(k)*0.5+Math.sin(k*2.7)*0.3+Math.sin(k*0.6)*0.4)*amp;
        if(h>amp*0.42) cx2.fillRect(x-2, hy-h-amp*0.5, 5, 3);
      }
    }
    cx2.globalAlpha = 1;
  }

  function drawForts(hy){
    cx2.globalAlpha = 0.85*camAlt;
    cx2.fillStyle = "#1a0d24";
    const off = (dist*1.4 + jet.x*8) % (W/2);
    for(let i=0;i<3;i++){
      const bx = ((i*(W/2.6)) - off + W) % (W+160) - 80;
      const bw = 60, bh = 26;
      cx2.fillRect(bx, hy-bh, bw, bh);
      for(let cxx=bx; cxx<bx+bw; cxx+=10) cx2.fillRect(cxx, hy-bh-6, 6, 6);   // crenellations
      cx2.fillRect(bx+bw*0.35, hy-bh-18, 14, 18);                              // tower
      cx2.fillRect(bx+bw*0.35-2, hy-bh-24, 18, 5);
    }
    cx2.globalAlpha = 1;
  }

  function drawFunnel(hy){
    const fx = W*0.5 + Math.sin(t*0.5)*W*0.06 - jet.x*36;
    const topW = W*0.34, steps = 9;
    cx2.globalAlpha = 0.8;
    for(let i=0;i<steps;i++){
      const p = i/(steps-1);
      const y = hy - (1-p)*H*0.34;
      const w = topW*(1-p*0.86) * (1 + Math.sin(t*3+i)*0.05);
      const xo = Math.sin(t*1.8 + i*0.9)*14*p;
      cx2.fillStyle = "rgba(48,58,80,"+(0.5+p*0.4)+")";
      cx2.beginPath();
      cx2.ellipse(fx+xo, y, w/2, H*0.022, Math.sin(t*2+i)*0.06, 0, 7);
      cx2.fill();
    }
    // debris
    cx2.fillStyle="rgba(160,175,205,.6)";
    for(let i=0;i<6;i++){
      const a = t*3 + i*1.05, rr = 20 + (i%3)*16;
      cx2.fillRect(fx+Math.cos(a)*rr, hy-8-((i*13)%40) + Math.sin(a)*6, 3, 3);
    }
    cx2.globalAlpha = 1;
  }

  function drawClouds(hy){
    for(const c of clouds){
      const z = c.z;
      const px = W/2 + ((c.x - jet.x*0.7)/z)*K();
      const py = hy - ((c.y - 0.2)/z)*K();
      if(py>hy+10 || px<-160 || px>W+160) continue;
      const s = (c.s/z)*K()*0.34;
      if(s<3) continue;
      cx2.globalAlpha = Math.min(0.9, 2.4/z + 0.12);
      cx2.fillStyle = scene.cloud;
      cx2.beginPath();
      cx2.ellipse(px, py, s, s*0.42, 0, 0, 7);
      cx2.ellipse(px-s*0.6, py+s*0.12, s*0.6, s*0.3, 0, 0, 7);
      cx2.ellipse(px+s*0.62, py+s*0.14, s*0.55, s*0.28, 0, 0, 7);
      cx2.fill();
    }
    cx2.globalAlpha = 1;
  }

  function drawGrid(hy){
    const a = Math.min(1, (camAlt-0.35)/0.4);
    cx2.strokeStyle = scene.grid; cx2.lineWidth = 1.4;
    cx2.globalAlpha = a;
    // lateral scrolling lines
    for(let i=0;i<11;i++){
      const zi = 1.2 + ((i*3.4 - (dist*1.0)%3.4));
      if(zi<=0.35) continue;
      const py = hy + (1.0/zi)*K()*0.55;
      if(py>H+4) continue;
      cx2.globalAlpha = a*Math.min(1, 1.6/zi);
      cx2.beginPath(); cx2.moveTo(0,py); cx2.lineTo(W,py); cx2.stroke();
    }
    // converging rays
    cx2.globalAlpha = a*0.7;
    const vx = W/2 - jet.x*W*0.12;
    for(let i=-6;i<=6;i++){
      cx2.beginPath(); cx2.moveTo(vx, hy);
      cx2.lineTo(W/2 + i*(W*0.13), H+30); cx2.stroke();
    }
    cx2.globalAlpha = 1;
  }

  function drawRiver(hy){
    const a = Math.min(1,(camAlt-0.35)/0.4);
    cx2.globalAlpha = 0.75*a;
    const grad = cx2.createLinearGradient(0,hy,0,H);
    grad.addColorStop(0,"#3f8fd4"); grad.addColorStop(1,"#0f3d6b");
    cx2.fillStyle=grad;
    cx2.beginPath();
    const N=16;
    const cxr = z => W/2 + ((Math.sin(z*0.34 + dist*0.12)*1.4 - jet.x*0.8)/z)*K();
    const wr  = z => (0.55/z)*K();
    // right edge far→near, then left edge near→far
    for(let i=N;i>=1;i--){
      const z=0.9+i*2.2, py=hy+(1.0/z)*K()*0.55;
      if(i===N) cx2.moveTo(cxr(z)+wr(z), py); else cx2.lineTo(cxr(z)+wr(z), py);
    }
    for(let i=1;i<=N;i++){ const z=0.9+i*2.2; cx2.lineTo(cxr(z)-wr(z), hy+(1.0/z)*K()*0.55); }
    cx2.closePath(); cx2.fill();
    // glints
    cx2.fillStyle="rgba(255,255,255,.25)";
    for(let i=1;i<N;i+=2){
      const z=0.9+i*2.2, py=hy+(1.0/z)*K()*0.55;
      cx2.fillRect(cxr(z)-wr(z)*0.3, py, wr(z)*0.5, 1.6);
    }
    cx2.globalAlpha = 1;
  }

  function drawRunway(hy, alpha){
    cx2.globalAlpha = alpha;
    const groundY = 0.24;                       // camera height while on ground
    const py = z => hy + (groundY/z)*K();
    const halfW = z => (0.85/z)*K()*0.5;
    const cxr = z => W/2 - (jet.x*0.3/z)*K();
    // tarmac
    cx2.fillStyle="#20242c";
    cx2.beginPath();
    cx2.moveTo(cxr(30)-halfW(30), py(30));
    cx2.lineTo(cxr(30)+halfW(30), py(30));
    cx2.lineTo(cxr(0.8)+halfW(0.8), py(0.8));
    cx2.lineTo(cxr(0.8)-halfW(0.8), py(0.8));
    cx2.closePath(); cx2.fill();
    // centerline dashes
    cx2.fillStyle="rgba(255,255,255,.8)";
    for(let i=0;i<12;i++){
      const z = 0.9 + ((i*2.4 - (dist*1.2)%2.4));
      if(z<=0.5) continue;
      const y1=py(z), y2=py(z+0.9);
      if(y1>H+10||y2<hy) continue;
      const wln = Math.max(1.5,(0.03/z)*K());
      cx2.fillRect(cxr(z)-wln/2, y2, wln, Math.max(2, y1-y2));
    }
    // edge lights
    for(let i=0;i<14;i++){
      const z = 0.8 + ((i*2.0 - (dist*1.2)%2.0));
      if(z<=0.4) continue;
      const y=py(z);
      if(y>H+8) continue;
      const r = Math.max(1.1,(0.02/z)*K());
      cx2.fillStyle = i%2? "#ffd257":"#7ef2ff";
      cx2.beginPath(); cx2.arc(cxr(z)-halfW(z), y, r, 0, 7); cx2.fill();
      cx2.beginPath(); cx2.arc(cxr(z)+halfW(z), y, r, 0, 7); cx2.fill();
    }
    cx2.globalAlpha = 1;
  }

  function drawRing(hy){
    const z = ring.z;
    const px = W/2 + ((ring.x - jet.x)/z)*K();
    const py = hy - ((ring.y - jet.y)/z)*K() + (0.55/z)*K()*0.35;
    const r = (0.62/z)*K();
    if(r<2) return;
    const pulse = 1 + Math.sin(t*6)*0.05;
    cx2.save();
    cx2.shadowColor = "#37ffd0"; cx2.shadowBlur = Math.min(26, r*0.5);
    cx2.strokeStyle = "rgba(55,255,208,.95)";
    cx2.lineWidth = Math.max(2.5, r*0.1);
    cx2.beginPath(); cx2.ellipse(px, py, r*pulse, r*pulse*0.94, 0, 0, 7); cx2.stroke();
    cx2.strokeStyle = "rgba(255,255,255,.5)";
    cx2.lineWidth = Math.max(1.2, r*0.035);
    cx2.beginPath(); cx2.ellipse(px, py, r*0.82, r*0.78, 0, 0, 7); cx2.stroke();
    // guide arrow if ring far off-screen center
    if(z>5){
      const dxn = px-W/2, dyn = py-H*0.55;
      if(Math.abs(dxn)>W*0.3 || Math.abs(dyn)>H*0.3){
        const ang = Math.atan2(dyn,dxn);
        const axx = W/2+Math.cos(ang)*W*0.18, ayy=H*0.5+Math.sin(ang)*H*0.16;
        cx2.fillStyle="rgba(55,255,208,.8)";
        cx2.save(); cx2.translate(axx,ayy); cx2.rotate(ang);
        cx2.beginPath(); cx2.moveTo(14,0); cx2.lineTo(-8,-8); cx2.lineTo(-8,8); cx2.closePath(); cx2.fill();
        cx2.restore();
      }
    }
    cx2.restore();
  }

  function drawJet(hy){
    const grounded = camAlt<0.5;
    const jx = W/2 + (grounded?0:jet.x*0) ;
    const jy = grounded ? H*0.86 : H*0.74 - (jet.y-1)*H*0.10;
    const s = Math.max(0.7, W/1100);
    cx2.save();
    cx2.translate(jx, jy);
    cx2.rotate(grounded?0:jet.roll);
    cx2.scale(s, s);

    // afterburner particles (behind jet = below on screen)
    for(const p of parts){
      cx2.globalAlpha = Math.max(0, 1-p.age/p.life)*0.8;
      cx2.fillStyle = p.c;
      cx2.beginPath(); cx2.arc(p.x, p.y+8, p.r*(1-p.age/p.life*0.5), 0, 7); cx2.fill();
    }
    // smoke (mayday)
    for(const sm of smoke){
      cx2.globalAlpha = Math.max(0,1-sm.age/sm.life)*0.5;
      cx2.fillStyle = "#5a6470";
      cx2.beginPath(); cx2.arc(sm.x, sm.y+6, sm.r, 0, 7); cx2.fill();
    }
    cx2.globalAlpha = 1;

    // flames
    if(throttle>0.12){
      const fl = 14 + throttle*26 + Math.random()*8;
      for(const ex of [-9, 9]){
        const g = cx2.createLinearGradient(0, 16, 0, 16+fl);
        g.addColorStop(0, "rgba(120,240,255,.95)");
        g.addColorStop(0.4, "rgba(255,157,46,.8)");
        g.addColorStop(1, "transparent");
        cx2.fillStyle = g;
        cx2.beginPath();
        cx2.moveTo(ex-5, 15); cx2.lineTo(ex+5, 15); cx2.lineTo(ex, 15+fl);
        cx2.closePath(); cx2.fill();
      }
    }

    // wings
    let wg = cx2.createLinearGradient(0,-10,0,20);
    wg.addColorStop(0,"#4c5666"); wg.addColorStop(1,"#232a36");
    cx2.fillStyle = wg;
    cx2.strokeStyle = "rgba(0,229,255,.45)"; cx2.lineWidth = 1.4;
    cx2.beginPath();
    cx2.moveTo(-92,12); cx2.lineTo(-18,-8); cx2.lineTo(18,-8); cx2.lineTo(92,12);
    cx2.lineTo(58,19); cx2.lineTo(-58,19); cx2.closePath();
    cx2.fill(); cx2.stroke();
    // wingtip lights
    cx2.fillStyle="#ff5a5a"; cx2.beginPath(); cx2.arc(-90,12,2.4,0,7); cx2.fill();
    cx2.fillStyle="#57ff8a"; cx2.beginPath(); cx2.arc(90,12,2.4,0,7); cx2.fill();

    // twin tails
    cx2.fillStyle="#39424f";
    cx2.beginPath(); cx2.moveTo(-13,0); cx2.lineTo(-26,-30); cx2.lineTo(-18,-30); cx2.lineTo(-6,-2); cx2.closePath(); cx2.fill();
    cx2.beginPath(); cx2.moveTo(13,0); cx2.lineTo(26,-30); cx2.lineTo(18,-30); cx2.lineTo(6,-2); cx2.closePath(); cx2.fill();
    cx2.fillStyle="rgba(255,179,0,.9)";
    cx2.fillRect(-25,-29,6,3); cx2.fillRect(19,-29,6,3);   // tail stripes

    // fuselage
    let fg = cx2.createLinearGradient(-16,0,16,0);
    fg.addColorStop(0,"#2b323e"); fg.addColorStop(0.5,"#5d6878"); fg.addColorStop(1,"#2b323e");
    cx2.fillStyle=fg;
    cx2.beginPath();
    cx2.moveTo(0,-34);
    cx2.quadraticCurveTo(14,-20, 15,8); cx2.quadraticCurveTo(14,17, 0,18);
    cx2.quadraticCurveTo(-14,17, -15,8); cx2.quadraticCurveTo(-14,-20, 0,-34);
    cx2.closePath(); cx2.fill();
    // canopy
    const cg = cx2.createLinearGradient(0,-26,0,-8);
    cg.addColorStop(0,"#aef3ff"); cg.addColorStop(1,"#0d7fa8");
    cx2.fillStyle=cg;
    cx2.beginPath(); cx2.ellipse(0,-18,6,9,0,0,7); cx2.fill();
    // engines
    cx2.fillStyle="#12161d";
    cx2.beginPath(); cx2.arc(-9,14,6,0,7); cx2.fill();
    cx2.beginPath(); cx2.arc(9,14,6,0,7); cx2.fill();
    cx2.strokeStyle="rgba(120,240,255,.7)"; cx2.lineWidth=1.2;
    cx2.beginPath(); cx2.arc(-9,14,6,0,7); cx2.stroke();
    cx2.beginPath(); cx2.arc(9,14,6,0,7); cx2.stroke();

    cx2.restore();
  }

  /* ---------- public API ---------- */
  return {
    init, begin, end, resize,
    phase(name, cb){ setPh(name, cb); },
    setAlert(on){ alertOn = !!on; if(!on) smoke.length = 0; },
    get currentPhase(){ return phase; },
    get misses(){ return misses; },
    set onTele(fn){ onTele = fn; },
    set onEvent(fn){ onEvent = fn; }
  };
})();
