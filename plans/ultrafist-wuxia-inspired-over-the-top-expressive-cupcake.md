# UltraFist — Implementation Plan

## Context

**UltraFist** is a browser-based, wuxia-parody kung-fu fighting game where every martial-arts trope is taken to a ridiculous extreme. It must be playable single-player vs a CPU opponent and multiplayer over LAN. The brief asks for:
- special-move combos, weird powers, extreme animations and funky sound effects;
- character customisation so players can try different builds;
- farm animals that are viable fighters alongside the human martial masters.

The project folder `C:\Data\Robert\UltraFist` is empty (no git repo), so this is a greenfield build. Tooling available: Node v24.18, npm 11, Python 3.11.

### Decisions confirmed with the user
- **Format:** 2D side-view 1v1 duel (Street Fighter style), best of 3. LAN rooms allow spectators. Local 2P on one keyboard or gamepads.
- **Art:** ink-wash cartoon, drawn entirely in code (Canvas 2D). No image or audio asset files.
- **Roster:** 8 fighters. 4 human masters, plus a Rooster, Cow, Pig and Goat, which stand upright and share the human skeleton.
- **Special-move input:** both styles. Simple input (Special + direction) always works. Classic motion inputs also work and give an **Authentic Technique** bonus.

### Game modes
- **Path of the Ultimate Fist (Arcade):** a ladder of 6 CPU fights at rising difficulty, ending in a Heavenly Demon-tier mirror match.
- **Versus CPU:** pick the opponent, difficulty and arena.
- **Local Versus:** two players on one machine.
- **LAN:** host a room, join by 4-letter code or from the room list, or spectate.
- **Training:** a dummy with settings (stand, crouch, jump, block all, CPU), a frame-data and input-history overlay, and hitbox view.
- **Build Workshop:** create, edit and save builds.
- **Settings:** controls and rebinding, key-test screen, music/SFX/voice volume, Heavenly Events frequency, quality.

---

## Game design

All tuning lives in plain JS data objects under `public/js/data/`. Numbers are at 60 fps, in world units. The stage is about 1600 units wide; at zoom 1 the camera shows about 960×540 units, rendered to a 1280×720 canvas. Zoom ranges from 0.8 to 1.3, and up to 1.7 for supers.

### Buttons and blocking
- **Inputs:** U D L R, **Light**, **Heavy**, **Special**, **Taunt**. That is 8 bits, so one byte per frame on the wire.
- **Blocking:** hold back to block, down-back to crouch-block. There is no Block button, which keeps the shared keyboard to 4 directions + 3 buttons per player and keeps high/low/overhead/cross-up mix-ups meaningful.
- **Shortcut keys** set two button bits at once, at the device layer:
  - Throw = L+H
  - Ultra = H+S
  - Qi Burst = L+S

| Action | P1 | P2 | Gamepad (standard) |
|---|---|---|---|
| Move / jump | WASD | Arrows | D-pad or stick (8-way, 0.45 dead zone); A also jumps |
| Light / Heavy / Special | J / K / L | Num1 / Num2 / Num3 | X / Y / B |
| Throw / Ultra / Qi Burst | U / I / O | Num4 / Num5 / Num6 | RB / RT / LB |
| Taunt / Pause | Y / Esc | Num+ / NumEnter | LT / Start |

- **Laptop preset without a numpad:** P1 uses WASD + F/G/H, P2 uses arrows + , . /.
- Keys are bound by `event.code` and everything can be rebound.
- A **key-test screen** reveals keys that stop registering when several are held (ghosting) and suggests gamepads.

### Specials: 5 slots, two ways to input
| Slot | Simple input | Motion input (Authentic) |
|---|---|---|
| N | S | ←↙↓↘→ + S (HCF) |
| F | → + S | ↓↘→ + S (QCF) |
| B | ← + S | ↓↙← + S (QCB) |
| U | ↑ + S (Special pressed during the 4-frame pre-jump) | →↓↘ + S (DP) |
| D | ↓ + S | ↓↓ + S |
| Ultra | H + S | ↓↘→↓↘→ + S |

- **Motion windows:** QCF/QCB 15f, DP 18f (shortcuts accepted), HCF 20f, double QCF 30f, dash tap-tap 12f.
- **Button buffer:** 8f; it pauses during hit-stop and freeze.
- **Authentic Technique bonus:** ×1.15 damage, +25% chi gain, a gold **真** seal, and a louder shout.
- **Priority on frames where the fighter can act or cancel:** Ultra → motion special → simple special → throw, Qi Burst, taunt → normals and chains → movement.

