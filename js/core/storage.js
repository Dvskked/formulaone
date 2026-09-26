/**
 * storage.js — versioned localStorage persistence with JSON export/import.
 */

const PREFIX = "apexgp:";
const SAVE_VERSION = 1;

function available() {
  try {
    const k = PREFIX + "__t";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const HAS_LS = available();
const memory = new Map();

function readRaw(key) {
  if (HAS_LS) return localStorage.getItem(PREFIX + key);
  return memory.has(key) ? memory.get(key) : null;
}

function writeRaw(key, value) {
  if (HAS_LS) {
    try {
      localStorage.setItem(PREFIX + key, value);
      return true;
    } catch {
      return false;
    }
  }
  memory.set(key, value);
  return true;
}

export const storage = {
  available: HAS_LS,

  get(key, fallback = null) {
    const raw = readRaw(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    return writeRaw(key, JSON.stringify(value));
  },

  remove(key) {
    if (HAS_LS) localStorage.removeItem(PREFIX + key);
    memory.delete(key);
  },

  keys() {
    if (!HAS_LS) return [...memory.keys()];
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
    return out;
  },

  /** Read a save bundle, migrating older shapes forward. */
  loadSave(slot = "career") {
    const data = this.get(`save:${slot}`);
    if (!data || typeof data !== "object") return null;
    if (data.version !== SAVE_VERSION) {
      if (typeof data.migrate === "function") { try { return data.migrate(); } catch { /* fall through */ } }
      return null;
    }
    return data.payload;
  },

  writeSave(slot, payload) {
    return this.set(`save:${slot}`, { version: SAVE_VERSION, savedAt: Date.now(), payload });
  },

  deleteSave(slot) {
    this.remove(`save:${slot}`);
  },

  saveInfo(slot = "career") {
    const raw = this.get(`save:${slot}`);
    return raw && raw.savedAt ? new Date(raw.savedAt) : null;
  },

  exportSave(slot = "career") {
    const payload = this.loadSave(slot);
    return payload ? JSON.stringify({ app: "apexgp2026", version: SAVE_VERSION, payload }, null, 2) : null;
  },

  importSave(json) {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    const payload = parsed && parsed.payload ? parsed.payload : parsed;
    if (!payload || typeof payload !== "object") throw new Error("Unrecognised save file");
    this.writeSave("career", payload);
    return payload;
  },
};

export const SETTINGS_DEFAULTS = {
  sound: true,
  masterVolume: 0.7,
  sfxVolume: 0.8,
  engineVolume: 0.65,
  musicVolume: 0.4,
  quality: "high",        // low | medium | high
  cameraZoom: 1,          // 0 far, 1 near
  showRacingLine: false,
  showMinimap: true,
  showHudHints: true,
  assists: { steering: true, traction: true, abs: true, autoPit: false },
  raceLaps: 6,
  simSpeed: 1,
  reducedMotion: false,
};

export function loadSettings() {
  const s = storage.get("settings", {});
  return {
    ...SETTINGS_DEFAULTS,
    ...s,
    assists: { ...SETTINGS_DEFAULTS.assists, ...(s.assists || {}) },
  };
}

export function saveSettings(settings) {
  storage.set("settings", settings);
}
