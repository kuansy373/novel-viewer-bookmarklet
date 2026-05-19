console.log('novel-window loaded: v2.0.3');

const win = window;
const doc = document;

const data = win.__NOVEL_DATA__;

const {
  totalVisibleChars,
  numPages,
  pageRanges,
  fullHTML,
  pageCharCounts,
  validPageCount
} = data;

const container = doc.getElementById('novelDisplay');
if (container && data) {

  // 長文の負荷軽減のため50文字毎にspan分割する関数
  // タグ内<>とエンティティ内&;は避ける
  function chunkHTMLSafe(html, chunkSize) {
    const chunks = [];
    const len = html.length;
    let i = 0, last = 0, count = 0, rubyDepth = 0;

    while (i < len) {
      const ch = html[i];

      if (ch === '<') {
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

      if (ch === '&') {
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
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    const range = pageRanges[pageIndex];

    // 前ページのtailを半透明で追加
    if (pageIndex > 0) {
      const prevRange = pageRanges[pageIndex - 1];
      const tailHTML = fullHTML.slice(prevRange.tailHtmlStart, prevRange.endHtmlPos);
      const span = document.createElement('span');
      span.style.opacity = '0.5';
      span.innerHTML = tailHTML;
      frag.appendChild(span);
    }

    // メイン本文をchunk分割してspan生成
    const mainHTML = fullHTML.slice(range.startHtmlPos, range.endHtmlPos);
    for (const chunkHTML of chunkHTMLSafe(mainHTML, 50)) {
      const span = document.createElement('span');
      span.innerHTML = chunkHTML;
      frag.appendChild(span);
    }

    container.appendChild(frag);
  }

  // ページが有効かチェックする関数
  function isValidPage(pageIndex) {
    return pageIndex >= 0 &&
           pageIndex < pageRanges.length &&
           pageCharCounts[pageIndex] > 0;
  }

  // ページ切り替えオーバーレイ作成関数
  function createOverlay() {
    const overlay = doc.createElement('div');
    overlay.id = 'page-switch-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 10005;
    `;

    const dialog = doc.createElement('div');
    dialog.style.cssText = `
      padding: 30px;
      border-radius: 6px;
      text-align: center;
      max-width: 400px;
    `;

    const message = doc.createElement('p');
    message.id = 'overlay-message';
    message.style.cssText = `
      font-size: 18px;
      margin-bottom: 15px;
      color: #333;
    `;

    const inputContainer = doc.createElement('div');
    inputContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin-bottom: 20px;
    `;

    const pageInput = doc.createElement('input');
    pageInput.type = 'number';
    pageInput.min = '1';
    pageInput.id = 'page-input';
    pageInput.style.cssText = `
      padding: 8px;
      font-size: 18px;
      border: 2px solid hsl(from currentColor h s l / 0.7);
      border-radius: 5px;
      text-align: center;
    `;

    const pageLabel = doc.createElement('span');
    pageLabel.textContent = 'ページ目に移動しますか?';
    pageLabel.id = 'pageLabel';
    pageLabel.style.cssText = `
      font-size: 18px;
      color: unset;
    `;

    inputContainer.appendChild(pageInput);
    inputContainer.appendChild(pageLabel);

    const buttonContainer = doc.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: center;
    `;

    const createChoiceButton = (doc, text, id) => {
      const btn = doc.createElement('button');
      btn.textContent = text;
      btn.id = id;
      btn.style.cssText = `
        padding: 10px 30px;
        font-size: 16px;
        background: rgba(120, 120, 120, 0.3);
        color: unset;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      `;
      return btn;
    };

    const yesButton = createChoiceButton(doc, 'はい', 'yesButton');
    const noButton = createChoiceButton(doc, 'いいえ', 'noButton');

    buttonContainer.appendChild(yesButton);
    buttonContainer.appendChild(noButton);
    dialog.appendChild(message);
    dialog.appendChild(inputContainer);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    doc.body.appendChild(overlay);

    return { overlay, message, pageInput, yesButton, noButton };
  }

  // 桁数に応じてinputの幅を調整
  function adjustInputWidth(input) {
    const digits = input.value.length || 1;
    input.style.width = `${digits + 2}ch`;
  }

  const overlayElements = createOverlay();

  // オーバーレイ表示関数
  function showOverlay(defaultPage, maxPage, onYes) {
    overlayElements.message.textContent = '';
    overlayElements.pageInput.value = defaultPage;
    adjustInputWidth(overlayElements.pageInput);
    overlayElements.pageInput.max = maxPage;
    disableBodyScroll();
    overlayElements.overlay.style.display = 'flex';

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
      resetScrollSliders();
    };

    // いいえ
    const handleNo = () => {
      overlayElements.overlay.style.display = 'none';
      enableBodyScroll();
      cleanup();
      resetScrollSliders();
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

  // 初回表示
  let currentIndex = 0;
  renderPart(currentIndex);

  // ページ切り替え可能フラグ
  let promptShownForward = false;
  let promptShownBackward = false;
  // 切り替え中フラグ
  let isSwitching = false;

  win.addEventListener('scroll', () => {
    if (isSwitching) return;

    const scrollBottom = win.scrollY + win.innerHeight;
    const scrollTop = win.scrollY;
    const bodyHeight = doc.body.offsetHeight;

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
        win.scrollTo(0, 0);
        win.setTimeout(() => {
          isSwitching = false;
        }, 50);
        promptShownForward = false;
        promptShownBackward = false;
      });
    } else if (scrollBottom < bodyHeight - win.innerHeight / 4) {
      // 最上部から（25%）離れたらフラグON
      promptShownForward = true;
    }

    // 上方向・最上部で前ページ
    if (
      totalVisibleChars > 10000 &&
      scrollTop <= 5 &&
      promptShownBackward
    ) {
      const targetPageForPrompt = currentIndex === 0 ? validPageCount  : currentIndex;
      resetScrollSliders();
      showOverlay(targetPageForPrompt, numPages , (targetPage) => {
        isSwitching = true;
        currentIndex = targetPage - 1;
        renderPart(currentIndex);
        win.requestAnimationFrame(() => {
          if (currentIndex === pageRanges.length - 1) {
            win.scrollTo(0, 0);
          } else {
            win.scrollTo(0, 1e9);
          }
          win.setTimeout(() => {
            isSwitching = false;
          }, 50);
          promptShownForward = false;
          promptShownBackward = false;
        });
      });
    } else if (scrollTop > (currentIndex === 0 ? win.innerHeight / 1.5625 : win.innerHeight / 4)) {
      // 最上部から（1ページ目:64%、それ以外:25%）離れたらフラグON
      promptShownBackward = true;
    }
  });

  function resetScrollSliders() {
    if (typeof scrollSliderRight !== 'undefined') scrollSliderRight.value = 0;
    if (typeof scrollSliderLeft !== 'undefined') scrollSliderLeft.value = 0;
    if (typeof scrollSpeed !== 'undefined') scrollSpeed = 0;
    lastTimestamp = null;
  }

  function disableBodyScroll() {
    doc.body.style.overflow = 'hidden';
    doc.documentElement.style.overflow = 'hidden';
  }

  function enableBodyScroll() {
    doc.body.style.overflow = '';
    doc.documentElement.style.overflow = '';
  }

  //
  function injectSliderStyles() {
    if (doc.getElementById('custom-slider-styles')) return;
    const style = doc.createElement('style');
    style.id = 'custom-slider-styles';
    style.textContent = `
      input[type="range"]::-webkit-slider-thumb {
        margin-top: 90vh;
      }
    `;
    doc.head.appendChild(style);
  }

  // スライダー作成関数
  function createSlider(position, additionalStyle = {}) {
    injectSliderStyles();
    const slider = doc.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 25;
    slider.value = 0;
    Object.assign(slider.style, {
      appearance: 'none',
      border: 'none',
      position: 'fixed',
      height: '100vh',
      margin: '0',
      zIndex: '9999',
      width: '80px',
      [position]: '30px',
      ...additionalStyle,
    });
    doc.body.appendChild(slider);
    return slider;
  }

  // 左右スライダー作成
  const scrollSliderRight = createSlider('right');
  const scrollSliderLeft = createSlider('left', { direction: 'rtl' });

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

    // ユーザーが手動スクロールした場合に基準を現在位置に更新
    if (Math.abs(scroller.scrollTop - preciseScroll) > 2) {
      preciseScroll = scroller.scrollTop;
    }

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

  // 両方のスライダーの値を同期
  function onSliderInput(e) {
    const val = +e.target.value;
    scrollSpeed = val * speedScale;

    if (scrollSliderRight !== e.target) {
      scrollSliderRight.value = val;
    }
    if (scrollSliderLeft !== e.target) {
      scrollSliderLeft.value = val;
    }
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

  // ==============================
  // Slider Settings
  // ==============================

  const ssContainerStyle = doc.createElement('style');
  ssContainerStyle.textContent = `
    #scrollUI {
      position: fixed;
      top: 10px;
      left: 10px;
      padding: 8px;
      background: inherit;
      border: 1px solid;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10007;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    #scrollUI .title {
      font-weight:bold;
      margin-left: 3px;
    }
    #scrollUI label {
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
      pointer-events: none;
    }
    #scrollUI label > * {
      pointer-events: auto;
    }
    #scrollUI .settingCheckbox {
      height: 15px;
      width: 15px;
      flex-shrink: 0;
      user-select: none;
    }
    #scrollUI .settingInputbox {
      width: 60px;
      border: 1px solid;
      color: unset;
    }
  `;
  doc.head.appendChild(ssContainerStyle);

  const scrollUI = doc.createElement('div');
  scrollUI.id = 'scrollUI';
  scrollUI.innerHTML = `
    <div class="title"> Slider Settings</div>
    <label><span><input id="scrollRight" class="settingCheckbox" type="checkbox"> Right side</span></label>
    <label><span><input id="scrollLeft" class="settingCheckbox" type="checkbox"> Left side</span></label>
    <label><span>Shadow :  <input id="scrollS" class="settingInputbox" type="number" value="0"> px</span></label>
    <label><span>Opacity :  <input id="scrollO" class="settingInputbox" type="number" min="0" max="100" value="100"> %</span></label>
    <label><span><input id="scrollB" class="settingCheckbox" type="checkbox"> Border</span></label>
    <label><span><input id="scrollC" class="settingCheckbox" type="checkbox"> Color in</span></label>
    <label><span>Position :  <input id="scrollX" class="settingInputbox" type="number" value="30"> px</span></label>
    <label><span>Width :  <input id="scrollW" class="settingInputbox" type="number" value="80"> px</span></label>
    <label><span>Speed scale :  <input id="scrollSpeedScale" class="settingInputbox" type="number" min="0" max="20" step="1" value="10"> (0~20)</span></label>
    <label><span><input id="scrollHide" class="settingCheckbox" type="checkbox"> Slider ball</span></label>
  `;
  doc.body.appendChild(scrollUI);

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
    scrollHide:       { prop: 'checked', event: 'change',  key: 'hideBall',    parser: null },
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
  setupXWInput('scrollX', val => applyToSliders(el => { el.style[el === scrollSliderRight ? 'right' : 'left'] = `${val}px`;}));
  setupXWInput('scrollW', val => applyToSliders(el => el.style.width = `${val}px`));

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

  // Slider ball
  doc.getElementById('scrollHide').addEventListener('change', e => {
    const existingStyle = doc.getElementById('slider-thumb-hide');

    if (!e.target.checked) {
      if (!existingStyle) {
        const style = doc.createElement('style');
        style.id = 'slider-thumb-hide';
        style.textContent = `
          input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            opacity: 0;
          }
        `;
        doc.head.appendChild(style);
      }
    } else {
      if (existingStyle) {
        existingStyle.remove();
      }
    }
  });

  // 初期設定
  applyScrollSettings({
    right:      false,
    left:       false,
    shadow:     0,
    opacity:    100,
    border:     true,
    colorIn:    false,
    position:   30,
    width:      80,
    speedScale: 10,
    hideBall:   true
  });

  // 開くボタン共通スタイル
  const baseOpenBtnStyle = {
    position: 'fixed',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'unset',
    opacity: '0.3',
    display: 'block'
  };

  // 開くボタン △
  const sUIOpenBtn = doc.createElement('div');
  sUIOpenBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24">
      <polygon points="12,6.144 20,20 4,20" fill="none" stroke="currentColor" stroke-width="1"/>
    </svg>
  `;
  Object.assign(sUIOpenBtn.style, baseOpenBtnStyle, {
    padding: '5px 8px 5px 8px',
    top: '5px',
    left: '10px',
    zIndex: '10006',
  });
  doc.body.appendChild(sUIOpenBtn);

  scrollUI.style.display = 'none';
  sUIOpenBtn.addEventListener('click', () => {
    scrollUI.style.display = 'flex';
  });

  // 閉じるボタン生成関数
  const createCloseBtn = () => {
    const closeBtn = doc.createElement('div');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '5px',
      right: '10px',
      cursor: 'pointer',
      fontSize: '16px',
      color: 'unset',
      userSelect: 'none'
    });
    return closeBtn;
  };

  // 閉じるボタン ✕
  const sUICloseBtn = createCloseBtn();
  scrollUI.appendChild(sUICloseBtn);

  sUICloseBtn.addEventListener('click', () => {
    scrollUI.style.display = 'none';
  });

  // ==============================
  // Font Control Panel
  // ==============================

  ['fontPanel', 'fontOpenBtn'].forEach(id => {
    const el = doc.getElementById(id);
    if (el) el.remove();
  });

  let target = doc.getElementById('novelDisplay');
  if (!target) {
    console.error('#novelDisplay が見つかりません');
  }

  // パネルコンテナ
  const panel = doc.createElement('div');
  panel.id = 'fontPanel';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '10px',
    right: '10px',
    padding: '0 8px',
    paddingBottom: '8px',
    width: '270px',
    height: '87px',
    border: '1px solid',
    borderRadius: '4px',
    zIndex: '10007',
    display: 'none',
    fontFamily: 'sans-serif'
  });

  // モードボタン
  const modes = ['Text shadow','Font weight','Font size'];
  let currentMode = 'Font size';
  const modeContainer = doc.createElement('div');
  Object.assign(modeContainer.style, {
    display: 'block',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '8px'
  });

  // 選択切り替えスタイル制御
  const setActive = (btn, isActive) => {
    btn.style.opacity = isActive ? '1' : '0.5';
    btn.style.boxShadow = isActive ? 'inset 0 0 3px' : 'none';
  };

  modes.forEach(mode => {
    const btn = doc.createElement('button');
    btn.textContent = mode;
    Object.assign(btn.style, {
      fontSize: '13px',
      padding: '6px 4px 2px',
      border: '1px solid',
      borderRadius: '4px',
      color: 'unset',
      cursor: 'pointer',
      textAlign: 'left',
    });
    if (mode === 'Font weight') btn.style.margin = '0 7px';

    setActive(btn, mode === currentMode);

    btn.addEventListener('click', () => {
      currentMode = mode;
      [...modeContainer.children].forEach(c => setActive(c, false));
      setActive(btn, true);
      updateControls();
    });
    modeContainer.appendChild(btn);
  });

  // コントロールエリア
  const controlArea = doc.createElement('div');
  Object.assign(controlArea.style, {
  });

  // ラベル
  const label = doc.createElement('div');
  Object.assign(label.style, {
    fontSize: '14px',
    marginBottom: '4px'
  });

  // 増減ボタン
  const decAndIncBtnStyle = {
    position: 'absolute',
    fontSize: '15px',
    padding: '0 6px',
    marginBottom: '3px',
    borderRadius: '4px',
    border: '1px solid',
    cursor: 'pointer'
  };

  const decreaseBtn = doc.createElement('button');
  decreaseBtn.id = 'sliderDecrease';
  decreaseBtn.textContent = '◀';
  Object.assign(decreaseBtn.style, decAndIncBtnStyle, {
    left: '135px'
  });

  const increaseBtn = doc.createElement('button');
  increaseBtn.id = 'sliderIncrease';
  increaseBtn.textContent = '▶';
  Object.assign(increaseBtn.style, decAndIncBtnStyle, {
    left: '255px'
  });

  // 増減ボタンの共通処理
  function adjustSlider(delta) {
    let value = parseInt(slider.value) + delta * parseInt(slider.step || 1);
    if (value >= parseInt(slider.min) && value <= parseInt(slider.max)) {
      slider.value = value;
      slider.dispatchEvent(new Event('input'));
    }
  }

  decreaseBtn.addEventListener('click', () => adjustSlider(-1));
  increaseBtn.addEventListener('click', () => adjustSlider(1));

  // スライダー
  const slider = doc.createElement('input');
  slider.type = 'range';
  Object.assign(slider.style, {
    position: 'absolute',
    width: '100px',
    marginLeft: '151px',
    marginBottom:'4px',
    blockSize: '5px',
  });

  // 更新処理
  function updateControls() {
    if (!target) return;

    if (currentMode === 'Font size') {
      slider.min = 10;
      slider.max = 50;
      slider.step = 1;
      slider.value = parseInt(getComputedStyle(target).fontSize) || 23;
      label.textContent = `Font size: ${slider.value}px`;
      slider.oninput = () => {
        target.style.fontSize = `${slider.value}px`;
        label.textContent = `Font size: ${slider.value}px`;
      };
    }
    else if (currentMode === 'Font weight') {
      slider.min = 100;
      slider.max = 900;
      slider.step = 100;
      slider.value = parseInt(getComputedStyle(target).fontWeight) || 400;
      label.textContent = `Font weight: ${slider.value}`;
      slider.oninput = () => {
        target.style.fontWeight = slider.value;
        label.textContent = `Font weight: ${slider.value}`;
      };
    }
    else if (currentMode === 'Text shadow') {
      slider.min = 0;
      slider.max = 30;
      slider.step = 1;

      // 現在のスライダー値を保持（前回の設定を使う）
      let blur = parseInt(target.dataset.textShadow || 0);
      slider.value = blur;
      label.textContent = `Text shadow: ${slider.value}px`;

      slider.oninput = () => {
        const b = slider.value;
        if (b > 0) {
          target.style.textShadow = `0 0 ${b}px`;
        } else {
          target.style.textShadow = 'none';
        }
        label.textContent = `Text shadow: ${b}px`;

        // blur 値を保持しておく
        target.dataset.textShadow = b;
      };
    }
  }

  // 横並び用コンテナを作る
  const sliderContainer = doc.createElement('div');
  Object.assign(sliderContainer.style, {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '5px',
  });
  // controlArea に横並びコンテナを追加
  controlArea.appendChild(sliderContainer);
  // ラベルとスライダーを横並びコンテナに追加
  sliderContainer.appendChild(label);
  sliderContainer.appendChild(slider);
  sliderContainer.appendChild(decreaseBtn);
  sliderContainer.appendChild(increaseBtn);

  panel.appendChild(modeContainer);
  panel.appendChild(controlArea);
  doc.body.appendChild(panel);

  // Font Family セレクトボックス
  const fontFamilyContainer = doc.createElement('div');
  Object.assign(fontFamilyContainer.style, {
    display: 'flex',
  });

  // ラベル
  const fontFamilyLabel = doc.createElement('div');
  fontFamilyLabel.textContent = 'Font family:';
  Object.assign(fontFamilyLabel.style, {
    fontSize: '14px',
    marginBottom: '4px'
  });
  fontFamilyContainer.appendChild(fontFamilyLabel);

  // セレクトボックス
  const fontSelect = doc.createElement('select');
    Object.assign(fontSelect.style, {
      alignItems: 'center',
      border: '1px solid',
      color: 'unset',
      marginLeft: '10px',
      width: '155px',
      height: '25px',
      paddingLeft: '5px',
      fontSize: '14px',
  });
  [
    '游明朝',
    'sans-serif',
    'Zen Kurenaido',
    'New Tegomin',
    'Yuji Syuku',
    'Kaisei Decol',
    'Hachi Maru Pop',
    'Stick',
    'DotGothic16',
    'Rampart One',
  ].forEach(font => {
    const opt = doc.createElement('option');
    opt.value = font;
    opt.textContent = font;
    fontSelect.appendChild(opt);
  });

  // グローバル変数として現在のフォントを保持
  let currentFont = '游明朝';

  // セレクト切り替え時にフォント適用
  fontSelect.addEventListener('change', () => {
    const font = fontSelect.value;
    currentFont = font; // 現在のフォントを保存
    // target以外の適用先をIDで取得する
    const pageLabel = doc.getElementById('pageLabel');
    const yesButton = doc.getElementById('yesButton');
    const noButton = doc.getElementById('noButton');
    const title = doc.getElementById('title');
    const prettyLabel = doc.getElementById('prettyLabel');
    const jsonCopyBtn = doc.getElementById('jsonCopyBtn');
    const cancelBtn = doc.getElementById('cancelBtn');
    const saveBtn = doc.getElementById('saveBtn');
    // 適用対象を配列にまとめる
    const elements = [target, pageLabel, yesButton, noButton, title, prettyLabel, jsonCopyBtn, cancelBtn, saveBtn];

    if (font === '游明朝') {
      doc.body.style.fontFamily = '';
      elements.forEach(el => { if (el) el.style.fontFamily = ''; });
      return;
    }
    if (font === 'sans-serif') {
      elements.forEach(el => { if (el) el.style.fontFamily = 'sans-serif'; });
      return;
    }
    // Google Fonts 読み込み
    const id = "gf-font-" + font.replace(/\s+/g, '-');
    if (!doc.getElementById(id)) {
      const link = doc.createElement('link');
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" + font.replace(/ /g, '+') + "&display=swap";
      doc.head.appendChild(link);
    }
    elements.forEach(el => {
      if (el) el.style.fontFamily = `'${font}', sans-serif`;
    });
  });
  fontFamilyContainer.appendChild(fontSelect);

  // controlArea に追加
  controlArea.appendChild(fontFamilyContainer);

  // 開くボタン 〇
  const fUIOpenBtn = doc.createElement('div');
  fUIOpenBtn.id = 'fontOpenBtn';
  fUIOpenBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1"/>
    </svg>
  `;
  Object.assign(fUIOpenBtn.style, baseOpenBtnStyle, {
    padding: '5px 8px 5px 8px',
    top: '5px',
    right: '10px',
    zIndex: '10006'
  });
  doc.body.appendChild(fUIOpenBtn);

  fUIOpenBtn.addEventListener('click', () => {
    panel.style.display = 'block';
  });

  // 閉じるボタン ✕
  const fUICloseBtn = createCloseBtn();
  Object.assign(fUICloseBtn.style, {
    top: '0px',
    right: '9px',
  });
  panel.appendChild(fUICloseBtn);

  fUICloseBtn.addEventListener('click', () => {
    panel.style.display = 'none';
  });

  // 初期化
  updateControls();

  // ==============================
  // Color Pickr
  // ==============================

  // スコープ確保
  let applyColor;
  let colorState;
  let updateContrast;
  let updateColorHexDisplays;

  // pcr-appに上書きスタイル（GPUレイヤー削減目的）
  const pickrOverride = doc.createElement('style');
  pickrOverride.textContent = `
    .pcr-app {
      visibility: visible !important; /* hidden の打ち消し */
    }
    .pcr-app.visible {
      display: block !important;
    }
  `;
  doc.head.appendChild(pickrOverride);

  // 読み込み制御関数
  const load = (tag, attrs) => new Promise((resolve, reject) => {
    const el = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      // 属性として設定
      el.setAttribute(k, v);
    }
    el.onload = resolve;
    el.onerror = reject;
    doc.head.appendChild(el);
  });

  // バージョン固定とSRI対応可能な形で読み込み
  Promise.all([
    load('link', {
      rel: 'stylesheet',
      href: 'https://cdn.jsdelivr.net/npm/@simonwep/pickr@1.9.1/dist/themes/classic.min.css',
      integrity: 'sha256-qj36GhivWJmT9StJECKY9O6UivAiwl7S+uckYeyYQ38=',
      crossorigin: 'anonymous'
    }),
    load('script', {
      src: 'https://cdn.jsdelivr.net/npm/@simonwep/pickr@1.9.1/dist/pickr.min.js',
      integrity: 'sha256-9C+4uiI+EoOmixe5tRD8hziXftaA5lBhVeF5bjvtqkY=',
      crossorigin: 'anonymous'
    })
  ]).then(() => {
    const style = doc.createElement('style');
    const PickrClass = win.Pickr;
    style.textContent = `
      /* ---- #pickrContainer 関連 ---- */
      #pickrContainer {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 20000;
        color: unset;
        background: transparent;
        padding: 7px;
        padding-bottom: 0;
        border: 1px solid;
        border-radius: 8px;
        font-family: sans-serif;
        box-shadow: 0 0 4px;
        min-width: max-content;
        max-width: max-content;
      }

      #pickrClose {
        font-size: 15px;
        font-weight: bolder;
        color: unset;
        cursor: pointer;
        position: absolute;
        top: 5px;
        right: 7px;
      }

      #dragHandle {
        cursor: move;
        padding: 0px;
        margin-right: 20px;
        background: #F4F4F4;
        height: 25px;
        width: 22px;
      }

      #dragHandle:active {
        transform: none;
      }

      #pickrContainer .row {
        display: flex;
        align-items: center;
        margin-bottom: 2px;
        gap: 5px;
      }

      #pickrContainer .row.contrast-row {
        justify-content: flex-start;
        gap: 4px;
      }

      #pickrContainer .row.contrast-row > strong {
        display: inline-block;
        min-width: 60px;
      }

      #pickrContainer .label {
        font-weight: bold;
        font-family: monospace;
        font-size: 21px;
      }

      #pickrContainer .label-lock {
        margin-left: 2px;
        font-weight: normal;
        font-size: 19px;
      }

      .color-swatch {
        width: 30px;
        height: 30px;
        border: 1px solid #999;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .color-swatch > div {
        flex: 1;
      }

      .color-saved {
        border-bottom: 1px solid #999;
      }

      .hex-display {
        font-family: monospace;
        font-size: 14px;
        font-weight: normal;
        padding: 2px 4px;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 4px;
        text-align: left;
        width: 86px;
        height: 13px;
      }

      .copy-btn {
        position: absolute;
        right: 55px;
        font-size: 11px;
        block-size: 19px;
        padding: 1px;
        border: 1px solid #999;
        border-radius: 4px;
        background: #F0FFEC;
        cursor: pointer;
      }

      .hex-load-btn {
        cursor: pointer;
        padding: 2px 2px;
        font-size: 1em;
        font-weight: bolder;
        border: 1px solid #aaa;
        background: #fafafa;
        border-radius: 4px;
      }

      .hex-load-btn:active {
        transform: translateY(1px);
      }

      .switch-bgfg {
        all: initial;
        font-family: monospace;
        font-size: 18px;
        border: 1px solid #aaa;
        background: #f9f9f9;
        border-radius: 4px;
        width: 19px;
        height: 25px;
        text-align: center;
        margin-left: 3px;
      }

      .switch-bgfg:active {
        transform: translateY(1px);
      }

      input.contrast-display {
        font-family: monospace;
        font-size: 14px;
        font-weight: normal;
        width: 35px;
        padding: 1px;
        background: #ffffff;
        border: 2px solid #999;
        border-radius: 4px;
        text-align: center;
      }

      .btn-wrapper {
        position: relative;
        display: inline-block;
      }

      #randomColorBtn {
        background: #E6FDFF;
        border: 1px solid #aaa;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 15px;
        font-family: monospace;
      }

      .click-block {
        position: absolute;
        left: 0;
        top: 0;
        width: 10px;
        height: 100%;
        background: transparent;
        pointer-events: auto;
      }

      #randomColorBtn:active {
        transform: translateY(1px);
      }

      #bgLockIcon,
      #fgLockIcon {
        font-size: 14px;
        margin: 0px 0px;
        border: 1px solid;
        display: inline-block;
        user-select: none;
      }
      #fgLockIcon {
        border-color: var(--current-bg);
      }

      #bgLockLabel,
      #fgLockLabel {
        cursor: pointer;
        display: inline-flex;
        align-items:center;
      }

      .pickr .pcr-button {
        height: 25px;
        width: 25px;
        margin: 0px;
        cursor: pointer;
        border: 1px solid;
        border-radius: 2px;
        background-size: 0;
        transition: all .3s;
      }

      /* ---- .pcr-app 関連 ---- */
      .pcr-app {
        position: fixed !important;
        top: 150px !important;
        right: 10px !important;
        padding: 10px !important;
        width: 310px !important;
        height: 150px !important;
        z-index: 20001 !important;
        background: unset !important;
        border: 1px solid !important;
        display: none !important;
        visibility: visible !important;
      }

      .pcr-app.visible {
        display: block !important;
      }

      .pcr-selection {
        height: 114px !important;
      }

      .pcr-color-palette {
        height: auto !important;
        border: 1px solid !important;
        border-radius: 0px !important;
      }

      .pcr-palette {
        border-radius: 0px !important;
      }

      .pcr-color-preview {
        width: 22px !important;
        margin-right: 10px !important;
        border: 1px solid !important;
      }

      .pcr-color-chooser {
        margin-left: 10px !important;
      }

      .pcr-current-color {
        border-radius: 0px !important;
      }

      .pcr-swatches{
        margin-top: .65em !important;
      }

      .pcr-interaction {
        height: 25px !important;
        margin: 0px !important;
      }

      .pcr-result {
        height: 20px !important;
        margin: 0px !important;
        font-family: monospace !important;
        font-size: 15px !important;
        background: #fff !important;
        color: #000000 !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        box-shadow: 0 0 0px !important;
      }

      .pcr-save {
        position: relative !important;
        right: 10px !important;
        margin: 0px !important;
        font-size: 12px !important;
        font-weight: normal !important;
        height: 22px !important;
        width: 40px !important;
        padding: 0px !important;
        border: 1px solid #999 !important;
        border-radius: 4px !important;
        background: #97DDC8! important;
        color: #000000 !important;
        box-shadow: 0 0 0px !important;
      }

      .pcr-drag-handle {
        margin: 0px !important;
        cursor: move;
        border: 1px solid #aaa;
        border-radius: 4px;
        background: #F4F4F4;
        height: 25px;
      }

      .pcr-copy {
        position: relative;
        right: 20px;
        margin: 0px !important;
        cursor: pointer;
        border: 1px solid #999;
        border-radius: 4px;
        color: #000000;
        background: #F0FFEC;
        font-size: 12px;
        line-height: 17px;
      }
    `;

    doc.head.appendChild(style);
    const container = doc.createElement('div');
    container.id = 'pickrContainer';
    container.innerHTML = `
      <div id="pickrClose">✕</div>

      <div class="row">
        <div class="label">BG:</div>
        <div id="bgSwatch" class="color-swatch">
          <div class="color-saved"></div>
          <div class="color-current"></div>
        </div>
        <button id="bgHexLoad" class="hex-load-btn">⇦</button>
        <input id="bgHex" class="hex-display" value="-">
        <button class="copy-btn" data-target="bgHex">Copy</button>
        <div id="dragHandle" class="hex-load-btn">${createEqualsIcon()}</div>
      </div>

      <div class="row">
        <div class="label">FG:</div>
        <div id="fgSwatch" class="color-swatch">
          <div class="color-saved"></div>
          <div class="color-current"></div>
        </div>
        <button id="fgHexLoad" class="hex-load-btn">⇦</button>
        <input id="fgHex" class="hex-display" value="-">
        <button class="copy-btn" data-target="fgHex">Copy</button>
        <button id="swapColorsBtn" class="switch-bgfg">↕</button>
      </div>

      <div class="row">
        <div class="label label-lock">BG:</div>
        <label id="bgLockLabel">
          <input type="checkbox" id="color-toggle-bg-lock" style="display:none;">
          <span id="bgLockIcon">🔓</span>
        </label>
        <div class="label label-lock">FG:</div>
        <label id="fgLockLabel">
          <input type="checkbox" id="color-toggle-fg-lock" style="display:none;">
          <span id="fgLockIcon">🔓</span>
        </label>
        <div class="btn-wrapper">
          <button id="randomColorBtn">🎨Random</button>
          <div class="click-block"></div>
        </div>
      </div>

      <div class="row contrast-row" style="align-items: center;">
        <strong>Contrast:</strong>
        <span id="contrastRatio" style="width: 51px;">-</span>
        <input
          id="contrastMin"
          class="contrast-display"
          type="number"
          min="1"
          max="21"
          step="0.1"
          value="3"
          title="Minimum contrast ratio"
        >
        <span style="margin: 0;font-size: 10px;font-weight: 500;">～</span>
        <input
          id="contrastMax"
          class="contrast-display"
          type="number"
          min="1"
          max="21"
          step="0.1"
          value="18"
          title="Maximum contrast ratio"
        >
      </div>
    `;
    doc.body.appendChild(container);

    // ドラッグ関数呼び出し
    const dragHandle = doc.getElementById('dragHandle');
    const dragTarget  = doc.getElementById('pickrContainer');
    makeDraggable(dragHandle, dragTarget, doc);

    // bodyの色を取得しrgbをHex変換する関数
    const getHex = (prop) => {
      const rgb = getComputedStyle(doc.body)[prop];
      return rgbToHex(rgb);
    };

    // applyColor関数
    applyColor = function (prop, value) {
      if (!value) return;

      // color / background-color
      const id = prop === 'color' ? '__fgOverride' : '__bgOverride';
      let el = doc.getElementById(id);
      if (!el) {
        el = doc.createElement('style');
        el.id = id;
        doc.head.appendChild(el);
      }
      el.textContent = `
      *:not(#pickrContainer):not(#pickrContainer *):not(.pcr-app):not(.pcr-app *) {
        ${prop}: ${value};
      }`;

      updateGlobalColors();
    };

    // その他のプロパティを更新する関数
    const updateGlobalColors = () => {
      let styleEl = doc.getElementById('__globalColorOverride');
      if (!styleEl) {
        styleEl = doc.createElement('style');
        styleEl.id = '__globalColorOverride';
        doc.head.appendChild(styleEl);
      }
      styleEl.textContent = `
      :root {
        --current-fg: ${colorState.currentFg};
        --current-bg: ${colorState.currentBg};
      }
      html {
        scrollbar-color: var(--current-fg) var(--current-bg);
      }`;
    };

    const updateSwatch = (swatch, current, saved) => {
      if (!swatch) return;
      swatch.querySelector('.color-current').style.background = current;
      swatch.querySelector('.color-saved').style.background = saved
    };

    updateColorHexDisplays = () => {
      doc.getElementById("bgHex").value = colorState.currentBg;
      doc.getElementById("fgHex").value = colorState.currentFg;
      updateLockIcons();
    };

    // Pickr関連・状態変数の初期化
    const contrastEl = doc.getElementById('contrastRatio');

    colorState = {
      savedFg: getHex('color') || '#000000',
      currentFg: null,
      savedBg: getHex('backgroundColor') || '#ffffff',
      currentBg: null,
    };

    colorState.currentFg = colorState.savedFg;
    colorState.currentBg = colorState.savedBg;

    updateContrast = () =>
      (contrastEl.textContent = getContrast(
        colorState.currentFg,
        colorState.currentBg
      ));

    let savedPickrLeft = null;
    let savedPickrTop = null;

    // pickrの初期化関数
    const initPickr = (id, prop) => {
      const swatch = doc.getElementById(id + 'Swatch');
      const isFg = id === 'fg';

      const setCurrent = (v) => {
        if (isFg) colorState.currentFg = v;
        else      colorState.currentBg = v;
      };

      const setSaved = (v) => {
        if (isFg) colorState.savedFg = v;
        else      colorState.savedBg = v;
      };

      const getCurrent = () =>
        isFg ? colorState.currentFg : colorState.currentBg;

      const getSaved = () =>
        isFg ? colorState.savedFg : colorState.savedBg;

      const pickr = PickrClass.create({
        el: `#${id}Swatch`,
        theme: 'classic',
        default: getSaved(),
        components: {
          preview: !0,
          opacity: !1,
          hue: !0,
          interaction: {
            input: !0,
            save: !0,
          },
        },
      });

      pickr.on('init', () => {
        win.setTimeout(() => {
          doc.querySelectorAll('.pcr-app').forEach(app => {
            // pcr-appドラッグボタン追加
            if (!app.querySelector('.pcr-drag-handle')) {
              const saveBtn = app.querySelector('.pcr-save');
              if (saveBtn) {
                const dragBtn = doc.createElement('button');
                dragBtn.innerHTML = createEqualsIcon();
                dragBtn.className = 'pcr-drag-handle';
                saveBtn.insertAdjacentElement('afterend', dragBtn);

                makeDraggable(dragBtn, app, doc, (left, top) => {
                  savedPickrLeft = left;
                  savedPickrTop  = top;
                });
              }
            }

            // Copyボタン追加
            if (!app.querySelector('.pcr-copy')) {
              const resultInput = app.querySelector('.pcr-result');
              if (resultInput) {
                const hexCopyBtn = doc.createElement('button');
                hexCopyBtn.textContent = 'Copy';
                hexCopyBtn.className = 'pcr-copy';
                resultInput.insertAdjacentElement('afterend', hexCopyBtn);

                hexCopyBtn.addEventListener("click", () => {
                  if (resultInput && resultInput.value !== "-") {
                    copyToClipboard(hexCopyBtn, resultInput.value);
                  }
                });
              }
            }
            app.style.display = 'none';  // visibility: hidden の代わり
          });
        }, 0);
      });

      // pcr-app イベント登録
      pickr.on('show', (color) => {
        const hex = color.toHEXA().toString();
        setCurrent(hex);
        applyColor(prop, hex);
        updateSwatch(swatch, hex, getSaved());
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
        const hex = color.toHEXA().toString();
        setCurrent(hex);
        applyColor(prop, hex);
        updateSwatch(swatch, hex, getSaved());
        updateContrast()
      });

      pickr.on('save', (color) => {
        const hex = color.toHEXA().toString();
        setCurrent(hex);
        setSaved(hex);
        applyColor(prop, hex);
        updateSwatch(swatch, hex, hex);
        updateContrast();
        updateLockIcons();
        if (isFg) win.__fgHSL = hexToHSL(hex);
        else win.__bgHSL = hexToHSL(hex);
      });

      pickr.on('hide', () => {
        setCurrent(getSaved());
        applyColor(prop, getSaved());
        updateSwatch(swatch, getSaved(), getSaved());
        updateContrast();
      });

      updateSwatch(swatch, getCurrent(), getSaved());
      applyColor(prop, getCurrent());
      updateContrast();
      return pickr
    };

    // Pickr初期化
    let bgPickr = null;
    let fgPickr = null;

    try {
      bgPickr = initPickr('bg', 'background-color');
      fgPickr = initPickr('fg', 'color')
    } catch (e) {
      console.warn('Pickrの初期化に失敗しました:', e);
      win.alert('Pickrの初期化に失敗しました: ' + (e && e.message ? e.message : e));
      bgPickr = {
        setColor: (color) => {
          colorState.currentBg = color;
          colorState.savedBg = color;
          applyColor('background-color', color);
          updateSwatch(doc.getElementById('bgSwatch'), color, color);
          updateContrast();
        },
        show: () => {},
        destroyAndRemove: () => {},
      };
      fgPickr = {
        setColor: (color) => {
          colorState.currentFg = color;
          colorState.savedFg = color;
          applyColor('color', color);
          updateSwatch(doc.getElementById('fgSwatch'), color, color);
          updateContrast();
        },
        show: () => {},
        destroyAndRemove: () => {},
      }
    }
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

    doc.getElementById('bgHexLoad').onclick = () => {
      const val = doc.getElementById('bgHex').value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        bgPickr.setColor(val, !0)
      }
      bgPickr.show();
      updateLockIcons();
    };
    doc.getElementById('fgHexLoad').onclick = () => {
      const val = doc.getElementById('fgHex').value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        fgPickr.setColor(val, !0)
      }
      fgPickr.show();
      updateLockIcons();
    };

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
          applyColor("background-color", colorState.savedBg);
          applyColor("color", colorState.savedFg);

          updateSwatch(doc.getElementById("bgSwatch"), colorState.currentBg, colorState.currentBg);
          updateSwatch(doc.getElementById("fgSwatch"), colorState.currentFg, colorState.currentFg);
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
    doc.querySelectorAll(".copy-btn").forEach(function(button) {
      button.addEventListener("click", function() {
        var targetInput = doc.getElementById(button.getAttribute("data-target"));
        if (targetInput && targetInput.value !== "-") {
          copyToClipboard(button, targetInput.value);
        }
      });
    });

    // Swapボタン
    doc.getElementById("swapColorsBtn").onclick = () => {

      // ロック状態を無視してスワップ
      [colorState.currentFg, colorState.currentBg] = [colorState.currentBg, colorState.currentFg];
      [colorState.savedFg, colorState.savedBg] = [colorState.savedBg, colorState.savedFg];

      applyColor("color", colorState.currentFg);
      applyColor("background-color", colorState.currentBg);
      updateSwatch(doc.getElementById("bgSwatch"), colorState.currentBg, colorState.savedBg);
      updateSwatch(doc.getElementById("fgSwatch"), colorState.currentFg, colorState.savedFg);
      updateColorHexDisplays();
      win.__bgHSL = hexToHSL(colorState.currentBg);
      win.__fgHSL = hexToHSL(colorState.currentFg);
      updateLockIcons();
    };

    // 初期非表示
    container.style.display = 'none';
    style.disabled = true;

    // 開くボタン □ 作成関数
    function createPickrOpenButton() {

      const pUIOpenBtn = doc.createElement('div');

      pUIOpenBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
      `;

      Object.assign(pUIOpenBtn.style, baseOpenBtnStyle, {
        padding: '5px 8px 5px 8px',
        top: '75px',
        right: '10px',
        zIndex: '20000'
      });

      pUIOpenBtn.onclick = () => {
        container.style.display = 'block';
        style.disabled = false;
        pUIOpenBtn.remove();
      };

      doc.body.appendChild(pUIOpenBtn);
      return pUIOpenBtn;
    }

    // 最初の □ ボタンを作成
    createPickrOpenButton();

    // Pickr の閉じるボタンの処理
    doc.getElementById('pickrClose').onclick = () => {
      container.style.display = 'none';
      style.disabled = true;
      createPickrOpenButton();
    };
  }).catch((err) => {
    win.alert("Pickr の読み込みに失敗しました。CSP によってブロックされている可能性があります。");
    console.error("Pickr load error:", err);
  });

  // ==関数==
  function hexToHSL(hex) {
    if (!hex || typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return { h: 0, s: 0, l: 0 };
    }
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min)/2;
    if(max == min){
      h = s = 0;
    } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max){
        case r: h = (g - b)/d + (g < b ? 6 : 0); break;
        case g: h = (b - r)/d + 2; break;
        case b: h = (r - g)/d + 4; break;
      }
      h *= 60;
    }
    return {h: Math.round(h), s: Math.round(s*100), l: Math.round(l*100)};
  }

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

  const onetapUIStyle = doc.createElement('style');
  onetapUIStyle.textContent = `
    #onetapUI {
      position: fixed;
      top: 80px;
      left: 10px;
      padding: 8px;
      border: 1px solid;
      border-radius: 4px;
      font-size: 14px;
      background: inherit;
      z-index: 10001;
      font-family: sans-serif;
      display: none;
    }
    #onetapUI .title {
      font-weight:bold;
      margin:0 0 10px 4px;
    }
    #onetapUI .ui-buttons {
      display: flex;
      flex-direction: column;
      margin-left: 5px;
      gap: 9px;
      font-size: 14px;
    }
    #onetapUI .json-input {
      font-size: 12px;
      padding: 4px;
      border: 1px solid;
      border-radius: 2px;
      width: 135px;
      font-family: monospace;
    }
    #onetapUI #jsonInput::placeholder,
    #onetapUI #bulkJsonInput::placeholder {
      color: unset;
      opacity: 0.7;
    }
    #onetapUI .style-rows {
      display: grid;
      align-content: space-between;
      width: 144.33px;
      height: 243px;
    }
    #onetapUI #toolbar {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      margin-left: 16px;
      border-radius: 1px;
      height: 243px;
      gap: 6px;
    }
    #onetapUI #toolbarTop {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-top: 13px;
    }
    #onetapUI .showAreaBtn {
      height: 24px;
    }
    #onetapUI #toolbarBottom {
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 148px;
      margin-left: 7px;
    }
    #onetapUI .page-btn {
      flex: 1;
      width: 28px;
      user-select: none;
    }
  `;
  doc.head.appendChild(onetapUIStyle);

  const onetapUI = doc.createElement('div');
  onetapUI.id = 'onetapUI';
  onetapUI.innerHTML = `
    <div class="title">Apply Style with One Tap</div>
    <div class="ui-buttons">
      <div class="button-set">
        <input id="jsonInput" class="json-input" placeholder="個別のJSONを貼り付け" />
        <span class="label">⇒</span>
        <button id="applyJsonBtn" class="button">APPLY</button>
      </div>
      <div class="button-set" style="margin-bottom:2px;">
        <input id="bulkJsonInput" class="json-input" placeholder="複数のJSONを貼り付け" />
        <span class="label">⇒</span>
        <button id="bulkSaveBtn" class="button">SAVE</button>
      </div>
      <div style="display:flex; gap:4px; align-items:stretch; height: 243px;">
        <div id="styleRows" class="style-rows"></div>
        <div id="toolbar">
          <div id="toolbarTop">
            <button id="moveBtn" class="button showAreaBtn">MOVE</button>
            <button id="delBtn" class="button showAreaBtn">DEL</button>
          </div>
          <div id="toolbarBottom">
            <button id="prevPageBtn" class="button page-btn">◀</button>
            <button id="nextPageBtn" class="button page-btn">▶</button>
          </div>
        </div>
      </div>
      <div class="button-set">
        <button id="viewAllJsonBtn" class="button">すべての保存済みJSONを表示</button>
      </div>
    </div>
  `;

  const STYLES_PER_PAGE = 8;
  const maxPage = Math.ceil(99 / STYLES_PER_PAGE);
  let currentPage = 1;

  // ボタンのスタイルを更新するヘルパー
  function updateButtonStyle(el) {
    Object.assign(el.style, {
      fontSize: '14px',
      color: 'unset',
      padding: '2px 4px',
      border: '1px solid',
    });
  }
  function updateLabelStyle(el) {
    Object.assign(el.style, {
      color: 'inherit',
      background: 'inherit',
      fontSize: '14px',
    });
  }
  onetapUI.querySelectorAll('.button').forEach(updateButtonStyle);
  onetapUI.querySelectorAll('.label').forEach(updateLabelStyle);

  const savedStyles = {};

  let lastRandomKey = null;
  let isMoveMode = false;
  let selectedStyleKey = null;

  // ページネーション：ボタンセット行を動的に描画
  function updatePage(page) {
    currentPage = page;
    const styleRows = doc.getElementById('styleRows');
    styleRows.innerHTML = '';
    styleRows.style.position = 'relative'; // absolute配置の基準

    const start = (page - 1) * STYLES_PER_PAGE + 1;
    for (let i = 0; i < STYLES_PER_PAGE; i++) {
      const n = start + i;
      const div = doc.createElement('div');
      div.className = 'button-set style-row';
      Object.assign(div.style, { display: 'flex', alignItems: 'center', gap: '4px', height: '22px' });

      // 100以上は高さ確保だけ
      if (n > 99) {
        div.style.visibility = 'hidden';
        styleRows.appendChild(div);
        continue;
      }

      const span1 = doc.createElement('span');
      span1.className = 'label';
      span1.textContent = `${n}.`;
      span1.style.display = 'inline-block';
      span1.style.width = '19px';
      span1.style.textAlign = 'center';
      updateLabelStyle(span1);

      const saveBtn = doc.createElement('button');
      saveBtn.id = `saveBtn${n}`;
      saveBtn.className = 'button';
      saveBtn.textContent = 'SAVE';
      updateButtonStyle(saveBtn);

      const arrow = doc.createElement('span');
      arrow.className = 'label';
      arrow.textContent = '⇒';
      updateLabelStyle(arrow);

      const applyBtn = doc.createElement('button');
      applyBtn.id = `applyBtn${n}`;
      applyBtn.className = 'button';
      applyBtn.textContent = 'APPLY';
      updateButtonStyle(applyBtn);

      div.appendChild(span1);
      div.appendChild(saveBtn);
      div.appendChild(arrow);
      div.appendChild(applyBtn);
      styleRows.appendChild(div);

      saveBtn.onclick = () => saveStyle(`Style${n}`);

      applyBtn.onclick = () => {
        const name = `Style${n}`;

        // === 通常モード ===
        if (!isMoveMode) {
          applyStyleByName(name);
          return;
        }

        // === 移動モード ===
        // 未選択 → 選択
        if (!selectedStyleKey) {
          selectedStyleKey = name;
          clearAllHighlights();
          highlightApplyBtn(name);
          syncMoveBtnStyle(name);
          return;
        }

        // 同じものを再クリック → 解除
        if (selectedStyleKey === name) {
          selectedStyleKey = null;
          clearAllHighlights();
          setApplyButtonsDimmed(true);
          moveBtn.style.color = '';
          moveBtn.style.backgroundColor = '';
          moveBtn.style.outline = '2px dotted';
          return;
        }

        // 別のものクリック → 入れ替え
        swapStyles(selectedStyleKey, name);

        // ボタン色更新
        updateApplyBtnColor(selectedStyleKey);
        updateApplyBtnColor(name);

        // リセット
        selectedStyleKey = null;
        clearAllHighlights();
        setApplyButtonsDimmed(true);
      };
    }

    for (let i = start; i < start + STYLES_PER_PAGE && i <= 99; i++) {
      updateApplyBtnColor(`Style${i}`);
    }

    // 最終ページのみにボタンを追加
    if (page === maxPage) {
      function createLastPageBtn(text) {
        const btn = doc.createElement('button');
        btn.className = 'button';
        btn.textContent = text;
        Object.assign(btn.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          writingMode: 'horizontal-tb',
          borderRadius: '2px',
          position: 'absolute',
          width: 'stretch',
        });
        updateButtonStyle(btn);
        return btn;
      }

      function flashText(btn, message, original, flag) {
        if (btn.dataset[flag]) return true;
        btn.dataset[flag] = 'true';
        btn.textContent = message;
        win.setTimeout(() => {
          btn.textContent = original;
          delete btn.dataset[flag];
        }, 1500);
        return false;
      }

      const randomApplyBtn = createLastPageBtn('Random Apply');
      Object.assign(randomApplyBtn.style, {
        top: '95px',
        height: '60px',
      });

      randomApplyBtn.onclick = () => {
        const savedKeys = Object.keys(savedStyles);
        if (savedKeys.length === 0) {
          flashText(randomApplyBtn, 'No styles saved yet', 'Random Apply', 'notifying');
          return;
        }
        const candidates = savedKeys.length > 1
          ? savedKeys.filter(k => k !== lastRandomKey)
          : savedKeys;
        const randomKey = candidates[Math.floor(Math.random() * candidates.length)];
        lastRandomKey = randomKey;
        applyStyleByName(randomKey);
      };

      styleRows.appendChild(randomApplyBtn);

      const copyAllBtn = createLastPageBtn('すべての保存済みJSONをコピー');
      Object.assign(copyAllBtn.style, {
        top: '163px',
        height: 'stretch',
      });

      copyAllBtn.onclick = () => {
        if (Object.keys(savedStyles).length === 0) {
          flashText(copyAllBtn, '保存スタイルがありません', 'すべての保存済みJSONをコピー', 'flashCopying');
          return;
        }
        const json = JSON.stringify(extractBase(getSortedStyles()), null, 2);
        copyToClipboard(copyAllBtn, json, { default: 'すべての保存済みJSONをコピー', success: 'コピーしました!' });
      };

      styleRows.appendChild(copyAllBtn);
    }
    if (isMoveMode) {
      setApplyButtonsDimmed(true);
      if (selectedStyleKey) {
        highlightApplyBtn(selectedStyleKey);
      }
    }
  }

  // 開くボタン ☆
  const oUIOpenBtn = doc.createElement('div');
  oUIOpenBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24">
      <polygon points="12,2 15,10 23,10 17,15 19,23 12,18 5,23 7,15 1,10 9,10" fill="none" stroke="currentColor" stroke-width="1"/>
    </svg>
  `;
  Object.assign(oUIOpenBtn.style, baseOpenBtnStyle, {
    padding: '5px 8px 5px 8px',
    top: '75px',
    left: '10px',
    zIndex: '10000',
  });
  doc.body.appendChild(oUIOpenBtn);

  oUIOpenBtn.addEventListener('click', () => {
    onetapUI.style.display = 'block';
  });

  // 閉じるボタン ✕
  const oUICloseBtn = createCloseBtn();
  onetapUI.appendChild(oUICloseBtn);
  oUICloseBtn.addEventListener('click', () => {
    onetapUI.style.display = 'none';
  });

  // UIをbodyに追加
  doc.body.appendChild(onetapUI);

  // 初期ページを描画（Style1〜8）
  updatePage(1);

  // ◀▶ページナビのイベント
  doc.getElementById('prevPageBtn').addEventListener('click', () => {
    updatePage(currentPage > 1 ? currentPage - 1 : maxPage);
  });
  doc.getElementById('nextPageBtn').addEventListener('click', () => {
    updatePage(currentPage < maxPage ? currentPage + 1 : 1);
  });

  // MOVEボタンのイベント
  function setApplyButtonsDimmed(dimmed) {
    for (let i = 1; i <= 99; i++) {
      const btn = doc.getElementById(`applyBtn${i}`);
      if (!btn) continue;
      if (dimmed) {
        btn.style.border = '1px dotted';
      } else {
        btn.style.border = '1px solid';
      }
    }
  }

  function highlightApplyBtn(name) {
    const num = name.replace('Style', '');
    const btn = doc.getElementById(`applyBtn${num}`);
    if (btn) {
      btn.style.border = 'none';
      btn.style.outline = `2px solid var(--current-fg)`;
    }
  }

  function syncMoveBtnStyle(name) {
    const num = name.replace('Style', '');
    const applyBtn = doc.getElementById(`applyBtn${num}`);
    if (!applyBtn) return;
    moveBtn.style.color = applyBtn.style.color;
    moveBtn.style.backgroundColor = applyBtn.style.backgroundColor;
    moveBtn.style.outline = '1px dotted var(--current-fg)'
  }

  function clearAllHighlights() {
    for (let i = 1; i <= 99; i++) {
      const btn = doc.getElementById(`applyBtn${i}`);
      if (!btn) continue;
      btn.style.outline = '';
    }
  }

  function swapStyles(a, b) {
    const temp = savedStyles[a];

    if (savedStyles[b] === undefined) {
      delete savedStyles[a];
    } else {
      savedStyles[a] = savedStyles[b];
    }

    if (temp === undefined) {
      delete savedStyles[b];
    } else {
      savedStyles[b] = temp;
    }

    moveBtn.style.color = '';
    moveBtn.style.backgroundColor = '';
    moveBtn.style.border = 'none';
    moveBtn.style.outline = '2px dotted currentColor';
  }

  const moveBtn = doc.getElementById('moveBtn');

  moveBtn.addEventListener('click', () => {
    isMoveMode = !isMoveMode;
    selectedStyleKey = null;
    clearAllHighlights();

    if (isMoveMode) {
      setApplyButtonsDimmed(true);
      moveBtn.style.border = 'none';
      moveBtn.style.outline = '2px dotted';
    } else {
      setApplyButtonsDimmed(false);
      moveBtn.style.color = '';
      moveBtn.style.backgroundColor = '';
      moveBtn.style.border = '1px solid';
      moveBtn.style.outline = 'none'
    }
  });

  // APPLYボタンに保存済みスタイルの色を反映
  function updateApplyBtnColor(name) {
    const num = name.replace('Style', '');
    const data = savedStyles[name];
    const btn = doc.getElementById(`applyBtn${num}`);
    if (!btn) return;
    if (!data) {
      btn.style.color = '';
      btn.style.backgroundColor = '';
      return;
    }
    btn.style.color = data.color || '';
    btn.style.backgroundColor = data.backgroundColor || '';
  }

  // RGB → HEX 変換関数
  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb.startsWith('rgba(0, 0, 0, 0)')) {
      return null;
    }
    const nums = rgb.match(/\d+/g)?.map(Number);
    return nums && nums.length >= 3
      ? '#' + nums.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('')
      : null;
  }

  // SAVEボタン
  async function saveStyle(name) {
    const target = doc.getElementById('novelDisplay');
    if (!target) return win.alert('対象要素が見つかりません');
    const computed = win.getComputedStyle(target);
    let { color, backgroundColor, fontSize, fontWeight, textShadow } = computed;
    const fontFamily = fontSelect.value;

    // blur 値を抽出
    const match = textShadow?.match(/(-?\d+)px$/);
    const blur = match ? parseInt(match[1], 10) : 0;

    // HEX に変換
    color = rgbToHex(color);
    backgroundColor = rgbToHex(backgroundColor);

    // スクロールUIの値を取得
    const scrollSettings = Object.fromEntries(
      Object.entries(SCROLL_FIELD_MAP).map(([id, { prop, key, parser }]) => {
        const el = doc.getElementById(id);
        if (!el) return [key, null];
        const raw = el[prop];
        return [key, parser ? parser(raw) : raw];
      })
    );

    // 保存プレビューオブジェクト
    const savePreview = {
      color,
      backgroundColor,
      fontSize,
      fontWeight,
      textShadow: blur,
      fontFamily,
      scrollSettings,
      searchConfigs: getSearchConfigs(),
    };

    // オーバーレイで確認
    // confirmed が data または false になる
    const confirmed = await showSaveConfirmOverlay(name, savePreview);
    if (!confirmed) return;

    // 編集済みデータで保存
    savedStyles[name] = confirmed;

    win.alert(`☆ 保存しました!`);
    updateApplyBtnColor(name);
  }

  // オーバーレイを表示する関数
  let __saveConfirmOpen = false;
  function showSaveConfirmOverlay(name, initialData) {

    // 二重表示を防ぐ
    if (__saveConfirmOpen) return Promise.resolve(false);
    __saveConfirmOpen = true;
    isSwitching = true;
    resetScrollSliders();
    disableBodyScroll();

    return new Promise((resolve) => {
      // オーバーレイ
      const overlay = doc.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10005;
      `;

      // コンテンツボックス
      const box = doc.createElement('div');
      box.style.cssText = `
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        min-width: 300px;
        max-height: 70vh;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        z-index: 10008
      `;

      // タイトル
      const title = doc.createElement('h3');
      title.textContent = `☆ ${name} に保存しますか?`;
      title.id = 'title';
      title.style.cssText = `
        margin: 0 0 5px;
        font-size: 16px;
        font-weight: bold;
      `;

      // 上段コンテナ
      const topContainer = doc.createElement('div');
      topContainer.style.cssText = `
        margin: 0 0 12px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      `;

      // チェックボックス
      const prettyCheckbox = doc.createElement('input');
      prettyCheckbox.type = 'checkbox';
      prettyCheckbox.id = 'prettyPrintCheckbox';
      prettyCheckbox.checked = false;
      prettyCheckbox.style.cssText = `
        cursor: pointer;
      `;

      // ラベル
      const prettyLabel = doc.createElement('label');
      prettyLabel.htmlFor = 'prettyPrintCheckbox';
      prettyLabel.textContent = 'プリティプリント';
      prettyLabel.id = 'prettyLabel';
      prettyLabel.style.cssText = `
        cursor: pointer;
        font-size: 14px;
        user-select: none;
      `;

      // 編集ボタン
      const jsonEditBtn = doc.createElement('button');
      jsonEditBtn.textContent = '編集';
      jsonEditBtn.id = 'jsonEditBtn';
      jsonEditBtn.style.cssText = `
        align-self: stretch;
        padding: 6px 12px;
        margin-left: auto;
        color: unset;
        border: 1px solid currentColor;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;

      // オーバーレイ内で管理する保存対象データ
      let currentData = initialData;
      let isEditing = false;

      const setEditingMode = (editing) => {
        if (isEditing && !editing) {
          const validationResult = validateAndParseJSON(preview.value);
          if (validationResult.error) {
            win.alert(validationResult.error);
            return;
          }
          // Styleキーが含まれていたらはじく
          const keys = Object.keys(validationResult.data);
          if (keys.some(k => /^Style\d+$/.test(k))) {
            win.alert('Styleキーは削除してください');
            return;
          }
          // 保存内容を更新
          currentData = validationResult.data;
          updatePreviewText();
        }

        isEditing = editing;

        // プレビュー編集切替
        preview.readOnly = !editing;
        preview.style.border = editing ? 'none' : '1px solid';
        preview.style.outline = editing ? '3px dashed' : 'none';
        preview.style.borderRadius = editing ? '0' : '4px';

        // ボタンの無効化対象
        const controls = [
          prettyCheckbox,
          prettyLabel,
          jsonCopyBtn,
          saveBtn
        ];

        controls.forEach(el => {
          el.disabled = editing;
          el.style.opacity = editing ? '0.5' : '1';
          el.style.cursor = editing ? 'not-allowed' : 'pointer';
        });

        // 編集ボタンの表示切替
        jsonEditBtn.textContent = editing ? '編集中...' : '編集';
      };

      // 編集ボタンのクリック処理
      jsonEditBtn.onclick = () => {
        setEditingMode(!isEditing);
      };

      // コピーボタン
      const jsonCopyBtn = doc.createElement('button');
      jsonCopyBtn.textContent = 'コピー';
      jsonCopyBtn.id = 'jsonCopyBtn';
      jsonCopyBtn.style.cssText = `
        align-self: stretch;
        padding: 6px 12px;
        color: unset;
        border: 1px solid currentColor;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;

      jsonCopyBtn.addEventListener("click", () => {
        copyToClipboard(jsonCopyBtn, preview.value, { default: "コピー", success: "コピー完了!" });
      });

      topContainer.appendChild(prettyCheckbox);
      topContainer.appendChild(prettyLabel);
      topContainer.appendChild(jsonEditBtn);
      topContainer.appendChild(jsonCopyBtn);

      // プレビューコンテナ
      const previewContainer = doc.createElement('div');
      previewContainer.style.cssText = `
        position: relative;
        margin: 0 0 15px 0;
      `;

      // プレビュー内容
      const preview = doc.createElement('textarea');
      preview.readOnly = true;
      preview.style.cssText = `
        width: 100%;
        padding: 12px;
        border: 1px solid currentColor;
        border-radius: 4px;
        outline: none;
        overflow: auto;
        font-size: 12px;
        resize: none;
        box-sizing: border-box;
        font-family: monospace;
        white-space: nowrap;
        scrollbar-width: thin;
      `;

      // 編集後のcurrentDataからプレビュー内容を再生成する関数
      const updatePreviewText = () => {
        const jsonTextFormatted = JSON.stringify(currentData, null, 2);
        const jsonTextCompressed = JSON.stringify(currentData);
        if (prettyCheckbox.checked) {
          preview.value = jsonTextFormatted;
          preview.style.whiteSpace = 'pre-wrap';
          preview.style.minHeight = '250px';
          preview.style.overflowY = 'auto';
        } else {
          preview.value = jsonTextCompressed;
          preview.style.whiteSpace = 'nowrap';
          preview.style.minHeight = '45px';
          preview.style.overflowY = 'hidden';
        }
      };

      updatePreviewText();

      // プリティプリントチェックイベント
      prettyCheckbox.onchange = () => updatePreviewText();

      // 下段コンテナ
      const bottomContainer = doc.createElement('div');
      bottomContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      `;

      // キャンセル・保存共通のクリーンアップ関数
      // 保存時に最新のcurrentDataを返す
      const cleanupAndResolve = (result) => {
        if (overlay.parentNode) doc.body.removeChild(overlay);
        __saveConfirmOpen = false;
        isSwitching = false;
        enableBodyScroll();
        doc.removeEventListener('keydown', handleKeydown);
        resolve(result ? currentData : false);
      };

      // キャンセルボタン
      const cancelBtn = doc.createElement('button');
      cancelBtn.textContent = 'キャンセル';
      cancelBtn.id = 'cancelBtn';
      cancelBtn.style.cssText = `
        padding: 8px 20px;
        background: rgba(120, 120, 120, 0.3);
        color: unset;
        border: 1px solid;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      `;
      cancelBtn.onclick = () => cleanupAndResolve(false);

      // 保存ボタン
      const saveBtn = doc.createElement('button');
      saveBtn.textContent = '保存する';
      saveBtn.id = 'saveBtn';
      saveBtn.style.cssText = `
        padding: 8px 20px;
        background: rgba(120, 120, 120, 0.3);
        color: unset;
        border: 1px solid currentColor;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      `;
      saveBtn.onclick = () => cleanupAndResolve(true);

      // エンターキーで「保存する」ボタンを押す処理
      const handleKeydown = (e) => {
        if (e.key === 'Enter') {
          saveBtn.click();
        }
      };
      doc.addEventListener('keydown', handleKeydown);

      // 組み立て
      previewContainer.appendChild(preview);
      bottomContainer.appendChild(cancelBtn);
      bottomContainer.appendChild(saveBtn);
      box.appendChild(title);
      box.appendChild(topContainer);
      box.appendChild(previewContainer);
      box.appendChild(bottomContainer);
      overlay.appendChild(box);
      doc.body.appendChild(overlay);

      // 現在のfontFamilyを要素に適用
      const overlayElements = [
        doc.getElementById('title'),
        doc.getElementById('prettyLabel'),
        doc.getElementById('jsonCopyBtn'),
        doc.getElementById('cancelBtn'),
        doc.getElementById('saveBtn')
      ];

      if (currentFont && currentFont !== '游明朝') {
        const fontFamily = currentFont === 'sans-serif'
          ? 'sans-serif'
          : `'${currentFont}', sans-serif`;

        overlayElements.forEach(el => {
          if (el) el.style.fontFamily = fontFamily;
        });
      }

      // フォーカスをオーバーレイに移してキーボードの影響を抑える
      overlay.tabIndex = -1;
      overlay.focus();

      // オーバーレイ背景クリック
      overlay.onclick = (e) => {
        if (e.target === overlay) cleanupAndResolve(false);
      };
    });
  }

  // APPLYボタン
  function applyStyleByName(name) {
    const data = savedStyles[name];

    if (!data) {
      return win.alert(`${name} は保存されていません`);
    }

    const proceed = win.confirm(`☆ ${name} を反映します！`);
    if (!proceed) return;

    if (applyStyleData(data)) {
      win.appConfig = data;
      createMenus();
      onetapUI.style.display = 'none';
    }
  }

  const VALID_KEYS = {
    root: new Set([
      'color',
      'backgroundColor',
      'fontSize',
      'fontWeight',
      'textShadow',
      'fontFamily',
      'scrollSettings',
      'searchConfigs'
    ]),

    scrollSettings: new Set([
      'right',
      'left',
      'shadow',
      'opacity',
      'border',
      'colorIn',
      'position',
      'width',
      'speedScale',
      'hideBall'
    ]),

    searchConfigs: new Set([
      'label',
      'side',
      'offsetY',
      'query',
      'engine'
    ])
  };

  // 純粋なオブジェクトかどうかを判定する関数
  function isPlainObject(obj) {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
  }

  // オブジェクト内の不正なキーを検出する関数
  const hasInvalidKey = (obj, validSet, path) =>
    Object.keys(obj)
      .filter(k => !validSet.has(k))
      .map(k => `${path} > "${k}"`);

  function validateObject(obj, path) {
    const invalid = [];

    invalid.push(...hasInvalidKey(obj, VALID_KEYS.root, path));

    if ('scrollSettings' in obj) {
      const s = obj.scrollSettings;
      if (!isPlainObject(s)) {
        invalid.push(`${path} > scrollSettings (not an object)`);
      } else {
        invalid.push(
          ...hasInvalidKey(s, VALID_KEYS.scrollSettings, `${path} > scrollSettings`)
        );
      }
    }

    if ('searchConfigs' in obj) {
      const arr = obj.searchConfigs;
      if (!Array.isArray(arr)) {
        invalid.push(`${path} > searchConfigs (not an array)`);
      } else {
        arr.forEach((item, i) => {
          if (!isPlainObject(item)) {
            invalid.push(`${path} > searchConfigs[${i}] (not an object)`);
          } else {
            invalid.push(
              ...hasInvalidKey(
                item,
                VALID_KEYS.searchConfigs,
                `${path} > searchConfigs[${i}]`
              )
            );
          }
        });
      }
    }

    return invalid;
  }

  // 不正なキーや構造エラーを収集する関数
  function collectInvalidKeys(obj) {
    const keys = Object.keys(obj);
    const hasAnyStyleKey = keys.some(k => /^Style\d+$/.test(k));

    // Style形式と判断する条件：Styleキーが1つ以上ある、
    // かつrootの有効キーに一つも一致しない（通常形式との区別）
    const looksLikeStyleFormat = hasAnyStyleKey && !keys.some(k => VALID_KEYS.root.has(k));

    if (looksLikeStyleFormat) {
      return keys.flatMap(key => {
        if (!/^Style\d+$/.test(key)) {
          // Styl1 のようなタイポ → 不正なStyleキーとして報告
          return [`root > "${key}"`];
        }
        const val = obj[key];
        return isPlainObject(val)
          ? validateObject(val, key)
          : [`${key} (not an object)`];
      });
    }

    return validateObject(obj, 'root');
  }

  // JSON文字列を正規化
  function normalizeJSONString(text) {
    return text
      .replace(/\u00A0/g, ' ')              // NBSP → 半角スペース
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字除去
      .replace(/\r\n/g, '\n')              // 改行コード統一
      .replace(/\r/g, '\n');
  }

  // JSONの検証ロジックを共通化
  function validateAndParseJSON(jsonText, allowEmpty = false) {
    if (!jsonText) {
      if (allowEmpty) {
        return { data: null };
      }
      return { error: 'JSONデータを入力してください' };
    }

    jsonText = normalizeJSONString(jsonText);

    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (e) {
      return { error: `JSONの解析に失敗しました:\n${e.message}` };
    }

    if (!isPlainObject(parsedData)) {
      return { error: 'JSONの形式が正しくありません' };
    }

    const invalidKeys = collectInvalidKeys(parsedData);
    if (invalidKeys.length > 0) {
      return { error: `不正なキーが含まれています:\n${invalidKeys.join('\n')}` };
    }

    return { data: parsedData };
  }

  // 複数JSONを分割する関数
  function splitMultipleJSON(text) {
    const blocks = [];
    let depth = 0;
    let start = 0;
    let inBlock = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (!inBlock && ch !== '{' && ch.trim() !== '') {
        // ブロック外に { 以外の非空白文字（余計なテキスト）
        return { error: `JSONの解析に失敗しました:\nUnexpected token '${ch}'` };
      }

      if (ch === '{') {
        if (depth === 0) { start = i; inBlock = true; }
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && inBlock) {
          blocks.push(text.slice(start, i + 1).trim());
          inBlock = false;
        } else if (depth < 0) {
          return { error: `JSONの解析に失敗しました:\nUnexpected token '}'` };
        }
      }
    }

    if (depth > 0) {
      return { error: `JSONの解析に失敗しました:\nUnexpected end of JSON input` };
    }

    if (blocks.length === 0) {
      return { error: 'JSONデータを入力してください' };
    }

    return { blocks };
  }

  // 入力を「Style形式オブジェクト」に統一する
  // ①キー無し個別   → { StyleN: data }          （N=空き番号）
  // ②キーあり個別   → そのまま                   （{ Style1: {...} }）
  // ③キーあり複数   → そのまま                   （{ Style1: {...}, Style2: {...} }）
  // ④キー無し複数   → splitで分割済みの配列を受け取り③に変換
  function normalizeToStyleFormat(parsedList) {
    // parsedList: validateAndParseJSONを通過済みのオブジェクト配列
    const result = {}; // Style番号 → データ のマップ

    // まず既存Style番号を一時的にusedSetに追加しながら処理（連番重複防止）
    const tempUsed = new Set(
      Object.keys(savedStyles)
        .map(k => /^Style(\d+)$/.exec(k))
        .filter(Boolean)
        .map(m => Number(m[1]))
    );

    function nextNum() {
      let n = 1;
      while (tempUsed.has(n)) n++;
      tempUsed.add(n);
      return n;
    }

    for (const data of parsedList) {
      const keys = Object.keys(data);
      const isStyleFormat = keys.length > 0 && keys.every(k => /^Style\d+$/.test(k));

      if (isStyleFormat) {
        // ②③: Styleキーあり → そのままマージ
        for (const k of keys) {
          result[k] = data[k];
        }
      } else {
        // ①④: Styleキー無し → 新しい番号を付与
        const key = `Style${nextNum()}`;
        result[key] = data;
      }
    }

    return result; // 常にStyle形式オブジェクトを返す
  }

  // 共通の入力パース処理
  // テキストを受け取り、Style形式オブジェクトを返す
  // エラー時は { error } を返す
  function parseInputToStyleMap(jsonText) {
    if (!jsonText) return { error: 'JSONデータを入力してください' };

    // 戻り値が { blocks } または { error } になった
    const splitResult = splitMultipleJSON(jsonText);
    if (splitResult.error) return { error: splitResult.error };

    const blocks = splitResult.blocks;

    const parsedList = [];
    for (let i = 0; i < blocks.length; i++) {
      const result = validateAndParseJSON(blocks[i]);
      if (result.error) {
        const prefix = blocks.length > 1 ? `【${i + 1}個目】\n` : '';
        return { error: prefix + result.error };
      }
      parsedList.push(result.data);
    }

    const styleMap = normalizeToStyleFormat(parsedList);
    return { data: styleMap };
  }

  // jsonInputのSAVEボタン
  doc.getElementById('bulkSaveBtn').onclick = () => {
    const bulkJsonInput = doc.getElementById('bulkJsonInput');
    let jsonText = bulkJsonInput.value.trim();

    try {
      const parsed = JSON.parse(jsonText);
      if ('_base' in parsed) jsonText = JSON.stringify(expandBase(parsed));
    } catch (e) {}

    const result = parseInputToStyleMap(jsonText);
    if (result.error) {
      win.alert(result.error);
      return;
    }

    const styleMap = result.data;
    const keys = Object.keys(styleMap);

    // 既存キーの上書き確認
    const existingKeys = keys.filter(k => k in savedStyles);
    if (existingKeys.length > 0) {
      const msg = `${compressKeys(existingKeys)} はすでに存在します。\n上書きしますか?`;
      if (!win.confirm(msg)) return;
    }

    // 保存実行
    for (const k of keys) {
      savedStyles[k] = styleMap[k];
    }

    win.alert(`${compressKeys(keys)} に保存しました!`);
    bulkJsonInput.value = '';
    keys.forEach(updateApplyBtnColor);
  };

  // アラートのStyle連番を～で省略
  function compressKeys(keys) {
    const nums = keys
      .map(k => k.match(/^Style(\d+)$/))
      .map(m => m ? parseInt(m[1]) : null);

    const groups = [];
    let i = 0;

    while (i < keys.length) {
      if (nums[i] === null) {
        groups.push(keys[i]);
        i++;
        continue;
      }

      let j = i + 1;
      while (j < keys.length && nums[j] === nums[j-1] + 1) j++;

      const len = j - i;
      if (len === 1)      groups.push(keys[i]);
      else if (len === 2) groups.push(`${keys[i]}, ${keys[j-1]}`);
      else                groups.push(`${keys[i]}～${keys[j-1]}`);
      i = j;
    }

    return groups.join(', ');
  }

  // jsonInputのAPPLYボタン
  doc.getElementById('applyJsonBtn').onclick = () => {
    const jsonInput = doc.getElementById('jsonInput');
    const jsonText = jsonInput.value.trim();

    const result = parseInputToStyleMap(jsonText);
    if (result.error) {
      win.alert(result.error);
      return;
    }

    const styleMap = result.data;
    const keys = Object.keys(styleMap);

    // ③相当（複数Styleキー）は適用不可
    if (keys.length > 1) {
      win.alert('個別のJSONを入力してください');
      return;
    }

    // ①②相当（Styleキー1つ）→ 中身を適用
    const finalData = styleMap[keys[0]];

    const proceed = win.confirm('☆ JSONデータを反映します!');
    if (!proceed) return;

    if (applyStyleData(finalData)) {
      win.appConfig = finalData;
      createMenus();
      onetapUI.style.display = 'none';
      jsonInput.value = '';
    }
  };

  // スタイル適用関数
  function applyStyleData(data) {
    const target = doc.getElementById('novelDisplay');
    if (!target) {
      win.alert('対象要素が見つかりません');
      return false;
    }

    // color
    if (data.color) {
      const hex = data.color;
      colorState.currentFg = colorState.savedFg = hex;
      applyColor('color', hex);
      win.__fgHSL = hexToHSL(hex);
      const fgHex = doc.getElementById('fgHex');
      if (fgHex) fgHex.value = hex;
    }

    // background
    if (data.backgroundColor) {
      const hex = data.backgroundColor;
      colorState.currentBg = colorState.savedBg = hex;
      applyColor('background-color', hex);
      win.__bgHSL = hexToHSL(hex);
      const bgHex = doc.getElementById('bgHex');
      if (bgHex) bgHex.value = hex;
    }

    updateContrast();
    updateColorHexDisplays();

    if (data.fontSize) target.style.fontSize = data.fontSize;
    if (data.fontWeight) target.style.fontWeight = data.fontWeight;
    if (data.textShadow !== null && data.textShadow !== undefined) {
      target.style.textShadow = data.textShadow > 0 ? `0 0 ${data.textShadow}px` : 'none';
      target.dataset.textShadow = data.textShadow;
    }
    if (data.fontFamily && fontSelect) {
      fontSelect.value = data.fontFamily;
      fontSelect.dispatchEvent(new Event('change'));
    }
    updateControls();

    // スライダーセッティングUIの状態反映
    if (data.scrollSettings) {
      applyScrollSettings(data.scrollSettings);
    }

    return true;
  }

  // --- 保存済みのすべてのJSONを表示するボタンのイベント登録 ---
  doc.getElementById('viewAllJsonBtn').onclick = () => {

    // 保存済みスタイルをキー順にソート
    const sortedStyles = getSortedStyles();

    const jsonHtml = `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>保存済みJSON</title>
      <style>
        body { font-family: sans-serif; padding: 16px; }
        .controls { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
        .controls-left { display: flex; align-items: center; }
        input[type="checkbox"] { cursor: pointer; }
        label { font-size: 15px; cursor: pointer; }
        button { margin-left: 8px; font-size: 15px; cursor: pointer; }
        .disabled { opacity: 0.5; cursor: not-allowed; }
        #jsonDisplay {
          width: 100%;
          height: 75vh;
          box-sizing: border-box;
          font-family: monospace;
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 12px;
          resize: none;
          white-space: pre-wrap;
        }
        #jsonDisplay:focus:not(.editing) {
          outline: none;
        }
        #jsonDisplay.editing {
          border: none;
          outline: 3px dashed #000;
          border-radius: 0;
        }
      </style>
    </head>
    <body>
      <div class="controls">
        <div class="controls-left">
          <label id="prettyPrintLabel">
            <input type="checkbox" id="prettyPrintCheckbox"> プリティプリント
          </label>
          <button id="compressJsonBtn">展開する</button>
          <button id="jsonWinCopyBtn">コピー</button>
        </div>
        <button id="allJsonEditBtn">編集</button>
      </div>
      <textarea id="jsonDisplay" readonly></textarea>
    </body>
    </html>`;

    const jsonBlob = new Blob([jsonHtml], { type: 'text/html' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonWin = win.open(jsonUrl);

    jsonWin.addEventListener('load', () => {
      try { URL.revokeObjectURL(jsonUrl); } catch (e) {};

      const jsonDoc = jsonWin.document;

      let currentJson = sortedStyles;

      const jsonDisplay = jsonDoc.getElementById('jsonDisplay');
      const prettyCheckbox = jsonDoc.getElementById('prettyPrintCheckbox');
      const prettyLabel = jsonDoc.getElementById('prettyPrintLabel');
      const jsonWinCopyBtn = jsonDoc.getElementById('jsonWinCopyBtn');
      const compressJsonBtn = jsonDoc.getElementById('compressJsonBtn');
      const allJsonEditBtn = jsonDoc.getElementById('allJsonEditBtn');
      let isAllEditing = false;

      const updateJsonDisplay = () => {
        if (isAllEditing) return;
        jsonDisplay.value = prettyCheckbox.checked
          ? JSON.stringify(currentJson, null, 2)
          : JSON.stringify(currentJson);
      };

      prettyCheckbox.addEventListener('change', updateJsonDisplay);

      const updateCompressBtn = () => {
        compressJsonBtn.textContent = '_base' in currentJson ? '展開する' : '短縮する';
      };

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
          jsonWin.alert('コピーに失敗しました: ' + err);
        }
      });

      allJsonEditBtn.addEventListener('click', () => {
        isAllEditing = !isAllEditing;
        allJsonEditBtn.textContent = isAllEditing ? '編集中…' : '編集';
        jsonDisplay.readOnly = !isAllEditing;
        jsonDisplay.classList.toggle('editing', isAllEditing);

        [prettyCheckbox, jsonWinCopyBtn, compressJsonBtn].forEach(el => {
          el.disabled = isAllEditing;
          el.classList.toggle('disabled', isAllEditing);
        });
        prettyLabel.classList.toggle('disabled', isAllEditing);

        if (!isAllEditing) {
          const expandedText = (() => {
            try {
              const raw = JSON.parse(jsonDisplay.value);
              return JSON.stringify(expandBase(raw));
            } catch {
              return jsonDisplay.value; // パース失敗時はそのまま渡してエラーを出させる
            }
          })();

          const result = validateAndParseJSON(expandedText);
          if (result.error) {
            jsonWin.alert(result.error);
            isAllEditing = true;
            allJsonEditBtn.textContent = '編集中…';
            jsonDisplay.readOnly = false;
            jsonDisplay.classList.add('editing');
            [prettyCheckbox, jsonWinCopyBtn, compressJsonBtn].forEach(el => {
              el.disabled = true;
              el.classList.add('disabled');
            });
            prettyLabel.classList.add('disabled');
          } else {
            currentJson = result.data;
            const raw = JSON.parse(jsonDisplay.value);
            const currentText = JSON.stringify(raw);
            const compressed = extractBase(raw);
            const compressedText = JSON.stringify(compressed);
            compressJsonBtn.textContent = compressedText.length < currentText.length ? '短縮する' : '展開する';
          }
        }
      });

      currentJson = extractBase(currentJson);
      updateCompressBtn();
      updateJsonDisplay();
    });
  };
  // ---

  function getSortedStyles() {
    return Object.fromEntries(
      Object.entries(savedStyles).sort((a, b) =>
        parseInt(a[0].replace(/\D/g, ''), 10) -
        parseInt(b[0].replace(/\D/g, ''), 10)
      )
    );
  }

  // ベース抽出
  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => deepEqual(v, b[i]));
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a), keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(k => deepEqual(a[k], b[k]));
    }
    return false;
  };

  function extractBase(styles) {
    const entries = Object.entries(expandBase(styles)).filter(([k]) => k !== '_base');
    if (entries.length === 0) return {};

    // トップレベルのbaseを最頻値で構築
    const base = {};
    const EXCLUDE_BASE_KEYS = new Set(['color', 'backgroundColor']);
    for (const key of Object.keys(entries[0][1])) {
      if (EXCLUDE_BASE_KEYS.has(key)) continue;
      const values = entries.map(([, s]) => s[key]);

      // 最頻値とその出現回数を取得
      const counts = new Map();
      for (const v of values) {
        const k = JSON.stringify(v);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      let bestKey = null, bestCount = 0;
      for (const [k, c] of counts) {
        if (
          c > bestCount ||
          (c === bestCount && bestKey !== null && k.length > bestKey.length)
        ) {
          bestCount = c;
          bestKey = k;
        }
      }

      // 出現回数が2以上のものだけbaseに入れる
      if (bestCount >= 2) {
        base[key] = JSON.parse(bestKey);
      }
    }

    // 各スタイルの差分を生成
    const diffStyles = Object.fromEntries(
      entries.map(([name, style]) => {
        const diff = {};
        for (const [k, v] of Object.entries(style)) {
          const baseVal = base[k];

          // オブジェクト（配列除く）はネストして差分キーだけ残す
          if (
            typeof v === 'object' && v !== null && !Array.isArray(v) &&
            typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal)
          ) {
            const nestedDiff = {};
            for (const [nk, nv] of Object.entries(v)) {
              if (!deepEqual(baseVal[nk], nv)) nestedDiff[nk] = nv;
            }
            if (Object.keys(nestedDiff).length > 0) diff[k] = nestedDiff;

          // 配列・プリミティブはそのまま比較
          } else if (!deepEqual(baseVal, v)) {
            diff[k] = v;
          }
        }
        return [name, diff];
      })
    );

    return { _base: base, ...diffStyles };
  };

  // ベース展開
  function mergeDeep(base, override) {
    const result = { ...base };
    for (const key of Object.keys(override)) {
      const baseVal = base[key];
      const overVal = override[key];
      if (
        overVal !== null && typeof overVal === 'object' && !Array.isArray(overVal) &&
        baseVal !== null && typeof baseVal === 'object' && !Array.isArray(baseVal)
      ) {
        result[key] = mergeDeep(baseVal, overVal);
      } else {
        result[key] = overVal;
      }
    }
    return result;
  }

  function expandBase(compressed) {
    const { _base, ...styles } = compressed;
    if (!_base) return compressed;
    return Object.fromEntries(
      Object.entries(styles).map(([name, diff]) => [name, mergeDeep(_base, diff)])
    );
  }

  // ==============================
  // テキスト選択で検索ショートカット
  // ==============================

  const novelText = doc.getElementById('novelDisplay');
  let pendingSelection = null;

  doc.addEventListener('selectionchange', () => {
    const sel = win.getSelection();

    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();
    if (!text) return;

    // doc全体に反応してしまうためnovelTextかどうかチェック
    const startNode = range.startContainer;
    const endNode = range.endContainer;

    if (
      !novelText.contains(startNode) ||
      !novelText.contains(endNode)
    ) {
      return;
    }

    pendingSelection = text;
  });

  // divスタイル
  function applyMenuStyle(el) {
    Object.assign(el.style, {
      position: 'absolute',
      border: '1px solid',
      borderRadius: '5px',
      padding: '5px',
      zIndex: '9999',
      display: 'none'
    });
  }

  // buttonスタイル
  function applyBtnStyle(btn) {
    Object.assign(btn.style, {
      padding: '0',
      margin: '0',
      border: 'none',
      background: 'none',
      userSelect: 'none',
      cursor: 'alias'
    });
  }

  // メニュー初期設定
  const defaultConfigs = [
    { label: '何者', side: 'left', offsetY: 0, query: '何者' , engine: 'https://www.google.com/search?q=' },
    { label: '元ネタ', side: 'left', offsetY: 40, query: '元ネタ' , engine: 'https://www.google.com/search?q=' },
    { label: '日本語訳', side: 'left', offsetY: 80, query: '日本語訳' , engine: 'https://www.google.com/search?q=' },

    { label: '意味', side: 'right', offsetY: 0, query: 'とは' , engine: 'https://www.google.com/search?q=' },
    { label: '読み方', side: 'right', offsetY: 40, query: '読み方' , engine: 'https://www.google.com/search?q=' },
    { label: '意味 読み方', side: 'right', offsetY: 80, query: '意味 読み方' , engine: 'https://www.google.com/search?q=' }
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
        offsetY: Number(item.offsetY) || 0,
        query: item.query,
        engine: typeof item.engine === 'string'
          ? item.engine
          : 'https://www.google.com/search?q='
      }));
  }

  const menus = [];

  // div作成関数
  function createMenus() {
    hideMenus();

    // 既存削除
    menus.forEach(({ div }) => div.remove());
    menus.length = 0;

    // 受け取ったメニュー設定を採用
    const configs = getSearchConfigs();

    configs.forEach(cfg => {
      const div = doc.createElement('div');
      applyMenuStyle(div);

      const btn = doc.createElement('button');
      btn.textContent = cfg.label;
      applyBtnStyle(btn);

      btn.onclick = () => {
        const text = div.dataset.text;

        const base = cfg.engine || "https://www.google.com/search?q=";
        const query = encodeURIComponent(text + " " + cfg.query);

        const url = base + query;

        win.open(url, '_blank');
        hideMenus();
      };

      div.appendChild(btn);
      doc.body.appendChild(div);

      menus.push({ div, cfg });
    });
  }

  createMenus();

  // 表示制御
  function showMenus(text) {
    const sel = win.getSelection();
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const direction = getSelectionDirection(sel);

    const fontSize = parseFloat(getComputedStyle(novelText).fontSize) || 20;
    const offset = fontSize + 10;

    const textRect = novelText.getBoundingClientRect();
    const centerX = textRect.left + textRect.width / 2;

    menus.forEach(({ div, cfg }) => {
      div.style.display = 'block';

      const width = div.offsetWidth;
      const height = div.offsetHeight;

      // 横位置
      if (cfg.side === 'right') {
        div.style.left = (centerX + offset + win.scrollX) + 'px';
      } else {
        div.style.left = (centerX - offset - width + win.scrollX) + 'px';
      }

      // 縦位置
      let top;

      if (text.length === 1) {
        top = rect.bottom - height - 40;
      } else if (direction === 'forward') {
        top = rect.bottom - height - 80;
      } else {
        top = rect.top;
      }

      div.style.top = (top + cfg.offsetY + win.scrollY) + 'px';
      div.dataset.text = text;
    });
  }

  // 選択方向を検査する関数
  function getSelectionDirection(sel) {
    if (sel.anchorNode === sel.focusNode) {
      return sel.anchorOffset <= sel.focusOffset ? 'forward' : 'backward';
    }

    const pos = sel.anchorNode.compareDocumentPosition(sel.focusNode);

    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return 'forward';
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 'backward';

    return 'none';
  }

  function hideMenus() {
    menus.forEach(({ div }) => {
      div.style.display = 'none';
    });
  }

  doc.addEventListener('mouseup', () => {
    if (!pendingSelection) return;

    showMenus(pendingSelection);
    pendingSelection = null;
  });

  doc.addEventListener('mousedown', (e) => {
    if (!menus.some(({ div }) => div.contains(e.target))) {
      hideMenus();
    }
  });
}
