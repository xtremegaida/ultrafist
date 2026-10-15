// Training-mode debug overlay: hurtboxes, active hitboxes, pushboxes, projectile boxes.
// Only usable when the full sim state is available locally.

import { hurtboxes, pushWidth } from '../sim/fighter.js';
import { activeHits, hitBoxScale } from '../sim/moves.js';
import { projBox } from '../sim/projectiles.js';
import { getMove } from '../data/registry.js';
import { worldBox } from '../sim/util.js';

export function drawDebugBoxes(ctx, s) {
  ctx.save();
  ctx.lineWidth = 2;
  for (const f of s.fighters) {
    ctx.strokeStyle = 'rgba(0,160,255,0.9)';
    ctx.fillStyle = 'rgba(0,160,255,0.15)';
    for (const b of hurtboxes(f)) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    if (f.move) {
      const def = getMove(f.move.id);
      ctx.strokeStyle = 'rgba(255,0,40,0.95)';
      ctx.fillStyle = 'rgba(255,0,40,0.2)';
      for (const h of activeHits(f)) {
        if (!h.box) continue;
        const b = h.global ? { x: s.stage.left, y: h.box[1], w: s.stage.right - s.stage.left, h: h.box[3] } : worldBox(f, h.box, ...hitBoxScale(f, def));
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
    }
    const pw = pushWidth(f);
    ctx.strokeStyle = 'rgba(255,200,0,0.8)';
    ctx.strokeRect(f.x - pw, f.y - 140 * f.scale, pw * 2, 140 * f.scale);
  }
  ctx.strokeStyle = 'rgba(255,120,0,0.9)';
  for (const p of s.projectiles) {
    const b = projBox(s, p);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  ctx.restore();
}

// Frame data summary for the move a fighter is currently performing.
export function frameDataText(f) {
  if (!f.move) return null;
  const def = getMove(f.move.id);
  if (!def) return null;
  const adv = def.hits.length ? (def.hits[0].hitstun ?? 0) - (def.dur - def.firstActive) : null;
  return `${def.name}: startup ${def.firstActive}f · active ${Math.max(0, def.lastActive - def.firstActive + 1)}f · total ${def.dur}f${adv != null ? ` · on hit ${adv >= 0 ? '+' : ''}${adv}` : ''}${f.move.bonus ? ' · AUTHENTIC 真' : ''}`;
}
