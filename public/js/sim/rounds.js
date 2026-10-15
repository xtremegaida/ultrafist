// Round and match flow: intro, fight, KO (with its ridiculous KO type), round end, match end.

import { RULES } from '../data/rules.js';
import { resetForRound, setState, faceOpponent } from './fighter.js';
import { resetStageForRound, enterArea } from './stage.js';
import { STAGES } from '../data/stages.js';
import { endCombo } from './states.js';
import { emit } from './util.js';
import { rand } from './rng.js';

export function startRound(s) {
  const [a, b] = s.fighters;
  // the last round ended with someone smashed through the scenery: fight on in the area behind it
  const from = s.stage.id;
  if (s.stage.next) {
    enterArea(s, s.stage.next);
    s.stage.next = null;
    emit(s, { t: 'stageChange', id: s.stage.id, from });
  }
  const mid = (s.stage.left + s.stage.right) / 2;
  resetForRound(a, mid - 190, 1);
  resetForRound(b, mid + 190, -1);
  if (s.suddenDeath) {
    a.hp = 1;
    b.hp = 1;
  }
  s.round++;
  s.phase = 'intro';
  s.phaseT = 0;
  // later rounds get a shorter intro, unless there is a new area to take in
  s.introLen = s.round === 1 || s.stage.id !== from ? RULES.INTRO_FRAMES : RULES.INTRO_FRAMES - 40;
  s.timerF = s.cfg.timer * 60;
  s.timer = s.cfg.timer;
  s.hitstop = 0;
  s.freeze = null;
  s.cine = null;
  s.clash = null;
  s.slow = null;
  s.clashCd = 0;
  s.ko = null;
  s.roundWinner = null;
  resetStageForRound(s);
  emit(s, { t: 'roundStart', round: s.round, sudden: !!s.suddenDeath, final: s.wins[0] === s.cfg.wins - 1 && s.wins[1] === s.cfg.wins - 1 });
}

export function tickRounds(s) {
  s.phaseT++;
  const [a, b] = s.fighters;
  switch (s.phase) {
    case 'intro': {
      if (s.phaseT === s.introLen - RULES.FIGHT_FRAMES) emit(s, { t: 'fight' });
      if (s.phaseT >= s.introLen) {
        s.phase = 'fight';
        s.phaseT = 0;
        for (const f of s.fighters) {
          setState(f, 'idle');
          for (const k of Object.keys(f.inp.buf)) f.inp.buf[k] = 0;
        }
      }
      break;
    }
    case 'fight': {
      if (!s.cfg.training) {
        s.timerF--;
        s.timer = Math.max(0, Math.ceil(s.timerF / 60));
      }
      const deadA = a.hp <= 0;
      const deadB = b.hp <= 0;
      if (s.cfg.training) {
        for (const f of s.fighters) if (f.hp <= 0) f.hp = 1;
        break;
      }
      if (deadA || deadB) {
        startKO(s, deadA && deadB ? -1 : deadA ? 1 : 0);
      } else if (s.timerF <= 0) {
        const ra = a.hp / a.maxHp;
        const rb = b.hp / b.maxHp;
        const w = Math.abs(ra - rb) < 1e-6 ? -1 : ra > rb ? 0 : 1;
        s.phase = 'ko';
        s.phaseT = 0;
        s.ko = { winner: w, type: 'timeup', loser: w < 0 ? -1 : 1 - w };
        s.roundWinner = w;
        emit(s, { t: 'timeUp', winner: w });
      }
      break;
    }
    case 'ko':
      if (s.phaseT >= RULES.KO_FRAMES) {
        s.phase = 'roundEnd';
        s.phaseT = 0;
        awardRound(s);
      }
      break;
    case 'roundEnd':
      if (s.phaseT >= RULES.ROUND_END_FRAMES) {
        const need = s.cfg.wins;
        if (s.wins[0] >= need && s.wins[1] >= need) {
          s.suddenDeath = true;
          s.wins = [need - 1, need - 1];
          startRound(s);
        } else if (s.wins[0] >= need || s.wins[1] >= need) {
          s.phase = 'matchEnd';
          s.phaseT = 0;
          s.winner = s.wins[0] >= need ? 0 : 1;
          emit(s, { t: 'matchEnd', winner: s.winner });
        } else startRound(s);
      }
      break;
    case 'matchEnd':
      break;
    default:
      break;
  }
}

function startKO(s, winner) {
  const loserSides = winner < 0 ? [0, 1] : [1 - winner];
  s.phase = 'ko';
  s.phaseT = 0;
  s.hitstop = Math.max(s.hitstop, RULES.HITSTOP.ko);
  s.slow = { t: RULES.KO_SLOW.frames, div: RULES.KO_SLOW.div };
  s.roundWinner = winner;
  const L = s.fighters[loserSides[0]];
  const lh = L.lastHit || {};
  let type;
  if (lh.ultra) type = 'scroll';
  else if (lh.up || L.vy < -11) type = 'star';
  else if (lh.wb || L.pendingWB || lh.kind === 'hazard') type = 'crash';
  else type = rand(s) < 0.5 ? 'signature' : 'crater';
  if (L.st === 'egg') type = 'signature';
  s.ko = { winner, type, loser: loserSides[0], double: winner < 0 };
  if (type === 'crash' && s.cfg.transitions && !s.cfg.training) s.stage.next = STAGES[s.stage.id].beyond || null;
  for (const side of loserSides) {
    const f = s.fighters[side];
    f.move = null;
    if (type === 'star') {
      setState(f, 'ko');
      f.air = true;
      f.y = Math.min(f.y, -2);
      f.vy = -26;
      f.vx = (f.x < s.fighters[1 - side].x ? -1 : 1) * 9;
    } else if (f.air) {
      setState(f, 'ko');
    } else {
      setState(f, 'ko');
      f.air = true;
      f.y = -2;
      f.vy = -9;
      f.vx = (f.x < s.fighters[1 - side].x ? -1 : 1) * 5;
    }
    endCombo(s, f);
  }
  emit(s, { t: 'ko', winner, loser: loserSides[0], type, double: winner < 0, x: L.x, y: L.y });
}

function awardRound(s) {
  const w = s.roundWinner;
  if (w === -1 || w == null) {
    s.wins[0]++;
    s.wins[1]++;
    emit(s, { t: 'roundEnd', winner: -1, draw: true });
  } else {
    s.wins[w]++;
    const W = s.fighters[w];
    const perfect = W.hp === W.maxHp;
    emit(s, { t: 'roundEnd', winner: w, perfect });
  }
  for (const f of s.fighters) {
    if (f.st === 'ko') continue;
    f.move = null;
    f.vx = 0;
    setState(f, f.side === w ? 'win' : 'lose');
    if (f.air) {
      f.air = true;
    }
    faceOpponent(f, s.fighters[1 - f.side]);
  }
}
