/*! Pickr 1.9.1 MIT | https://github.com/Simonwep/pickr */

// ============================================================
// Color utilities
// ============================================================

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

/** HSV (h: 0-360, s/v: 0-100) → RGB (0-255, 小数のまま) */
function hsvToRgb(h, s, v) {
  s /= 100;
  v /= 100;
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return [f(5), f(3), f(1)];
}

/** RGB (0-255) → HSV (h: 0-360, s/v: 0-100) */
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta + 6) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
  }
  return [h, max ? (delta / max) * 100 : 0, max * 100];
}

const HEX_RE = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const RGB_RE = /^rgba?\D+([\d.]+)(%?)\D+([\d.]+)(%?)\D+([\d.]+)(%?)\D*?(([\d.]+)(%?)|$)/i;
const HSL_RE = /^hsla?\D+([\d.]+)\D+([\d.]+)\D+([\d.]+)\D*?(([\d.]+)(%?)|$)/i;
const HSV_RE = /^hsva?\D+([\d.]+)\D+([\d.]+)\D+([\d.]+)\D*?(([\d.]+)(%?)|$)/i;

/** アルファは扱わないため、不透明（未指定 or 1）以外は不正として弾く */
const isOpaque = (a) => a === undefined || a === 1;
const parseAlpha = (value, percent) =>
  value === undefined ? undefined : Number(value) / (percent === '%' ? 100 : 1);

/**
 * 色文字列 (hex / rgb[a] / hsl[a] / hsv[a]) を [h, s, v] にする。不正なら null。
 */
function parseColor(str) {
  let m;

  if ((m = HEX_RE.exec(str))) {
    let hex = m[1];
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
    const a = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : undefined;
    if (!isOpaque(a)) return null;
    return rgbToHsv(...hex.slice(0, 6).match(/../g).map((c) => parseInt(c, 16)));
  }

  if ((m = RGB_RE.exec(str))) {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const n = Number(m[i]);
      return m[i + 1] === '%' ? (n / 100) * 255 : n;
    });
    const a = parseAlpha(m[8], m[9]);
    if (![r, g, b].every(Number.isFinite) || r > 255 || g > 255 || b > 255 || !isOpaque(a)) {
      return null;
    }
    return rgbToHsv(r, g, b);
  }

  if ((m = HSL_RE.exec(str))) {
    const [h, s, l] = [1, 2, 3].map((i) => Number(m[i]));
    const a = parseAlpha(m[5], m[6]);
    if (![h, s, l].every(Number.isFinite) || h > 360 || s > 100 || l > 100 || !isOpaque(a)) {
      return null;
    }
    const light = l / 100;
    const sat = (s / 100) * (light < 0.5 ? light : 1 - light);
    const ns = ((2 * sat) / (light + sat)) * 100;
    return [h, Number.isNaN(ns) ? 0 : ns, (light + sat) * 100];
  }

  if ((m = HSV_RE.exec(str))) {
    const [h, s, v] = [1, 2, 3].map((i) => Number(m[i]));
    const a = parseAlpha(m[5], m[6]);
    if (![h, s, v].every(Number.isFinite) || h > 360 || s > 100 || v > 100 || !isOpaque(a)) {
      return null;
    }
    return [h, s, v];
  }

  return null;
}

/** HSV の色。アルファは使わない。 */
class HSVColor {
  constructor(h = 0, s = 0, v = 0) {
    this.h = h;
    this.s = s;
    this.v = v;
  }

  clone() {
    return new HSVColor(this.h, this.s, this.v);
  }

  toHSV() {
    return [this.h, this.s, this.v];
  }

  /** "rgb(r, g, b)"（整数丸め） */
  toCSS() {
    const [r, g, b] = hsvToRgb(this.h, this.s, this.v).map(Math.round);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /** "#rrggbb"*/
  toHEX() {
    const hex = hsvToRgb(this.h, this.s, this.v)
      .map((c) => Math.round(c).toString(16).padStart(2, '0'))
      .join('');
    return `#${hex}`;
  }
}

// ============================================================
// Moveable: ドラッグ / キーボードで 0-1 の座標を取るつまみ
// ============================================================

const ARROW_KEYS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};
const KEY_STEP = 0.01;

class Moveable {
  #wrapper;
  #element;
  #axis;
  #onstart;
  #onchange;
  #x = 0;
  #y = 0;

