import { createEqualsIcon, makeDraggable, parseTag, render } from './shared.js';
import Pickr from './pickr.js';
import {
  saveConfirmOverlay as saveConfirmOverlayTpl,
  jsonWindow as jsonWindowTpl,
} from '../build/templates.json';

import jsonWinStyles from '../build/json-window.min.css';

import windowStyles from '../build/novel-window.min.css';
const styleEl = document.createElement('style');
document.head.appendChild(styleEl);
styleEl.textContent = windowStyles;

import pickrCss from '../build/classic.min.css';
const pickrStyleEl = document.createElement('style');
pickrStyleEl.textContent = pickrCss;
document.head.appendChild(pickrStyleEl);

/* --- */

const win = window;
const doc = document;

const novelDisplay = doc.getElementById('novelDisplay');

win.addEventListener('message', (event) => {

  const msg = event.data;
  if (!msg || msg.type !== 'NOVEL_DATA') return;

  const data = msg.payload;

  const {
    totalVisibleChars,
    numPages,
    pageRanges,
    novelHtml,
    pageCharCounts,
    validPageCount,
    notices = []
  } = data;

  if (notices.length > 0) {
    alert(notices.join('\n'));
  }

  // 縦に長い長文要素の自動スクロール負荷軽減のためのpan分割関数
  // タグ内<>とエンティティ内&;は避ける
  function chunkHTMLSafe(html, chunkSize) {
    const chunks = [];
    const len = html.length;
    let i = 0, last = 0, count = 0, rubyDepth = 0;

    while (i < len) {

      if (html.charCodeAt(i) === 60) { // '<'
        const tag = parseTag(html, i);
        if (!tag) {
          i = len;
          break;
        }
        if (tag.name === 'ruby') {
          rubyDepth += tag.isClosing ? -1 : 1;
          rubyDepth = Math.max(0, rubyDepth);
        }
        i = tag.end + 1;
        continue;
      }

      if (html.charCodeAt(i) === 38) { // '&'
        const semi = html.indexOf(';', i + 1);
        i = semi !== -1 ? semi + 1 : len;
      } else {
        i++;
      }

      count++;
      if (count >= chunkSize && rubyDepth === 0) {
        chunks.push(html.slice(last, i));
        last = i;
        count = 0;
      }
    }

    if (last < len) chunks.push(html.slice(last));
    return chunks;
  }

  // レンダリング関数
  function renderPart(pageIndex) {
    novelDisplay.innerHTML = '';
    const frag = document.createDocumentFragment();
    const range = pageRanges[pageIndex];

    // 前ページのtailを半透明で追加
    if (pageIndex > 0) {
      const prevRange = pageRanges[pageIndex - 1];
      const tailHTML = novelHtml.slice(prevRange.tailHtmlStart, prevRange.endHtmlPos);
      const span = document.createElement('span');
      span.style.opacity = '0.5';
      span.innerHTML = tailHTML;
      frag.appendChild(span);
    }

    // メイン本文をchunk分割してspan生成
    const mainHTML = novelHtml.slice(range.startHtmlPos, range.endHtmlPos);
    for (const chunkHTML of chunkHTMLSafe(mainHTML, 50)) {
      const span = document.createElement('span');
      span.innerHTML = chunkHTML;
      frag.appendChild(span);
    }

    novelDisplay.appendChild(frag);
  }

  // 初回表示
  let currentIndex = 0;
  renderPart(currentIndex);

  function getOverlayElements() {
    const overlay = doc.getElementById('page-switch-overlay');
    return {
      overlay,
      pageInput: overlay.querySelector('#page-input'),
      yesButton: overlay.querySelector('#yesButton'),
      noButton: overlay.querySelector('#noButton'),
    };
  }

  // ページが有効かチェックする関数
  function isValidPage(pageIndex) {
    return pageIndex >= 0 &&
           pageIndex < pageRanges.length &&
           pageCharCounts[pageIndex] > 0;
  }

  // 桁数に応じてinputの幅を調整
  function adjustInputWidth(input) {
    const digits = input.value.length || 1;
    input.style.width = `${digits + 2}ch`;
  }

  const overlayElements = getOverlayElements();

  // オーバーレイ表示関数
  function showOverlay(defaultPage, maxPage, onYes) {
    overlayElements.pageInput.value = defaultPage;
    adjustInputWidth(overlayElements.pageInput);
    overlayElements.pageInput.max = maxPage;
    disableBodyScroll();
    overlayElements.overlay.style.display = 'flex';

    let lastValidValue = defaultPage;

    // 入力制御
    const handleInput = () => {

      if (overlayElements.pageInput.value === '') {
        adjustInputWidth(overlayElements.pageInput);
        return;
      }

      const max = parseInt(overlayElements.pageInput.max) || Infinity;
      const min = parseInt(overlayElements.pageInput.min) || 1;
      let val = parseInt(overlayElements.pageInput.value);

      if (val > max) val = max;
      else if (val < min) val = min;

      if (isValidPage(val - 1)) {
          lastValidValue = val;
      } else {
          val = lastValidValue;
      }

      overlayElements.pageInput.value = val;
      adjustInputWidth(overlayElements.pageInput);
    };

    // はい
    const handleYes = () => {
      const targetPage = parseInt(overlayElements.pageInput.value);

      if (isNaN(targetPage)) {
        win.alert(`1から${maxPage}の範囲で入力してください。`);
        return;
      }

      overlayElements.overlay.style.display = 'none';
      enableBodyScroll();
      cleanup();
      onYes(targetPage);
    };

    // いいえ
    const handleNo = () => {
      overlayElements.overlay.style.display = 'none';
      enableBodyScroll();
      cleanup();
      isSwitching = false;
      promptShownForward = false;
      promptShownBackward = false;
    };

    // オーバーレイ背景クリック
    const handleOverlayClick = (e) => {
      if (e.target === overlayElements.overlay) {
        handleNo();
      }
    };

    // イベントリスナー削除
    const cleanup = () => {
      overlayElements.pageInput.removeEventListener('input', handleInput);
      overlayElements.yesButton.removeEventListener('click', handleYes);
      overlayElements.noButton.removeEventListener('click', handleNo);
      overlayElements.overlay.removeEventListener('click', handleOverlayClick);
    };

    // イベントリスナー追加
    overlayElements.pageInput.addEventListener('input', handleInput);
    overlayElements.yesButton.addEventListener('click', handleYes);
    overlayElements.noButton.addEventListener('click', handleNo);
    overlayElements.overlay.addEventListener('click', handleOverlayClick);
  }

  // ビューポート高さキャッシュ
  let cachedViewportHeight = 0;
  function updateViewportHeightCache() {
    cachedViewportHeight = win.visualViewport?.height ?? win.innerHeight;
  }
  // body高さキャッシュ
  let cachedBodyHeight = 0;
  function updateBodyHeightCache() {
    cachedBodyHeight = doc.body.offsetHeight;
  }
  win.requestAnimationFrame(() => {
    win.requestAnimationFrame(() => {
      updateViewportHeightCache();
      updateBodyHeightCache();
      updateSliderDisabled();
      updateSliderThumbPosition();
    });
  });

  // ページ切り替え可能フラグ
  let promptShownForward = false;
  let promptShownBackward = false;
  // 切り替え中フラグ
  let isSwitching = false;

  win.addEventListener('scroll', () => {
    if (isSwitching) return;
    // ユーザーが手動スクロールした場合に基準を現在位置に更新
    if (rafId !== null && Math.abs(scroller.scrollTop - preciseScroll) > 2) {
      preciseScroll = scroller.scrollTop;
    }

    updateSliderDisabled();

    const scrollBottom = win.scrollY + cachedViewportHeight;
    const scrollTop = win.scrollY;
    const bodyHeight = cachedBodyHeight;

    // 下方向・最下部で次ページ
    if (
      totalVisibleChars > 10000 &&
      scrollBottom >= bodyHeight - 5 &&
      currentIndex < pageRanges.length - 1 &&
      promptShownForward &&
      isValidPage(currentIndex + 1)
    ) {
      const nextPage = currentIndex + 2;
      showOverlay(nextPage, numPages, (targetPage) => {
        isSwitching = true;
        currentIndex = targetPage - 1;
        renderPart(currentIndex);
        win.requestAnimationFrame(() => {
          win.requestAnimationFrame(() => {
            updateBodyHeightCache();
          });
        });
        win.scrollTo(0, 0);
        scrollSliderRight.disabled = false;
        scrollSliderLeft.disabled = false;
        win.setTimeout(() => {
          isSwitching = false;
        }, 50);
        promptShownForward = false;
        promptShownBackward = false;
      });
    } else if (scrollBottom < bodyHeight - cachedViewportHeight / 4) {
      // 最上部から（25%）離れたらフラグON
      promptShownForward = true;
    }

    // 上方向・最上部で前ページ
    if (
      totalVisibleChars > 10000 &&
      scrollTop <= 5 &&
      promptShownBackward
    ) {
      const targetPageForPrompt = currentIndex === 0 ? validPageCount : currentIndex;
      resetScrollSliders();
      showOverlay(targetPageForPrompt, numPages , (targetPage) => {
        isSwitching = true;
        currentIndex = targetPage - 1;
        renderPart(currentIndex);
        win.requestAnimationFrame(() => {
          win.requestAnimationFrame(() => {
            updateBodyHeightCache();
            if (currentIndex === pageRanges.length - 1) {
              win.scrollTo(0, 0);
            } else {
              win.scrollTo(0, 1e9);
              scrollSliderRight.disabled = true;
              scrollSliderLeft.disabled = true;
            }
            win.setTimeout(() => {
              isSwitching = false;
            }, 50);
            promptShownForward = false;
            promptShownBackward = false;
          });
        });
      });
    } else if (scrollTop > (currentIndex === 0 ? cachedViewportHeight / 1.5625 : cachedViewportHeight / 4)) {
      // 最上部から（1ページ目:64%、それ以外:25%）離れたらフラグON
      promptShownBackward = true;
    }
  }, { passive: true });

  // 最下部でスクロールスライダーリセットし、操作無効化
  let isSliderDisabled = false;

  function updateSliderDisabled() {
    const scrollBottom = win.scrollY + cachedViewportHeight;
    const atBottom = scrollBottom >= cachedBodyHeight - 5;

    if (atBottom === isSliderDisabled) return;

    isSliderDisabled = atBottom;
    if (atBottom) {
      resetScrollSliders();
      scrollSliderRight.disabled = true;
      scrollSliderLeft.disabled = true;
    } else {
      scrollSliderRight.disabled = false;
      scrollSliderLeft.disabled = false;
    }
  }

  win.visualViewport?.addEventListener('resize', () => {
    updateViewportHeightCache();
    updateSliderDisabled();
    updateSliderThumbPosition();
  });

  function resetScrollSliders() {
    if (typeof scrollSliderRight !== 'undefined') scrollSliderRight.value = 0;
    if (typeof scrollSliderLeft !== 'undefined') scrollSliderLeft.value = 0;
    if (typeof scrollSpeed !== 'undefined') scrollSpeed = 0;
    lastTimestamp = null;
    setOpenBtnsVisibility(true);
  }

  function disableBodyScroll() {
    doc.body.style.overflow = 'hidden';
    doc.documentElement.style.overflow = 'hidden';
  }

  function enableBodyScroll() {
    doc.body.style.overflow = '';
    doc.documentElement.style.overflow = '';
  }

  // スライダー要素を取得（HTMLは novel-window.html）
  function setupSlider(id) {
    const slider = doc.getElementById(id);
    slider.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    return slider;
  }

  function updateSliderThumbPosition() {
    const h = cachedViewportHeight;
    doc.documentElement.style.setProperty('--slider-height', `${h}px`);
    doc.documentElement.style.setProperty('--slider-thumb-top', `${h * 0.9}px`);
  }

  // 左右スライダー作成
  const scrollSliderRight = setupSlider('scrollSliderRight');
  const scrollSliderLeft  = setupSlider('scrollSliderLeft');
  updateViewportHeightCache();
  updateSliderThumbPosition();

  // === スクロール処理 ===
  const scroller = doc.scrollingElement || doc.documentElement;
  let scrollSpeed = 0;
  let lastTimestamp = null; // 前フレームの時刻
  let rafId = null;         // アニメーションループの管理ID
  let preciseScroll = 0;    // 小数点以下も保持する正確なスクロール位置

  function forceScroll(timestamp) {
    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
      preciseScroll = scroller.scrollTop;
    }

    if (scrollSpeed === 0) {
      rafId = null;
      lastTimestamp = null;
      return;
    }

    // 経過時間を最大32msに抑えて、タブ復帰時などの急激な飛びを防ぐ
    const elapsed = Math.min(timestamp - lastTimestamp, 32);

    preciseScroll += (scrollSpeed * elapsed) / 1000;
    scroller.scrollTop = preciseScroll;

    lastTimestamp = timestamp;

    rafId = requestAnimationFrame(forceScroll);
  }

  function startScrollLoop() {
    if (rafId === null && scrollSpeed !== 0) {
      rafId = requestAnimationFrame(forceScroll);
    }
  }

  function onSliderInput(e) {
    const val = +e.target.value;
    scrollSpeed = val * speedScale;
    setOpenBtnsVisibility(val === 0);

    if (scrollSliderRight !== e.target) scrollSliderRight.value = val;
    if (scrollSliderLeft !== e.target) scrollSliderLeft.value = val;
    startScrollLoop();
  }
  [scrollSliderRight, scrollSliderLeft].forEach((slider) => {
    slider.addEventListener("input", onSliderInput);
  });

  // タブまたはウィンドウの非アクティブでスライダー値リセット
  doc.addEventListener("visibilitychange", () => {
    if (doc.hidden) {
      resetScrollSliders();
    }
  });

  win.addEventListener("blur", resetScrollSliders);

  // 各種UIOpenBtnを表示/非表示する
  function setOpenBtnsVisibility(visible) {
    const display = visible ? 'block' : 'none';
    sUIOpenBtn.style.display = display;
    fUIOpenBtn.style.display = display;
    oUIOpenBtn.style.display = display;
    // Pickr パネルを開いている間は □ を出さない
    pUIOpenBtn.style.display = (visible && !isPickrContainerOpen) ? 'block' : 'none';
  }

  // ==============================
  // Slider Settings
  // ==============================

  const scrollUI = doc.getElementById('scrollUI');

  const SCROLL_FIELD_MAP = {
    scrollRight:      { prop: 'checked', event: 'change',  key: 'right',       parser: null },
    scrollLeft:       { prop: 'checked', event: 'change',  key: 'left',        parser: null },
    scrollS:          { prop: 'value',   event: 'input',   key: 'shadow',      parser: Number },
    scrollO:          { prop: 'value',   event: 'input',   key: 'opacity',     parser: parseFloat },
    scrollB:          { prop: 'checked', event: 'change',  key: 'border',      parser: null },
    scrollC:          { prop: 'checked', event: 'change',  key: 'colorIn',     parser: null },
    scrollX:          { prop: 'value',   event: 'input',   key: 'position',    parser: Number },
    scrollW:          { prop: 'value',   event: 'input',   key: 'width',       parser: Number },
    scrollSpeedScale: { prop: 'value',   event: 'input',   key: 'speedScale',  parser: parseFloat },
    scrollHide:       { prop: 'checked', event: 'change',  key: 'showThumb',    parser: null },
  };

  function applyScrollSettings(settings) {
    Object.entries(SCROLL_FIELD_MAP).forEach(([id, { prop, event, key }]) => {
      const value = settings[key];
      if (value === undefined) return;
      const el = doc.getElementById(id);
      if (!el) return;
      el[prop] = value;
      el.dispatchEvent(new Event(event));
    });
  }

  // === イベント ===
  // 共通のスタイル適用関数
  const applyToSliders = (fn) => {
    fn(scrollSliderRight);
    fn(scrollSliderLeft);
  };

  // Right/Left
  const rightbox = doc.getElementById('scrollRight');
  const leftbox = doc.getElementById('scrollLeft');

  function updateDisplay() {
    scrollSliderRight.style.display = rightbox.checked ? 'block' : 'none';
    scrollSliderLeft.style.display = leftbox.checked ? 'block' : 'none';
  }

  [rightbox, leftbox].forEach(box => {
    box.addEventListener('change', updateDisplay);
  });

  // Shadow
  const scrollS = doc.getElementById('scrollS');
  scrollS.addEventListener('input', () => {
    const val = Number(scrollS.value) || 0;
    const shadow = val < 0 ? `inset 0 0 ${Math.abs(val)}px` : `0 0 ${val}px`;
    applyToSliders(el => el.style.boxShadow = shadow);
  });
  scrollS.addEventListener('blur', e => {
    if (e.target.value === '') {
      e.target.value = '0';
      applyToSliders(el => el.style.boxShadow = '0 0 0px');
    }
  });

  // Opacity
  const opacityInput = doc.getElementById('scrollO');
  opacityInput.addEventListener('input', e => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      applyToSliders(el => el.style.opacity = num / 100);
    }
  });
  opacityInput.addEventListener('blur', e => {
    let num = parseFloat(e.target.value);
    if (e.target.value === '' || isNaN(num)) {
      num = 0;
    } else {
      num = Math.max(0, Math.min(100, num));
    }
    e.target.value = num;
    applyToSliders(el => el.style.opacity = num / 100);
  });

  // Border & Color
  ['scrollB', 'scrollC'].forEach((id, i) => {
    const el = doc.getElementById(id);
    el.addEventListener('change', e => {
      const otherId = i ? 'scrollB' : 'scrollC';
      const otherEl = doc.getElementById(otherId);

      if (e.target.checked) {
        otherEl.checked = false;
        otherEl.dispatchEvent(new Event('change'));
      }

      const isBorder  = doc.getElementById('scrollB').checked;
      const isColorIn = doc.getElementById('scrollC').checked;

      applyToSliders(sl => {
        sl.style.borderRight = isBorder ? '1px solid currentColor' : 'none';
        sl.style.borderLeft = isBorder ? '1px solid currentColor' : 'none';
        sl.style.setProperty(
          "background",
          isColorIn ? "currentColor" : "transparent",
          "important"
        );
      });
    });
  });

  // Position & Width
  setupXWInput('scrollX', val => doc.documentElement.style.setProperty('--slider-x', `${val}px`));
  setupXWInput('scrollW', val => doc.documentElement.style.setProperty('--slider-width', `${val}px`));

  function setupXWInput(inputId, applyWideXpos) {
    const input = doc.getElementById(inputId);
    input.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) applyWideXpos(val);
    });
    input.addEventListener('blur', e => {
      if (e.target.value === '') {
        e.target.value = '0';
        applyWideXpos(0);
      }
    });
  }

  // Speed Scale
  const speedScaleInput = doc.getElementById('scrollSpeedScale');
  let speedScale = parseFloat(speedScaleInput.value);

  function updateScrollSpeed() {
    const val = +scrollSliderRight.value;
    scrollSpeed = val * speedScale;
  }

  speedScaleInput.addEventListener('input', e => {
    let num = parseFloat(e.target.value);
    if (!isNaN(num)) {
      num = Math.max(0, Math.min(20, num));
      if (num !== parseFloat(e.target.value)) e.target.value = num;
      speedScale = num;
      updateScrollSpeed();
    }
  });
  speedScaleInput.addEventListener('blur', e => {
    if (e.target.value === '') {
      e.target.value = '0';
      speedScale = 0;
      updateScrollSpeed();
    }
  });

  // Slider thumb
  doc.getElementById('scrollHide').addEventListener('change', e => {
    scrollSliderRight.classList.toggle('hide-thumb', !e.target.checked);
    scrollSliderLeft.classList.toggle('hide-thumb', !e.target.checked);
  });

  // 初期設定
  applyScrollSettings({
    right:      false,
    left:       false,
    shadow:     0,
    opacity:    100,
    border:     true,
    colorIn:    false,
    position:   10,
    width:      70,
    speedScale: 15,
    showThumb:   true
  });

  const sUIOpenBtn = doc.getElementById('sUIOpenBtn');
  sUIOpenBtn.addEventListener('click', () => {
    scrollUI.style.display = '';
  });

  const sUICloseBtn = doc.getElementById('sUICloseBtn');
  sUICloseBtn.addEventListener('click', () => {
    scrollUI.style.display = 'none';
  });

  // ==============================
  // Font Control Panel
  // ==============================

  const FONT_MODES = {
    'Font size': {
      min: 10, max: 50, step: 1,
      getValue: () => parseInt(novelDisplay.style.fontSize) || 23,
      format: v => `${v}px`,
      apply: v => { novelDisplay.style.fontSize = `${v}px`; },
    },
    'Font weight': {
      min: 100, max: 900, step: 100,
      getValue: () => parseInt(novelDisplay.style.fontWeight) || 400,
      format: v => `${v}`,
      apply: v => { novelDisplay.style.fontWeight = v; },
    },
    'Letter spacing': {
      min: -10, max: 100, step: 1,
      getValue: () => parseInt(novelDisplay.dataset.letterSpacing ?? 30),
      format: v => `${v}%`,
      apply: v => {
        novelDisplay.style.letterSpacing = `${v}%`;
      },
    },
    'Text shadow': {
      min: 0, max: 30, step: 1,
      getValue: () => parseInt(novelDisplay.dataset.textShadow || 0),
      format: v => `${v}px`,
      apply: v => {
        novelDisplay.style.textShadow = v > 0 ? `0 0 ${v}px` : 'none';
      },
    },
  };

  // 他のGoogle Fontsを使いたい場合は、JSONの fontFamily に直接書く
  const FONT_LIST = [
    'serif',
    'sans-serif',
    'Noto Serif JP',
    'Noto Sans JP',
  ];

  const DEFAULT_FONT = 'Noto Serif JP';

  // Google Fonts を読み込まず、CSSの総称フォントとしてそのまま適用するもの
  const GENERIC_FONTS = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  ]);

  // 軸を指定しないと Google Fonts は 400 だけを返すため、wght軸付きで読み込む。
  // 範囲が合わない・軸を持たないフォントは読み込みに失敗する（エラー本文に有効な範囲は含まれない）ため、
  // 「FONT_WEIGHT_AXES の範囲 → FONT_WEIGHT_AXIS → 軸なし」の順に試す（loadGoogleFont）
  const FONT_WEIGHT_AXIS = '100..900';

  // wght軸の範囲が FONT_WEIGHT_AXIS と異なる可変フォントだけ載せる
  const FONT_WEIGHT_AXES = {
    'Noto Serif JP': '200..900',
    'M PLUS 1 Code': '100..700',
  };

  const panel = doc.getElementById('fontPanel');

  // select の option は FONT_LIST / FONT_MODES から生成
  panel.querySelector('#modeSelect')
    .append(...Object.keys(FONT_MODES).map(m => new Option(m, m)));
  panel.querySelector('#fontSelect')
    .append(...FONT_LIST.map(f => new Option(f, f)));

  const fUICloseBtn = doc.getElementById('fUICloseBtn');
  const fontSelect  = panel.querySelector('#fontSelect');
  const modeSelect  = panel.querySelector('#modeSelect');
  const valueLabel  = panel.querySelector('#valueLabel');
  const slider      = panel.querySelector('#slider');
  const decreaseBtn = panel.querySelector('#sliderDecrease');
  const increaseBtn = panel.querySelector('#sliderIncrease');

  // body高さ変化対応
  let layoutRefreshPending = false;

  function refreshBodyHeightLater() {
    if (layoutRefreshPending) return;
    layoutRefreshPending = true;

    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => {
        layoutRefreshPending = false;
        updateBodyHeightCache();
        updateSliderDisabled();
      });
    });
  }

  // スライダー更新処理
  let currentMode = 'Font size';

  function updateControls() {
    const mode = FONT_MODES[currentMode];
    slider.min   = mode.min;
    slider.max   = mode.max;
    slider.step  = mode.step;
    slider.value = mode.getValue();
    valueLabel.textContent = mode.format(slider.value);
    slider.oninput = () => {
      mode.apply(slider.value);
      valueLabel.textContent = mode.format(slider.value);
      refreshBodyHeightLater();
    };
  }

  function adjustSlider(delta) {
    const value = parseInt(slider.value) + delta * parseInt(slider.step || 1);
    if (value >= parseInt(slider.min) && value <= parseInt(slider.max)) {
      slider.value = value;
      slider.dispatchEvent(new Event('input'));
    }
  }

  // Google Fonts の読み込み。wght軸の範囲の候補を順に試し、失敗したら次の候補で読み直す（null は軸なし）
  function loadGoogleFont(
    font,
    linkId,
    axes = [FONT_WEIGHT_AXES[font], FONT_WEIGHT_AXIS, null]
      .filter((axis, i, list) => axis !== undefined && list.indexOf(axis) === i)
  ) {
    const [axis, ...restAxes] = axes;
    const family = font.trim().split(/\s+/).map(encodeURIComponent).join('+');
    const link = doc.createElement('link');
    link.id   = linkId;
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + family
      + (axis ? `:wght@${axis}` : '') + '&display=swap';
    link.onload = () => { doc.fonts?.ready.then(refreshBodyHeightLater); };
    link.onerror = () => {
      link.remove();
      if (restAxes.length) loadGoogleFont(font, linkId, restAxes);
    };
    doc.head.appendChild(link);
  }

  // フォント適用
  function applyFont(font) {
    font = font.replace(/\+/g, ' ').trim();
    const isGeneric = GENERIC_FONTS.has(font);

    // JSONで指定された、一覧にないフォントも select に表示する
    if (![...fontSelect.options].some(o => o.value === font)) {
      fontSelect.append(new Option(font, font));
    }
    fontSelect.value = font;

    if (isGeneric) {
      doc.body.style.fontFamily = font;
    } else {
      const linkId = 'gf-font-' + font.replace(/\s+/g, '-');
      if (!doc.getElementById(linkId)) loadGoogleFont(font, linkId);
      doc.body.style.fontFamily = `'${font}', sans-serif`;
    }
    refreshBodyHeightLater();
  }

  // 開くボタン 〇
  const fUIOpenBtn = doc.getElementById('fUIOpenBtn');

  // イベントリスナー
  modeSelect.value = currentMode;
  modeSelect.addEventListener('change', () => {
    currentMode = modeSelect.value;
    updateControls();
  });

  decreaseBtn.addEventListener('click', () => adjustSlider(-1));
  increaseBtn.addEventListener('click', () => adjustSlider(1));
  fontSelect.addEventListener('change', () => applyFont(fontSelect.value));
  fUICloseBtn.addEventListener('click', () => { panel.style.display = 'none'; });
  fUIOpenBtn.addEventListener('click', () => { panel.style.display = 'block'; });

  // 初期化
  // フォントの適用は、初期スタイルの決定後（JSONセクション末尾）に行う
  Object.values(FONT_MODES).forEach(mode => mode.apply(mode.getValue()));
  updateControls();

  // ==============================
  // Color Pickr
  // ==============================

  const container = doc.getElementById('pickrContainer');
  const pUIOpenBtn = doc.getElementById('pUIOpenBtn');
  const dragHandle = doc.getElementById('dragHandle');
  const contrastEl = doc.getElementById('contrastRatio');

  dragHandle.innerHTML = createEqualsIcon();
  makeDraggable(dragHandle, container, doc);

  const colorState = {
    savedFg: '#000000', currentFg: '#000000',
    savedBg: '#ffffff', currentBg: '#ffffff',
  };

  // true の間は <meta name="theme-color"> を常に現在のBG色に一致させる。false で meta を除去
  let isThemeColorEnabled = false;

  const syncThemeColorMeta = () => {
    let meta = doc.head.querySelector('meta[name="theme-color"]');
    if (!isThemeColorEnabled) {
      meta?.remove();
      return;
    }
    if (!meta) {
      meta = doc.createElement('meta');
      meta.name = 'theme-color';
      doc.head.appendChild(meta);
    }
    meta.content = colorState.currentBg;
  };

  const setCssColorVars = function () {
    const rootStyle = doc.documentElement.style;
    rootStyle.setProperty('--current-fg', colorState.currentFg);
    rootStyle.setProperty('--current-bg', colorState.currentBg);
    syncThemeColorMeta();
  };

  const updateColorHexDisplays = () => {
    doc.getElementById("bgHex").value = colorState.currentBg;
    doc.getElementById("fgHex").value = colorState.currentFg;
    updateLockIcons();
  };

  const updateContrast = () =>
    (contrastEl.textContent = getContrast(
      colorState.currentFg,
      colorState.currentBg
    ));

  let savedPickrLeft = null;
  let savedPickrTop = null;

  // pickrの初期化関数
  const initPickr = (id) => {
    const isFg = id === 'fg';

    const setCurrent = (v) => {
      if (isFg) colorState.currentFg = v;
      else      colorState.currentBg = v;
    };

    const setSaved = (v) => {
      if (isFg) colorState.savedFg = v;
      else      colorState.savedBg = v;
    };

    const getSaved = () =>
      isFg ? colorState.savedFg : colorState.savedBg;

    const pickr = new Pickr({
      el: `#${id}Swatch`,
      default: getSaved(),
    });

    pickr.on('init', () => {
      const app = pickr.getApp();
      const resultInput = app.querySelector('.pcr-result');
      const copyBtn = app.querySelector('.pcr-copy');
      const dragBtn = app.querySelector('.pcr-drag-handle');

      dragBtn.innerHTML = createEqualsIcon();
      makeDraggable(dragBtn, app, doc, (left, top) => {
        savedPickrLeft = left;
        savedPickrTop  = top;
      });

      copyBtn.addEventListener('click', () => {
        if (resultInput.value !== '-') copyToClipboard(copyBtn, resultInput.value);
      });
    });

    // pcr-app イベント登録
    pickr.on('show', (color) => {
      const hex = color.toHEX();
      setCurrent(hex);
      setCssColorVars();
      updateContrast();
      if (savedPickrLeft && savedPickrTop) {
        doc.querySelectorAll('.pcr-app').forEach(a => {
          a.style.setProperty('left',   savedPickrLeft, 'important');
          a.style.setProperty('top',    savedPickrTop,  'important');
          a.style.setProperty('right',  'auto', 'important');
          a.style.setProperty('bottom', 'auto', 'important');
        });
      }
    });

    pickr.on('change', (color) => {
      const hex = color.toHEX();
      setCurrent(hex);
      setCssColorVars();
      updateContrast()
    });

    pickr.on('save', (color) => {
      const hex = color.toHEX();
      setCurrent(hex);
      setSaved(hex);
      setCssColorVars();
      updateContrast();
      updateLockIcons();
    });

    pickr.on('hide', () => {
      setCurrent(getSaved());
      setCssColorVars();
      updateContrast();
    });

    setCssColorVars();
    updateContrast();
    return pickr
  };

  // Pickr初期化
  const bgPickr = initPickr('bg');
  const fgPickr = initPickr('fg');

  // イベントハンドラ・UI操作
  updateColorHexDisplays();

  // ロックアイコン制御関数
  function updateLockIcons() {
    const bgLocked = doc.getElementById('color-toggle-bg-lock').checked;
    const fgLocked = doc.getElementById('color-toggle-fg-lock').checked;

    const bgLockIcon = doc.getElementById('bgLockIcon');
    const fgLockIcon = doc.getElementById('fgLockIcon');
    bgLockIcon.textContent = bgLocked ? '🔒' : '🔓';
    fgLockIcon.textContent = fgLocked ? '🔒' : '🔓';

    const bgColor = bgLocked
      ? colorState.savedBg
      : doc.getElementById('bgHex').value;

    const fgColor = fgLocked
      ? colorState.savedFg
      : doc.getElementById('fgHex').value;

    bgLockIcon.style.background = bgColor;
    fgLockIcon.style.background = fgColor;

    bgLockIcon.style.border = bgLocked ? `6px ridge ${bgColor}` : '';
    fgLockIcon.style.border = fgLocked ? `6px ridge ${fgColor}` : '';
    bgLockIcon.style.borderRadius = bgLocked ? '0px' : '4px';
    fgLockIcon.style.borderRadius = fgLocked ? '0px' : '4px';
    bgLockIcon.style.padding = bgLocked ? '0px 0px' : '6px 6px';
    fgLockIcon.style.padding = fgLocked ? '0px 0px' : '6px 6px';
  }
  doc.getElementById('color-toggle-bg-lock').addEventListener('change', updateLockIcons);
  doc.getElementById('color-toggle-fg-lock').addEventListener('change', updateLockIcons);
  updateLockIcons();

  ['bg', 'fg'].forEach(id => {
    const pickr = id === 'bg' ? bgPickr : fgPickr;
    doc.getElementById(`${id}HexLoad`).onclick = () => {
      const val = doc.getElementById(`${id}Hex`).value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        pickr.setColor(val, true);
      }
      pickr.show();
      updateLockIcons();
    };
  });

  function changeColors() {
    const bgLocked = doc.getElementById("color-toggle-bg-lock").checked;
    const fgLocked = doc.getElementById("color-toggle-fg-lock").checked;

    if (bgLocked && fgLocked) { win.alert("BGとFGの両方がロックされています");
      return;
    }

    const contrastMin = parseFloat(doc.getElementById("contrastMin").value);
    const contrastMax = parseFloat(doc.getElementById("contrastMax").value);
    let trials = 0;
    const maxTrials = 300;

    if (isNaN(contrastMin) || isNaN(contrastMax) ||contrastMin > 21 || contrastMax < 1 || contrastMin > contrastMax) {
      win.alert("指定されたコントラスト範囲が無効です\n（1〜21で指定してください）");
      return;
    }

    while (trials < maxTrials) {
      trials++;
      const bgHex = bgLocked
        ? colorState.currentBg
        : hslToHex(...Object.values(getRandomHSL()));
      const fgHex = fgLocked
        ? colorState.currentFg
        : hslToHex(...Object.values(getRandomHSL()));

      const ratio = parseFloat(getContrast(fgHex, bgHex));
      if (ratio >= contrastMin && ratio <= contrastMax) {
        // 適用
        if (!bgLocked) { colorState.currentBg = bgHex; colorState.savedBg = bgHex; }
        if (!fgLocked) { colorState.currentFg = fgHex; colorState.savedFg = fgHex; }
        setCssColorVars();

        updateColorHexDisplays();
        updateContrast();
        updateLockIcons();
        return;
      }
    }
    win.alert("指定されたコントラスト範囲に合うランダム色の組み合わせが見つかりませんでした");
  }
  doc.getElementById("randomColorBtn").onclick = changeColors;

  // Copyボタン
  doc.querySelectorAll('.copy-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const targetInput = doc.getElementById(button.dataset.target);
      if (targetInput && targetInput.value !== '-') {
        copyToClipboard(button, targetInput.value);
      }
    });
  });

  // Swapボタン
  doc.getElementById("swapColorsBtn").onclick = () => {

    // ロック状態を無視してスワップ
    [colorState.currentFg, colorState.currentBg] = [colorState.currentBg, colorState.currentFg];
    [colorState.savedFg, colorState.savedBg] = [colorState.savedBg, colorState.savedFg];

    setCssColorVars();
    updateColorHexDisplays();
    updateLockIcons();
  };

  // Pickr パネルの開閉。開いている間は □ を隠す
  let isPickrContainerOpen = false;
  function setPickrContainerOpen(open) {
    isPickrContainerOpen = open;
    container.style.display = open ? 'block' : 'none';
    pUIOpenBtn.style.display = open ? 'none' : 'block';
  }
  setPickrContainerOpen(false);

  pUIOpenBtn.onclick = () => setPickrContainerOpen(true);
  doc.getElementById('pUICloseBtn').onclick = () => setPickrContainerOpen(false);

  // ==関数==

  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0,
      g = 0,
      b = 0;
    if (0 <= h && h < 60) {
      r = c;
      g = x;
      b = 0
    } else if (60 <= h && h < 120) {
      r = x;
      g = c;
      b = 0
    } else if (120 <= h && h < 180) {
      r = 0;
      g = c;
      b = x
    } else if (180 <= h && h < 240) {
      r = 0;
      g = x;
      b = c
    } else if (240 <= h && h < 300) {
      r = x;
      g = 0;
      b = c
    } else if (300 <= h && h < 360) {
      r = c;
      g = 0;
      b = x
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")
  }

  function getRandomHSL() {
    return {
      h: Math.floor(Math.random() * 360),
      s: Math.floor(Math.random() * 101) ,
      l: Math.floor(Math.random() * 101)
    }
  }

  function getContrast(fg, bg) {
    const lum = (hex) => {
      const rgb = hex.match(/\w\w/g).map((v) => parseInt(v, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
    };
    const [l1, l2] = [lum(fg), lum(bg)];
    return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)
  }

  async function copyToClipboard(button, text, labels = { default: "Copy", success: "Copied!" }) {
    if (button.dataset.copying) return;
    try {
      button.dataset.copying = "true";
      await win.navigator.clipboard.writeText(text);
      button.textContent = labels.success;
      win.setTimeout(() => {
        button.textContent = labels.default;
        delete button.dataset.copying;
      }, 1500);
    } catch (err) {
      console.error("コピーに失敗しました:", err);
      win.alert("コピーに失敗しました: " + err);
      delete button.dataset.copying;
    }
  }

  // ==============================
  // JSONで各値を保存/反映
  // ==============================

  const STYLE_COUNT = 99;
  const STYLES_PER_PAGE = 8;
  const MAX_PAGE = Math.ceil(STYLE_COUNT / STYLES_PER_PAGE);
  const STYLE_KEY_RE = /^Style\d+$/;
  const STORAGE_KEY = 'nvl-vwr-bkmrklt:savedStyles';
  const TRASH_KEY = 'nvl-vwr-bkmrklt:trashedStyles';
  const INIT_STYLE_KEY = 'nvl-vwr-bkmrklt:initStyleName'; // 初期適用するStyle名（"Style3" など）

  const onetapUI = doc.getElementById('onetapUI');
  const styleRows = doc.getElementById('styleRows');
  const moveBtn = doc.getElementById('moveBtn');
  const initBtn = doc.getElementById('initBtn');
  const delBtn = doc.getElementById('delBtn');
  const oUIOpenBtn = doc.getElementById('oUIOpenBtn');
  const oUICloseBtn = doc.getElementById('oUICloseBtn');
  const styleRowTpl = doc.getElementById('styleRowTemplate');
  const lastPageBtnsTpl = doc.getElementById('lastPageBtnsTemplate');

  /* --- 汎用ヘルパー --- */

  const isPlainObject = (obj) =>
    obj !== null && typeof obj === 'object' && !Array.isArray(obj);

  const deepEqual = (a, b) => {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return keysA.length === keysB.length && keysA.every((k) => deepEqual(a[k], b[k]));
  };

  const mergeDeep = (base, override) => {
    const result = { ...base };
    for (const [key, overVal] of Object.entries(override)) {
      const baseVal = base[key];
      result[key] = isPlainObject(overVal) && isPlainObject(baseVal)
        ? mergeDeep(baseVal, overVal)
        : overVal;
    }
    return result;
  };

  const flashText = (btn, message) => {
    if (btn.dataset.flashing) return;
    btn.dataset.flashing = 'true';
    btn.textContent = message;
    win.setTimeout(() => {
      btn.textContent = btn.dataset.label;
      delete btn.dataset.flashing;
    }, 1500);
  };

  /* --- 保存データ --- */

  // storage から Style形式のマップ（{ Style1: {...}, ... }）を読む。不正な内容は捨てる
  const readStyleMap = (storage, key) => {
    try {
      const parsed = JSON.parse(storage.getItem(key));
      if (!isPlainObject(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(([k, v]) => STYLE_KEY_RE.test(k) && isPlainObject(v))
      );
    } catch {
      return {};
    }
  };

  const loadSavedStyles = () => readStyleMap(win.localStorage, STORAGE_KEY);

  const savedStyles = loadSavedStyles();

  // Storage 操作を実行し、失敗時は警告ログだけ出す（プライベートモード等で例外になるため）
  const tryStorage = (action, fn) => {
    try {
      fn();
    } catch (err) {
      console.warn(`Storage: ${action}に失敗:`, err);
    }
  };

  const persistSavedStyles = () =>
    tryStorage('Styleの保存', () =>
      win.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedStyles))
    );

  // 初期適用するStyle名。Style本体ではなく名前（参照）だけを保存する
  const loadInitStyleName = () => {
    try {
      const name = win.localStorage.getItem(INIT_STYLE_KEY);
      return STYLE_KEY_RE.test(name) ? name : null;
    } catch {
      return null;
    }
  };

  const persistInitStyleName = (name) =>
    tryStorage('INIT Style名の保存', () => win.localStorage.setItem(INIT_STYLE_KEY, name));

  const clearInitStyleName = () =>
    tryStorage('INIT Style名の削除', () => win.localStorage.removeItem(INIT_STYLE_KEY));

  const styleNumber = (key) => parseInt(key.replace(/\D/g, ''), 10);

  const sortByStyleNumber = (styles) =>
    Object.fromEntries(
      Object.entries(styles).sort(([a], [b]) => styleNumber(a) - styleNumber(b))
    );

  const getSortedStyles = () => sortByStyleNumber(savedStyles);

  // 削除したStyleの一時保管（sessionStorage。同じキーは新しい方で上書き）
  const loadTrash = () => readStyleMap(win.sessionStorage, TRASH_KEY);

  const saveTrash = (trash) =>
    tryStorage('ゴミ箱の保存', () =>
      win.sessionStorage.setItem(TRASH_KEY, JSON.stringify(trash))
    );

  const moveToTrash = (name, data) => saveTrash({ ...loadTrash(), [name]: data });

  const removeFromTrash = (keys) => {
    const trash = loadTrash();
    keys.forEach((k) => delete trash[k]);
    saveTrash(trash);
  };

  const swapStyles = (a, b) => {
    const temp = savedStyles[a];

    if (savedStyles[b] === undefined) delete savedStyles[a];
    else savedStyles[a] = savedStyles[b];

    if (temp === undefined) delete savedStyles[b];
    else savedStyles[b] = temp;

    persistSavedStyles();
  };

  /* --- _base の抽出 / 展開 --- */

  const EXCLUDE_BASE_KEYS = new Set(['color', 'backgroundColor']);

  // 値の最頻値（JSON文字列）と出現回数。同数なら JSON 文字列が長い方を優先
  const findMostFrequent = (values) => {
    const counts = new Map();
    for (const v of values) {
      const k = JSON.stringify(v);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let bestKey = null;
    let bestCount = 0;
    for (const [k, c] of counts) {
      if (c > bestCount || (c === bestCount && bestKey !== null && k.length > bestKey.length)) {
        bestCount = c;
        bestKey = k;
      }
    }
    return { json: bestKey, count: bestCount };
  };

  // 各キーの最頻値（2回以上出現）を base にする
  const buildBase = (entries) => {
    const base = {};
    for (const key of Object.keys(entries[0][1])) {
      if (EXCLUDE_BASE_KEYS.has(key)) continue;
      const { json, count } = findMostFrequent(entries.map(([, style]) => style[key]));
      if (count >= 2) base[key] = JSON.parse(json);
    }
    return base;
  };

  // base との差分のみを残す（オブジェクトはネストして比較、配列・プリミティブはそのまま比較）
  const diffFromBase = (style, base) => {
    const diff = {};
    for (const [k, v] of Object.entries(style)) {
      const baseVal = base[k];
      if (isPlainObject(v) && isPlainObject(baseVal)) {
        const nestedDiff = Object.fromEntries(
          Object.entries(v).filter(([nk, nv]) => !deepEqual(baseVal[nk], nv))
        );
        if (Object.keys(nestedDiff).length > 0) diff[k] = nestedDiff;
      } else if (!deepEqual(baseVal, v)) {
        diff[k] = v;
      }
    }
    return diff;
  };

  const expandBase = (compressed) => {
    const { _base, ...styles } = compressed;
    if (!_base) return compressed;
    return Object.fromEntries(
      Object.entries(styles).map(([name, diff]) => [name, mergeDeep(_base, diff)])
    );
  };

  const extractBase = (styles) => {
    const entries = Object.entries(expandBase(styles)).filter(([k]) => k !== '_base');
    if (entries.length === 0) return {};

    const base = buildBase(entries);
    const diffStyles = Object.fromEntries(
      entries.map(([name, style]) => [name, diffFromBase(style, base)])
    );
    return { _base: base, ...diffStyles };
  };

  // テキストが _base 付きJSONなら展開した文字列を返す。それ以外はそのまま返す
  const expandBaseInText = (text) => {
    try {
      const parsed = JSON.parse(text);
      return isPlainObject(parsed) && '_base' in parsed
        ? JSON.stringify(expandBase(parsed))
        : text;
    } catch {
      return text;
    }
  };

  /* --- JSON の検証 --- */

  const VALID_KEYS = {
    root: new Set([
      'backgroundColor',
      'color',
      'themeColor',
      'fontSize',
      'fontWeight',
      'letterSpacing',
      'textShadow',
      'fontFamily',
      'scrollSettings',
      'searchConfigs',
    ]),
    scrollSettings: new Set(Object.values(SCROLL_FIELD_MAP).map((v) => v.key)),
    searchConfigs: new Set(['label', 'side', 'offsetY', 'query', 'engine']),
  };

  const findInvalidKeys = (obj, validSet, path) =>
    Object.keys(obj)
      .filter((k) => !validSet.has(k))
      .map((k) => `${path} > "${k}"`);

  const validateStyleObject = (obj, path) => {
    const invalid = findInvalidKeys(obj, VALID_KEYS.root, path);

    if ('scrollSettings' in obj) {
      const settings = obj.scrollSettings;
      if (isPlainObject(settings)) {
        invalid.push(...findInvalidKeys(settings, VALID_KEYS.scrollSettings, `${path} > scrollSettings`));
      } else {
        invalid.push(`${path} > scrollSettings (not an object)`);
      }
    }

    if ('searchConfigs' in obj) {
      const configs = obj.searchConfigs;
      if (Array.isArray(configs)) {
        configs.forEach((item, i) => {
          const itemPath = `${path} > searchConfigs[${i}]`;
          if (isPlainObject(item)) {
            invalid.push(...findInvalidKeys(item, VALID_KEYS.searchConfigs, itemPath));
          } else {
            invalid.push(`${itemPath} (not an object)`);
          }
        });
      } else {
        invalid.push(`${path} > searchConfigs (not an array)`);
      }
    }

    return invalid;
  };

  // 不正なキーや構造エラーを収集する
  const collectInvalidKeys = (obj) => {
    const keys = Object.keys(obj);

    // Style形式と判断する条件：Styleキーが1つ以上あり、rootの有効キーに一つも一致しない
    const looksLikeStyleFormat =
      keys.some((k) => STYLE_KEY_RE.test(k)) && !keys.some((k) => VALID_KEYS.root.has(k));

    if (!looksLikeStyleFormat) return validateStyleObject(obj, 'root');

    return keys.flatMap((key) => {
      // Styl1 のようなタイポ → 不正なStyleキーとして報告
      if (!STYLE_KEY_RE.test(key)) return [`root > "${key}"`];
      const val = obj[key];
      return isPlainObject(val) ? validateStyleObject(val, key) : [`${key} (not an object)`];
    });
  };

  const normalizeJSONString = (text) =>
    text
      .replace(/\u00A0/g, ' ')               // NBSP → 半角スペース
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字除去
      .replace(/\r\n?/g, '\n');              // 改行コード統一

  // 戻り値: { data } または { error }
  const validateAndParseJSON = (jsonText) => {
    if (!jsonText) return { error: 'JSONデータを入力してください' };

    let parsed;
    try {
      parsed = JSON.parse(normalizeJSONString(jsonText));
    } catch (e) {
      return { error: `JSONの解析に失敗しました:\n${e.message}` };
    }

    if (!isPlainObject(parsed)) return { error: 'JSONの形式が正しくありません' };

    const invalidKeys = collectInvalidKeys(parsed);
    if (invalidKeys.length > 0) {
      return { error: `不正なキーが含まれています:\n${invalidKeys.join('\n')}` };
    }

    return { data: parsed };
  };

  /* --- 入力 → Style形式への変換 --- */

  // 保存済みStyleで使われていない最小の番号
  const findFreeStyleNumber = () => {
    const used = new Set(Object.keys(savedStyles).filter((k) => STYLE_KEY_RE.test(k)).map(styleNumber));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  };

  // Styleキーあり（個別・複数）→ そのまま / キー無し → 空き番号を付与
  const toStyleMap = (data) => {
    const keys = Object.keys(data);
    const isStyleFormat = keys.length > 0 && keys.every((k) => STYLE_KEY_RE.test(k));
    return isStyleFormat ? { ...data } : { [`Style${findFreeStyleNumber()}`]: data };
  };

  // 戻り値: { data: Style形式オブジェクト } または { error }
  const parseInputToStyleMap = (jsonText) => {
    const result = validateAndParseJSON(jsonText);
    return result.error ? result : { data: toStyleMap(result.data) };
  };

  // アラート用に Style の連番を～で省略
  const formatKeyRanges = (keys) => {
    const nums = keys.map((k) => (STYLE_KEY_RE.test(k) ? styleNumber(k) : null));
    const groups = [];
    let i = 0;

    while (i < keys.length) {
      if (nums[i] === null) {
        groups.push(keys[i++]);
        continue;
      }

      let j = i + 1;
      while (j < keys.length && nums[j] === nums[j - 1] + 1) j++;

      const len = j - i;
      if (len === 1) groups.push(keys[i]);
      else if (len === 2) groups.push(`${keys[i]}, ${keys[j - 1]}`);
      else groups.push(`${keys[i]}～${keys[j - 1]}`);
      i = j;
    }

    return groups.join(', ');
  };

  /* --- スタイルの適用 --- */

  const applyStyleData = (data) => {
    if (data.color) colorState.currentFg = colorState.savedFg = data.color;
    if (data.backgroundColor) colorState.currentBg = colorState.savedBg = data.backgroundColor;
    isThemeColorEnabled = data.themeColor === true;

    setCssColorVars();
    updateContrast();
    updateColorHexDisplays();

    if (data.fontSize) novelDisplay.style.fontSize = data.fontSize;
    if (data.fontWeight) novelDisplay.style.fontWeight = data.fontWeight;
    if (data.letterSpacing) novelDisplay.style.letterSpacing = data.letterSpacing;
    if (data.textShadow != null) {
      novelDisplay.style.textShadow = data.textShadow > 0 ? `0 0 ${data.textShadow}px` : 'none';
      novelDisplay.dataset.textShadow = data.textShadow;
    }
    updateControls();

    if (data.fontFamily) applyFont(data.fontFamily);

    // スライダーセッティングUIの状態反映
    if (data.scrollSettings) applyScrollSettings(data.scrollSettings);

    refreshBodyHeightLater();
  };

  // スタイルを適用し、検索メニューを作り直してUIを閉じる
  const applyStyleAndClose = (data) => {
    applyStyleData(data);
    win.appConfig = data;
    createMenus();
    onetapUI.style.display = 'none';
  };

  const applyStyleByName = (name) => {
    const data = savedStyles[name];
    if (!data) {
      win.alert(`${name} は保存されていません`);
      return;
    }
    if (!win.confirm(`☆ ${name} を反映します！`)) return;
    applyStyleAndClose(data);
  };

  /* --- 保存確認オーバーレイ --- */

  let isSaveConfirmOpen = false;

  const showSaveConfirmOverlay = (name, initialData) => {
    if (isSaveConfirmOpen) return Promise.resolve(false);
    isSaveConfirmOpen = true;
    isSwitching = true;
    resetScrollSliders();
    disableBodyScroll();

    return new Promise((resolve) => {
      const overlay = doc.createElement('div');
      overlay.id = 'save-confirm-overlay';
      overlay.innerHTML = render(saveConfirmOverlayTpl, { name });
      doc.body.appendChild(overlay);

      const prettyCheckbox = overlay.querySelector('#prettyPrintCheckbox');
      const prettyLabel = overlay.querySelector('#prettyLabel');
      const jsonEditBtn = overlay.querySelector('#jsonEditBtn');
      const jsonCopyBtn = overlay.querySelector('#jsonCopyBtn');
      const preview = overlay.querySelector('#preview');
      const cancelBtn = overlay.querySelector('#cancelBtn');
      const saveBtn = overlay.querySelector('#saveBtn');

      let currentData = initialData;
      let isEditing = false;

      const updatePreviewText = () => {
        const pretty = prettyCheckbox.checked;
        preview.value = pretty ? JSON.stringify(currentData, null, 2) : JSON.stringify(currentData);
        preview.classList.toggle('pretty', pretty);
        preview.classList.toggle('compact', !pretty);
      };

      const setEditingMode = (editing) => {
        if (isEditing && !editing) {
          const { data, error } = validateAndParseJSON(preview.value);
          if (error) {
            win.alert(error);
            return;
          }
          if (Object.keys(data).some((k) => STYLE_KEY_RE.test(k))) {
            win.alert('Styleキーは削除してください');
            return;
          }
          currentData = data;
          updatePreviewText();
        }

        isEditing = editing;
        preview.readOnly = !editing;
        preview.classList.toggle('editing', editing);

        [prettyCheckbox, prettyLabel, jsonCopyBtn, saveBtn].forEach((el) => {
          el.disabled = editing;
          el.classList.toggle('disabled-control', editing);
        });

        jsonEditBtn.textContent = editing ? '編集中...' : '編集';
      };

      const handleKeydown = (e) => {
        if (e.key === 'Enter') saveBtn.click();
      };

      const cleanupAndResolve = (confirmed) => {
        overlay.remove();
        isSaveConfirmOpen = false;
        isSwitching = false;
        enableBodyScroll();
        doc.removeEventListener('keydown', handleKeydown);
        resolve(confirmed ? currentData : false);
      };

      updatePreviewText();

      jsonEditBtn.onclick = () => setEditingMode(!isEditing);
      prettyCheckbox.onchange = updatePreviewText;
      jsonCopyBtn.addEventListener('click', () => {
        copyToClipboard(jsonCopyBtn, preview.value, { default: 'コピー', success: 'コピー完了!' });
      });
      cancelBtn.onclick = () => cleanupAndResolve(false);
      saveBtn.onclick = () => cleanupAndResolve(true);
      overlay.onclick = (e) => {
        if (e.target === overlay) cleanupAndResolve(false);
      };
      doc.addEventListener('keydown', handleKeydown);

      overlay.tabIndex = -1;
      overlay.focus();
    });
  };

  // 現在の見た目・設定を保存用オブジェクトにまとめる
  const collectCurrentStyle = () => {
    const { fontFamily: rawFontFamily } = doc.body.style;
    const { fontSize, fontWeight, letterSpacing, textShadow } = novelDisplay.style;

    // Google Fonts のリクエスト（applyFont）で使用できる形にする
    const fontFamily = rawFontFamily.replace(/['"]/g, '').split(',')[0].trim();

    // blur 値を抽出
    const blurMatch = textShadow?.match(/(-?\d+)px$/);

    const scrollSettings = Object.fromEntries(
      Object.entries(SCROLL_FIELD_MAP).map(([id, { prop, key, parser }]) => {
        const el = doc.getElementById(id);
        if (!el) return [key, null];
        return [key, parser ? parser(el[prop]) : el[prop]];
      })
    );

    return {
      backgroundColor: colorState.currentBg,
      color: colorState.currentFg,
      themeColor: isThemeColorEnabled,
      fontSize,
      fontWeight,
      letterSpacing,
      textShadow: blurMatch ? parseInt(blurMatch[1], 10) : 0,
      fontFamily,
      scrollSettings,
      searchConfigs: getSearchConfigs(),
    };
  };

  /* --- Style一覧UI（ページネーション / MOVE） --- */

  let currentPage = 1;
  let lastRandomKey = null;
  let isMoveMode = false;
  let selectedStyleKey = null;

  // INIT: 初期適用するStyle名（未設定は null）。解除待機中は、続けて対応するAPPLYを押すと解除される
  let initStyleName = loadInitStyleName();
  let isInitUnsetArmed = false;

  const updateInitBtn = () => {
    initBtn.textContent = initStyleName ?? 'INIT';
    initBtn.classList.toggle('is-armed', isInitUnsetArmed);
  };

  const setInitUnsetArmed = (armed) => {
    isInitUnsetArmed = armed;
    updateInitBtn();
  };

  const findApplyBtn = (name) => styleRows.querySelector(`.apply-btn[data-name="${name}"]`);

  // APPLYボタンに保存済みスタイルの色を反映
  const updateApplyBtnColor = (name) => {
    const btn = findApplyBtn(name);
    if (!btn) return;
    const data = savedStyles[name];
    btn.style.color = data?.color || '';
    btn.style.backgroundColor = data?.backgroundColor || '';
  };

  const createStyleRow = (n) => {
    const row = styleRowTpl.content.firstElementChild.cloneNode(true);
    if (n > STYLE_COUNT) {
      // 100以上は高さ確保だけ
      row.replaceChildren();
      row.classList.add('is-spacer');
      return row;
    }
    row.querySelector('.style-index').textContent = `${n}.`;
    row.querySelectorAll('button').forEach((btn) => {
      btn.dataset.name = `Style${n}`;
    });
    return row;
  };

  // 最終ページのみ表示するボタン
  const createLastPageButtons = () => {
    const fragment = lastPageBtnsTpl.content.cloneNode(true);
    fragment.querySelectorAll('button').forEach((btn) => {
      btn.dataset.label = btn.textContent;
    });
    return fragment;
  };

  const renderStylePage = (page) => {
    currentPage = page;
    const start = (page - 1) * STYLES_PER_PAGE + 1;
    const end = start + STYLES_PER_PAGE;

    const fragment = doc.createDocumentFragment();
    for (let n = start; n < end; n++) fragment.append(createStyleRow(n));
    if (page === MAX_PAGE) fragment.append(createLastPageButtons());
    styleRows.replaceChildren(fragment);

    for (let n = start; n < end && n <= STYLE_COUNT; n++) updateApplyBtnColor(`Style${n}`);

    if (selectedStyleKey) findApplyBtn(selectedStyleKey)?.classList.add('is-selected');
  };

  const resetMoveBtnColors = () => {
    moveBtn.style.color = '';
    moveBtn.style.backgroundColor = '';
    moveBtn.classList.remove('has-selection');
  };

  const clearSelection = () => {
    selectedStyleKey = null;
    styleRows.querySelectorAll('.apply-btn.is-selected').forEach((btn) => {
      btn.classList.remove('is-selected');
    });
  };

  const selectStyle = (name) => {
    selectedStyleKey = name;
    const btn = findApplyBtn(name);
    btn?.classList.add('is-selected');
    moveBtn.style.color = btn?.style.color ?? '';
    moveBtn.style.backgroundColor = btn?.style.backgroundColor ?? '';
    moveBtn.classList.add('has-selection');
  };

  // DEL: 選択中のStyleを削除（ゴミ箱へ移動）
  const deleteSelectedStyle = () => {
    const name = selectedStyleKey;
    if (!name || !savedStyles[name]) return;

    moveToTrash(name, savedStyles[name]);
    delete savedStyles[name];
    persistSavedStyles();

    updateApplyBtnColor(name);
    clearSelection();
    resetMoveBtnColors();
  };

  const handleApplyClick = (name) => {
    // 通常モード
    if (!isMoveMode) {
      applyStyleByName(name);
      return;
    }

    // 移動モード: INIT解除待機中 → 初期Styleのクリックで解除（別のStyleなら待機を取り消すだけ）
    if (isInitUnsetArmed) {
      if (name === initStyleName) {
        clearInitStyleName();
        initStyleName = null;
      }
      setInitUnsetArmed(false);
      return;
    }

    // 移動モード: 未選択 → 選択
    if (!selectedStyleKey) {
      selectStyle(name);
      return;
    }

    // 同じものを再クリック → 解除 / 別のものクリック → 入れ替え
    if (selectedStyleKey !== name) {
      swapStyles(selectedStyleKey, name);
      updateApplyBtnColor(selectedStyleKey);
      updateApplyBtnColor(name);
    }
    clearSelection();
    resetMoveBtnColors();
  };

  const applyRandomStyle = (btn) => {
    const keys = Object.keys(savedStyles);
    if (keys.length === 0) {
      flashText(btn, 'No styles saved yet');
      return;
    }
    const candidates = keys.length > 1 ? keys.filter((k) => k !== lastRandomKey) : keys;
    lastRandomKey = candidates[Math.floor(Math.random() * candidates.length)];
    applyStyleByName(lastRandomKey);
  };

  const copyAllStyles = (btn) => {
    if (Object.keys(savedStyles).length === 0) {
      flashText(btn, '保存スタイルがありません');
      return;
    }
    const json = JSON.stringify(extractBase(getSortedStyles()), null, 2);
    copyToClipboard(btn, json, { default: btn.dataset.label, success: 'コピーしました!' });
  };

  // SAVEボタン
  const saveStyle = async (name) => {
    // 編集済みデータ、またはキャンセル時は false
    const confirmed = await showSaveConfirmOverlay(name, collectCurrentStyle());
    if (!confirmed) return;

    savedStyles[name] = confirmed;
    persistSavedStyles();

    win.alert('☆ 保存しました!');
    updateApplyBtnColor(name);
  };

  /* --- イベント登録 --- */

  oUIOpenBtn.addEventListener('click', () => {
    onetapUI.style.display = 'block';
  });
  oUICloseBtn.addEventListener('click', () => {
    onetapUI.style.display = 'none';
  });

  styleRows.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, name } = btn.dataset;
    if (action === 'save') saveStyle(name);
    else if (action === 'apply') handleApplyClick(name);
    else if (action === 'random') applyRandomStyle(btn);
    else if (action === 'copy-all') copyAllStyles(btn);
  });

  doc.getElementById('prevPageBtn').addEventListener('click', () => {
    renderStylePage(currentPage > 1 ? currentPage - 1 : MAX_PAGE);
  });
  doc.getElementById('nextPageBtn').addEventListener('click', () => {
    renderStylePage(currentPage < MAX_PAGE ? currentPage + 1 : 1);
  });

  delBtn.disabled = true; // MOVEモード中のみ有効
  delBtn.addEventListener('click', deleteSelectedStyle);

  // INIT: 選択中のStyleを、次回以降の初期適用スタイルとして記憶する。
  // 何も選択せずに押すと、設定中なら解除待機（もう一度押すと取り消し）
  initBtn.disabled = true; // MOVEモード中のみ有効
  updateInitBtn();
  initBtn.addEventListener('click', () => {
    const name = selectedStyleKey;

    if (!name) {
      if (initStyleName) setInitUnsetArmed(!isInitUnsetArmed);
      return;
    }

    persistInitStyleName(name);
    initStyleName = name;
    updateInitBtn();
    clearSelection();
    resetMoveBtnColors();
  });

  moveBtn.addEventListener('click', () => {
    isMoveMode = !isMoveMode;
    clearSelection();
    resetMoveBtnColors();
    moveBtn.classList.toggle('is-active', isMoveMode);
    delBtn.disabled = !isMoveMode;
    initBtn.disabled = !isMoveMode;
    setInitUnsetArmed(false);
    styleRows.classList.toggle('move-mode', isMoveMode);
  });

  // 既存キーの上書きを確認して保存する。キャンセル時は false
  const saveStyleMap = (styleMap) => {
    const keys = Object.keys(styleMap);

    const existingKeys = keys.filter((k) => k in savedStyles);
    if (existingKeys.length > 0) {
      if (!win.confirm(`${formatKeyRanges(existingKeys)} はすでに存在します。\n上書きしますか?`)) return false;
    }

    Object.assign(savedStyles, styleMap);
    persistSavedStyles();

    win.alert(`☆ ${formatKeyRanges(keys)} に保存しました!`);
    keys.forEach(updateApplyBtnColor);
    return true;
  };

  // 復元キーワード: "all" または Style番号（"3" / "1,3" / "1 3"）。該当しなければ null
  const parseRestoreKeyword = (text) => {
    const keyword = text.toLowerCase();
    if (keyword === 'all') return 'all';
    if (/^\d+(?:[\s,]+\d+)*$/.test(keyword)) {
      return keyword.split(/[\s,]+/).map((n) => `Style${parseInt(n, 10)}`);
    }
    return null;
  };

  // ゴミ箱から復元。保存された場合のみ true
  const restoreFromTrash = (keyword) => {
    const trash = loadTrash();
    if (Object.keys(trash).length === 0) {
      win.alert('ゴミ箱は空です');
      return false;
    }

    const keys = Object.keys(sortByStyleNumber(
      Object.fromEntries((keyword === 'all' ? Object.keys(trash) : keyword).map((k) => [k, null]))
    ));
    const missing = keys.filter((k) => !(k in trash));
    if (missing.length > 0) {
      win.alert(`ゴミ箱に ${formatKeyRanges(missing)} はありません`);
      return false;
    }

    const restored = saveStyleMap(Object.fromEntries(keys.map((k) => [k, trash[k]])));
    if (restored) removeFromTrash(keys);
    return restored;
  };

  // jsonInputのSAVEボタン（Style保存 / ゴミ箱からの復元）
  doc.getElementById('saveJsonBtn').onclick = () => {
    const saveJsonInput = doc.getElementById('saveJsonInput');
    const text = saveJsonInput.value.trim();

    const restoreKeyword = parseRestoreKeyword(text);
    if (restoreKeyword) {
      if (restoreFromTrash(restoreKeyword)) saveJsonInput.value = '';
      return;
    }

    const result = parseInputToStyleMap(expandBaseInText(text));
    if (result.error) {
      win.alert(result.error);
      return;
    }

    if (saveStyleMap(result.data)) saveJsonInput.value = '';
  };

  // jsonInputのAPPLYボタン
  doc.getElementById('applyJsonBtn').onclick = () => {
    const jsonInput = doc.getElementById('jsonInput');

    const result = parseInputToStyleMap(jsonInput.value.trim());
    if (result.error) {
      win.alert(result.error);
      return;
    }

    const styleMapValues = Object.values(result.data);

    // 複数Styleキーは適用不可
    if (styleMapValues.length > 1) {
      win.alert('個別のJSONを入力してください');
      return;
    }

    if (!win.confirm('☆ JSONデータを反映します!')) return;

    applyStyleAndClose(styleMapValues[0]);
    jsonInput.value = '';
  };

  /* --- 保存済みJSONの一覧ウィンドウ --- */

  const openAllJsonWindow = () => {
    const jsonUrl = URL.createObjectURL(new Blob([jsonWindowTpl], { type: 'text/html' }));
    const jsonWin = win.open(jsonUrl);

    jsonWin.addEventListener('load', () => {
      URL.revokeObjectURL(jsonUrl);

      const jsonDoc = jsonWin.document;
      const jsonStyleEl = jsonDoc.createElement('style');
      jsonStyleEl.textContent = jsonWinStyles;
      jsonDoc.head.appendChild(jsonStyleEl);

      const jsonDisplay = jsonDoc.getElementById('jsonDisplay');
      const prettyCheckbox = jsonDoc.getElementById('prettyPrintCheckbox');
      const prettyLabel = jsonDoc.getElementById('prettyPrintLabel');
      const jsonWinCopyBtn = jsonDoc.getElementById('jsonWinCopyBtn');
      const compressJsonBtn = jsonDoc.getElementById('compressJsonBtn');
      const allJsonEditBtn = jsonDoc.getElementById('allJsonEditBtn');
      const trashDisplay = jsonDoc.getElementById('trashDisplay');

      // 削除済みStyleの一時保管（開いた時点の内容。_base にまとめ、整形表示は固定）
      const trashJson = {
        description:
          'ここは MOVE→DEL 操作で削除したStyleのゴミ箱です（sessionStorage）。復元するにはSAVE入力欄にStyleの番号のみを（半角で、複数の場合はカンマ区切り）、またはすべて復元は all と入力し、SAVEを押してください。以下にDELされたStyleを表示しています。',
        ...extractBase(sortByStyleNumber(loadTrash())),
      };

      // 表示の元データ。編集後はユーザーが書いた形（_base の有無）のまま保持する
      let currentJson = extractBase(getSortedStyles());
      let isEditing = false;

      const stringifyJson = (value) =>
        prettyCheckbox.checked ? JSON.stringify(value, null, 2) : JSON.stringify(value);

      const updateJsonDisplay = () => {
        if (isEditing) return;
        jsonDisplay.value = stringifyJson(currentJson);
        trashDisplay.value = JSON.stringify(trashJson, null, 2);
      };

      const updateCompressBtn = () => {
        compressJsonBtn.textContent = '_base' in currentJson ? '展開する' : '短縮する';
      };

      const setEditingUI = (editing) => {
        isEditing = editing;
        allJsonEditBtn.textContent = editing ? '編集中…' : '編集';
        jsonDisplay.readOnly = !editing;
        jsonDisplay.classList.toggle('editing', editing);
        [prettyCheckbox, jsonWinCopyBtn, compressJsonBtn].forEach((el) => {
          el.disabled = editing;
          el.classList.toggle('disabled', editing);
        });
        prettyLabel.classList.toggle('disabled', editing);
      };

      prettyCheckbox.addEventListener('change', updateJsonDisplay);

      compressJsonBtn.addEventListener('click', () => {
        if (Object.keys(currentJson).length === 0) {
          jsonWin.alert('保存スタイルがありません');
          return;
        }
        if (compressJsonBtn.textContent === '展開する') {
          if (!jsonWin.confirm('"_base"を各スタイルに展開しますか?')) return;
          currentJson = expandBase(currentJson);
        } else {
          if (!jsonWin.confirm('各スタイルの共通した値を"_base"にまとめますか?')) return;
          currentJson = extractBase(currentJson);
        }
        updateJsonDisplay();
        updateCompressBtn();
      });

      jsonWinCopyBtn.addEventListener('click', async () => {
        if (Object.keys(currentJson).length === 0) {
          jsonWin.alert('保存スタイルがありません');
          return;
        }
        try {
          await jsonWin.navigator.clipboard.writeText(jsonDisplay.value);
          jsonWin.alert('コピーしました!');
        } catch (err) {
          jsonWin.alert(`コピーに失敗しました: ${err}`);
        }
      });

      allJsonEditBtn.addEventListener('click', () => {
        if (!isEditing) {
          setEditingUI(true);
          return;
        }

        // 検証は _base を展開した形で行う
        const text = jsonDisplay.value;
        const { error } = validateAndParseJSON(expandBaseInText(text));
        if (error) {
          jsonWin.alert(error);
          return; // 編集モードのまま
        }

        // 展開済みデータではなく、編集した内容そのものを保持する（プリティプリント切替で _base が展開されないように）
        currentJson = JSON.parse(normalizeJSONString(text));
        setEditingUI(false);

        const compressedLength = JSON.stringify(extractBase(currentJson)).length;
        compressJsonBtn.textContent =
          compressedLength < JSON.stringify(currentJson).length ? '短縮する' : '展開する';
      });

      updateCompressBtn();
      updateJsonDisplay();
    });
  };

  doc.getElementById('viewAllJsonBtn').onclick = openAllJsonWindow;

  // 初期ページを描画（Style1〜8）
  renderStylePage(1);

  // 初期スタイルの適用（INITで記憶したStyle。未設定・未保存・fontFamilyなしならデフォルトフォント）
  // 検索メニューは後段の createMenus() が win.appConfig を見て作る
  const initStyleData = initStyleName ? savedStyles[initStyleName] : null;
  if (!initStyleData?.fontFamily) applyFont(DEFAULT_FONT);
  if (initStyleData) {
    applyStyleData(initStyleData);
    win.appConfig = initStyleData;
  }

  // ==============================
  // テキスト選択で検索ショートカット
  // ==============================

  let pendingSelection = null;
  let currentSearchText = '';

  doc.addEventListener('selectionchange', () => {
    const sel = win.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;

    const text = sel.toString().trim();
    if (!text) return;

    const range = sel.getRangeAt(0);

    if (
      !novelDisplay.contains(range.startContainer) ||
      !novelDisplay.contains(range.endContainer)
    ) return;

    pendingSelection = {
      text,
      range: range.cloneRange(),
      direction: getSelectionDirection(sel)
    };
  });

  const DEFAULT_SEARCH_ENGINE = 'https://www.google.com/search?q=';

  // メニュー初期設定
  const defaultConfigs = [
    { label: '何者', side: 'left', offsetY: 0, query: '何者' , engine: DEFAULT_SEARCH_ENGINE },
    { label: '元ネタ', side: 'left', offsetY: 40, query: '元ネタ' , engine: DEFAULT_SEARCH_ENGINE },
    { label: '日本語訳', side: 'left', offsetY: 80, query: '日本語訳' , engine: DEFAULT_SEARCH_ENGINE },

    { label: '意味', side: 'right', offsetY: 0, query: 'とは' , engine: DEFAULT_SEARCH_ENGINE },
    { label: '読み方', side: 'right', offsetY: 40, query: '読み方' , engine: DEFAULT_SEARCH_ENGINE },
    { label: '意味 読み方', side: 'right', offsetY: 80, query: '意味 読み方' , engine: DEFAULT_SEARCH_ENGINE }
  ];

  // メニュー設定を受け取る関数
  function getSearchConfigs() {
    const cfg = win.appConfig;

    if (!cfg || !Array.isArray(cfg.searchConfigs)) {
      return defaultConfigs;
    }

    return cfg.searchConfigs
      .filter(item =>
        item &&
        typeof item.label === 'string' &&
        typeof item.query === 'string'
      )
      .map(item => ({
        label: item.label,
        side: item.side === 'right' ? 'right' : 'left',
        offsetY: Number.isFinite(Number(item.offsetY)) ? Number(item.offsetY) : 0,
        query: item.query,
        engine: typeof item.engine === 'string'
          ? item.engine
          : DEFAULT_SEARCH_ENGINE
      }));
  }

  const menus = [];

  function createMenus() {
    menus.forEach(({ div }) => div.remove());
    menus.length = 0;

    const configs = getSearchConfigs();

    configs.forEach(cfg => {
      const div = doc.createElement('div');
      div.className = 'search-menu';

      const btn = doc.createElement('button');
      btn.textContent = cfg.label;

      btn.onclick = () => {
        const query = encodeURIComponent(currentSearchText + " " + cfg.query);
        const url = cfg.engine + query;

        win.open(url, '_blank', 'noopener,noreferrer');
        hideMenus();
      };

      div.appendChild(btn);
      doc.body.appendChild(div);

      menus.push({ div, cfg });
    });
  }

  createMenus();

  // 表示制御
  function showMenus(selection) {
    const { text, range, direction } = selection;
    currentSearchText = text;
    const rect = range.getBoundingClientRect();

    const fontSize = parseFloat(getComputedStyle(novelDisplay).fontSize) || 20;
    const offset = fontSize + 10;
    const textRect = novelDisplay.getBoundingClientRect();
    const centerX = textRect.left + textRect.width / 2;

    menus.forEach(({ div }) => {
      div.style.display = 'block';
    });

    menus.forEach(({ div, cfg }) => {
      const width = div.offsetWidth;
      const height = div.offsetHeight;

      if (cfg.side === 'right') {
        div.style.left = (centerX + offset + win.scrollX) + 'px';
      } else {
        div.style.left = (centerX - offset - width + win.scrollX) + 'px';
      }

      const top =
        text.length === 1 || direction === 'forward'
          ? rect.bottom - height - (text.length === 1 ? 40 : 80)
          : rect.top;

      div.style.top = (top + cfg.offsetY + win.scrollY) + 'px';
    });
  }

  function getSelectionDirection(sel) {
    if (sel.anchorNode === sel.focusNode) {
      return sel.anchorOffset <= sel.focusOffset ? 'forward' : 'backward';
    }

    const pos = sel.anchorNode.compareDocumentPosition(sel.focusNode);

    return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? 'forward' : 'backward';
  }

  function hideMenus() {
    menus.forEach(({ div }) => {
      div.style.display = 'none';
    });
  }

  doc.addEventListener('mouseup', () => {
    if (!pendingSelection) return;
    const selection = pendingSelection;
    pendingSelection = null;
    showMenus(selection);
  });

  doc.addEventListener('mousedown', (e) => {
    if (!menus.some(({ div }) => div.contains(e.target))) {
      hideMenus();
    }
  });
});
