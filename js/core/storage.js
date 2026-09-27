// Persistencia local: ajustes, partidas guardadas (autoguardado) e import/export.

const PREFIX = 'f1predestinato';
export const KEYS = {
  settings: `${PREFIX}.settings`,
  slots: `${PREFIX}.slots`,
  slot: (i) => `${PREFIX}.slot.${i}`,
  last: `${PREFIX}.last`,
  seen: `${PREFIX}.seen`,
  tips: `${PREFIX}.tips`,
};

export const SLOT_COUNT = 3;
export const SAVE_VERSION = 2;

function safeLocal() {
  try {
    const k = '__f1p_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
      isMemory: true,
    };
  }
}

const store = typeof window !== 'undefined' ? safeLocal() : null;
const memoryFallback = new Map();

function readRaw(key) {
  if (!store) return memoryFallback.get(key) ?? null;
  try {
    return store.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

function writeRaw(key, value) {
  if (!store) {
    memoryFallback.set(key, value);
    return true;
  }
  try {
    store.setItem(key, value);
    return true;
  } catch {
    memoryFallback.set(key, value);
    return false;
  }
}

export function readJson(key, fallback = null) {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  return writeRaw(key, JSON.stringify(value));
}

export function removeKey(key) {
  if (store) {
    try {
      store.removeItem(key);
    } catch {
      /* ignora */
    }
  }
  memoryFallback.delete(key);
}

/* ───────────────────────── Ajustes ───────────────────────── */

export const DEFAULT_SETTINGS = {
  sound: true,
  sfx: true,
  engineVolume: 0.75,
  musicVolume: 0.45,
  crowdVolume: 0.5,
  difficulty: 'pro' /* amateur | pro | legendary */,
  assists: true,
  steeringAssist: 0.55,
  tractionControl: true,
  abs: true,
  autoDrs: true,
  brakeAssist: true,
  stability: 0.6,
  units: 'metric' /* metric | imperial */,
  raceLength: 'corta' /* corta | media | larga | completa */,
  hudScale: 1,
  simSpeed: 1,
  showMinimap: true,
  showTiming: true,
  reduceMotion: false,
};

export function loadSettings() {
  const saved = readJson(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
}

export function saveSettings(settings) {
  return writeJson(KEYS.settings, settings);
}

/* ─────────────────────── Partidas guardadas ─────────────────────── */

/** @returns {Array<{index:number,empty:boolean,meta:object|null}>} */
export function listSlots() {
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const data = readSlot(i);
    out.push({ index: i, empty: !data, meta: data ? data.meta || {} : null });
  }
  return out;
}

export function readSlot(index) {
  const data = readJson(KEYS.slot(index), null);
  if (!data || data.version !== SAVE_VERSION || !data.state) return null;
  return data;
}

export function writeSlot(index, state, meta) {
  const payload = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    meta: meta || state.meta || {},
    state,
  };
  const ok = writeJson(KEYS.slot(index), payload);
  if (ok) {
    writeJson(KEYS.last, { index, savedAt: payload.savedAt });
    return true;
  }
  return false;
}

export function deleteSlot(index) {
  removeKey(KEYS.slot(index));
  const last = readJson(KEYS.last, null);
  if (last && last.index === index) removeKey(KEYS.last);
  return true;
}

export function lastSlotIndex() {
  const last = readJson(KEYS.last, null);
  if (!last) return null;
  return readSlot(last.index) ? last.index : null;
}

export function hasAnySave() {
  return lastSlotIndex() !== null;
}

/* ─────────────────────── Importar / exportar ─────────────────────── */

export function exportSlot(index) {
  const data = readSlot(index);
  if (!data) return null;
  return JSON.stringify(data, null, 2);
}

export function importSlot(json, targetIndex = null) {
  let parsed;
  try {
    parsed = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!parsed || parsed.version !== SAVE_VERSION || !parsed.state) {
    throw new Error('El archivo no es una partida de Predestinato.');
  }
  let index = targetIndex;
  if (index === null) {
    const free = listSlots().find((s) => s.empty);
    index = free ? free.index : 0;
  }
  writeJson(KEYS.slot(index), parsed);
  writeJson(KEYS.last, { index, savedAt: parsed.savedAt || new Date().toISOString() });
  return index;
}

export function downloadText(filename, text) {
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

export function pickTextFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
    input.click();
  });
}

/* ─────────────────────── Marcadores de visto ─────────────────────── */

export function seenFlag(key) {
  const bag = readJson(KEYS.seen, {});
  return Boolean(bag[key]);
}

export function markSeen(key) {
  const bag = readJson(KEYS.seen, {});
  bag[key] = Date.now();
  writeJson(KEYS.seen, bag);
}

export function storageInfo() {
  const inMemory = !store || store.isMemory === true;
  let bytes = 0;
  try {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const raw = readRaw(KEYS.slot(i));
      if (raw) bytes += raw.length;
    }
    const s = readRaw(KEYS.settings);
    if (s) bytes += s.length;
  } catch {
    /* ignora */
  }
  return { inMemory, bytes, kilobytes: Math.round(bytes / 102.4) / 10 };
}
