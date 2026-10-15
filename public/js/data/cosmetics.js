// Render-only customisation options.

export const COLOR_PRESETS = [
  '#e9e4d4', '#212529', '#9d0208', '#c1121f', '#e07a1f', '#f2c14e',
  '#3c6e71', '#2d6a4f', '#3a86ff', '#6a4c93', '#ffafcc', '#7f4f24',
];

export const HEADGEAR = {
  none: 'None',
  strawHat: 'Straw Hat',
  topknot: 'Topknot',
  bandana: 'Bandana',
  monkBeads: 'Monk Beads',
  scholarHat: 'Scholar Hat',
  riceHat: 'Rice Hat',
  chopsticks: 'Chopstick Crown',
  teacup: 'Teacup Hat',
  bucket: 'Bucket',
};

export const AURAS = ['#ffd34d', '#ff4d6d', '#4dd2ff', '#7cff6b', '#c77dff', '#ffffff', '#ff8c42', 'rainbow'];

export const BATTLE_CRY_MAX = 24;

export function sanitizeCry(text) {
  return String(text || '').replace(/[^\p{L}\p{N} !?.,'\-~*]/gu, '').slice(0, BATTLE_CRY_MAX).trim();
}

export function isColor(c) {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
}
