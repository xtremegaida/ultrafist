// Local game session: runs the pure sim at a fixed 60 Hz with human, CPU or training-dummy seats.

import { createMatch, step } from '../sim/index.js';
import { createAI, aiInput } from '../sim/ai.js';
import { BTN, dirToBits } from '../sim/input.js';
import { sampleSeat } from '../input/devices.js';
import { clearLatch } from '../input/keyboard.js';

const STEP_MS = 1000 / 60;

// seats: [{ type: 'human', devices: ['kb1', 'pad0'] } | { type: 'cpu', level } | { type: 'dummy', mode }]
export function createLocalSession(cfg) {
  const state = createMatch({
    seed: cfg.seed ?? ((Date.now() ^ (Math.random() * 1e9)) >>> 0),
    stageId: cfg.stageId,
    builds: cfg.builds,
    events: cfg.events,
    timer: cfg.timer,
    wins: cfg.wins,
    training: cfg.training,
    transitions: cfg.transitions,
  });
  const seats = cfg.seats.map((seat, side) => ({
    ...seat,
    ai: seat.type === 'cpu' ? createAI(seat.level ?? 2, side, (state.cfg.seed ^ (side * 7777)) >>> 0) : null,
  }));
  return {
    kind: 'local',
    state,
    seats,
    acc: 0,
    paused: false,
    last: 0,
    pauseRequested: false,
    lastInputs: [0, 0],
    inputLog: [[], []],
    // Advance by real time; returns the list of events from all steps run.
    update(now) {
      if (!this.last) this.last = now;
      let dt = now - this.last;
      this.last = now;
      if (dt > 250) dt = 250;
      if (this.paused) return [];
      this.acc += dt;
      const events = [];
      let steps = 0;
      while (this.acc >= STEP_MS && steps < 5) {
        this.acc -= STEP_MS;
        steps++;
        const inputs = seats.map((seat, side) => this.sample(seat, side));
        clearLatch();
        if (this.paused) break;
        step(this.state, inputs);
        this.lastInputs = inputs;
        for (const e of this.state.events) events.push(e);
      }
      if (steps === 5) this.acc = 0;
      return events;
    },
    sample(seat, side) {
      if (seat.type === 'human') {
        const r = sampleSeat(seat.devices || []);
        if (r.pause) this.pauseRequested = true;
        logInput(this.inputLog[side], r.byte, this.state.frame);
        return r.byte;
      }
      if (seat.type === 'cpu') return aiInput(seat.ai, this.state);
      if (seat.type === 'dummy') return dummyInput(seat, this.state, side);
      return 0;
    },
  };
}

function logInput(log, byte, frame) {
  const last = log[log.length - 1];
  if (last && last.b === byte) {
    last.n++;
    return;
  }
  log.push({ b: byte, n: 1, frame });
  if (log.length > 18) log.shift();
}

// Training dummy behaviours.
function dummyInput(seat, s, side) {
  const f = s.fighters[side];
  const o = s.fighters[1 - side];
  const back = dirToBits(4, f.facing);
  switch (seat.mode) {
    case 'crouch':
      return BTN.D;
    case 'jump':
      return BTN.U;
    case 'block':
      return back | (o.move && o.move.f < 12 && ['cL', 'sweep'].includes(o.move.id) ? BTN.D : 0);
    case 'blockLow':
      return back | BTN.D;
    case 'cpu':
      if (!seat.ai) seat.ai = createAI(seat.level ?? 2, side, 99);
      return aiInput(seat.ai, s);
    default:
      return 0;
  }
}
