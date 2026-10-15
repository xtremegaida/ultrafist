// Title screen and main menu.

import { h, btn } from './dom.js';
import { audio } from '../audio/audio.js';
import { showCharSelect } from './select.js';
import { showWorkshop } from './workshop.js';
import { showLobby } from './lobby.js';
import { showSettings, showHowTo } from './settings.js';

export function showTitle(app) {
  const el = h('div', { class: 'screen clear' },
    h('div', { class: 'title-wrap' },
      h('div', { class: 'logo' }, 'ULTRA', h('span', { class: 'cjk' }, '極拳'), 'FIST'),
      h('div', { class: 'tagline' }, 'WUXIA STRONGEST FIGHT'),
      h('div', { class: 'press' }, 'PRESS ANY KEY')),
    h('div', { class: 'footer-hint', style: { color: '#f3ead7', textShadow: '0 0 4px #000' } }, 'Masters, monks, and one very angry rooster. Best with headphones.'));
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    audio.unlock();
    audio.sfx('bigGong');
    audio.music.play('menu');
    app.setScreen(showMainMenu(app));
  };
  el.addEventListener('pointerdown', go);
  return {
    el,
    nav: false,
    onKey: () => {
      go();
      return true;
    },
    poll: () => {
      for (const p of navigator.getGamepads?.() || []) if (p && p.buttons.some((b) => b.pressed)) go();
    },
  };
}

export function showMainMenu(app) {
  const items = [
    btn('Path of the Ultimate Fist', () => app.setScreen(showCharSelect(app, { mode: 'arcade' })), { glyph: '道', desc: 'Arcade: six CPU masters, then the Heavenly Demon.' }),
    btn('Versus CPU', () => app.setScreen(showCharSelect(app, { mode: 'cpu' })), { glyph: '戰', desc: 'Pick your fighter, your foe, and how much it should hurt.' }),
    btn('Local Versus', () => app.setScreen(showCharSelect(app, { mode: 'local' })), { glyph: '雙', desc: 'Two players, one machine. Keyboard or gamepads.' }),
    btn('LAN Battle', () => app.setScreen(showLobby(app)), { glyph: '網', desc: 'Host or join a duel on your local network. Spectators welcome.' }),
    btn('Training Dojo', () => app.setScreen(showCharSelect(app, { mode: 'training' })), { glyph: '練', desc: 'Hitboxes, frame data and a very patient dummy.' }),
    btn('Build Workshop', () => app.setScreen(showWorkshop(app)), { glyph: '功', desc: 'Stances, inner arts, forbidden scrolls, cosmetics.' }),
    btn('How to Play', () => app.setScreen(showHowTo(app)), { glyph: '書' }),
    btn('Settings', () => app.setScreen(showSettings(app)), { glyph: '設' }),
  ];
  const el = h('div', { class: 'screen clear' },
    h('div', { class: 'row', style: { marginTop: '24px', gap: '40px', alignItems: 'flex-start' } },
      h('div', { class: 'logo', style: { fontSize: '64px', marginTop: '10px' } }, 'ULTRA', h('span', { class: 'cjk', style: { fontSize: '56px' } }, '極拳'), 'FIST')),
    h('div', { class: 'panel', style: { marginTop: '22px', width: '980px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, items),
    h('div', { class: 'footer-hint', style: { color: '#f3ead7', textShadow: '0 0 4px #000' } }, 'Arrows / WASD / D-pad to move · Enter / J / A to select · Esc to go back'));
  return { el };
}
