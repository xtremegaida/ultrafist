// Saved builds and settings in localStorage.

import { presetsFor } from '../data/presets.js';
import { resolveBuild } from '../sim/builds.js';

const BUILDS_KEY = 'ultrafist.builds.v1';
const SETTINGS_KEY = 'ultrafist.settings.v1';
const PROFILE_KEY = 'ultrafist.profile.v1';

export const DEFAULT_SETTINGS = {
  master: 0.9, music: 0.7, sfx: 0.9, voice: 0.9, speech: true,
  events: 'normal', wins: 2, timer: 99, transitions: true, quality: 'high', showFps: false, bindingsPreset: 'standard', cpuLevel: 2,
};

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadProfile() {
  try {
    return { name: '', token: '', ...(JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}) };
  } catch {
    return { name: '', token: '' };
  }
}

export function saveProfile(p) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function loadCustomBuilds() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUILDS_KEY));
    if (Array.isArray(raw)) return raw.filter((b) => b && b.id && b.charId);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveCustomBuilds(list) {
  try {
    localStorage.setItem(BUILDS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function upsertBuild(build) {
  const list = loadCustomBuilds();
  const i = list.findIndex((b) => b.id === build.id);
  if (i >= 0) list[i] = build;
  else list.push(build);
  saveCustomBuilds(list);
}

export function deleteBuild(id) {
  saveCustomBuilds(loadCustomBuilds().filter((b) => b.id !== id));
}

// Presets first, then the player's own builds for that character.
export function buildsFor(charId) {
  return [...presetsFor(charId), ...loadCustomBuilds().filter((b) => b.charId === charId)];
}

export function newBuildId() {
  return `custom.${Date.now().toString(36)}.${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function resolvedCos(build) {
  return resolveBuild(build).cos;
}

