# ✈️ Sky Commander Academy v2

A learning game wearing a flight-sim costume. Built for a young pilot who loves fighter jets,
the Indian Army, tornados, supercars and origami — and who has Grade 4 Social Studies to master.
**History is the core; the jets are the reward.**

**Just open `index.html` in any browser. No install, no internet needed.**

## 🕹️ What's inside

### Learning first
- **Kingdom Chronicles I & II** — the flagship history worlds, **unlocked from the start**:
  villages, canals & jhum farming, the Bhil tribe, settlement-location strategy, SDGs and rivers,
  the 16 Mahajanapadas, janapadas vs mahajanapadas, republics vs kingdoms, Magadha, Pataliputra,
  the Mauryan & Gupta empires — the full Grade 4 answer-key content across 29 questions.
- **Operation Time Machine & Gold Rupee** — the practice-paper questions (also unlocked from the start).
- **Reward worlds** (earned with stars from the history missions):
  ✈️ Sky Guardians (3★) · 🪖 Brave Hearts (6★) · 🌪️ Turbo Storm (9★).
- **5 question types** — MCQ, timeline ordering, expert-role matching, two-bucket era sorting,
  and a tactical **map of the Mahajanapadas** you tap.
- **Repeat-until-mastery** — every wrong answer circles back until it's answered right.
- **Command Log 📊** — a parent-readable progress screen: accuracy per topic, weakest topic first.
- **Cool mentor explanations** after every answer, right or wrong.

### The flight experience
- **Flight Mission mode**: taxi down the runway, throttle up, rotate, climb — then steer the jet
  (mouse / touch / arrow keys, with gentle auto-assist) through glowing knowledge rings.
  Each ring is a question. Land on the runway when every target is locked.
- **🚨 MAYDAY emergencies** — engine fires, bird strikes, fuel leaks! A timed review question
  (drawn from questions you got wrong) must be answered to save the jet. Bonus points for cool heads.
- **⚡ Quick Drill mode**: pure rapid-fire questions, no flight — perfect before a test.
- **7 themed flight worlds**: dawn river valley, fortress sunset, storm supercell with lightning
  and a live tornado funnel, high-altitude blue, snow-capped mountains…
- **Synthesized audio** (Web Audio, zero asset files): throttle-reactive engine, ring chimes,
  klaxons, radio blips, touchdown screech, victory fanfares.

### Progression
100 pts first-try (+streak bonuses, afterburner mode at 3🔥) · 50 pts on retry ·
3 stars for a flawless run · ranks from Cadet to Air Marshal Legend · medal locker ·
grand victory screen when every world is mastered. Progress auto-saves (localStorage).

## 🚀 Hosting on GitHub Pages (optional)

Repo → Settings → Pages → Deploy from branch → pick the branch, root folder → Save.
The game will be live at `https://<user>.github.io/weareingithub/`.

## 🔧 Dev notes
- `js/questions.js` — worlds & question bank (edit here to add content)
- `js/flight.js` — canvas 2.5D flight engine (phase machine: taxi → climb → cruise → hold → approach)
- `js/game.js` — quiz engine, mayday logic, progress log, screens
- `js/audio.js` — Web Audio synth SFX + engine loop
- Append `?fast=1` to the URL for fast phases + autopilot (used by the headless tests).
