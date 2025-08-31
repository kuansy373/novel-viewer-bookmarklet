(() => {
  let text = '';
  document.querySelectorAll('body > h1, body > h2, body > h3, .metadata, .main_text, .p-novel__title, .p-novel__text, .widget-episodeTitle, .widget-episodeBody p, .novel-title, .novel-body p, .chapter-title, .episode-title, #novelBody').forEach(node => {
    text += node.innerHTML.replace(/<(\/?ruby|\/?rb|\/?rp|\/?rt)>/g, '___$1___').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/___([^_]+)___/g, '<$1>') + '　'
  });
  text = text.trim().replace(/(\r\n|\r)+/g, '\n').replace(/\n{2,}/g, '\n').replace(/\n/g, '　').replace(/　{2,}/g, '　');
  document.querySelectorAll('body > *').forEach(node => {
    node.style.display = 'none'
  });
  let vp = document.querySelector('meta[name="viewport"]');
  if (!vp) {
    vp = document.createElement('meta');
    vp.name = 'viewport';
    document.head.appendChild(vp)
  }
  vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  const hideStyle = document.createElement('style');
  hideStyle.textContent = `#pageTop, .c-navigater, .js-navigater-totop, .global-header, .global-footer { display: none !important; }`;
  document.head.appendChild(hideStyle);
  const container = document.createElement('div');
  container.id = 'novelDisplay';
  container.innerHTML = text;
  container.style.cssText = `
  writing-mode: vertical-rl;
  white-space: nowrap;
  letter-spacing: 0.25em;
  line-height: 1.8;
  font-size: 23px;
  display: block;
  padding: 2em;
  contain: none;
  content-visibility: visible;
  will-change: transform;
  transform: translateZ(0);
`;
  document.body.appendChild(container);
  document.body.style.cssText = `
  display: flex;
  justify-content: center;
  font-family: '游明朝', 'Yu Mincho', YuMincho, 'Hiragino Mincho Pro', serif;
  font-feature-settings: 'pkna';
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
`;
  const scrollSlider = document.createElement('input');
  scrollSlider.type = 'range';
  scrollSlider.min = 0;
  scrollSlider.max = 15;
  scrollSlider.value = 0;
  scrollSlider.style.border = 'initial';
  scrollSlider.style.position = 'fixed';
  scrollSlider.style.bottom = '-98vh';
  scrollSlider.style.right = '30px';
  scrollSlider.style.zIndex = '9999';
  scrollSlider.style.width = '80px';
  scrollSlider.style.opacity = '0.05';
  scrollSlider.style.height = '200vh';
  document.body.appendChild(scrollSlider);
  const scroller = document.scrollingElement || document.documentElement;
  let scrollSpeed = 0;
  let lastTimestamp = null;

  function forceScroll(timestamp) {
    if (lastTimestamp !== null) {
      const elapsed = timestamp - lastTimestamp;
      scroller.scrollTop += (scrollSpeed * elapsed) / 1000
    }
    lastTimestamp = timestamp;
    requestAnimationFrame(forceScroll)
  }
  scrollSlider.addEventListener('input', () => {
    scrollSpeed = parseFloat(scrollSlider.value) * 15
  });
  requestAnimationFrame(forceScroll);
  ['fontSizeSlider', 'fontSizeLabel', 'fontSizeClose', 'fontSizeDecrease', 'fontSizeIncrease', 'fontSizeOpen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  const target = container;
  const currentSize = parseInt(getComputedStyle(target).fontSize) || 23;
  const fontSlider = document.createElement('input');
  fontSlider.type = 'range';
  fontSlider.id = 'fontSizeSlider';
  fontSlider.min = 12;
  fontSlider.max = 48;
  fontSlider.value = currentSize;
  fontSlider.style.webkitAppearance = 'auto';
  Object.assign(fontSlider.style, {
    padding: 'initial',
    position: 'fixed',
    top: '40px',
    right: '50px',
    zIndex: '9999',
    width: '100px',
    display: 'none'
  });
  const label = document.createElement('div');
  label.id = 'fontSizeLabel';
  label.textContent = `文字サイズ: ${fontSlider.value}px`;
  Object.assign(label.style, {
    position: 'fixed',
    top: '10px',
    right: '47px',
    background: '#fff',
    padding: '2px 6px',
    fontSize: '14px',
    zIndex: '10000',
    border: '1px solid #ccc',
    borderRadius: '4px',
    display: 'none'
  });
  const closeBtn = document.createElement('div');
  closeBtn.id = 'fontSizeClose';
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, {
    position: 'fixed',
    top: '10px',
    right: '10px',
    padding: '0 8px',
    fontSize: '14px',
    cursor: 'pointer',
    zIndex: '10001',
    borderRadius: '4px',
    display: 'none'
  });
  const decreaseBtn = document.createElement('button');
  decreaseBtn.id = 'fontSizeDecrease';
  decreaseBtn.textContent = '◀';
  Object.assign(decreaseBtn.style, {
    position: 'fixed',
    top: '40px',
    right: '170px',
    zIndex: '9999',
    fontSize: '16px',
    padding: '0 6px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    background: '#eee',
    cursor: 'pointer',
    display: 'none'
  });
  const increaseBtn = document.createElement('button');
  increaseBtn.id = 'fontSizeIncrease';
  increaseBtn.textContent = '▶';
  Object.assign(increaseBtn.style, {
    position: 'fixed',
    top: '40px',
    right: '10px',
    zIndex: '9999',
    fontSize: '16px',
    padding: '0 6px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    background: '#eee',
    cursor: 'pointer',
    display: 'none'
  });
  const openBtn = document.createElement('div');
  openBtn.id = 'fontSizeOpen';
  openBtn.textContent = '○';
  Object.assign(openBtn.style, {
    position: 'fixed',
    top: '10px',
    right: '10px',
    padding: '0 8px',
    fontSize: '14px',
    opacity: '0.3',
    cursor: 'pointer',
    zIndex: '10001',
    borderRadius: '4px',
    display: 'block'
  });
  closeBtn.addEventListener('click', () => {
    fontSlider.style.display = 'none';
    label.style.display = 'none';
    closeBtn.style.display = 'none';
    decreaseBtn.style.display = 'none';
    increaseBtn.style.display = 'none';
    openBtn.style.display = 'block'
  });
  openBtn.addEventListener('click', () => {
    fontSlider.style.display = 'block';
    label.style.display = 'block';
    closeBtn.style.display = 'block';
    decreaseBtn.style.display = 'block';
    increaseBtn.style.display = 'block';
    openBtn.style.display = 'none'
  });
  decreaseBtn.addEventListener('click', () => {
    let size = parseInt(fontSlider.value) - 1;
    if (size >= parseInt(fontSlider.min)) {
      fontSlider.value = size;
      target.style.fontSize = `${size}px`;
      label.textContent = `文字サイズ: ${size}px`
    }
  });
  increaseBtn.addEventListener('click', () => {
    let size = parseInt(fontSlider.value) + 1;
    if (size <= parseInt(fontSlider.max)) {
      fontSlider.value = size;
      target.style.fontSize = `${size}px`;
      label.textContent = `文字サイズ: ${size}px`
    }
  });
  fontSlider.addEventListener('input', () => {
    target.style.fontSize = `${fontSlider.value}px`;
    label.textContent = `文字サイズ: ${fontSlider.value}px`
  });
  document.body.appendChild(fontSlider);
  document.body.appendChild(label);
  document.body.appendChild(closeBtn);
  document.body.appendChild(decreaseBtn);
  document.body.appendChild(increaseBtn);
  document.body.appendChild(openBtn);
  
// ここからPickr
  if (window.__pickrLoaded) return;
  window.__pickrLoaded = !0;
  const load = (tag, attrs) => new Promise((res, rej) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => (el[k] = v));
    el.onload = res;
    el.onerror = rej;
    document.head.appendChild(el)
  });
  Promise.all([load('link', {
    rel: 'stylesheet',
    href: 'https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/themes/classic.min.css',
  }), load('script', {
    src: 'https://cdn.jsdelivr.net/npm/@simonwep/pickr'
  }), ]).then(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* ---- #pickrContainer 関連 ---- */
      #pickrContainer {
        all: initial;
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 999999;
        background: #C4EFF5 !important;
        padding: 7px;
        padding-bottom: 0;
        border: 1px solid #ccc;
        border-radius: 8px;
        font-family: sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }

      #pickrContainer,
      #pickrContainer *,
      .pcr-app,
      .pcr-app * {
        line-height: initial !important;
        color: #000000 !important;
      }

      #pickrContainer .row {
        display: flex;
        align-items: center;
        margin-bottom: 2px;
        gap: 5px;
      }

      #pickrContainer .label {
        font-weight: bold;
        font-family: monospace;
        font-size: 21px;
      }

      #pickrClose {
        all: initial;
        font-size: 15px;
        font-weight: bolder;
        cursor: pointer;
        position: absolute;
        top: 5px;
        right: 7px;
      }

      #pickrContainer .row.contrast-row {
        justify-content: flex-start;
        gap: 4px;
      }

      #pickrContainer .row.contrast-row > strong {
        display: inline-block;
        min-width: 60px;
      }

      #dragHandle {
        cursor: move;
        padding: 0px;
        padding-bottom: 2px;
        padding-left: 0.3px;
        margin-right: 20px;
        background: #F4F4F4;
      }

      #dragHandle:active {
        transform: none;
      }

      /* ---- .color-swatch 関連 ---- */
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
        all: initial;
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
        all: initial;
        position: absolute;
        right: 55px;
        font-size: 11px;
        block-size: 17px;
        border: 1px solid #999;
        border-radius: 4px;
        background: #F0FFEC;
        cursor: pointer;
      }

      .hex-load-btn {
        all: initial;
        cursor: pointer;
        padding: 2px 2px;
        font-size: 1em;
        font-weight: bolder;
        border: 1px solid #aaa;
        background: #dddddd;
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
        background: #dddddd;
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
        all: initial;
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

      #randomColorBtn {
        all: initial;
        background: #E6FDFF;
        border: 1px solid #aaa;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 15px;
        font-family: monospace;
      }

      #randomColorBtn:active {
        transform: translateY(1px);
      }

      #bgLockIcon, #fgLockIcon {
        font-size: 14px;
        margin: 0px 0px;
        display: inline-block;
      }

      /* ---- .pcr-app 関連 ---- */
      .pcr-app {
        position: fixed !important;
        box-sizing: initial !important;
        left: initial !important;
        bottom: initial !important;
        top: 150px !important;
        right: 10px !important;
        padding: 10px !important;
        width: 310px !important;
        height: 150px !important;
        z-index: 1000000 !important;
        background: #C4EFF5 !important;
      }

      .pcr-selection {
        height: 114px !important;
      }

      .pcr-color-palette {
        height: auto !important;
      }

      .pickr .pcr-button {
        all: unset;
        display: inline-block;
        position: relative;
        height: 8.3px;
        width: 8.3px;
        padding: .5em;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif;
        border-radius: 2px;
        background-size: 0;
        transition: all .3s;
      }

      .pcr-color-preview {
        width: 22px !important;
        margin-right: 10px !important;
      }

      .pcr-color-chooser{
        margin-left: 10px !important;
      }

      .pcr-last-color {
        margin-top: 0;
        margin-bottom: 0;
      }

      .pcr-swatches {
        all: initial !important;
      }

      .pcr-result {
        height: 20px !important;
        margin-top: 10px !important;
        font-family: monospace !important;
        font-size: 15px !important;
        background: #fff !important;
        box-shadow: initial !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
      }

      .pcr-save {
        all: unset;
        box-shadow: initial !important;
        font-size: 12px !important;
        font-weight: normal !important;
        height: 22px !important;
        width: 40px !important;
        margin-top: 10px !important;
        padding: 0px !important;
        border: 1px solid #999 !important;
        border-radius: 4px !important;
        background: #97DDC8!important
      }

      .pcr-save:active {
        transform: translateY(1px);
      }
    `;


    document.head.appendChild(style);
    const container = document.createElement('div');
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
        <button id="dragHandle" class="hex-load-btn">🟰</button>
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
        <button id="randomColorBtn">🎨Random</button>
        <div class="label" style="margin-left:2px;font-weight: normal;font-size: 19px;">BG:</div>
        <label id="bgLockLabel" style="cursor:pointer;display:inline-flex;align-items:center;">
          <input type="checkbox" id="color-toggle-bg-lock" style="display:none;">
          <span id="bgLockIcon">🔓</span>
        </label>
        <div class="label" style="margin-left:2px;font-weight: normal;font-size: 19px;">FG:</div>
        <label id="fgLockLabel" style="cursor:pointer;display:inline-flex;align-items:center;">
          <input type="checkbox" id="color-toggle-fg-lock" style="display:none;">
          <span id="fgLockIcon">🔓</span>
        </label>
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
          value="21"
          title="Maximum contrast ratio"
        >
      </div>
    `;

    document.body.appendChild(container);

    // --- ドラッグ処理 ---
    (function() {
      const dragHandle = document.getElementById('dragHandle');
      const container = document.getElementById('pickrContainer');
      let isDragging = false;
      let offsetX = 0;
      let offsetY = 0;

      // --- マウス操作 ---
      dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - container.getBoundingClientRect().left;
        offsetY = e.clientY - container.getBoundingClientRect().top;
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        container.style.left = e.clientX - offsetX + 'px';
        container.style.top = e.clientY - offsetY + 'px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });

      // --- タッチ操作 ---
      dragHandle.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        isDragging = true;
        offsetX = touch.clientX - container.getBoundingClientRect().left;
        offsetY = touch.clientY - container.getBoundingClientRect().top;
        e.preventDefault();
      });

      document.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        container.style.left = touch.clientX - offsetX + 'px';
        container.style.top = touch.clientY - offsetY + 'px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
      }, { passive: false });

      document.addEventListener('touchend', () => {
        isDragging = false;
      });
    })();

    // --- ユーティリティ関数 ---
    const getHex = (prop) => {
      const rgb = getComputedStyle(document.body)[prop];
      if (!rgb || rgb === 'transparent' || rgb.startsWith('rgba(0, 0, 0, 0)')) {
        return null
      }
      const nums = rgb.match(/\d+/g)?.map(Number);
      return nums && nums.length >= 3 ? '#' + nums.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('') : null
    };
    const applyStyle = (prop, value) => {
      if (!value) return;
      const id = prop === 'color' ? '__fgOverride' : '__bgOverride';
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('style');
        el.id = id;
        document.head.appendChild(el)
      }
      el.textContent = `*:not(#pickrContainer):not(#pickrContainer *):not(.pcr-app):not(.pcr-app *) {       ${prop}: ${value} !important;     }`
    };
    const updateSwatch = (swatch, current, saved) => {
      if (!swatch) return;
      swatch.querySelector('.color-current').style.background = current;
      swatch.querySelector('.color-saved').style.background = saved
    };
    const updateColorHexDisplays = () => {
      document.getElementById("bgHex").value = currentBg;
      document.getElementById("fgHex").value = currentFg;
      updateLockIcons();
    };
    const getContrast = (fg, bg) => {
      const lum = (hex) => {
        const rgb = hex.match(/\w\w/g).map((v) => parseInt(v, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
      };
      const [l1, l2] = [lum(fg), lum(bg)];
      return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)
    };
    function hexToHSL(hex) {
      if (!hex || typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
        return { h: 0, s: 0, l: 0 };
      }
      let r = parseInt(hex.substr(1,2),16)/255;
      let g = parseInt(hex.substr(3,2),16)/255;
      let b = parseInt(hex.substr(5,2),16)/255;
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
    // --- Pickr関連・状態変数 ---
    const contrastEl = document.getElementById('contrastRatio');
    const updateContrast = () => (contrastEl.textContent = getContrast(currentFg, currentBg));
    let savedFg = getHex('color') || '#000000';
    let savedBg = getHex('backgroundColor') || '#ffffff';
    let currentFg = savedFg;
    let currentBg = savedBg;
    // --- pcr-appドラッグ用グローバル変数を追加 ---
    let globalDragStyle = null;
    let globalDragRuleIndex = null;

    const initPickr = (id, prop) => {
      const swatch = document.getElementById(id + 'Swatch');
      const isFg = prop === 'color';
      const getSaved = () => (isFg ? savedFg : savedBg);
      const setSaved = (v) => (isFg ? (savedFg = v) : (savedBg = v));
      const getCurrent = () => (isFg ? currentFg : currentBg);
      const setCurrent = (v) => (isFg ? (currentFg = v) : (currentBg = v));
      const pickr = Pickr.create({
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
      pickr.on('init', instance => {
        // --- pcr-appドラッグボタン追加 ---
        setTimeout(() => {
          // すべてのpcr-appにドラッグボタンを追加
          document.querySelectorAll('.pcr-app').forEach(app => {
            if (app.querySelector('.pcr-drag-handle')) return;
            const saveBtn = app.querySelector('.pcr-save');
            if (saveBtn) {
              const dragBtn = document.createElement('button');
              dragBtn.textContent = '🟰';
              dragBtn.className = 'pcr-drag-handle';
              dragBtn.style.cssText = `
                all: unset;
                cursor: move;
                margin-left: 2.4px;
                margin-top: 10px;
                font-size: 17px;
                vertical-align: middle;
                display: inline-block;
                padding: 0px 4px 3px 4px;
                border-radius: 4px;
                background: #F4F4F4;
                border: 1px solid #aaa;
                height: 22px;
                width: 28px;
                text-align: center;
              `;
              saveBtn.insertAdjacentElement('afterend', dragBtn);

              // --- ドラッグ処理 ---
              let isDragging = false, offsetX = 0, offsetY = 0;

              // --- グローバルなドラッグ用CSSルールを使う ---
              function applyDragCss(left, top) {
                if (!globalDragStyle) {
                  globalDragStyle = document.createElement('style');
                  globalDragStyle.setAttribute('data-pcr-drag', '1');
                  document.head.appendChild(globalDragStyle);
                }
                const sheet = globalDragStyle.sheet;
                if (globalDragRuleIndex !== null) {
                  sheet.deleteRule(globalDragRuleIndex);
                  globalDragRuleIndex = null;
                }
                const rule = `.pcr-app { left: ${left}px !important; top: ${top}px !important; right: auto !important; bottom: auto !important; position: fixed !important; }`;
                globalDragRuleIndex = sheet.insertRule(rule, sheet.cssRules.length);
              }

              dragBtn.addEventListener('mousedown', e => {
                isDragging = true;
                const rect = app.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                applyDragCss(rect.left, rect.top);
                e.preventDefault();
                e.stopPropagation();
              });
              document.addEventListener('mousemove', e => {
                if (!isDragging) return;
                applyDragCss(e.clientX - offsetX, e.clientY - offsetY);
              });
              document.addEventListener('mouseup', () => {
                if (isDragging) {
                  isDragging = false;
                }
              });

              // タッチ対応
              dragBtn.addEventListener('touchstart', e => {
                if (e.touches.length !== 1) return;
                isDragging = true;
                const touch = e.touches[0];
                const rect = app.getBoundingClientRect();
                offsetX = touch.clientX - rect.left;
                offsetY = touch.clientY - rect.top;
                applyDragCss(rect.left, rect.top);
                e.preventDefault();
                e.stopPropagation();
              });
              document.addEventListener('touchmove', e => {
                if (!isDragging || e.touches.length !== 1) return;
                const touch = e.touches[0];
                applyDragCss(touch.clientX - offsetX, touch.clientY - offsetY);
              }, { passive: false });
              document.addEventListener('touchend', () => {
                if (isDragging) {
                  isDragging = false;
                }
              });
            }
          });
        }, 0);
      });
      
    pickr.on('init', instance => {
      setTimeout(() => {
        document.querySelectorAll('.pcr-app').forEach(app => {
          // すでにコピー用ボタンがあればスキップ
          if (app.querySelector('.pcr-copy')) return;
    
          const resultInput = app.querySelector('.pcr-result');
          if (resultInput) {
            // Copy ボタン生成
            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'Copy';
            copyBtn.className = 'pcr-copy';
            copyBtn.style.cssText = `
              all: unset;
              position: absolute;
              cursor: pointer;
              border: 1px solid #999;
              border-radius: 4px;
              background: #F0FFEC;
              padding: initial;
              margin-top: 5px;
              font-size: 12px;
              block-size: 18px;
              width: 42px;
              right: 94px;
              top: 132px;
              text-align: center;
            `;
    
            // .pcr-result の右隣に追加
            resultInput.insertAdjacentElement('afterend', copyBtn);
    
            // クリック時にクリップボードへコピー
          document.querySelectorAll(".pcr-copy").forEach(function(button){
            button.addEventListener("click", function(){
              const app = button.closest('.pcr-app');
              const resultInput = app.querySelector('.pcr-result');
          
              if (resultInput && resultInput.value !== "-") {
                navigator.clipboard.writeText(resultInput.value).then(function(){
                  button.textContent = "Copied!";
                  setTimeout(function(){ button.textContent = "Copy"; }, 1200);
                }).catch(function(err){
                  console.error("コピーに失敗しました:", err);
                });
              }
            });
          });
          }
        });
      });
    });


      pickr.on('change', (color) => {
        const hex = color.toHEXA().toString();
        setCurrent(hex);
        applyStyle(prop, hex);
        updateSwatch(swatch, hex, getSaved());
        updateContrast()
      });
      pickr.on('save', (color) => {
        const hex = color.toHEXA().toString();
        setCurrent(hex);
        setSaved(hex);
        applyStyle(prop, hex);
        updateSwatch(swatch, hex, hex);
        updateContrast();
        if (isFg) window.__fgHSL = hexToHSL(hex);
        else window.__bgHSL = hexToHSL(hex);
      });
      pickr.on('hide', () => {
        setCurrent(getSaved());
        applyStyle(prop, getSaved());
        updateSwatch(swatch, getSaved(), getSaved());
        updateContrast()
      });
      updateSwatch(swatch, getCurrent(), getSaved());
      applyStyle(prop, getCurrent());
      updateContrast();
      return pickr
    };
    let bgPickr = null;
    let fgPickr = null;
    try {
      bgPickr = initPickr('bg', 'background-color');
      fgPickr = initPickr('fg', 'color')
    } catch (e) {
      console.warn('Pickrの初期化に失敗しました:', e);
      alert('Pickrの初期化に失敗しました:', e);
      bgPickr = {
        setColor: (color) => {
          currentBg = savedBg = color;
          applyStyle('background-color', color);
          updateSwatch(document.getElementById('bgSwatch'), color, color);
          updateContrast()
        },
        show: () => {},
        destroyAndRemove: () => {},
      };
      fgPickr = {
        setColor: (color) => {
          currentFg = savedFg = color;
          applyStyle('color', color);
          updateSwatch(document.getElementById('fgSwatch'), color, color);
          updateContrast()
        },
        show: () => {},
        destroyAndRemove: () => {},
      }
    }

    // --- イベントハンドラ・UI操作 ---
    updateColorHexDisplays();

    // --- ロックアイコン制御 ---
    function updateLockIcons() {
      const bgLocked = document.getElementById('color-toggle-bg-lock').checked;
      const fgLocked = document.getElementById('color-toggle-fg-lock').checked;
      const bgColor = document.getElementById('bgHex').value;
      const fgColor = document.getElementById('fgHex').value;
      const bgLockIcon = document.getElementById('bgLockIcon');
      const fgLockIcon = document.getElementById('fgLockIcon');
      bgLockIcon.textContent = bgLocked ? '🔒' : '🔓';
      fgLockIcon.textContent = fgLocked ? '🔒' : '🔓';
      bgLockIcon.style.background = bgColor;
      fgLockIcon.style.background = fgColor;
      bgLockIcon.style.border = bgLocked ? `6px ridge ${bgColor}` : '';
      fgLockIcon.style.border = fgLocked ? `6px ridge ${fgColor}` : '';
      bgLockIcon.style.borderRadius = bgLocked ? '0px' : '4px';
      fgLockIcon.style.borderRadius = fgLocked ? '0px' : '4px';
      bgLockIcon.style.padding = bgLocked ? '0px 0px' : '6px 6px';
      fgLockIcon.style.padding = fgLocked ? '0px 0px' : '6px 6px';
    }
    document.getElementById('color-toggle-bg-lock').addEventListener('change', updateLockIcons);
    document.getElementById('color-toggle-fg-lock').addEventListener('change', updateLockIcons);
    updateLockIcons();

    document.getElementById('bgHexLoad').onclick = () => {
      const val = document.getElementById('bgHex').value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        bgPickr.setColor(val, !0)
      }
      bgPickr.show();
      updateLockIcons();
    };
    document.getElementById('fgHexLoad').onclick = () => {
      const val = document.getElementById('fgHex').value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        fgPickr.setColor(val, !0)
      }
      fgPickr.show();
      updateLockIcons();
    };

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
        s: Math.floor(Math.random() * 80) + 20,
        l: Math.floor(Math.random() * 80) + 10
      }
    }

    function changeColors() {
      const bgLocked = document.getElementById("color-toggle-bg-lock").checked;
      const fgLocked = document.getElementById("color-toggle-fg-lock").checked;
      const contrastMin = parseFloat(document.getElementById("contrastMin").value) || 1;
      const contrastMax = parseFloat(document.getElementById("contrastMax").value) || 21;
      let trials = 0;
      const maxTrials = 300;
      // --- HSLオブジェクトが不正な場合は必ず初期化 ---
      if (!window.__bgHSL || typeof window.__bgHSL.h !== 'number' || typeof window.__bgHSL.s !== 'number' || typeof window.__bgHSL.l !== 'number') {
        window.__bgHSL = hexToHSL(currentBg);
      }
      if (!window.__fgHSL || typeof window.__fgHSL.h !== 'number' || typeof window.__fgHSL.s !== 'number' || typeof window.__fgHSL.l !== 'number') {
        window.__fgHSL = hexToHSL(currentFg);
      }
      while (trials < maxTrials) {
        trials++;
        if (!bgLocked) {
          window.__bgHSL = getRandomHSL()
        }
        if (!fgLocked) {
          window.__fgHSL = getRandomHSL()
        }
        const bgHex = hslToHex(window.__bgHSL.h, window.__bgHSL.s, window.__bgHSL.l);
        const fgHex = hslToHex(window.__fgHSL.h, window.__fgHSL.s, window.__fgHSL.l);
        const ratio = parseFloat(getContrast(fgHex, bgHex));
        if (ratio >= contrastMin && ratio <= contrastMax) {
          if (!bgLocked) currentBg = savedBg = bgHex;
          if (!fgLocked) currentFg = savedFg = fgHex;
          applyStyle("background-color", savedBg);
          applyStyle("color", savedFg);
          updateSwatch(document.getElementById("bgSwatch"), savedBg, savedBg);
          updateSwatch(document.getElementById("fgSwatch"), savedFg, savedFg);
          updateContrast();
          updateColorHexDisplays();
          updateLockIcons();
          return
        }
      }
      alert("指定されたコントラスト範囲に合うランダム色の組み合わせが見つかりませんでした。")
    }
    document.getElementById("randomColorBtn").onclick = changeColors;
    document.getElementById("swapColorsBtn").onclick = () => {
      // ロック状態を無視して完全にスワップ
      [currentFg, currentBg] = [currentBg, currentFg];
      [savedFg, savedBg] = [currentFg, currentBg];
      applyStyle("color", currentFg);
      applyStyle("background-color", currentBg);
      updateSwatch(document.getElementById("bgSwatch"), currentBg, savedBg);
      updateSwatch(document.getElementById("fgSwatch"), currentFg, savedFg);
      updateColorHexDisplays();
      updateContrast();
      window.__bgHSL = hexToHSL(currentBg);
      window.__fgHSL = hexToHSL(currentFg);
      updateLockIcons();
    };

    document.getElementById('pickrClose').onclick = () => {
      // pickrOpen ボタンを生成
      const pickrOpen = document.createElement('div');
      pickrOpen.id = 'pickrOpen';
      pickrOpen.textContent = '□';
      Object.assign(pickrOpen.style, {
        all: 'initial',
        cursor: 'pointer',
        position: 'fixed',
        top: '80px',
        right: '17.5px',
        opacity: '0.3',
        zIndex: '999999'
      });
      document.body.appendChild(pickrOpen);
      
      // Pickr を非表示にする
      container.style.display = 'none';
      style.disabled = true;
      window.__pickrLoaded = false;
    
      // pickrOpen クリック時に復元
      pickrOpen.onclick = () => {
        container.style.display = 'block';
        style.disabled = false;
        pickrOpen.remove();
        window.__pickrLoaded = true;
      };
    };

  document.querySelectorAll(".copy-btn").forEach(function(button){
    button.addEventListener("click", function(){
      var targetId = button.getAttribute("data-target");
      var targetInput = document.getElementById(targetId);
      if (targetInput && targetInput.value !== "-") {
        navigator.clipboard.writeText(targetInput.value).then(function(){
          button.textContent = "Copied!";
          setTimeout(function(){ button.textContent = "Copy"; }, 1200);
        }).catch(function(err){
          console.error("コピーに失敗しました:", err);
        });
      }
    });
  });

  })
  .catch((err) => {
    alert("Pickr の読み込みに失敗しました。CSP によってブロックされている可能性があります。");
    console.error("Pickr load error:", err);
});
})()
