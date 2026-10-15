// Snapshot packing for LAN play: a compact, render-ready view of the sim state.
// The packed object *is* the view the renderer draws, so pack(state) must include every field the
// renderer, HUD and director read. A round-trip test guards this contract.

const r1 = (v) => Math.round(v * 10) / 10;

function packFighter(f) {
  return {
    side: f.side, charId: f.charId,
    x: r1(f.x), y: r1(f.y), vx: r1(f.vx), vy: r1(f.vy), facing: f.facing, scale: r1(f.scale * 100) / 100, air: f.air,
    st: f.st, stT: f.stT, stun: f.stun,
    move: f.move ? { id: f.move.id, f: f.move.f, bonus: f.move.bonus, data: { grab: !!f.move.data.grab, cine: !!f.move.data.cine } } : null,
    hp: f.hp, maxHp: f.maxHp, chi: Math.round(f.chi), guard: Math.round(f.guard), guardMax: f.guardMax,
    awakened: f.awakened || 0,
    buffs: f.buffs.map((b) => ({ id: b.id, t: b.t > 1e6 ? 1e6 : b.t })),
    status: {
      poison: f.status.poison ? { stacks: f.status.poison.stacks } : undefined,
      doom: f.status.doom ? 1 : undefined,
      slow: f.status.slow ? 1 : undefined,
      frozen: f.status.frozen ? 1 : undefined,
      hatless: f.status.hatless || undefined,
    },
    char: { drunk: f.char.drunk, cud: f.char.cud, eggHp: f.char.eggHp },
    combo: { n: f.combo.n, dmg: f.combo.dmg },
    guarding: f.guarding, crouching: f.crouching, dashBack: f.dashBack, running: f.running, clinging: f.clinging,
    airDashT: f.airDashT, quickRise: f.quickRise,
    stat: f.stat,
  };
}

export function pack(s) {
  return {
    frame: s.frame,
    phase: s.phase, phaseT: s.phaseT, round: s.round, wins: s.wins, timer: s.timer, winner: s.winner,
    cfg: { wins: s.cfg.wins, training: s.cfg.training ? 1 : 0, stageId: s.cfg.stageId },
    suddenDeath: s.suddenDeath,
    freeze: s.freeze, cine: s.cine ? { by: s.cine.by, t: s.cine.t, bg: s.cine.bg } : null,
    clash: s.clash ? { kind: s.clash.kind, t: s.clash.t, max: s.clash.max, tug: s.clash.tug, x: r1(s.clash.x), y: r1(s.clash.y) } : null,
    slow: !!s.slow,
    hitstop: s.hitstop,
    ko: s.ko, heavenly: s.heavenly ? { id: s.heavenly.id, t: s.heavenly.t, forced: s.heavenly.forced } : null,
    stage: { id: s.stage.id, left: s.stage.left, right: s.stage.right, hazards: s.stage.hazards.map((h) => ({ kind: h.kind, x: r1(h.x), y: h.y != null ? r1(h.y) : undefined, st: h.st, t: h.t, dir: h.dir, hp: h.hp, w: h.w })) },
    fighters: s.fighters.map(packFighter),
    projectiles: s.projectiles.map((p) => ({ kind: p.kind, owner: p.owner, x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy), t: p.t, facing: p.facing, len: r1(p.len), mult: r1(p.mult), data: { scale: p.data.scale } })),
    zones: s.zones.map((z) => ({ kind: z.kind, x: r1(z.x), w: z.w, t: z.t })),
    props: s.props.map((p) => ({ kind: p.kind, x: r1(p.x), y: r1(p.y), vx: r1(p.vx), flying: p.flying })),
    pickups: s.pickups.map((p) => ({ kind: p.kind, x: r1(p.x), y: r1(p.y) })),
  };
}

// Events are plain objects already; strip anything bulky.
export function packEvents(events) {
  return events;
}

export function unpack(view) {
  return view;
}
