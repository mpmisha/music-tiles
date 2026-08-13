// Entry point: wires the DOM HUD/overlays to the canvas GameScene, and aligns
// with the Playground hub (shared Sound/Vibration settings + back handshake).
import { GameScene } from './scene.js';
import { SettingsStore } from './storage.js';
import { resolveLang, applyLang, t, isValidLang } from './i18n.js';

// Apply the platform language (shared same-origin with the hub) before wiring UI.
applyLang(resolveLang());

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// Last HUD values (declared before the scene is built — the scene calls setSong
// synchronously during construction).
let lastSong = { n: 1, total: 8, title: '' };

const dom = {
  header: $('hud'),
  setSong,
  setProgress,
  onPresentSettings: openSettings,
  onPresentSongComplete: openComplete,
  onPresentVictory: openVictory,
};

const scene = new GameScene(canvas, dom);

// Debug hook for automated tests only (opt-in via ?debug).
if (new URLSearchParams(location.search).has('debug')) window.scene = scene;

// ---- HUD ----

function setSong(n, total, title) {
  lastSong = { n, total, title };
  $('hud-song').textContent = `${n}/${total}`;
  $('hud-title').textContent = title;
  $('settings-song').textContent = t('songOf', { n, total });
}

function setProgress() { /* progress bar is drawn on the canvas */ }

// ---- Gear / settings ----

$('gear').addEventListener('click', () => {
  scene.sound.unlock();
  scene.sound.play('button');
  scene.presentSettings();
});

const settingsOverlay = $('settings-overlay');
const toggleNames = $('toggle-names');
const toggleSound = $('toggle-sound');
const toggleHaptics = $('toggle-haptics');

function syncSettingsUi() {
  toggleNames.classList.toggle('on', SettingsStore.showNames);
  toggleSound.classList.toggle('on', SettingsStore.isSoundEnabled);
  toggleHaptics.classList.toggle('on', SettingsStore.areHapticsEnabled);
}

function openSettings() {
  syncSettingsUi();
  settingsOverlay.hidden = false;
}

function closeSettings() {
  settingsOverlay.hidden = true;
  scene.dismissOverlay();
}

toggleNames.addEventListener('click', () => {
  SettingsStore.showNames = !SettingsStore.showNames;
  toggleNames.classList.toggle('on', SettingsStore.showNames);
  scene.sound.play('button');
});

toggleSound.addEventListener('click', () => {
  SettingsStore.isSoundEnabled = !SettingsStore.isSoundEnabled;
  toggleSound.classList.toggle('on', SettingsStore.isSoundEnabled);
  scene.sound.play('button');
});

toggleHaptics.addEventListener('click', () => {
  SettingsStore.areHapticsEnabled = !SettingsStore.areHapticsEnabled;
  toggleHaptics.classList.toggle('on', SettingsStore.areHapticsEnabled);
  scene.haptics.tap();
});

$('btn-new-game').addEventListener('click', () => {
  scene.sound.play('button');
  closeSettings();
  scene.startNewGame();
});

$('btn-close').addEventListener('click', () => {
  scene.sound.play('button');
  closeSettings();
});

settingsOverlay.querySelector('[data-dismiss="settings"]').addEventListener('click', closeSettings);

// ---- Back to hub ----
const HUB_URL = (() => {
  const param = new URLSearchParams(location.search).get('hub');
  if (param) { try { return new URL(param, location.href).href; } catch { /* ignore */ } }
  return 'https://mpmisha.github.io/playground/';
})();
const hasHubParam = new URLSearchParams(location.search).has('hub');
const backHubBtn = $('btn-back-hub');
const embeddedInHub = window.self !== window.top;
backHubBtn.href = HUB_URL;
// Sound/Vibration are global — controlled from the hub. When embedded, hide
// those rows and the redundant in-panel Back button (the hub's player bar does
// the going-back). Show-note-letters is game-specific and stays.
if (embeddedInHub) {
  toggleSound.closest('.row').hidden = true;
  toggleHaptics.closest('.row').hidden = true;
  backHubBtn.hidden = true;
} else {
  backHubBtn.hidden = !hasHubParam;
}
backHubBtn.addEventListener('click', (e) => {
  scene.sound.play('button');
  if (embeddedInHub) {
    e.preventDefault();
    try {
      window.parent.postMessage({ type: 'playground:back' }, new URL(HUB_URL).origin);
    } catch {
      window.parent.postMessage({ type: 'playground:back' }, '*');
    }
  }
});

// ---- Song-complete overlay ----

function openComplete({ title }) {
  $('complete-caption').textContent = `${t('youPlayed')} ${title}`;
  $('complete-overlay').hidden = false;
}

$('btn-next').addEventListener('click', () => {
  scene.sound.play('button');
  $('complete-overlay').hidden = true;
  scene.dismissOverlay();
  scene.nextSong();
});

// ---- Victory overlay ----

function openVictory() {
  $('victory-overlay').hidden = false;
}

$('btn-play-again').addEventListener('click', () => {
  scene.sound.play('button');
  $('victory-overlay').hidden = true;
  scene.dismissOverlay();
  scene.startNewGame();
});

// ---- Localization of static DOM chrome ----

function applyDomStrings() {
  $('settings-title').textContent = t('settings');
  $('settings-panel').setAttribute('aria-label', t('settingsAria'));
  $('label-names').textContent = t('showNames');
  $('label-sound').textContent = t('sound');
  $('label-haptics').textContent = t('vibration');
  $('btn-new-game').textContent = t('restart');
  $('btn-back-hub').textContent = t('backToGames');
  $('btn-close').textContent = t('close');
  $('gear').setAttribute('aria-label', t('settingsAria'));
  $('complete-title').textContent = t('nicePlaying');
  $('complete-panel').setAttribute('aria-label', t('doneAria'));
  $('victory-title').textContent = t('allDone');
  $('victory-caption').textContent = t('playedEvery');
  $('btn-next').textContent = t('nextSong');
  $('btn-play-again').textContent = t('playAgain');
  $('settings-song').textContent = t('songOf', { n: lastSong.n, total: lastSong.total });
}

applyDomStrings();

// Live language updates from the hub (same-origin postMessage only).
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const d = e.data;
  if (d && d.type === 'playground:lang' && isValidLang(d.lang)) {
    applyLang(d.lang);
    applyDomStrings();
  }
});

// ---- Service worker (offline support + reliable auto-update) ----
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then((reg) => {
      reg.update().catch(() => {});
      const promote = (worker) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => promote(reg.installing));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
