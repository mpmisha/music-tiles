// Canvas renderer + controller for Music Tiles. Owns layout, the self-paced
// downward scroll animation, tap input, the game loop, and delegating HUD /
// overlay updates to the DOM (see the `dom` contract used by main.js).
import { MusicGame, Phase, LANES } from './game.js';
import { SkinCatalog } from './skins.js';
import { SettingsStore } from './storage.js';
import { SoundPlayer, Haptics } from './audio.js';
import { css, adjustBrightness } from './color.js';
import { fontFamily } from './i18n.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const HUD_HEIGHT = 64;
const GAP_TOP = 12;
const SCROLL_MS = 140;
const WRONG_MS = 260;
const COMPLETE_PAUSE_MS = 650;
const VISIBLE_ABOVE = 4; // rows drawn above the current one

// Lane colours (from the shared candy palette) — one steady colour per lane so
// the four columns read clearly: purple, blue, pink, yellow.
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

    this.scroll = 0; // animated offset in [-rowHeight..0], 0 = at rest
    this.scrollFrom = 0;
    this.scrollStart = 0;
    this.wrongLane = -1;
    this.wrongAt = 0;
    this.pulse = 0;

    this.dpr = Math.min(window.devicePixelRatio || 1, 3);

    this.bindEvents();
    this.performLayout();
    this.updateHud();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
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
    const progressY = this.hudTop + HUD_HEIGHT + 4;
    this.progressY = progressY;
    const boardTop = progressY + 22;
    const boardBottom = h - insets.bottom - 18;

    const pad = 14;
    this.boardX = pad;
    this.boardW = w - pad * 2;
    this.laneW = this.boardW / LANES;

    const boardH = boardBottom - boardTop;
    this.boardTop = boardTop;
    this.boardBottom = boardBottom;
    // Show ~4.6 rows; the current tile sits near the bottom with a small gap.
    this.rowH = boardH / 4.6;
    this.bottomGap = this.rowH * 0.22;
    this.hitTop = boardBottom - this.rowH - this.bottomGap;
    this.hitBottom = this.hitTop + this.rowH;

    if (this.dom.header) {
      this.dom.header.style.top = `${insets.top + 6}px`;
      this.dom.header.style.height = `${HUD_HEIGHT}px`;
    }
  }

  // y of the top of row `index`'s cell, given the current pointer + scroll.
  rowY(index) {
    return this.hitTop + (this.game.pointer - index) * this.rowH + this.scroll * this.rowH;
  }

  laneRect(lane, top) {
    const gap = Math.min(this.laneW, this.rowH) * 0.06;
    return {
      x: this.boardX + lane * this.laneW + gap,
      y: top + gap,
      w: this.laneW - gap * 2,
      h: this.rowH - gap * 2,
    };
  }

  // MARK: - Input

  bindEvents() {
    window.addEventListener('resize', () => this.performLayout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.performLayout(), 200));
    this.canvas.addEventListener('pointerdown', (e) => this.handleTap(e));
  }

  laneAt(clientX, clientY) {
    const x = clientX - this.boardX;
    if (x < 0 || x > this.boardW) return -1;
    if (clientY < this.boardTop || clientY > this.height) return -1;
    return clamp(Math.floor(x / this.laneW), 0, LANES - 1);
  }

  handleTap(e) {
    if (this.overlayOpen) return;
    this.sound.unlock();
    if (this.game.phase !== Phase.playing) return;
    const lane = this.laneAt(e.clientX, e.clientY);
    if (lane < 0) return;

    const row = this.game.currentRow;
    const result = this.game.tap(lane);
    if (!result) return;

    if (result === 'wrong') {
      this.wrongLane = lane;
      this.wrongAt = performance.now();
      this.sound.play('wrong');
      this.haptics.wrong();
      return;
    }

    // A correct tap: play the note, scroll the board down by one row.
    this.sound.playNote(row.freq, 0.28 + row.beats * 0.14);
    this.haptics.tap();
    this.scrollFrom = -1;
    this.scroll = -1;
    this.scrollStart = performance.now();
    this.updateHud();

    if (result === 'songComplete' || result === 'victory') {
      this.presented = false;
      this.completeAt = performance.now();
      this.sound.play(result === 'victory' ? 'win' : 'levelUp');
      this.haptics.win();
    }
  }

  // MARK: - External controls (from main.js)

  presentSettings() {
    this.overlayOpen = true;
    this.dom.onPresentSettings?.();
  }

  dismissOverlay() {
    this.overlayOpen = false;
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
    this.scroll = 0;
    this.wrongLane = -1;
    this.performLayout();
    this.updateHud();
  }

  updateHud() {
    this.dom.setSong?.(this.game.songNumber, this.game.songCount, this.game.song.title);
    this.dom.setProgress?.(this.game.pointer, this.game.total);
  }

  // MARK: - Render loop

  loop(now) {
    // Advance the scroll animation.
    if (this.scroll !== 0) {
      const t = clamp((now - this.scrollStart) / SCROLL_MS, 0, 1);
      this.scroll = this.scrollFrom * (1 - easeOut(t));
      if (t >= 1) this.scroll = 0;
    }
    this.pulse = (Math.sin(now / 380) + 1) / 2;

    this.render(now);

    // Present the song-complete / victory overlay a beat after the last note.
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

    const rows = this.game.rows;
    const ptr = this.game.pointer;
    const showNames = this.settings.showNames;
    const finished = this.game.phase !== Phase.playing;

    // Clip tile drawing to the board so tiles fade out below the hit line.
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.boardX, this.boardTop, this.boardW, this.hitBottom + this.rowH - this.boardTop);
    ctx.clip();

    // Draw from the just-tapped row (ptr-1, fading below) up to the visible top.
    for (let i = ptr - 1; i <= ptr + VISIBLE_ABOVE; i++) {
      if (i < 0 || i >= rows.length) continue;
      const row = rows[i];
      const top = this.rowY(i);
      if (top > this.hitBottom + this.rowH || top < this.boardTop - this.rowH) continue;
      const isCurrent = i === ptr && !finished;
      let alpha = 1;
      if (i < ptr) {
        // The tile just played, sliding below the hit line — fade it out.
        alpha = clamp(1 - (top - this.hitTop) / this.rowH, 0, 1) * 0.5;
      }
      this.drawTile(ctx, row, top, isCurrent, showNames, alpha, now);
    }
    ctx.restore();

    // The "now" hit line.
    this.drawHitLine(ctx);
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
    // Board backdrop.
    ctx.fillStyle = 'rgba(16,18,41,0.28)';
    this.roundRectPath(ctx, this.boardX - 4, this.boardTop - 4,
      this.boardW + 8, this.hitBottom + this.rowH - this.boardTop + 8, 18);
    ctx.fill();
    // Lane separators.
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let l = 1; l < LANES; l++) {
      const x = this.boardX + l * this.laneW;
      ctx.beginPath();
      ctx.moveTo(x, this.boardTop);
      ctx.lineTo(x, this.hitBottom);
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
    const frac = this.game.total ? this.game.pointer / this.game.total : 0;
    if (frac > 0) {
      ctx.fillStyle = css(SkinCatalog.blockPalette.colors[1]); // green
      this.roundRectPath(ctx, x, y, Math.max(h, w * frac), h, h / 2);
      ctx.fill();
    }
  }

  drawHitLine(ctx) {
    const y = this.hitBottom + 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(this.boardX + 4, y);
    ctx.lineTo(this.boardX + this.boardW - 4, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawTile(ctx, row, top, isCurrent, showNames, alpha, now) {
    let lane = row.lane;
    let dx = 0;
    // Wrong-tap wobble on the current tile.
    if (isCurrent && now - this.wrongAt < WRONG_MS) {
      const p = (now - this.wrongAt) / WRONG_MS;
      dx = Math.sin(p * Math.PI * 6) * (1 - p) * this.laneW * 0.12;
    }
    const r = this.laneRect(lane, top);
    r.x += dx;
    const baseColor = SkinCatalog.blockPalette.colors[LANE_COLOR_INDEX[lane % LANES]];
    const radius = Math.min(r.w, r.h) * 0.22;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Bevel shadow.
    const inset = Math.max(0.5, r.h * 0.03);
    ctx.fillStyle = css(adjustBrightness(baseColor, 0.6));
    this.roundRectPath(ctx, r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, radius);
    ctx.fill();

    // Raised face.
    const fx = r.x + r.w * 0.04;
    const fy = r.y + r.h * 0.04;
    const fw = r.w - r.w * 0.08;
    const fh = r.h - r.h * 0.12;
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

    // Current-tile "tap me" ring pulse.
    if (isCurrent) {
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + this.pulse * 0.5})`;
      ctx.lineWidth = 3 + this.pulse * 2;
      this.roundRectPath(ctx, fx + 3, fy + 3, fw - 6, fh - 6, radius * 0.7);
      ctx.stroke();
    }

    if (showNames) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `700 ${Math.round(r.h * 0.32)}px ${fontFamily()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.label, r.x + r.w / 2, r.y + r.h * 0.5);
    }

    ctx.restore();
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