### Core combat (key numbers)
- **Health and stats**
  - HP = 850 + 30×DEF, which works out to about 940–1150.
  - Damage ×(0.80 + 0.04×POW). Walk speed 2.0 + 0.25×SPD. Chi gain ×(0.75 + 0.05×CHI).
- **Movement**
  - Dash: double-tap. Forward is 18f / 220 units. Back is 20f / 160 units with strike invulnerability on frames 1–6.
  - Jump: 4f pre-jump, vy −17, gravity 0.8, about 43f in the air.
  - Qinggong air jumps: 1 by default, each leaving an ink-cloud footprint.
  - Wall-jump: max 2 per jump.
- **Normals** (startup / active / recovery, damage)

| Move | Frames | Damage | Notes |
|---|---|---|---|
| Standing Light | 4/3/7 | 40 | |
| Standing Heavy | 8/4/16 | 90 | |
| Crouching Light | 4/2/8 | 35 | hits low |
| Crouching Heavy | 9/4/20 | 80 | launcher, jump-cancel on hit |
| Jumping Light | 5/6 | 45 | |
| Jumping Heavy | 8/5 | 85 | overhead; spikes airborne opponents |

- **Chains and cancels**
  - Ground: L→L→L → H → Special → Ultra. Air: j.L → j.L → j.H → air special.
  - The cancel window is the hit-stop plus 8f, on hit or on block.
  - **Chi Cancel** (special into special) costs 1 bar.
- **Throws**
  - L+H: 5f startup, range 110, 120 damage. Teched with L+H within 8f, which shows **解**.
  - Air throw: 100 damage.
- **Chip and guard**
  - Chip: specials 20%, ultras 25%. Only ultra chip can KO.
  - Guard bar = 70 + 6×DEF. When it breaks, **破** appears and the victim is stunned for 50f.
- **Juggles**
  - Each move has a juggle cost; the limit is 10. Past it, the victim flips out with 12f of invulnerability.
  - Juggled fighters fall faster: gravity ×(1 + 0.07 per juggle hit).
  - Max 1 wall-bounce and 1 ground-bounce per combo.
- **Damage scaling and counter-hits**
  - From hit 3 on, −10% per hit, down to a floor of 30% (ultras floor at 50%).
  - Using the same move a 3rd time in one combo: ×0.5.
  - Counter-hit: ×1.2 damage and +4 hit-stop, shows **反**.
- **Hit-stop and screen shake**
  - Hit-stop: light 6f, heavy 10f, special 12f, block 4f, last hit of an ultra 30f.
  - KO: 45f hit-stop, then 0.25× slow motion for 60f.
  - Shake: 2 / 6 / 10 / 16 px for light / heavy / special / ultra.
- **Chi meter:** 3 bars × 100, carried over between rounds.
  - Gained from dealing damage (×0.10), taking damage (×0.07), blocking, walking forward, and taunting (+30, at most once per 8s; a hit during a taunt is a ×1.5 counter-hit).
  - Costs: Chi Cancel 100, **Qi Burst** 200 (invulnerable combo-breaker shockwave, used during hitstun or blockstun), **Ultra** 300.
- **Clashes**
  - Normal vs normal: "Clink", both pushed back.
  - Special vs special: a **Beam Struggle 氣** (projectiles) or **Palm Clash 掌** (physical).
    - A 180f mash-off on a tug value from −50 to +50. Alternating L and H counts double; spending a bar gives a surge.
    - The winner's move lands at ×1.5 damage.
  - Ultra vs ultra: **Heaven-Splitting Clash**, 300f, winner deals ×1.75.
  - Deterministic from inputs alone, so it is safe for LAN.
- **Final Awakening 覺醒:** once per round, it triggers automatically below 25% HP.
  - A 40f invulnerable burst and +1 bar of chi.
  - For 10s: ×1.15 damage, +1 air jump, and the Ultra costs only 2 bars.
  - White spiky hair and a flame aura.
- **Rounds**
  - Best of 3, 99s timer. If time runs out, the higher HP% wins.
  - If the match is still tied after a draw, **Sudden Death**: 1 HP each, with Ancestors Watching forced on.
  - A perfect round shows "FLAWLESS LOTUS 蓮".
- **KO outcomes** depend on the final hit:
  - Ultra KO → the scene becomes an **Ink Scroll** stamped with **勝/敗** seals.
  - Launched upward → **Twinkle Star**: the loser shrinks into the sky with a "ding".
  - Wall-bounce → **Scenery Crash**.
  - Otherwise, the character's **signature KO**, e.g. Rooster explodes into feathers, Pig deflates like a balloon, Goat faints rigid.
  - Time-out loser bows under the word "DISHONOR".

### Roster
Base stats are POW / SPD / DEF / CHI on a 1–10 scale, and every character's total is 24.

