# UltraFist 極拳

A wuxia-parody, over-the-top kung-fu fighting game for the browser. Beard whips, wire-fu, drunken fists,
an iron-body monk — and a rooster, a cow, a pig and a goat who all take martial arts extremely seriously.

Play against the CPU, against a friend on the same keyboard, or over your local network. Everything —
characters, arenas, effects, music, sound and voices — is drawn and synthesized in code. No assets, no
dependencies, no build step.

## Quick start

Requires [Node.js](https://nodejs.org/) 20 or newer (tested on 24).

```bash
npm start
```

Then open **http://localhost:3000**. There is nothing to install: the project has zero npm dependencies.

> The game must be served by `npm start` (ES modules don't load from `file://`).

## LAN multiplayer

1. One person runs `npm start`. The server prints the addresses to share, e.g.
   `LAN players: http://192.168.1.23:3000 (Wi-Fi)`.
2. Everyone (including the host) opens that address in a browser and picks **LAN Battle**.
3. One player **creates a room** and shares the 4-letter code; the other **joins** it. Anyone else can
   **watch** — spectators can join mid-match.
4. Pick fighters and builds, press **READY**. The host chooses the arena, the Heavenly Event frequency and whether
   stage transitions are on.

The server is authoritative: it runs the same simulation as the browser and streams the fight to every
player and spectator, so everyone always sees the same match. If a player drops, the match pauses for
15 seconds so they can reconnect (just reload the page); otherwise they forfeit.

**Friends can't connect?** The first time Node listens on the network, Windows asks whether to allow it —
allow **Private networks**. Also make sure your Wi-Fi/Ethernet network profile is set to *Private*, not
*Public*. To use another port: `PORT=3001 npm start` (Git Bash) or `$env:PORT=3001; npm start` (PowerShell).

## Modes

| Mode | |
|---|---|
| Path of the Ultimate Fist | Arcade ladder: six CPU masters of rising skill, then your own shadow as the Heavenly Demon |
| Versus CPU | Pick your fighter, your opponent, the arena and one of five difficulty tiers |
| Local Versus | Two players on one machine (keyboard and/or gamepads) |
| LAN Battle | Host, join or spectate over your local network |
| Training Dojo | Hitboxes (F1), frame data, input log, configurable dummy, infinite timer |
| Build Workshop | Create and save custom builds |

## Controls

| Action | Player 1 | Player 2 | Gamepad |
|---|---|---|---|
| Move / Jump / Crouch | W A S D | Arrows | D-pad / left stick, A jumps |
| Light / Heavy / Special | J / K / L | Num1 / Num2 / Num3 | X / Y / B |
| Throw (L+H) | U | Num4 | RB |
| Ultra (H+S) | I | Num5 | RT |
| Qi Burst (L+S) | O | Num6 | LB |
| Taunt | Y | Num+ | LT |
| Pause | Esc | NumEnter | Start |

No numpad? Pick the **Laptop** layout in Settings, or rebind every key. The **Key Test** screen shows whether
your keyboard drops keys when several are held (common on cheap keyboards — gamepads don't).

### Two ways to do specials

Every fighter has five special slots and an Ultra:

| Slot | Simple input | Authentic Technique (+15% damage, +25% chi) |
|---|---|---|
| N | Special | ←↙↓↘→ + Special |
| F | → + Special | ↓↘→ + Special |
| B | ← + Special | ↓↙← + Special |
| U | ↑ + Special | →↓↘ + Special |
| D | ↓ + Special | ↓↓ + Special |
| Ultra (3 chi bars) | Heavy + Special | ↓↘→↓↘→ + Special |

Simple inputs always work. Classic motions earn a gold 真 seal and extra damage.

### The essentials

- **Block** by holding back (down-back for lows). Jump attacks and overheads must be blocked standing.
- **Chains:** Light → Light → Light → Heavy → Special → Ultra. ↓+Heavy launches; hold ↑ to jump after it.
- **Chi** (3 bars): Chi Cancel one special into another (1 bar), Qi Burst out of a combo (2), Ultra (3).
- **Guard bar:** blocking drains it; when it breaks (破) you're dizzy.
- **Throws** (L+H) can be broken by pressing L+H as you're grabbed (解).
- **Final Awakening 覺醒:** once per round below 25% HP — more damage, an extra air jump, cheaper Ultra.
- **Clashes:** when specials collide, a Beam Struggle / Palm Clash starts — mash, alternating Light and Heavy.
- **KO finishes:** sent to the heavens as a twinkling star, through the scenery, into a crater, a painted
  ink scroll for Ultra KOs, or the loser's own signature humiliation.

## The roster

| Fighter | Style | Ultras |
|---|---|---|
| **Grandmaster Long Xu** 龍鬚 | Zoner whose beard is a weapon | Ten-Thousand Strand Tempest · Reverse Aging |
| **Lady Wai-Ya** 飛劍 | Wire-fu aerial rushdown (the wire is very visible) | Ten Thousand Swords · Stagehand Union Strike |
| **Uncle Jiu-Gui** 酒鬼 | Drunken fist — stronger with every swig, passes out at six | Sea of Wine · Last Call |
| **Brother Da Zhong** 大鐘 | Armored grappler; becomes an actual bell | Buddha's Palm from Heaven · Thirty-Six Chambers Piledriver |
| **General Ji Dao** 雞道 🐓 | Aerial speedster; eggs; resurrects from an egg | Phoenix Reborn · Sunrise Wing Inferno |
| **Madame Moo-Lan** 牛蘭 🐄 | Tank with dairy artillery | Over the Moon · Ten Thousand Head Stampede |
| **Sifu Ham Fu** 豬 🐖 | Trickster: mud, lard floors, belly bounces | When Pigs Fly · Eight Treasures Banquet |
| **Shan Yang** 山羊 🐐 | Wall-climbing mix-ups and a terrible scream | Scream of a Thousand Peaks · G.O.A.T. Ascension |

The How to Play screen and the pause menu show full move lists.

## Builds

Each build has a **10 Gong (功)** budget:

- **Stance** (free): Tiger, Crane, Mantis, Snake, Monkey or Iron — each with a benefit and a drawback.
- **Inner Arts** (up to 2, 1–4 Gong): Iron Shirt, Lightness Skill, Vampiric Chi, Poison Palm, Thousand-Hand
  Afterimage, Golden Bell Reflex and more.
- **Special slots:** swap in universal **Forbidden Scrolls** (1–3 Gong) such as Lion's Roar, Cloud Step,
  Seven-Step Doom Palm or Tea Break.
- **Ultra:** pick one of two.
- **Stats:** move up to 3 points between POW/SPD/DEF/CHI for free, or buy up to 2 bonus points.
- Unspent Gong becomes starting chi. Cosmetics (colours, headgear, aura, battle cry) are free.

Builds are saved in the browser (localStorage). The LAN server re-validates every build, so tampered builds
are clamped back to legal values.

## Arenas and Heavenly Events

Bamboo Forest (falling bamboo), Temple Rooftop (slippery tiles, burning lanterns), Tea House (a waiter with
scalding tea, table smashes), Barnyard (hay bales, kickable chickens), Waterfall Peak (slowed projectiles,
healing meditation rock) and the Jade Emperor's Cloud Court (low gravity, heavenly gusts).

Every half-minute the heavens may intervene: Moon Festival, Rain of Tea, Ancestors Watching (double damage),
Dragon Flyover, Fortune Cookie Storm, Turtle Time, Hungry Ghosts and the Emperor's Decree. Frequency can be
set to Off / Rare / Normal / Chaos.

### Stage transitions

Every arena hides another area behind it. When a KO smashes the loser **through the scenery** (a wall-bounce
or hazard finisher), the arena rips apart like paper and the next round is fought in the area behind it —
another crash KO sends the fight back:

| Arena | Behind it | What changes |
|---|---|---|
| Bamboo Forest | Moonlit Lotus Pond 蓮池 | slick lily pads: dashes skid further |
| Temple Rooftop | Hall of a Thousand Buddhas 千佛殿 | temple lanterns still fall and burn |
| Tea House | Tea House Kitchen 廚房 | a grease spill mid-floor, chopping blocks by the walls |
| Barnyard | The Pigpen 豬圈 | two mud wallows slow everyone except pigs |
| Waterfall Peak | Water Curtain Cave 水簾洞 | a healing meditation stone on each side |
| Cloud Court | Peach Garden of Immortality 蟠桃園 | peaches of immortality drop from the trees |

Turn them off under Settings → Rules (or, in a LAN room, the host's *Stage transitions* option).

## Graphics

Settings → Graphics → **Quality**:

- **Low (fast)** renders at 75% resolution with half the particles and no animated background extras. Try
  it if fights stutter.
- **High** (default) renders at 1280×720.
- **Ultra (sharp)** renders at your screen's real resolution (up to 2×) for big or high-DPI displays.

**Show FPS** puts a frame-rate counter in the corner.

## Development

```bash
npm test                      # 89 tests: sim purity, determinism, motion inputs, combat, builds, roster, stages, WebSocket, LAN
npm run soak                  # AI-vs-AI soak: every pairing, win rates, invariant checks
node tools/soak.js 5 4        # 5 matches per pairing at difficulty tier 4
node tools/check-imports.mjs  # static check that every import resolves
```

While the server runs, two dev pages help with authoring:

- **`/dev/anim.html`**, the animation viewer: steps any move or state of any fighter frame by frame using the real
  pose, skin and hitbox code. It shows hurtboxes, hitboxes, pushboxes, projectile spawns, onion skin and joints,
  plus a timeline of startup, active, recovery, invulnerability, armor and parry frames, and the full frame data.
  - The **pose lab** edits any pose in POSES live and prints the line to paste into `render/pose.js`.
  - The URL hash links to an exact frame, e.g. `/dev/anim.html#c=moolan&k=move&m=milkBeam&f=12`.
- **`/dev/sound.html`**, a test board for every sound, voice, music track and speech.

### How it fits together

```
server.js              static files + WebSocket upgrade; prints LAN URLs
server/ws.js           hand-rolled RFC 6455 WebSocket (no dependencies)
server/rooms.js        LAN lobby: rooms, seats, spectators, ready-up, rejoin, forfeits
server/match-host.js   authoritative 60 Hz match loop; broadcasts packed snapshots
public/js/sim/         the pure, deterministic simulation (no DOM, seeded RNG) — runs in browser and Node
public/js/data/        rules, characters, moves, stances, inner arts, scrolls, presets, stages, events
public/js/render/      Canvas 2D ink-wash renderer: skeleton poses, skins, effects, HUD, cut-ins, arenas
                       and the hidden areas behind them (areas.js)
public/js/audio/       Web Audio synthesis (SFX, animal voices, procedural music) + speechSynthesis
public/js/game/        local sessions and the "director" that turns sim events into juice
public/js/net/         LAN client: input upload and snapshot playback
public/js/ui/          menus, character/stage select, workshop, lobby, settings
public/dev/            animation viewer and sound board
```

The simulation is a pure function of `(state, inputs)`: offline the browser steps it, online the Node
server does, and the AI soak runs it headless. All visual-only effects (particles, shake, calligraphy)
live in the renderer, so the server never draws anything.

Balance was tuned with thousands of CPU-vs-CPU matches; human players will find different strengths, so
treat the numbers in `public/js/data/characters/` as a starting point.
