// Player settings + progress via localStorage.
//
// Sound/Vibration use the SHARED, unprefixed keys so the Playground hub's global
// toggles (and the other games) stay in sync. Game-specific prefs are namespaced
// with mt_ so they never collide with other games on the same origin.
const KEYS = {
  sound: 'soundEnabled',
  haptics: 'hapticsEnabled',
  showNames: 'mt_showNames',
  song: 'mt_song',
};

function readBool(key, fallback) {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  return v === 'true';
}

const SettingsStore = {
  get isSoundEnabled() { return readBool(KEYS.sound, true); },
  set isSoundEnabled(value) { localStorage.setItem(KEYS.sound, value ? 'true' : 'false'); },

  get areHapticsEnabled() { return readBool(KEYS.haptics, true); },
  set areHapticsEnabled(value) { localStorage.setItem(KEYS.haptics, value ? 'true' : 'false'); },

  // Show the note letter on each tile — a gentle assist / learning aid.
  // Off by default so the board stays clean; kids can turn it on.
  get showNames() { return readBool(KEYS.showNames, false); },
  set showNames(value) { localStorage.setItem(KEYS.showNames, value ? 'true' : 'false'); },
};

const ProgressStore = {
  get song() {
    const stored = parseInt(localStorage.getItem(KEYS.song) || '', 10);
    return Number.isFinite(stored) && stored >= 0 ? stored : 0;
  },
  set song(value) {
    try {
      localStorage.setItem(KEYS.song, String(value));
    } catch (_) {
      // Storage may be unavailable; the game still plays fine.
    }
  },
};

export { SettingsStore, ProgressStore };
