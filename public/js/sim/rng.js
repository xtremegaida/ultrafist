// Seeded PRNG (mulberry32). The seed lives in plain state so snapshots and replays stay deterministic.

export function nextU32(holder, key = 'rng') {
  let t = (holder[key] = (holder[key] + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

export function rand(holder, key = 'rng') {
  return nextU32(holder, key) / 4294967296;
}

export function randInt(holder, lo, hi, key = 'rng') {
  return lo + Math.floor(rand(holder, key) * (hi - lo + 1));
}

export function randRange(holder, lo, hi, key = 'rng') {
  return lo + rand(holder, key) * (hi - lo);
}

export function chance(holder, p, key = 'rng') {
  return rand(holder, key) < p;
}

export function pick(holder, arr, key = 'rng') {
  return arr[Math.floor(rand(holder, key) * arr.length)];
}

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