Fairness rules every character follows:
- an invulnerable reversal of 6f or faster (U slot by default);
- an answer to projectiles;
- a way to build chi;
- animals' hurtboxes are at most 1.15× the humans'.

| Character | Archetype | P/S/D/C | Movement trait |
|---|---|---|---|
| **Grandmaster Long Xu 龍鬚** ("Dragon Whiskers") | zoner; beard is a weapon | 5/3/6/10 | teleport-shuffle dash with afterimage |
| **Lady Wai-Ya 飛劍** ("the Visibly Suspended Sword") | wire-fu aerial rushdown | 5/9/3/7 | 2 air jumps, air dash, hover; the wire to the ceiling is visible |
| **Uncle Jiu-Gui 酒鬼** ("the Staggering Sage") | drunken fist, gets stronger | 6/5/6/7 | drunk level 0–5: +6% damage per level, random lurches; passes out at 6 |
| **Brother Da Zhong 大鐘** ("the Unbreakable Bell") | iron-body grappler | 9/2/10/3 | absorbs 1 light hit when walking forward; landing makes a ground ripple |
| **General Ji Dao 雞道** (Rooster) | aerial speedster | 4/10/3/7 | 3 wing-flap air jumps, 8-way air dash, glide |
| **Madame Moo-Lan 牛蘭** (Cow) | tank, long range | 8/3/9/4 | Stampede Run (dash into a run that absorbs a hit); no pushback on block |
| **Sifu Ham Fu 豬** (Pig) | trickster, controls the stage | 6/6/7/5 | Belly Bounce chains off landings; crouch-roll goes under high attacks |
| **Shan Yang 山羊** (Goat) | wall control, mix-ups | 7/7/5/5 | clings to and climbs walls, unlimited wall-jumps |

**Specials (default slots N / F / B / U / D) and the two Ultras (the build picks one)**
- **Long Xu**
  - N Elder's Lecture: a slow "IN MY DAY…" scroll projectile.
  - F Beard Lash: a 340-unit whip.
  - B Hair Net: anti-air catch.
  - U Whisker Copter: spins his beard into a rotor; invulnerable reversal.
  - D Ancient Nap: dozes off; if hit, teleports behind the attacker for a Snore Palm.
  - Ultras: *Ten-Thousand Strand Tempest* / *Reverse Aging* (becomes a muscular 25-year-old for 8s).
- **Wai-Ya**
  - N Petal Rain Dive.
  - F Flying Sword Barrage (also in the air).
  - B Silk Sleeve Rebuff (reflect).
  - U Wire Yank: an offscreen stagehand yanks her up.
  - D Bamboo-Tip Stand: balances on the opponent's head.
  - Ultras: *Ten Thousand Swords Return to the Sect* / *Stagehand Union Strike*.
- **Jiu-Gui**
  - N Drunken Flop.
  - F Eight Immortals Stagger.
  - B Spit Take: a wine spray, fire breath at drunk level 3+.
  - U Hiccup Uppercut.
  - D Take a Swig: +1 drunk level and some chi.
  - Ultras: *Eight Immortals Cross the Sea of Wine* (surfs a wine tsunami) / *Last Call*.
- **Da Zhong**
  - N Arhat Suplex: command grab; the stage flips upside down.
  - F Eighteen Bronze Men Rush.
  - B One-Finger Push-Up Splash.
  - U Prayer Bead Lasso.
  - D Golden Bell Cover: becomes an actual bronze bell.
  - Ultras: *Buddha's Palm from Heaven* (a screen-sized palm) / *Thirty-Six Chambers Piledriver* (up through 36 temple floors).
- **Ji Dao**
  - N Cockfight Fury: a 12-peck flurry.
  - F Egg Grenade: leaves a slippery yolk puddle.
  - B Feather Dart Volley.
  - U Talon Tornado.
  - D Dawn Crow: a sonic ring that destroys projectiles and turns the background to sunrise.
  - Ultras: *Phoenix Reborn from the Egg* (his next KO turns him into an egg; if it survives he hatches with 30% HP) / *Sunrise Wing Inferno* (becomes the sun).
- **Moo-Lan**
  - N Milk Beam: chargeable.
  - F Spirit Stampede: ghost cows.
  - B Cowbell Counter: parry.
  - U Horn Toss: launcher.
  - D Chew the Cud: heals; 4 uses (four stomachs).
  - Ultras: *Over the Moon* (literally jumps the moon) / *Ten Thousand Head Stampede* (tramples the HUD).
- **Ham Fu**
  - N Hogwash Cyclone: pulls the opponent in.
  - F Mud Roll: leaves a trail that slows.
  - B Lard Slick: frictionless floor that Ham Fu is immune to.
  - U Truffle Uppercut: longest invulnerability in the game, very unsafe.
  - D Belly Bounce Cannon: reflects projectiles.
  - Ultras: *When Pigs Fly* (a body slam from orbit) / *Eight Treasures Banquet* (grows to 2× size).