  /**
   * @param {object}   opt
   * @param {Element}  opt.wrapper  操作領域
   * @param {Element}  opt.element  つまみ
   * @param {'xy'|'y'} [opt.axis]   'y' はつまみを縦方向だけに動かす（Hueスライダー用）
   * @param {Function} [opt.onstart]  ドラッグ開始時
   * @param {Function} opt.onchange   (x, y) 0-1
   */
  constructor({ wrapper, element, axis = 'xy', onstart, onchange }) {
    this.#wrapper = wrapper;
    this.#element = element;
    this.#axis = axis;
    this.#onstart = onstart;
    this.#onchange = onchange;

    for (const target of [wrapper, element]) {
      target.style.touchAction = 'none';
      target.addEventListener('pointerdown', this.#onPointerDown);
      target.addEventListener('pointermove', this.#onPointerMove);
    }
    wrapper.addEventListener('keydown', this.#onKeyDown);
  }

  /** 位置を設定（0-1）して onchange を呼ぶ */
  set(x = 0, y = 0) {
    this.#x = clamp01(x);
    this.#y = clamp01(y);

    const el = this.#element;
    if (this.#axis !== 'y') {
      el.style.left = `calc(${this.#x * 100}% - ${el.offsetWidth / 2}px)`;
    }
    el.style.top = `calc(${this.#y * 100}% - ${el.offsetHeight / 2}px)`;

    this.#onchange(this.#x, this.#y);
  }

  /** 現在位置のまま onchange を呼び直す（Hue変更でパレットを再描画する時など） */
  refresh() {
    this.set(this.#x, this.#y);
  }

  #fromPointer({ clientX, clientY }) {
    const { left, top, width, height } = this.#wrapper.getBoundingClientRect();
    this.set(width ? (clientX - left) / width : 0, height ? (clientY - top) / height : 0);
  }

  #onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    this.#onstart?.();
    this.#fromPointer(e);
  };

  #onPointerMove = (e) => {
    // pointerdown で capture している間だけ追従する
    if (e.currentTarget.hasPointerCapture(e.pointerId)) this.#fromPointer(e);
  };

  #onKeyDown = (e) => {
    const dir = ARROW_KEYS[e.key];
    if (!dir) return;
    e.preventDefault();

    if (this.#axis === 'y') {
      // 上 / 右 でつまみが上へ、下 / 左で下へ
      const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? -1 : 1;
      this.set(this.#x, this.#y + KEY_STEP * d);
    } else {
      this.set(this.#x + KEY_STEP * dir[0], this.#y + KEY_STEP * dir[1]);
    }
  };
}

// ============================================================
// DOM
// ============================================================

import { pickr as pickrTpl } from '../build/templates.json';

function createDom() {
  const tpl = document.createElement('template');
  tpl.innerHTML = pickrTpl;
  const root = tpl.content.firstElementChild;
  const $ = (selector) => root.querySelector(selector);

  return {
    root,
    button: $('.pcr-button'),
    app: $('.pcr-app'),
    lastColor: $('.pcr-last-color'),
    currentColor: $('.pcr-current-color'),
    palette: $('.pcr-palette'),
    paletteThumb: $('.pcr-color-palette .pcr-picker'),
    hue: $('.pcr-hue'),
    hueThumb: $('.pcr-color-chooser .pcr-picker'),
    input: $('.pcr-result'),
    save: $('.pcr-save'),
  };
}

// ============================================================
// Pickr
// ============================================================

/**
 * events:
 *   init   (pickr)
 *   show   (color)
 *   hide   ()
 *   change (color, source)   source: 'slider' | 'input' | undefined
 *   save   (color)
 * color は HSVColor（toHEX() / toCSS() / toHSV()）
 */
export default class Pickr {
  #dom;
  #palette;
  #hue;
  #color = new HSVColor();
  #lastColor = new HSVColor();
  #listeners = new Map();

  // 入力欄にフォーカスしている間は false。スライダー操作でも色を再計算しない
  #recalc = true;
  // 初期化中は change / save を発火しない
  #initializing = true;

  /**
   * @param {object}         opt
   * @param {string|Element} opt.el        置き換える要素（セレクタ可）
   * @param {string}         [opt.default] 初期色
   */
  constructor({ el, default: defaultColor = '#42445a' } = {}) {
    const target = typeof el === 'string' ? document.querySelector(el) : el;
    if (!(target instanceof Element)) {
      throw new TypeError('Pickr: `el` must be an element or a selector that matches one');
    }

    const dom = (this.#dom = createDom());

    // ダイアログは body 直下へ、ボタンは対象要素の位置へ
    document.body.append(dom.app);
    target.replaceWith(dom.root);

    this.#buildComponents();
    this.#bindEvents();

    // レイアウト確定後に初期色を反映
    requestAnimationFrame(() => {
      this.setColor(defaultColor);
      this.#initializing = false;
      this.#emit('init', this);
    });
  }

  // ---------- public ----------

  on(event, cb) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push(cb);
    return this;
  }

  isOpen() {
    return this.#dom.app.classList.contains('visible');
  }

  /** ダイアログ要素（.pcr-app） */
  getApp() {
    return this.#dom.app;
  }

  /** @returns {boolean} 状態が変わったか */
  show() {
    if (this.isOpen()) return false;

    this.#dom.app.classList.add('visible');
    this.#emit('show', this.#color);

    // 表示確定後につまみ位置を再計算
    requestAnimationFrame(() => {
      const { h, s, v } = this.#color;
      this.#hue.set(0, h / 360);
      this.#palette.set(s / 100, 1 - v / 100);
    });
    return true;
  }

  /** @returns {boolean} 状態が変わったか */
  hide() {
    if (!this.isOpen()) return false;

    this.#dom.app.classList.remove('visible');
    this.#emit('hide');
    return true;
  }

  /**
   * 色文字列を設定する。例: "#fff" / "rgb(10 10 200)" / "hsva 10 20 5"
   * @param {string}  str
   * @param {boolean} [silent=false] true なら「保存」扱いにしない（ボタン色・前回色を更新しない）
   * @returns {boolean} 受理されたか
   */
  setColor(str, silent = false) {
    const hsv = parseColor(str);
    return hsv ? this.#setHSV(...hsv, silent) : false;
  }

  // ---------- internal ----------

  #emit(event, ...args) {
    this.#listeners.get(event)?.forEach((cb) => cb(...args));
  }

  #buildComponents() {
    const { palette, paletteThumb, hue, hueThumb, currentColor } = this.#dom;

    this.#palette = new Moveable({
      wrapper: palette,
      element: paletteThumb,
      onstart: () => (this.#recalc = true),
      onchange: (x, y) => {
        const color = this.#color;

        if (this.#recalc) {
          color.s = x * 100;
          color.v = 100 - y * 100;
          this.#updateOutput('slider');
        }

        const css = color.toCSS();
        paletteThumb.style.background = css;
        palette.style.background = `
          linear-gradient(to top, #000, transparent),
          linear-gradient(to left, hsl(${color.h} 100% 50%), #fff)`;
        currentColor.style.setProperty('--pcr-color', css);
      },
    });

