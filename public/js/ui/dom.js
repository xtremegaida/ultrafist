// Tiny DOM helpers + spatial keyboard/gamepad navigation for menu screens.

import { listPads, readPad } from '../input/gamepad.js';
import { audio } from '../audio/audio.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function btn(label, onClick, opts = {}) {
  const b = h('button', { class: opts.class || '', title: opts.title || null, disabled: opts.disabled || null, 'data-nav': '1' },
    opts.glyph ? h('span', { class: 'cjk' }, opts.glyph) : null,
    label,
    opts.desc ? h('span', { class: 'desc' }, opts.desc) : null);
  b.addEventListener('click', (e) => {
    audio.sfx('uiSelect');
    onClick(e);
  });
  b.addEventListener('mouseenter', () => audio.sfx('uiMove', { vol: 0.4 }));
  return b;
}

let toastTimer = 0;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---- spatial navigation for menus (keyboard arrows/WASD + gamepads) -------------------------

function focusables(root) {
  return [...root.querySelectorAll('[data-nav]')].filter((el) => !el.disabled && el.offsetParent !== null);
}

export function moveFocus(root, dx, dy) {
  const els = focusables(root);
  if (!els.length) return;
  const cur = document.activeElement && els.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) {
    els[0].focus();
    return;
  }
  const r0 = cur.getBoundingClientRect();
  const c0 = [r0.left + r0.width / 2, r0.top + r0.height / 2];
  let best = null;
  let bestScore = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const c = [r.left + r.width / 2, r.top + r.height / 2];
    const vx = c[0] - c0[0];
    const vy = c[1] - c0[1];
    const along = vx * dx + vy * dy;
    if (along <= 4) continue;
    const across = Math.abs(vx * dy) + Math.abs(vy * dx);
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus();
    audio.sfx('uiMove', { vol: 0.5 });
  }
}

// Gamepad + extra keyboard menu navigation, polled from the main loop.
const prevPad = {};
export function pollMenuNav(root, onBack) {
  for (const pad of listPads()) {
    const a = readPad(pad);
    const p = prevPad[pad.index] || {};
    const edge = (k) => a[k] && !p[k];
    if (edge('up')) moveFocus(root, 0, -1);
    if (edge('down')) moveFocus(root, 0, 1);
    if (edge('left')) moveFocus(root, -1, 0);
    if (edge('right')) moveFocus(root, 1, 0);
    if (edge('confirm') && document.activeElement && root.contains(document.activeElement)) document.activeElement.click();
    if (edge('back') && onBack) onBack();
    prevPad[pad.index] = { ...a };
  }
}

export function keyNav(e, root, onBack) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
    if (e.code === 'Escape' && onBack) onBack();
    return false;
  }
  const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
  if (map[e.code]) {
    e.preventDefault();
    moveFocus(root, ...map[e.code]);
    return true;
  }
  if (e.code === 'KeyJ' || e.code === 'Numpad1') {
    if (document.activeElement && root.contains(document.activeElement)) document.activeElement.click();
    return true;
  }
  if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'KeyK') {
    if (onBack) {
      e.preventDefault();
      audio.sfx('uiBack');
      onBack();
    }
    return true;
  }
  return false;
}

