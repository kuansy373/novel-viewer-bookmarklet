(() => {

  // WebページのDOM完成を待って実行
  function run() {

    // PC幅でレンダリングされたページがスマホで縮小表示される場合のサイズ補正
    const scale = Math.max(1, window.innerWidth / window.outerWidth);
    const baseFontSize = Math.round(13 * scale);
    const s = n => Math.round(n * scale);

    const panelStyles = `
      .panel {
        position: fixed;
        top: 10px;
        right: 10px;
        background: #faf6ef;
        color: #000;
        border-radius: 8px;
        font-family: 'Hiragino Mincho ProN', serif;
        font-size: ${baseFontSize}px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-shadow: 0 6px 10px rgba(0,0,0,0.15);
        line-height: 1.6;
        width: max-content;
      }
      .content-container {
        flex: 1;
        overflow-y: auto;
        padding: 15px 15px 0px;
      }
      .header {
        font-weight: bold;
        margin-bottom: 10px;
        border-bottom: 1px solid;
        padding-bottom: 5px;
        display: flex;
        align-items: center;
        gap: 1px;
      }
      .bookmark-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-size: 1.3em;
      }
      .t-title {
        flex: 1;
        margin-left: 3px;
      }
      .drag-handle {
        border: 1px solid #aaa;
        border-radius: 4px;
        background: #F4F4F4;
        padding: 1px 2px;
        cursor: move;
        color: #8578c1;
        width: ${s(22)}px;
        height: ${s(24)}px;
        flex-shrink: 0;
      }
      .parts-list {
        max-height: 245px;
        overflow-y: auto;
        margin-top: 5px;
        scrollbar-width: thin;
        scrollbar-color: #c8b9a6 #f0ebe3;
        overscroll-behavior: contain;
        content-visibility: auto;
      }
      .part-info {
        padding: 3px 0;
      }
      .value {
        float: right;
      }
      .divider {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid;
      }
      .popup-retry {
        padding: 4px;
        font-size: 1em;
        text-indent: 11px;
        background: #fffbf2;
        border-top: 1px solid #aaa;
        cursor: pointer;
        user-select: none;
        color: #444;
        text-decoration: none;
      }
      .popup-retry:hover {
        background: #faf6ef;
        color: #000;
        text-decoration: underline;
      }
    `;

    const settingsStyles = `
      .overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(40, 40, 40, 0.5);
      }
      .box {
        background: #faf6ef;
        border-radius: 8px;
        padding: 20px 24px;
        font-family: 'Hiragino Mincho ProN', serif;
        font-size: ${baseFontSize}px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        color: #000;
        transform: scale(1.2);
      }
      .s-title {
        font-weight: bold;
        margin-bottom: 14px;
        font-size: 1.1em;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .help-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.1em;
        height: 1.1em;
        border-radius: 50%;
        border: 1px solid #5f4fac;
        color: #5f4fac;
        font-size: 0.9em;
        font-weight: normal;
        cursor: pointer;
        user-select: none;
        flex-shrink: 0;
      }
      .item {
        margin-bottom: 3px;
      }
      .label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .label--disabled {
        cursor: default;
      }
      .label--disabled .label-text {
        color: #999;
      }
      .checkbox {
        width: ${s(15)}px;
        height: ${s(15)}px;
        cursor: pointer;
        accent-color: brown;
      }
      .label--disabled .checkbox {
        cursor: default;
      }
      .label-text {
        color: #000;
        user-select: none;
      }
      .save-btn {
        margin-top: 8px;
        width: 100%;
        padding: 8px;
        background: #5f4fac;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 0.95em;
        font-family: 'Hiragino Mincho ProN', serif;
        cursor: pointer;
      }
      .save-btn:hover {
        background: #4a3c8a;
      }
      .save-btn--error,
      .save-btn--error:hover {
        background: #a94442;
      }
    `;

    const shadowHost = document.createElement('div');
    document.body.appendChild(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = panelStyles + settingsStyles;
    shadow.appendChild(styleEl);

    const textInfoPanel = document.createElement('div');
    textInfoPanel.className = 'panel';
    shadow.appendChild(textInfoPanel);

    /* --- 定数・設定 --- */

    const ALLOWED_TAGS = new Set(['ruby', 'rt', 'em']);

    const MAX_CHARS_PER_PAGE      = 10000;
    const DELIMITER_SEARCH_MARGIN = 0.05;
    const TAIL_PREVIEW_CHARS      = 10;
    const DELIMITER_CODES = new Set([
      12288, // 　（全角スペース）
      12290, // 。
      12301, // 」
      8230,  // …
    ]);

    const SETTINGS_KEY = 'tateichigyo_bm_extract';
    const SETTING_ITEMS = [
      { key: 'includeTitle',    label: 'タイトル' },
      { key: 'includeAuthor',   label: '作者名' },
      { key: 'includeForeword', label: '作者まえがき' },
      { key: 'includeBody',     label: '小説本文' },
      { key: 'includeAfterword',label: '作者あとがき' },
    ];

    const SELECTOR_MAP = {
      includeTitle: [
        { selector: '.title', default: true },                          // 青空文庫
        { selector: 'body > h1', default: true },                       // 青空文庫
        { selector: '.p-novel__title',                 default: true }, // なろう
        { selector: '.p-novel__subtitle-episode',      default: true }, // なろう（スマホ）
        { selector: '.widget-episodeTitle',            default: true }, // カクヨム
        { selector: '.p-novel-episode__episode-title', default: true }, // アルファポリス
      ],
      includeAuthor: [
        { selector: '.author', default: true },                     // 青空文庫
        { selector: '.editor', default: true },                     // 青空文庫
        { selector: 'body > h2', default: true },                   // 青空文庫
        { selector: '#contentMain-header-author', default: false }, // カクヨム（PCのみ）
        { selector: '.p-novel-episode__author',   default: false }, // アルファポリス
      ],
      includeForeword: [
        { selector: '.p-novel__text--preface', default: false }, // なろう
      ],
      includeBody: [
        { selector: '.main_text',                default: true }, // 青空文庫
        { selector: '.p-novel__text:not(.p-novel__text--preface):not(.p-novel__text--afterword)', default: true }, // なろう
        { selector: '.widget-episodeBody p',     default: true }, // カクヨム
        { selector: '.p-novel-episode__text',    default: true }, // アルファポリス
      ],
      includeAfterword: [
        { selector: '.p-novel__text--afterword', default: false }, // なろう
      ],
    };

    /* --- 関数 --- */

    /* ドラッグ関連 */
    function createEqualsIcon({ bg = 'transparent', color = '#5f4fac', scale = 1 } = {}) {
      const w = Math.round(22 * scale), h = Math.round(24 * scale);
      return `
      <svg width="${w}" height="${h}" viewBox="0 0 22 24" xmlns="http://www.w3.org/2000/svg">
        <rect width="22" height="24" rx="4" fill="${bg}"/>
        <rect x="3.3" y="6.5" width="16" height="3.3" rx="2" fill="${color}"/>
        <rect x="3.3" y="14" width="16" height="3.3" rx="2" fill="${color}"/>
      </svg>`;
    }

    function makeDraggable(dragHandle, dragTarget, dragDoc, onDragEnd) {
      let isDragging = false;
      let offsetX = 0;
      let offsetY = 0;

      const onMouseMove = e => {
        if (!isDragging) return;
        dragTarget.style.setProperty('left',   e.clientX - offsetX + 'px', 'important');
        dragTarget.style.setProperty('top',    e.clientY - offsetY + 'px', 'important');
        dragTarget.style.setProperty('right',  'auto', 'important');
        dragTarget.style.setProperty('bottom', 'auto', 'important');
      };

      const onMouseUp = () => {
        isDragging = false;
        if (onDragEnd) onDragEnd(
          dragTarget.style.getPropertyValue('left'),
          dragTarget.style.getPropertyValue('top')
        );
        dragDoc.removeEventListener('mousemove', onMouseMove);
        dragDoc.removeEventListener('mouseup', onMouseUp);
      };

      const onTouchMove = e => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        dragTarget.style.setProperty('left', touch.clientX - offsetX + 'px', 'important');
        dragTarget.style.setProperty('top',  touch.clientY - offsetY + 'px', 'important');
        e.preventDefault();
      };

      const onTouchEnd = () => {
        isDragging = false;
        if (onDragEnd) onDragEnd(
          dragTarget.style.getPropertyValue('left'),
          dragTarget.style.getPropertyValue('top')
        );
        dragDoc.removeEventListener('touchmove', onTouchMove);
        dragDoc.removeEventListener('touchend', onTouchEnd);
      };

      dragHandle.addEventListener('mousedown', e => {
        isDragging = true;

        const rect = dragTarget.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        dragDoc.addEventListener('mousemove', onMouseMove);
        dragDoc.addEventListener('mouseup', onMouseUp);

        e.preventDefault();
      });

      dragHandle.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        const rect = dragTarget.getBoundingClientRect();

        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;

        isDragging = true;

        dragDoc.addEventListener('touchmove', onTouchMove, { passive: false });
        dragDoc.addEventListener('touchend', onTouchEnd);

        e.preventDefault();
      }, { passive: false });
    }

    /* 設定の読み書き */

    function loadSettings() {
      try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return Object.fromEntries(SETTING_ITEMS.map(item => {
        const entries = SELECTOR_MAP[item.key] ?? [];
        const matched = entries.find(e => document.querySelector(e.selector));
        return [item.key, matched ? matched.default : false];
      }));
    }

    function saveSettings(settings) {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e) {}
    }

    /* HTML */

    function escapeHTML(str) {
      return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[m]);
    }

    function extractWithRubyTags(node) {

      const result = [];

      function traverse(el) {
        for (const child of el.childNodes) {

          if (child.nodeType === Node.TEXT_NODE) {
            result.push(escapeHTML(child.textContent));

          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();

            // カクヨムの傍点
            if (tagName === 'em' && child.classList.contains('emphasisDots')) {
              const raw = child.textContent;
              const dots = '・'.repeat([...raw].length);
              const chars = escapeHTML(raw);
              result.push(`<ruby>${chars}<rt>${dots}</rt></ruby>`);

            } else if (ALLOWED_TAGS.has(tagName)) {
              result.push(`<${tagName}>`);
              traverse(child);
              result.push(`</${tagName}>`);

            } else if (tagName === 'rp') {

            } else if (tagName === 'br') {
              result.push('\n');

            } else {
              traverse(child);
            }
          }
        }
      }

      traverse(node);
      return result.join('');
    }

    // scan() のホットパスで毎回オブジェクトを生成しないよう、結果を再利用する
    // 呼び出し元は次の parseTag() 呼び出し前に必要な値を取り出すこと
    const tagResult = { end: 0, name: '', isClosing: false };

    function parseTag(html, start) {
      const end = html.indexOf('>', start + 1);
      if (end === -1) return null;

      let i = start + 1;
      while (i < end && html.charCodeAt(i) === 32) i++;

      const isClosing = html.charCodeAt(i) === 47;
      if (isClosing) i++;

      let nameStart = i;
      while (i < end) {
        const c = html.charCodeAt(i);
        if (c === 32 || c === 62 || c === 47) break;
        i++;
      }

      tagResult.end = end;
      tagResult.name = html.slice(nameStart, i);
      tagResult.isClosing = isClosing;
      return tagResult;
    }

    function consumeTag(html, h, state) {
      const tag = parseTag(html, h);
      if (!tag) return null;
      if (tag.name === 'rt') {
        state.skipDepth += tag.isClosing ? -1 : 1;
        state.skipDepth = Math.max(0, state.skipDepth);
      }
      if (tag.name === 'ruby') {
        state.rubyDepth += tag.isClosing ? -1 : 1;
        state.rubyDepth = Math.max(0, state.rubyDepth);
      }
      return tag.end + 1;
    }

    function advancePastRuby(html, h, rubyDepth) {
      while (rubyDepth > 0 && h < html.length) {
        if (html.charCodeAt(h) === 60) {
          const tag = parseTag(html, h);
          if (!tag) break;
          if (tag.name === 'ruby') {
            rubyDepth += tag.isClosing ? -1 : 1;
            rubyDepth = Math.max(0, rubyDepth);
          }
          h = tag.end + 1;
        } else {
          h++;
        }
      }
      return h;
    }

    function scan(html, startHtmlPos, limit, stopOnDelimiter = false) {
      let pos = startHtmlPos;
      let count = 0;
      const state = { skipDepth: 0, rubyDepth: 0 };

      while (pos < html.length && count < limit) {
        if (html.charCodeAt(pos) === 60) {
          const next = consumeTag(html, pos, state);
          if (next === null) break;
          pos = next;
          continue;
        }
        if (state.skipDepth === 0) {
          count++;
          if (stopOnDelimiter) {
            const c = html.charCodeAt(pos);
            if (DELIMITER_CODES.has(c)) {
              pos++;
              return { htmlPos: advancePastRuby(html, pos, state.rubyDepth), visibleCount: count, found: true };
            }
          }
        }
        pos++;
      }

      // stopOnDelimiter で区切りが見つからなかった場合は元の位置を返す
      if (stopOnDelimiter) {
        return { htmlPos: startHtmlPos, visibleCount: 0, found: false };
      }

      return { htmlPos: advancePastRuby(html, pos, state.rubyDepth), visibleCount: count, found: true };
    }

    /* --- UI構築 --- */

    function createPanelHTML(totalChars, numPages, charsPerPage) {
      return `
        <div id="contentContainer" class="content-container">
          <div class="header">
            <button id="bookmarkBtn" class="bookmark-btn">🔖</button>
            <span class="t-title">テキスト情報</span>
            <div id="dragHandle" class="drag-handle">${createEqualsIcon({ scale })}</div>
          </div>
          <div>
            <strong>総文字数:</strong>
            <span class="value">${totalChars.toLocaleString()}</span>
          </div>
          <div>
            <strong>分割ページ数:</strong>
            <span class="value">${numPages}</span>
          </div>
          <div>
            <strong>目標文字数/ページ:　</strong>
            <span class="value">${charsPerPage.toLocaleString()}</span>
          </div>
          <div class="divider">
            <strong>各ページの文字数</strong>
          </div>
          <div id="partsList" class="parts-list"></div>
        </div>
        <div id="popupRetry" class="popup-retry">
          小説タブを開く
        </div>
      `;
    }

    let fullHTML = '';
    let totalVisibleChars = 0;
    let numPages = 0;
    let charsPerPage = 0;
    let pageRanges = [];
    let pageCharCounts = [];
    let validPageCount = 0;

    function buildText() {
      const settings = loadSettings();

      const activeSelectors = Object.entries(SELECTOR_MAP)
        .filter(([key]) => settings[key] !== false)
        .flatMap(([, entries]) => entries.map(e => e.selector));

      const allSelectors = [...new Set(activeSelectors)];

      const parts = [];
      if (allSelectors.length > 0) {
        document.querySelectorAll(allSelectors.join(', '))
          .forEach(node => {
            const part = extractWithRubyTags(node).trim();
            if (part) parts.push(part);
          });
      }

      let text = parts.join('　　');

      text = text.trim()
        .replace(/(\r\n|\r)+/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .replace(/\n/g, '　')
        .replace(/　{3,}/g, '　');

      fullHTML = text;
      totalVisibleChars = scan(fullHTML, 0, Infinity).visibleCount;

      numPages = Math.ceil(totalVisibleChars / MAX_CHARS_PER_PAGE);
      charsPerPage = Math.ceil(totalVisibleChars / numPages);
    }

    function buildPanel() {
      textInfoPanel.innerHTML = createPanelHTML(totalVisibleChars, numPages, charsPerPage);
      const partsList = shadow.getElementById('partsList');

      pageRanges = [];
      pageCharCounts = [];
      let curHtmlPos = 0;
      let accumulatedChars = 0;

      for (let i = 0; i < numPages; i++) {
        const startHtmlPos = curHtmlPos;
        const isLast = i === numPages - 1;

        let endHtmlPos;
        let actualLen;

        if (isLast) {
          endHtmlPos = fullHTML.length;
          actualLen = totalVisibleChars - accumulatedChars;
        } else {
          const { htmlPos: rawEndHtmlPos, visibleCount: scanned } =
            scan(fullHTML, startHtmlPos, charsPerPage);
          const maxExtra = Math.floor(charsPerPage * DELIMITER_SEARCH_MARGIN);
          const { htmlPos: delimHtmlPos, visibleCount: extra } =
            scan(fullHTML, rawEndHtmlPos, maxExtra, true);
          endHtmlPos = delimHtmlPos;
          actualLen = scanned + extra;
        }

        const { htmlPos: tailHtmlStart } =
          scan(fullHTML, startHtmlPos, Math.max(0, actualLen - TAIL_PREVIEW_CHARS));

        pageRanges.push({ startHtmlPos, endHtmlPos, tailHtmlStart });
        pageCharCounts.push(actualLen);
        accumulatedChars += actualLen;

        const div = document.createElement('div');
        div.className = 'part-info';
        div.innerHTML = `
          <strong>ページ${i + 1}:</strong>
          <span class="value">${actualLen.toLocaleString()}文字</span>
        `;
        partsList.appendChild(div);

        curHtmlPos = endHtmlPos;
      }

      validPageCount = pageCharCounts.filter(count => count > 0).length;

      // 🔖ボタン
      const bookmarkBtn = shadow.getElementById('bookmarkBtn');
      bookmarkBtn.addEventListener('click', openSettingsUI);

      // 小説タブを開く
      const popupRetry = shadow.getElementById('popupRetry');
      popupRetry.addEventListener('click', openNovelWindow);

      // ドラッグ
      makeDraggable(
        shadow.getElementById('dragHandle'),
        textInfoPanel,
        document
      );
    }

    // openSettingsUI を複数回開いても「一度でも有効にしたキー」を記憶するため、
    // openSettingsUI の外側で宣言して状態を保持する
    const everEnabledKeys = new Set();

    function openSettingsUI() {
      const existing = shadow.getElementById('novelBmSettingsOverlay');
      if (existing) { existing.remove(); return; }

      const current = loadSettings();

      Object.entries(current)
        .filter(([, v]) => v === true)
        .forEach(([k]) => everEnabledKeys.add(k));

      const itemsHTML = SETTING_ITEMS.map(item => {
        const entries = SELECTOR_MAP[item.key] ?? [];
        const supported = entries.length === 0 || entries.some(e => document.querySelector(e.selector));
        const onceTrue = everEnabledKeys.has(item.key);
        const disabled = !supported && !onceTrue;
        const checked = supported ? current[item.key] !== false : current[item.key] === true;
        return `
          <div class="item" data-key="${item.key}" data-disabled="${disabled}" data-label="${escapeHTML(item.label)}">
            <label class="label${disabled ? ' label--disabled' : ''}">
              <input type="checkbox" class="checkbox" data-key="${item.key}"
                ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
              <span class="label-text">${escapeHTML(item.label)}</span>
            </label>
          </div>`;
      }).join('');

      const overlay = document.createElement('div');
      overlay.id = 'novelBmSettingsOverlay';
      overlay.className = 'overlay';
      overlay.innerHTML = `
        <div class="box">
          <div class="s-title">
            縦一行に含める内容を選択
            <span id="helpBtn" class="help-btn">？</span>
          </div>
          ${itemsHTML}
          <button id="saveBtn" class="save-btn">保存する</button>
        </div>
      `;

      overlay.querySelector('#helpBtn').addEventListener('click', () => {
        alert(`この設定は ${window.location.hostname} の localStorage に保存され、適用されます。キー名: ${SETTINGS_KEY}`);
      });

      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
      });

      overlay.querySelectorAll('.item[data-disabled="true"]').forEach(wrapper => {
        wrapper.addEventListener('click', () => {
          alert(`現在のページから「${wrapper.dataset.label}」を取得できないため、変更できません`);
        });
      });

      const saveBtn = overlay.querySelector('#saveBtn');
      saveBtn.addEventListener('click', () => {
        const newSettings = {};
        SETTING_ITEMS.forEach(item => {
          newSettings[item.key] = overlay.querySelector(`.checkbox[data-key="${item.key}"]`).checked;
        });
        Object.entries(newSettings).forEach(([key, val]) => {
          if (val) everEnabledKeys.add(key);
        });
        const anyChecked = Object.values(newSettings).some(v => v);
        if (!anyChecked) {
          saveBtn.textContent = '最低1つ選択してください';
          saveBtn.classList.add('save-btn--error');
          setTimeout(() => {
            saveBtn.textContent = '保存する';
            saveBtn.classList.remove('save-btn--error');
          }, 2000);
          return;
        }
        saveSettings(newSettings);
        overlay.remove();
        buildText();
        buildPanel();
      });

      shadow.appendChild(overlay);
    }

    function openNovelWindow() {

      const data = {
        totalVisibleChars,
        numPages,
        pageRanges,
        fullHTML,
        pageCharCounts,
        validPageCount
      };

      const html = `
        <!DOCTYPE html>
        <html lang="ja" style="scrollbar-width: thin;">
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>小説</title>
        <style>
        body {
          display: flex;
          justify-content: center;
          font-feature-settings: 'pkna';
          -moz-osx-font-smoothing: grayscale;
          -webkit-font-smoothing: antialiased;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        #novelDisplay {
          writing-mode: vertical-rl;
          white-space: nowrap;
          letter-spacing: 0.27%;
          line-height: 1.8;
          font-size: 23px;
          display: block;
          padding: 2em;
          content-visibility: auto;
        }
        ruby rt {
          font-size: 0.5em;
          background: transparent !important;
          user-select: none;
        }
        </style>
        </head>
        <body>
          <div id="novelDisplay"></div>
          <script>
          window.createEqualsIcon = ${createEqualsIcon.toString()};
          window.makeDraggable = ${makeDraggable.toString()};
          window.tagResult = ${JSON.stringify(tagResult)};
          window.parseTag = ${parseTag.toString()};
          </script>
          <script src="https://cdn.jsdelivr.net/gh/kuansy373/novel-viewer-bookmarklet@967e038680b4c326306ec4f51af934208f7be11e/src/novel-window.js"></script>
        </body>
        </html>
      `;

      const blob = new Blob(
        [html],
        { type: 'text/html' }
      );

      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');

      if (!win) {
        alert('ポップアップがブロックされました');
        return;
      }

      win.addEventListener('load', () => {
        win.postMessage({
          type: 'NOVEL_DATA',
          payload: data
        }, '*');

        URL.revokeObjectURL(url);

      }, { once: true });
    }

    /* --- 初期実行 --- */

    buildText();
    buildPanel();
    openNovelWindow();
  }

  if (document.readyState !== 'loading') {
    run();
  } else {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
})()