- **Shan Yang**
  - N Eat Anything: command grab that eats chi and the opponent's hat.
  - F Ram Headbutt: chargeable, wall-bounces.
  - B Goat Scream: a sonic cone that stuns.
  - U Cliffside Leap.
  - D Fainting Goat: goes rigid; if struck, springs up with a counter kick.
  - Ultras: *Scream of a Thousand Peaks* (the mountains scream too) / *G.O.A.T. Ascension*.

**Frame rules for all specials**
- Projectiles: 13f startup, 35f recovery.
- Reversals: −24 on block.
- Ultras: a 90f cut-in that freezes the opponent; 350–480 damage, or 50–80 on activation for transformation ultras.

**Per-character flavour**
- A taunt with a gag, e.g. Rooster lays an egg and is confused (he's a rooster); the egg can be kicked as a projectile.
- A victory quote, e.g. Moo-Lan: "Udderly outclassed."
- A synthesized signature voice.

### Builds (customisation)
- **Budget:** 10 **Gong 功** points per build.
- **Stance** (pick 1, free):

| Stance | Benefit | Drawback |
|---|---|---|
| Tiger 虎 | stronger heavies | slower lights |
| Crane 鶴 | +1 air jump, bigger air hitboxes | weaker ground heavies |
| Mantis 螳螂 | 5-hit light chains, stronger counter-hits | weaker heavies |
| Snake 蛇 | longer, faster crouching attacks | weaker standing guard |
| Monkey 猴 | dash 30% faster, can cross up, quick taunt | DEF −1 |
| Iron 鐵 | Standing Heavy absorbs a hit, half chip damage | slower walk, no air jump |

- **Inner Arts** (up to 2, cost 1–4 each):
  - Iron Shirt, Lightness Skill, Vampiric Chi, Hundred-Year Grudge, Bottomless Gourd.
  - Thousand-Hand Afterimage, Poison Palm, Meridian Lock, Second Wind, Golden Bell Reflex (just-defend), Burning Blood.
  - Each is implemented as hooks (`onHit`, `onBlock`, `onDamaged`, `perFrame`, `modifyStats`).
- **Special slots:**
  - Each of the 5 slots holds one of the character's own specials (free) or a universal **Forbidden Scroll** (1–3 Gong): Lazy Dragon Palm, Shadowless Kick, Lion's Roar, Cloud Step, Falling Star Fist, Ink Clone, Seven-Step Doom Palm, Tea Break, Pressure Point.
  - The motion input follows the slot.
- **Ultra:** pick 1 of the character's 2.
- **Stats:**
  - Move up to 3 points between stats for free; each stat must stay between 2 and 10.
  - Extra points cost 2 Gong each, max +2.
  - Leftover Gong becomes starting chi (+15 per point).
- **Cosmetics** (render-only):
  - 2 colours from 12 ink-friendly presets.
  - Headgear: straw hat, topknot, bandana, monk beads, scholar hat, chopstick crown, teacup hat, bucket…
  - Aura colour (or rainbow).
  - A battle cry of up to 24 characters, spoken at round start.
- **Presets:** 2 per character (16 total), e.g. Moo-Lan "Dairy Fortress" and "Stampede Season". All cost 8 Gong or less.
- **Storage and validation:**
  - Builds are saved in localStorage under `ultrafist.builds.v1`.
  - `resolveBuild()` validates and clamps a build, and an invalid one falls back to a preset.
  - The LAN server re-validates every build.

### Arenas and Heavenly Events
- **4 core arenas**, each with hazards:
  1. **Whispering Bamboo Forest 竹林:** poles you can wall-jump off; heavy hits fell a stalk on whoever is underneath.
  2. **Temple Rooftop at Midnight 屋頂:** slippery tiles; lanterns that leave fire patches.
  3. **Drunken Lotus Tea House 茶樓:** tables that flip into debris; a waiter carrying scalding tea crosses every 20s.
  4. **Barnyard at Dawn 農場:** hay bales that stop projectiles; chickens running across (kick one for chi).
- **Stretch:**
  - 2 more arenas: **Waterfall Peak 瀑布** (ends in a falling duel) and **Jade Emperor's Cloud Court 天庭** (low gravity, drifting cloud platform).
  - **Stage transitions:** a scenery-crash KO sends the next round to an area behind the arena (Hall of a Thousand Buddhas, Kitchen, Pigpen…).
- **Heavenly Events:**
  - One triggers every 25–40s and lasts 10s, announced with a gong and an unrolling scroll.
  - Driven by the seeded RNG, so they are identical on LAN.
  - Frequency setting: Off, Rare, Normal, Chaos.

| Event | Effect |
|---|---|
| 月 Moon Festival | half gravity |
| 茶 Rain of Tea | heals anyone not attacking |
| 祖 Ancestors Watching | double damage |
| 龍 Dragon Flyover | a warning shadow, then a damaging sweep |
| 福 Fortune Cookie Storm | pickups fall: chi orb, peach (heal), chilli (speed) |
| 龜 Turtle Time | 0.6× game speed |
| 鬼 Hungry Ghosts | lights out; only silhouettes and sparks are visible |
| 令 Emperor's Decree | the next hit is a guaranteed counter-hit and gives +100 chi |

### CPU AI
- **5 tiers:**

| Tier | Reaction | Block |
|---|---|---|
| Humble Disciple 弟子 | 30f | 20% |
| Wandering Swordsman 遊俠 | 22f | 40% |
| Sect Elder 長老 | 16f | 60% |
| Hidden Grandmaster 隱世高手 | 12f | 75% |
| Heavenly Demon 天魔 | 8f | 88% |

  Each tier also scales its anti-air and punish chances, combo length, use of motion inputs (0–100%) and clash mash rate.
- **Same inputs as a player:** the AI outputs the same input byte, so it goes through the same buffer, motion parser and rules.
- **Delayed view:** it reacts to observations it records itself, delayed by its reaction time. This history lives in the AI controller object, not in the sim state.
- **Decision loop:** every 20f (tier 1) down to every 6f (tier 5), it picks the highest-scoring goal:
  - NEUTRAL: keeps its preferred distance (zoner, rushdown or grappler).
  - ANTI_AIR.
  - DEFEND: blocks high or low from the attack's hit level; Qi Burst at tier 4+.
  - PUNISH.
  - OKI: attacks timed to hit as the opponent stands up.
- **Combo routes** are data, e.g. `{opener:'cL', seq:['cL','sL','sH','S:F'], range:[0,110]}`.
- **Habit reading:** tier 5 tracks how often the opponent jumps, what they do on wakeup, and whether they block high or low.
- **Personality per character**, e.g. Jiu-Gui drinks at range, Ham Fu greases the floor early, Ji Dao stays airborne 60% of the time.
- **Randomness:** a separate seeded RNG, so AI matches are reproducible.

### Juice (visual-only, render side)
| Event | Effects |
|---|---|
| Light hit | ink droplets + spark, 2px shake |
| Heavy hit | ink splat decal + speed lines, 6px shake + zoom punch |
| Counter-hit | red flash + **反** |
| Block | blue ink ring |
| Guard break | ink shatters like glass + **破** |
| Dash / jump | afterimages / ink-cloud footprints |
| Special | 6f background darken + brush-font move name + element glyph (拳 fist, 氣 qi, 劍 sword, 龍 dragon) |
| Ultra | 90f cut-in: red sun, ink band, close-up on the eyes, world desaturates, **極** |
| Wall / ground bounce | crack decals |
| Clash | diagonal split screen + "MASH!" + **鬥** |
| KO | colour drains from everything but the fighters, slow-mo, **勝/敗** seals |

- **Combo counter titles** escalate in size, shake and colour (ink → red → gold → rainbow), each with a pentatonic flourish:

| Hits | Title |
|---|---|
| 3 | Good Form 好 |
| 5 | Skilled 妙 |
| 10 | HEAVENLY 天 |
| 15 | SAGE 聖 |
| 20 | GRANDMASTER 宗 |
| 30 | UNBELIEVABLE KUNG FU 神 |
| 40 | FORBIDDEN TECHNIQUE 禁 |
| 50 | ANCESTORS WEEP 泣 |
| 75 | THE SCROLLS WERE TRUE 經 |
| 100 | ASCENDED 仙 |

- **Fonts:** calligraphy uses `KaiTi, STKaiti, "Microsoft YaHei", serif`; Latin display text uses `Impact, "Arial Black"`.

---

## Architecture

### Tech stack
- **Code:** vanilla JavaScript ES modules, no build step, **zero npm dependencies**. `package.json` has `"type":"module"`, `start` = `node server.js` and `test` = `node --test`.
- **Server:** a single `node server.js` does three jobs:
  - serves `public/` over HTTP;
  - hosts LAN rooms over a hand-rolled RFC 6455 WebSocket on the HTTP `upgrade` event;
  - prints a `http://<LAN-IP>:PORT` URL for each network adapter, skipping vEthernet/WSL adapters.

  `PORT` comes from an env var, default 3000.
- **Rendering and timing:** Canvas 2D with a fixed 1280×720 backing store, letterboxed. The sim runs at a fixed 60 Hz: a fixed-step accumulator in the browser, and on the server a loop that checks the clock and catches up on missed frames (at most 5 at once), because Windows timers are coarse.

### Core principle: one pure simulation, many hosts
`public/js/sim/` is **pure**: no DOM, `Date`, `performance` or `Math.random`; a seeded RNG (mulberry32) kept in the state; fixed iteration order.
- **Who runs it:** the browser offline (vs CPU, local, training), the Node server as the LAN authority, and `tools/replay.js` and `tools/soak.js` headlessly.
- **Inside the sim:** motion-input parsing, using the authoritative facing so cross-ups don't break motions online. Gameplay timing also lives here: hit-stop, super freeze, KO slow-mo, clash timers.
- **Outside the sim:** everything purely visual lives in `render/` and never touches the sim: shake, zoom, particles, afterimages, calligraphy.

### Directory layout
```
server.js                 http + static + upgrade→ws; prints LAN URLs
package.json  README.md   (README: how to play, controls, LAN setup incl. Windows Firewall "Private network")
.claude/launch.json       preview config: node server.js on port 3000
server/static.js          GET-only from public/, MIME map, path-traversal guard, Cache-Control: no-store
server/ws.js              RFC 6455 handshake, incremental frame parser/writer, ping/pong, close, setNoDelay(true)
server/rooms.js           4-letter codes, 2 seats + spectators, phases lobby→select→countdown→match→results
server/match-host.js      per-room tick: input queues → sim.step → pack once → broadcast same string
public/index.html, style.css
public/js/main.js         boot, scene stack, rAF + fixed-step accumulator
public/js/shared/protocol.js   message types + protocol version (server imports it too)
public/js/sim/            index.js (createMatch, step) · rng.js · input.js (history, motion parser, priority)
                          fighter.js (state table) · moves.js (move runner, cancels, spawns, ultra scripts)
                          combat.js (hits, block, guard, scaling, juggle, chi, clash, awakening)
                          physics.js · projectiles.js · stage.js (hazards) · events.js (Heavenly Events)
                          rounds.js · builds.js (resolveBuild) · arts.js (inner-art hooks) · ai.js · pack.js
public/js/data/           skeleton.js · rules.js · characters/{index + 8 files} · stances.js · innerArts.js
                          scrolls.js · presets.js · cosmetics.js · stages.js · heavenlyEvents.js · aiTiers.js
public/js/input/          keyboard.js · gamepad.js · bindings.js · devices.js (device→seat, SOCD, shortcut chords)
public/js/render/         renderer.js · camera.js · pose.js (FK + keyframes) · anims/<char>.js · skins/<char>.js
                          brush.js (prebaked ink textures, tapered strokes) · stages/<stage>.js · fx.js
                          calligraphy.js · hud.js · cutin.js · ko.js · debug.js
public/js/audio/          audio.js (unlock, buses, compressor) · sfx.js · voices.js (animal synths) · music.js · speech.js
public/js/net/client.js   ws wrapper, ping, 2-frame snapshot buffer + interpolation, fires each frame's events once
public/js/ui/             title · modeSelect · charSelect · buildEditor · lobby · training · results · settings
                          keyTest · buildStore.js
public/dev/anim.html      frame-by-frame pose + hitbox viewer for authoring characters
test/*.test.js            see Verification
tools/replay.js · tools/soak.js
```

### Sim state (plain and serializable)
```js
{ v, frame, rng, cfg:{stageId, winsNeeded:2, timer:99, events:'normal'},
  phase:'intro'|'fight'|'ko'|'roundEnd'|'matchEnd', phaseT, round, wins:[0,0], timer,
  hitstop, freeze:{t,by}, slow:{t,div}, clash:null|{kind,t,tug}, heavenly:null|{id,t}, nextEventAt,
  stage:{id,left,right,hazards:[...]}, projectiles:[...], pickups:[...], nextId,
  fighters:[{ side, charId, stats, arts, stance, loadout:{N,F,B,U,D,ultra}, cos,
     x,y,vx,vy,facing,hp,chi,guard, st,stT, move:{id,f,hit,blocked,bonus,hitIds}|null,
     stun, juggle, bounces, combo:{n,dmg,scale,used}, inv, armor, grab, buffs:[{id,t}], airJumps,
     awakened, inp:{hist[32],head,buf}, char:{} /* drunk level, egg life, cud uses… */ }],
  events:[] }  // cleared each step: hit, block, shout, sfx, spawn, ko, clash, glyph…
```

### Fighter state machine and data-driven moves
- **How states work:** `STATES[name] = {tick, actionable, hurt}`, and the only way to change state is `setState()`.
- **States:** idle, walk, crouch, dash, jumpSquat, air, landing, attack, hitstun, blockstun, launched, wallBounce, groundBounce, knockdown, wakeup, grabbed, taunt, guardBroken, ultraVictim, egg, ko.
- **Moves are data:** startup/active/recovery, per-frame hitboxes, hurtbox extensions, velocity scripts, invulnerability or armour windows, projectile spawns, `onHit` (launch, wallBounce, groundBounce, status effects), cancel rules, juggle cost, `shout`, `glyph`.
- **Hurtboxes** are authored per stance and per move, never derived from the skeleton.
- **Ultras** are scripted sequences: frame → {hits, positions, camera cue, background cue}. A per-ultra render overlay provides the spectacle (moon, 36 floors, sky of swords).
- **Character-specific mechanics** (drunk level, egg life, stomachs, Belly Bounce) are hook functions in each character's data file, run by the move runner.

### LAN networking (server-authoritative)
- **Messages:** JSON text, types defined in `shared/protocol.js`.
  - Client to server: `hello`, `list`, `create`, `join{code,role}`, `pick{charId,build}`, `ready`, `i{f,b}` (input every frame), `rematch`, `leave`, `ping`.
  - Server to client: `welcome{id,token}`, `rooms`, `room`, `start{seed,cfg,resolvedBuilds}`, `s:[frame,packed,events]`, `end`, `pong`, `err`.
- **Input queue:** each player's queue is capped at 4. On overflow the oldest input is dropped but its button bits are ORed into the next, so no press is lost. If the queue is empty, the last input is repeated.
- **Snapshots:** full, as quantized-integer positional arrays, about 500 B each, or roughly 35 KB/s per client. No deltas, so spectators can join mid-match. Clients render 2 frames behind the newest snapshot, with interpolation.
- **Disconnects:** the match pauses, and the player has 15 s to rejoin by token (stored in localStorage) or forfeits. WS ping every 5 s; a client is dropped after 15 s of silence. Ping is shown in the HUD.

### Rendering
- **Draw path:** `draw(view, prevView, alpha, fx)`. The view is the live sim state offline (read-only) or the unpacked snapshot online. A pack round-trip test keeps both shapes identical.
- **Layers:**
  1. Paper texture
  2. Parallax backgrounds
  3. Floor and hazards
  4. Shadows
  5. Afterimages
  6. Fighters (attacker on top)
  7. Projectiles
  8. Ink particles (pool of 400)
  9. World calligraphy
  10. Screen-space darken and cut-in
  11. HUD
  12. F1 debug overlay
- **Camera:** tracks the midpoint between fighters, zooming with their distance (0.8–1.3). It lifts when a fighter is airborne, punches in to 1.7× on super freeze and on the KO victim, and shakes using a render-only RNG.
- **Characters:**
  - Pose keyframes are indexed by move frame, so the visuals always match the frame data.
  - Forward kinematics feeds `skins/<char>.js`, which draws tapered brush-stroke limbs with per-bone seeded outline jitter.
  - Animals use the same skeleton with their own skins: wings with feather fingers, hooves and horns, snout and belly, beard and horns.
- **Palette:** cream paper `#f3ead7`, ink black, cinnabar seal red `#c8102e`, gold for Authentic and Ultra effects, plus the 2 cosmetic colours.
- **Performance:** no `shadowBlur` or `ctx.filter` in hot paths; textures prebaked to OffscreenCanvas; a low-quality setting.

### Audio (all synthesized)
- **Setup:** Web Audio is unlocked by the first key or click on the "Press any key" screen. A master compressor sits on separate SFX, music and voice buses.
- **SFX:**
  - Hits: a noise burst plus a sine thump, scaled by hit level.
  - Whooshes: bandpassed noise sweeps.
  - Gong: inharmonic sines with a 3s decay.
  - Wire twang: Karplus-Strong pluck.
  - Animal voices:
    - Moo: sawtooth through a formant filter with a pitch bend.
    - Crow: frequency-modulated sawtooth.
    - Oink: square-wave pulses.
    - Goat scream: detuned sawtooths, vibrato and distortion.
- **Music:** procedural pentatonic loops: an erhu-like lead, guzheng-style plucks and taiko drums, with an intensity layer that comes in at low HP.
- **Speech:**
  - `speechSynthesis` voices the announcer and the shouted move names, with a pitch per character (e.g. Da Zhong 0.3, Ji Dao 1.8).
  - Each new shout cancels any shout still playing, and each side can shout at most once every 1.5s. If no voice is available it stays silent.
  - On-screen calligraphy always shows the same words.

---

## Milestones (build order)

LAN comes in early, while the sim is still small enough that network bugs are cheap to fix. Each milestone ends with its checks passing.

| # | Milestone | Done when |
|---|---|---|
| M0 | **Scaffold:** package.json, static server with LAN URLs, canvas + game loop, `.claude/launch.json`, test harness | `npm start` serves the page on localhost and the LAN IP |
| M1 | **Sim core:** physics, normals, hit/block/stun, rounds and timer, KO, placeholder box renderer, local 2P | purity, determinism and combat tests pass; two players can fight with boxes |
| M2 | **Input:** history ring, motion parser, 8f buffer, priority, shortcut chords, SOCD, gamepad | motion-parser table tests pass (accept, too slow, DP beats QCF, crossed sides, buffer during hit-stop) |
| M3 | **Ink look:** skeleton, FK, brush skins, camera, HUD, hit-stop, shake, particles, calligraphy, anim viewer. First 2 fighters: **Ji Dao** (Rooster) + **Long Xu** | both fighters animate correctly in the browser and in `dev/anim.html` |
| M4 | **Combat depth:** projectiles, juggles, bounces, knockdown/wakeup, throws, guard bar, chi, Qi Burst, Chi Cancel, Awakening, ultra script + cut-in, clashes, KO outcomes | combat tests (scaling floor, juggle limit, chip KO rule, clash determinism); play-test |
| M5 | **Audio:** SFX, animal voices, music, speech, settings toggles | listen-test in the browser, no errors in the console |
| M6 | **CPU AI + menus:** 5 tiers, title screen, mode select, character select, Versus CPU, Arcade ladder, Training, results | `tools/soak.js` AI-vs-AI runs: no NaN, fighters stay in bounds, every match ends |
| M7 | **LAN:** ws.js, rooms, match-host, net client, lobby UI, spectators, ping, rejoin/forfeit | ws framing tests + LAN integration test; two browser tabs + a spectator tab play a match |
| M8 | **Builds:** stances, inner arts, scrolls, `resolveBuild`, Build Workshop UI, 16 presets, cosmetics, localStorage | build validation tests (presets within budget, clamping); builds change play in the browser |
| M9 | **Rest of roster:** Wai-Ya, Jiu-Gui, Da Zhong, Moo-Lan, Ham Fu, Shan Yang | character data tests; soak win rates within 35–65% per pair |
| M10 | **Arenas + Heavenly Events:** 4 core arenas with hazards, 8 events, frequency setting | hazard and event tests (seeded, identical on replay); visual check |
| M11 | **Polish / stretch:** stage transitions, Waterfall Peak and Cloud Court, rebinding UI, key-test screen, quality setting, balance pass, README | final end-to-end check (below) |

## Verification

**Automated (`npm test` → `node --test`)**
- **Sim purity:** greps `sim/` for `document`, `window`, `Math.random`, `Date`, `performance` and any `render/` import. Importing the sim in Node proves it runs headless.
- **Determinism:** the same seed and input log produce the same state hash after N frames. The pack/unpack round trip loses nothing.
- **Motion parser:** table-driven cases.
- **Combat rules:** block high/low/overhead, chip can't KO except ultra, scaling floors, juggle limit flip-out, wall/ground bounce limits, throw tech, guard break, Awakening triggers once per round.
- **Build validation:** budget, clamps, invalid falls back to a preset, the server rejects tampered builds.
- **Character data integrity:** hitboxes inside active frames, all 5 slots plus 2 ultras exist, the fairness rules hold (a reversal of 6f or faster).
- **WebSocket framing:** frames split byte by byte and concatenated, 16- and 64-bit lengths, masking, ping/pong, close.
- **LAN integration:** a server on port 0 with Node 24's built-in `WebSocket` client: create → join → pick → ready → snapshots arrive → spectator joins mid-match → a disconnect leads to forfeit after the timeout.
- **AI soak:** `tools/soak.js` runs every character pair × several seeds and reports win rates and invariant violations.

**Manual / in-app**
1. Start the server with `preview_start` (from `.claude/launch.json`). In the browser pane, play vs CPU at several tiers, check the console for errors, and confirm effects, cut-ins, combo titles and KO outcomes.
2. Training mode with the F1 overlay: confirm that motion inputs give the Authentic bonus, that simple inputs work, and that frame data matches the data files.
3. Open two tabs on the LAN URL and play a full best-of-3. Add a third tab as a spectator. Close one player tab mid-match and confirm the pause, the rejoin and the forfeit.
4. Ask the user to open the printed LAN URL on a second PC or a phone, to confirm it is reachable through the Windows Firewall.
5. Build Workshop: create a build, save it, reload the page, and confirm it persisted and changes play (stance, arts, scroll in a slot, chosen ultra).
