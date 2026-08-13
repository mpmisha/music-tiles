// Canvas renderer + controller for Music Tiles (real-time falling-tile board).
//
// Owns: the falling clock (with pause), layout, the 4 static keys pinned at the
// bottom, the tile-fall animation, multi-touch hit/miss detection, and
// delegating HUD / overlay updates to the DOM (see the `dom` contract in
// main.js). Difficulty (speed + two-finger chords) is baked into the schedule by
// game.js — this file just plays it back in real time.
//
// Calm rules: there is no failure. A missed tile slips past silently; the song
// always finishes and ends softly.
import { MusicGame, Phase, LANES } from './game.js';
import { SkinCatalog } from './skins.js';
import { SettingsStore } from './storage.js';
import { SoundPlayer, Haptics } from './audio.js';
import { css, adjustBrightness } from './color.js';
import { fontFamily, t } from './i18n.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const HUD_HEIGHT = 64;
const GAP_TOP = 12;

// Timing windows (seconds).
const GRACE = 0.16;       // how far from the exact beat a tap still counts
const MISS_AFTER = 0.19;  // a tile is "missed" this long after its beat
const GLOW_WINDOW = 0.42; // a key starts glowing this early as its tile nears

// Animation lengths (ms).
const KEY_FLASH_MS = 150;
const POP_MS = 210;
const COMPLETE_PAUSE_MS = 700;

// One steady colour per lane from the shared candy palette: purple, blue, pink,
// yellow — so the four columns (and their keys) read clearly.
const LANE_COLOR_INDEX = [0, 3, 4, 5];

class GameScene {
  constructor(canvas, dom) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dom = dom;
    this.settings = SettingsStore;
    this.sound = new SoundPlayer(this.settings);
    this.haptics = new Haptics(this.settings);

    SkinCatalog.reset();

    this.game = new MusicGame();
    this.game.reset(false);

    this.overlayOpen = false;
    this.presented = false;
    this.completeAt = 0;

    // Real-time clock (ms). elapsedSec() converts to seconds since song start.
    this.startTime = 0;
    this.pausedAccum = 0;
    this.paused = false;
    this.pauseStart = 0;

    // Per-lane transient animation state.
    this.keyHitAt = new Array(LANES).fill(-1);   // last successful hit (ms)
    this.keyFlashAt = new Array(LANES).fill(-1); // last empty/soft tap (ms)

    this.showTwoFingerHint = false;
    this.pulse = 0;

    this.dpr = Math.min(window.devicePixelRatio || 1, 3);

    this.bindEvents();
    this.performLayout();
    this.updateHud();
    this.showTwoFingerHint = this.game.hasDoubles && !this.settings.seenTwoFingers;

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // MARK: - Clock

  now() { return performance.now(); }

  elapsedSec() {
    if (this.game.phase === Phase.ready) return 0;
    const base = this.paused ? this.pauseStart : this.now();
    return (base - this.startTime - this.pausedAccum) / 1000;
  }

  // MARK: - Layout

  readInsets() {
    const probe = document.getElementById('safe-probe');
    const cs = probe ? getComputedStyle(probe) : null;
    const top = cs ? parseFloat(cs.paddingTop) || 0 : 0;
    const bottom = cs ? parseFloat(cs.paddingBottom) || 0 : 0;
    return { top: Math.max(top, 24), bottom: Math.max(bottom, 14) };
  }

  performLayout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const insets = this.readInsets();
    this.hudTop = insets.top + GAP_TOP;
    this.progressY = this.hudTop + HUD_HEIGHT + 4;

    const pad = 14;
    this.boardX = pad;
    this.boardW = w - pad * 2;
    this.laneW = this.boardW / LANES;

    // Static keys pinned near the bottom (above the home-indicator inset).
    const keyBottom = h - insets.bottom - 14;
    const keyH = clamp(this.laneW * 0.62, 58, 96);
    this.keyBottom = keyBottom;
    this.keyTop = keyBottom - keyH;

    // Falling channel: from just under the progress bar down to the key tops.
    this.boardTop = this.progressY + 22;
    this.hitLineY = this.keyTop;

    // Tiles are roughly square and never taller than ~a third of the channel, so
    // consecutive same-lane notes can't visually overlap even at fast tempo.
    const channel = this.hitLineY - this.boardTop;
    this.tileH = Math.min(this.laneW * 1.02, channel * 0.32);
    this.startCenterY = this.boardTop - this.tileH * 0.5;