    this.#hue = new Moveable({
      wrapper: hue,
      element: hueThumb,
      axis: 'y',
      onstart: () => (this.#recalc = true),
      onchange: (_x, y) => {
        if (this.#recalc) this.#color.h = y * 360;
        hueThumb.style.backgroundColor = `hsl(${this.#color.h} 100% 50%)`;
        this.#palette.refresh();
      },
    });
  }

  #bindEvents() {
    const { button, app, lastColor, input, save } = this.#dom;

    // 前回の色に戻す
    lastColor.addEventListener('click', () => this.#setHSV(...this.#lastColor.toHSV(), true));

    // 保存（ダイアログは閉じない。閉じるのは外側クリック / Esc / ボタン）
    save.addEventListener('click', () => this.#applyColor());

    // 手入力
    const onInput = (e) => {
      if (this.setColor(e.target.value, true) && !this.#initializing) {
        this.#emit('change', this.#color, 'input');
      }
      e.stopImmediatePropagation();
    };
    input.addEventListener('keyup', onInput);
    input.addEventListener('input', onInput);

    // 入力中はスライダー由来の再計算を止める
    const onFocusChange = (e) => {
      this.#recalc = e.type === 'blur';
      if (this.#recalc) this.#updateOutput(null);
    };
    input.addEventListener('focus', onFocusChange);
    input.addEventListener('blur', onFocusChange);

    // 開閉
    button.addEventListener('click', () => (this.isOpen() ? this.hide() : this.show()));

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.hide();
    });

    // ダイアログ外を押したら閉じる
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.isOpen()) return;
        const path = e.composedPath();
        if (!path.includes(app) && !path.includes(button)) this.hide();
      },
      { capture: true },
    );
  }

  #updateOutput(source) {
    this.#dom.input.value = this.#color.toHEX();

    if (!this.#initializing && this.#recalc) {
      this.#emit('change', this.#color, source);
    }
  }

  #applyColor() {
    const css = this.#color.toCSS();
    this.#dom.lastColor.style.setProperty('--pcr-color', css);
    this.#dom.button.style.setProperty('--pcr-color', css);
    this.#lastColor = this.#color.clone();

    if (!this.#initializing) this.#emit('save', this.#color);
  }

  /** @returns {boolean} 範囲内で受理されたか */
  #setHSV(h, s, v, silent = false) {
    // NaN も弾く
    if (!(h >= 0 && h <= 360 && s >= 0 && s <= 100 && v >= 0 && v <= 100)) return false;

    // つまみを動かす間は色の再計算を止める（onchange で値を上書きしないため）
    const recalc = this.#recalc;
    this.#recalc = false;

    this.#color = new HSVColor(h, s, v);
    this.#hue.set(0, h / 360);
    this.#palette.set(s / 100, 1 - v / 100);

    if (!silent) this.#applyColor();
    if (recalc) this.#updateOutput();

    this.#recalc = recalc;
    return true;
  }
}
