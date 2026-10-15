// Server-authoritative match runner for one room: queues inputs, steps the shared pure simulation
// at a fixed 60 Hz and broadcasts one packed snapshot string per frame to players and spectators.

import { createMatch, step } from '../public/js/sim/index.js';
import { pack } from '../public/js/sim/pack.js';
import { NET, S } from '../public/js/shared/protocol.js';
import { RULES } from '../public/js/data/rules.js';

const STEP_MS = 1000 / 60;
const MAX_CATCHUP = 5;

export function createMatchHost(cfg, { broadcast, onEnd, now = () => performance.now(), autoStart = true }) {
  const state = createMatch(cfg);
  const queues = [[], []];
  const last = [0, 0];
  let paused = null; // { seat, until }
  let timer = null;
  let t0 = now();
  let ended = false;

  function popInput(side) {
    const q = queues[side];
    // an empty queue repeats the last input: a held button never creates a new press
    if (q.length) last[side] = q.shift();
    return last[side];
  }

  function tick() {
    if (ended) return;
    if (paused) {
      t0 = now();
      return;
    }
    const inputs = [popInput(0), popInput(1)];
    step(state, inputs);
    broadcast(JSON.stringify({ t: S.SNAP, v: pack(state), e: state.events }));
    if (state.phase === 'matchEnd' && state.phaseT >= RULES.MATCH_END_FRAMES * 0.5) finish(state.winner, 'ko');
  }

  function loop() {
    const n = now();
    let steps = 0;
    while (n - t0 >= STEP_MS && steps < MAX_CATCHUP) {
      t0 += STEP_MS;
      tick();
      steps++;
      if (ended) return;
    }
    if (n - t0 > STEP_MS * MAX_CATCHUP) t0 = n; // drop time we can't catch up on
  }

  function finish(winner, reason) {
    if (ended) return;
    ended = true;
    stop();
    onEnd(winner, reason);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  if (autoStart) {
    timer = setInterval(loop, 4);
    timer.unref?.();
  }

  return {
    state,
    input(side, b) {
      const q = queues[side];
      q.push(b & 0xff);
      if (q.length > NET.INPUT_QUEUE_CAP) {
        // drop the oldest but keep its button presses so nothing is lost
        const dropped = q.shift();
        q[0] |= dropped & 0xf0;
      }
    },
    pause(seat, seconds) {
      paused = { seat };
      broadcast(JSON.stringify({ t: S.PAUSE, on: true, seat, secondsLeft: seconds, reason: 'disconnect' }));
    },
    resume(seat) {
      if (paused && paused.seat === seat) {
        paused = null;
        t0 = now();
        broadcast(JSON.stringify({ t: S.PAUSE, on: false, seat }));
      }
    },
    forfeit(seat, reason) {
      finish(1 - seat, reason || 'forfeit');
    },
    stop,
    // test hook: advance n frames synchronously
    _tick(n = 1) {
      for (let i = 0; i < n; i++) tick();
    },
  };
}