    if (this.dom.header) {
      this.dom.header.style.top = `${insets.top + 6}px`;
      this.dom.header.style.height = `${HUD_HEIGHT}px`;
    }
  }

  laneCenterX(lane) { return this.boardX + (lane + 0.5) * this.laneW; }

  // Center y of a tile given the current elapsed time (may go below the line).
  tileCenterY(tile, elapsed) {
    const T = this.game.travelTime;
    const p = (elapsed - (tile.hitTime - T)) / T;
    return this.startCenterY + p * (this.hitLineY - this.startCenterY);
  }

  // MARK: - Input

  bindEvents() {
    window.addEventListener('resize', () => this.performLayout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.performLayout(), 200));
    // Each finger fires its own pointerdown (distinct pointerId) → real
    // multi-touch: two simultaneous taps resolve two chord tiles independently.
    this.canvas.addEventListener('pointerdown', (e) => this.handleTap(e), { passive: true });
  }

  laneAt(clientX, clientY) {
    if (clientY < this.boardTop || clientY > this.keyBottom + 12) return -1;
    const x = clientX - this.boardX;
    if (x < 0 || x > this.boardW) return -1;
    return clamp(Math.floor(x / this.laneW), 0, LANES - 1);
  }

  handleTap(e) {
    if (this.overlayOpen) return;
    this.sound.unlock();

    // First tap begins the falling clock (also satisfies audio autoplay unlock).
    if (this.game.phase === Phase.ready) {
      this.beginPlaying();
      return;
    }
    if (this.game.phase !== Phase.playing) return;

    const lane = this.laneAt(e.clientX, e.clientY);
    if (lane < 0) return;

    const elapsed = this.elapsedSec();
    const tile = this.game.hittableTile(lane, elapsed, GRACE);
    if (tile) {
      tile.resolved = true;
      tile.resolvedAt = this.now();
      this.keyHitAt[lane] = this.now();
      this.sound.playNote(tile.freq, 0.26 + tile.beats * 0.12);
      this.haptics.tap();
    } else {
      // Empty / early tap — soft key flash, no penalty.
      this.keyFlashAt[lane] = this.now();
      this.haptics.tap();
    }
  }

  beginPlaying() {
    this.startTime = this.now();
    this.pausedAccum = 0;
    this.paused = false;
    this.game.start();
    // Retire the one-time two-finger hint once a doubles song has begun.
    if (this.showTwoFingerHint) {
      this.settings.seenTwoFingers = true;
      this.showTwoFingerHint = false;
    }
  }

  // MARK: - Pause / resume (driven by the settings overlay)

  pause() {
    if (this.paused || this.game.phase !== Phase.playing) return;
    this.paused = true;
    this.pauseStart = this.now();
  }

  resume() {
    if (!this.paused) return;
    this.pausedAccum += this.now() - this.pauseStart;
    this.paused = false;
  }

  // MARK: - External controls (from main.js)

  presentSettings() {
    this.overlayOpen = true;
    this.pause();
    this.dom.onPresentSettings?.();
  }

  dismissOverlay() {
    this.overlayOpen = false;
    if (this.game.phase === Phase.playing) this.resume();
  }

  startNewGame() {
    this.game.restartFromStart();
    this._afterReset();
  }

  nextSong() {
    this.game.advanceSong();
    this._afterReset();
  }

  restartSong() {
    this.game.restartSong();
    this._afterReset();
  }

  _afterReset() {
    this.overlayOpen = false;
    this.presented = false;
    this.paused = false;
    this.pausedAccum = 0;
    this.keyHitAt.fill(-1);
    this.keyFlashAt.fill(-1);
    this.performLayout();
    this.updateHud();
    // Offer the calm two-finger hint the first time a doubles song comes up.
    this.showTwoFingerHint = this.game.hasDoubles && !this.settings.seenTwoFingers;
  }

  updateHud() {
    this.dom.setSong?.(this.game.songNumber, this.game.songCount, this.game.song.title);
    this.dom.setProgress?.(0, this.game.duration);
  }

  // MARK: - Render loop

  loop(now) {
    this.pulse = (Math.sin(now / 380) + 1) / 2;

    if (this.game.phase === Phase.playing && !this.paused) {
      const elapsed = this.elapsedSec();
      this.game.sweepMissed(elapsed, MISS_AFTER);
      if (this.game.isComplete(elapsed)) {
        this.game.finish();
        this.completeAt = now;
        this.presented = false;
        this.sound.play(this.game.phase === Phase.victory ? 'win' : 'levelUp');
        this.haptics.win();
      }
    }

    this.render(now);

    // Present the song-complete / victory overlay a beat after the song ends.
    if ((this.game.phase === Phase.songComplete || this.game.phase === Phase.victory)
        && !this.presented && now - this.completeAt > COMPLETE_PAUSE_MS) {
      this.presented = true;
      this.overlayOpen = true;
      if (this.game.phase === Phase.victory) {
        this.dom.onPresentVictory?.({ songs: this.game.songCount });
      } else {
        this.dom.onPresentSongComplete?.({
          song: this.game.songNumber, title: this.game.song.title,
        });
      }
    }

    requestAnimationFrame(this.loop);
  }

  render(now) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackground(ctx);
    this.drawLanes(ctx);
    this.drawProgress(ctx);

    const elapsed = this.elapsedSec();

    // Falling tiles, clipped to the channel + keys area.
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.boardX, this.boardTop, this.boardW, this.keyBottom - this.boardTop);
    ctx.clip();
    for (const tile of this.game.tiles) {
      this.drawTile(ctx, tile, elapsed, now);
    }
    ctx.restore();

    this.drawHitLine(ctx);
    this.drawKeys(ctx, elapsed, now);

    if (this.game.phase === Phase.ready) this.drawReadyPrompt(ctx);
  }

  drawBackground(ctx) {
    const surface = SkinCatalog.surfacePalette;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, css(surface.backgroundTop));
    g.addColorStop(1, css(surface.backgroundBottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawLanes(ctx) {
    ctx.fillStyle = 'rgba(16,18,41,0.28)';
    this.roundRectPath(ctx, this.boardX - 4, this.boardTop - 4,
      this.boardW + 8, this.keyBottom - this.boardTop + 8, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let l = 1; l < LANES; l++) {
      const x = this.boardX + l * this.laneW;
      ctx.beginPath();
      ctx.moveTo(x, this.boardTop);
      ctx.lineTo(x, this.keyTop);
      ctx.stroke();
    }
  }

  drawProgress(ctx) {
    const y = this.progressY;
    const x = this.boardX;
    const w = this.boardW;
    const h = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    this.roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    const frac = this.game.duration ? clamp(this.elapsedSec() / this.game.duration, 0, 1) : 0;
    if (frac > 0) {
      ctx.fillStyle = css(SkinCatalog.blockPalette.colors[1]); // green
      this.roundRectPath(ctx, x, y, Math.max(h, w * frac), h, h / 2);
      ctx.fill();
    }
  }

  drawHitLine(ctx) {
    const y = this.hitLineY;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(this.boardX + 4, y);
    ctx.lineTo(this.boardX + this.boardW - 4, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawTile(ctx, tile, elapsed, now) {
    const T = this.game.travelTime;
    const spawn = tile.hitTime - T;
    if (elapsed < spawn - 0.05) return; // not spawned yet

    let centerY = this.tileCenterY(tile, elapsed);
    let alpha = 1;
    let scale = 1;

    if (tile.resolved) {
      const age = now - (tile.resolvedAt || now);
      if (age > POP_MS) return;
      const k = age / POP_MS;
      alpha = 1 - k;
      scale = 1 + 0.22 * k;
      centerY = this.hitLineY; // pop right on the key
    } else if (tile.missed) {
      if (centerY > this.keyBottom + this.tileH) return;
      alpha = clamp(1 - (centerY - this.hitLineY) / (this.tileH * 1.6), 0.12, 1) * 0.55;
    }

    const w = (this.laneW - Math.min(this.laneW, this.tileH) * 0.12) * scale;
    const h = this.tileH * scale;
    const cx = this.laneCenterX(tile.lane);
    const x = cx - w / 2;
    const y = centerY - h / 2;

    const baseColor = SkinCatalog.blockPalette.colors[LANE_COLOR_INDEX[tile.lane % LANES]];
    const radius = Math.min(w, h) * 0.22;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Bevel shadow.
    const inset = Math.max(0.5, h * 0.03);
    ctx.fillStyle = css(adjustBrightness(baseColor, 0.6));
    this.roundRectPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, radius);
    ctx.fill();

    // Raised face.
    const fx = x + w * 0.04;
    const fy = y + h * 0.04;
    const fw = w - w * 0.08;
    const fh = h - h * 0.12;
    ctx.fillStyle = css(baseColor);
    this.roundRectPath(ctx, fx, fy, fw, fh, radius * 0.85);
    ctx.fill();

    // Gloss.
    ctx.save();
    this.roundRectPath(ctx, fx, fy, fw, fh, radius * 0.85);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(fx, fy, fw, fh * 0.4);
    ctx.restore();

    // Highlight ring when the tile is inside its hit window.
    if (!tile.resolved && !tile.missed && Math.abs(tile.hitTime - elapsed) < GRACE * 1.4) {
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + this.pulse * 0.4})`;
      ctx.lineWidth = 3 + this.pulse * 2;
      this.roundRectPath(ctx, fx + 3, fy + 3, fw - 6, fh - 6, radius * 0.7);
      ctx.stroke();
    }

    if (this.settings.showNames) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `700 ${Math.round(h * 0.32)}px ${fontFamily()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.label, cx, centerY);
    }

    ctx.restore();
  }

  // Proximity glow of a lane's key from its nearest incoming tile (0..1).
  keyGlow(lane, elapsed) {
    let best = 0;
    for (const tile of this.game.tiles) {
      if (tile.lane !== lane || tile.resolved || tile.missed) continue;
      const d = Math.abs(tile.hitTime - elapsed);
      if (d < GLOW_WINDOW) best = Math.max(best, 1 - d / GLOW_WINDOW);
    }
    return best;
  }

  drawKeys(ctx, elapsed, now) {
    const gap = this.laneW * 0.09;
    for (let lane = 0; lane < LANES; lane++) {
      const x = this.boardX + lane * this.laneW + gap;
      const w = this.laneW - gap * 2;
      const y = this.keyTop;
      const h = this.keyBottom - this.keyTop;
      const radius = Math.min(w, h) * 0.28;
      const base = SkinCatalog.blockPalette.colors[LANE_COLOR_INDEX[lane % LANES]];

      const glow = this.keyGlow(lane, elapsed);
      const hitAge = now - this.keyHitAt[lane];
      const flashAge = now - this.keyFlashAt[lane];
      const pressed = hitAge >= 0 && hitAge < KEY_FLASH_MS;
      const flashed = flashAge >= 0 && flashAge < KEY_FLASH_MS;

      // Base key: dim tint of the lane colour, brightening as a tile approaches.
      let bright = 0.34 + glow * 0.5;
      if (pressed) bright = 1.05;
      const face = adjustBrightness(base, bright);

      ctx.save();
      // A soft press: nudge the key down a hair on hit.
      const press = pressed ? (1 - hitAge / KEY_FLASH_MS) : 0;
      ctx.translate(0, press * 3);

      // Shadow / rim.
      ctx.fillStyle = css(adjustBrightness(base, 0.5));
      this.roundRectPath(ctx, x, y + 3, w, h, radius);
      ctx.fill();

      ctx.fillStyle = css(face);
      this.roundRectPath(ctx, x, y, w, h, radius);
      ctx.fill();

      // Top gloss.
      ctx.save();
      this.roundRectPath(ctx, x, y, w, h, radius);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x, y, w, h * 0.42);
      ctx.restore();

      // Glow ring as the tile lands.
      if (glow > 0.02 || flashed) {
        const a = flashed ? (1 - flashAge / KEY_FLASH_MS) * 0.5 : glow * 0.55;
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 2 + glow * 3;
        this.roundRectPath(ctx, x + 2, y + 2, w - 4, h - 4, radius * 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawReadyPrompt(ctx) {
    // Dim the board a touch so the prompt reads.
    ctx.fillStyle = 'rgba(16,18,41,0.35)';
    ctx.fillRect(this.boardX - 4, this.boardTop - 4, this.boardW + 8, this.keyTop - this.boardTop + 8);

    const cx = this.width / 2;
    const cy = this.boardTop + (this.keyTop - this.boardTop) * 0.42;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.font = `800 ${Math.round(this.laneW * 0.5)}px ${fontFamily()}`;
    ctx.fillText(`▶ ${t('tapToPlay')}`, cx, cy);

    if (this.showTwoFingerHint) {
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = `600 ${Math.round(this.laneW * 0.28)}px ${fontFamily()}`;
      ctx.fillText(`✌︎ ${t('twoFingers')}`, cx, cy + this.laneW * 0.55);
    }
  }

  roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

export { GameScene };
