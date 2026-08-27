(() => {

  // webページのDOM完成を待って実行
  function run() {

    // テキスト情報パネル
    const panelStyles = {
      panel: `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #faf6ef;
        color: #000;
        border-radius: 8px;
        font-family: 'Hiragino Mincho ProN', serif;
        font-size: 13px;
        z-index: 10000;
        min-height: 35vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-shadow: 0 6px 10px rgba(0,0,0,0.15);
        line-height: 1.6;
        min-width: max-content;
        max-width: max-content;
      `,
      contentContainer: `
        flex: 1;
        overflow-y: auto;
        padding: 15px 15px 0px;
      `,
      bookmarkBtn: `
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-size: 16px;
      `,
      partsList: `
        max-height: 270px;
        overflow-y: auto;
        margin-top: 5px;
        scrollbar-width: thin;
        scrollbar-color: #c8b9a6 #f0ebe3;
        overscroll-behavior: contain;
        content-visibility: auto;
      `,
      partInfo: 'padding: 3px 0;',
      header: `
        font-weight: bold;
        margin-bottom: 10px;
        border-bottom: 1px solid;
        padding-bottom: 5px;
      `,
      dragHandle:`
        float: right;
        border: 1px solid #aaa;
        border-radius: 4px;
        background: #F4F4F4;
        font-size: 14px;
        padding: 1px 2px;
        margin-top: -4px;
        cursor: move;
        color: #8578c1;
        width: 22px;
        height: 24px;
      `,
      valueSpan: `
        float: right;
      `,
      divider: `
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid;
      `,
      popupRetry: `
        padding: 4px;
        font-size: 12px;
        text-indent: 11px;
        background: #fffbf2;
        border-top: 1px solid #aaa;
        cursor: pointer;
        user-select: none;
      `
    };

    function createEqualsIcon({ bg = 'transparent', color = '#5f4fac' } = {}) {
      return `
      <svg width="22" height="24" viewBox="0 0 22 24" xmlns="http://www.w3.org/2000/svg">
        <rect width="22" height="24" rx="4" fill="${bg}"/>
        <rect x="3.3" y="6.5" width="16" height="3.3" rx="2" fill="${color}"/>
        <rect x="3.3" y="14" width="16" height="3.3" rx="2" fill="${color}"/>
      </svg>`;
    }

    function createPanelHTML(totalChars, numPages, charsPerPage) {
      return `
        <div id="contentContainer" style="${panelStyles.contentContainer}">
          <div style="${panelStyles.header}">
            <button id="bookmarkBtn" style="${panelStyles.bookmarkBtn}">🔖</button> テキスト情報
            <div id="dragHandle" style="${panelStyles.dragHandle}">${createEqualsIcon()}</div>
          </div>
          <div>
            <strong>総文字数:</strong>
            <span style="${panelStyles.valueSpan}">
              ${totalChars.toLocaleString()}
            </span>
          </div>
          <div>
            <strong>ページ数:</strong>
            <span style="${panelStyles.valueSpan}">
              ${numPages}
            </span>
          </div>
          <div>
            <strong>目標文字数/ページ:　</strong>
            <span style="${panelStyles.valueSpan}">
              ${charsPerPage.toLocaleString()}
            </span>
          </div>
          <div style="${panelStyles.divider}">
            <strong>各ページの文字数</strong>
          </div>
          <div id="partsList" style="${panelStyles.partsList}"></div>
        </div>
        <div id="popupRetry" style="${panelStyles.popupRetry}">
          小説タブを開く
        </div>
      `;
    }

    function createPartInfoHTML(partNumber, charCount) {
      return `
        <strong>ページ${partNumber}:</strong>
        <span style="${panelStyles.valueSpan}">
          ${charCount.toLocaleString()}文字
        </span>
      `;
    }

    // パネル追加
    const textInfoPanel = document.createElement('div');
    textInfoPanel.style.cssText = panelStyles.panel;
    document.body.appendChild(textInfoPanel);

    // ドラッグ関数
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

    /* ここからテキスト処理 */

    function escapeHTML(str) {
      return str.replace(/[&<>"']/g, function (m) {
        return ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[m];
      });
    }

    const ALLOWED_TAGS = new Set(['ruby', 'rt', 'em']);

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

    const SETTING_ITEMS = [
      { key: 'includeTitle',    label: 'タイトル' },
      { key: 'includeAuthor',   label: '作者名' },
      { key: 'includeForeword', label: '作者まえがき' },
      { key: 'includeBody',     label: '小説本文' },
      { key: 'includeAfterword',label: '作者あとがき' },
    ];

    const SETTINGS_KEY = 'tateichigyo_bm_extract';

    function loadSettings() {
      try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      // デフォルト：サイトに存在するセレクタのdefault値を使う
      return Object.fromEntries(SETTING_ITEMS.map(item => {
        const entries = SELECTOR_MAP[item.key] ?? [];
        const matched = entries.find(e => document.querySelector(e.selector));
        return [item.key, matched ? matched.default : true];
      }));
    }

    function saveSettings(settings) {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e) {}
    }

    const SELECTOR_MAP = {
      includeTitle: [
        { selector: '.metadata .title',                default: true  }, // 青空文庫
        { selector: '.p-novel__title',                 default: true  }, // なろう
        { selector: '.widget-episodeTitle',            default: true  }, // カクヨム
        { selector: '.p-novel-episode__episode-title', default: true  }, // アルファポリス
      ],
      includeAuthor: [
        { selector: '.metadata .author',          default: true  }, // 青空文庫
        { selector: '.contentMain-header-author', default: false }, // カクヨム
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
      let h = startHtmlPos;
      let count = 0;
      const state = { skipDepth: 0, rubyDepth: 0 };

      while (h < html.length && count < limit) {
        if (html.charCodeAt(h) === 60) {
          const next = consumeTag(html, h, state);
          if (next === null) break;
          h = next;
          continue;
        }
        if (state.skipDepth === 0) {
          count++;
          if (stopOnDelimiter) {
            const c = html.charCodeAt(h);
            if (
              c === 12288 || // 　
              c === 12290 || // 。
              c === 12301 || // 」
              c === 8230     // …
            ) {
              h++;
              return { htmlPos: advancePastRuby(html, h, state.rubyDepth), visibleCount: count };
            }
          }
        }
        h++;
      }

      // stopOnDelimiter で区切りが見つからなかった場合は元の位置を返す
      if (stopOnDelimiter) {
        return { htmlPos: startHtmlPos, visibleCount: 0 };
      }

      return { htmlPos: advancePastRuby(html, h, state.rubyDepth), visibleCount: count };
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

      let text = parts.join('　');

      text = text.trim()
        .replace(/(\r\n|\r)+/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .replace(/\n/g, '　')
        .replace(/　{2,}/g, '　');

      fullHTML = text;
      totalVisibleChars = scan(fullHTML, 0, Infinity).visibleCount;
      console.log('総文字数:', totalVisibleChars);

      const MAX_PER_PAGE = 10000;
      numPages = Math.ceil(totalVisibleChars / MAX_PER_PAGE);
      charsPerPage = Math.ceil(totalVisibleChars / numPages);
      console.log('ページ数:', numPages);
      console.log('1ページあたりの目標文字数:', charsPerPage);
    }

    function buildPanel() {
      textInfoPanel.innerHTML = createPanelHTML(totalVisibleChars, numPages, charsPerPage);
      const partsList = textInfoPanel.querySelector('#partsList');

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
          const maxExtra = Math.floor(charsPerPage * 0.05);
          const { htmlPos: delimHtmlPos, visibleCount: extra } =
            scan(fullHTML, rawEndHtmlPos, maxExtra, true);
          endHtmlPos = delimHtmlPos;
          actualLen = scanned + extra;
        }

        const { htmlPos: tailHtmlStart } =
          scan(fullHTML, startHtmlPos, Math.max(0, actualLen - 10));

        pageRanges.push({ startHtmlPos, endHtmlPos, tailHtmlStart });
        pageCharCounts.push(actualLen);
        accumulatedChars += actualLen;

        const div = document.createElement('div');
        div.style.cssText = panelStyles.partInfo;
        div.innerHTML = createPartInfoHTML(i + 1, actualLen);
        partsList.appendChild(div);

        console.log(`ページ${i + 1}: ${actualLen}文字`);

        curHtmlPos = endHtmlPos;
      }

      validPageCount = pageCharCounts.filter(count => count > 0).length;

      // 🔖ボタン
      const bookmarkBtn = textInfoPanel.querySelector('#bookmarkBtn');
      bookmarkBtn.addEventListener('click', openSettingsUI);

      // 小説タブを開く
      const popupRetry = textInfoPanel.querySelector('#popupRetry');
      if (popupRetry) {
        popupRetry.addEventListener('click', () => openNovelWindow());
        ['mouseenter', 'mouseleave'].forEach(evtType => {
          popupRetry.addEventListener(evtType, () => {
            popupRetry.style.color = evtType === 'mouseenter' ? '#000' : '#444';
            popupRetry.style.background = evtType === 'mouseenter' ? '#faf6ef' : '#fffbf2';
            popupRetry.style.textDecoration = evtType === 'mouseenter' ? 'underline' : 'none';
          });
        });
      }

      // ドラッグ
      makeDraggable(
        textInfoPanel.querySelector('#dragHandle'),
        textInfoPanel,
        document
      );
    }

    buildText();
    buildPanel();

    function openSettingsUI() {
      // 既に開いていたら閉じる
      const existing = document.getElementById('novelBmSettingsOverlay');
      if (existing) { existing.remove(); return; }

      const current = loadSettings();

      const overlay = document.createElement('div');
      overlay.id = 'novelBmSettingsOverlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgb(40, 40, 40, 0.5)
      `;

      const box = document.createElement('div');
      box.style.cssText = `
        background: #faf6ef;
        border-radius: 8px;
        padding: 20px 24px;
        font-family: 'Hiragino Mincho ProN', serif;
        font-size: 14px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        min-width: 240px;
        color: #000;
      `;

      const title = document.createElement('div');
      title.style.cssText = 'font-weight: bold; margin-bottom: 14px; font-size: 15px; display: flex; align-items: center; gap: 8px;';

      const titleText = document.createTextNode('縦一行に含める内容を選択');
      title.appendChild(titleText);

      const helpBtn = document.createElement('span');
      helpBtn.textContent = '？';
      helpBtn.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1px solid #5f4fac;
        color: #5f4fac;
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
        user-select: none;
        flex-shrink: 0;
      `;

      const helpTooltip = document.createElement('div');
      helpTooltip.textContent = 'この設定は localStorage に保存され、小説サイトごとに適用されます。また、二回目以降の保存は上書き保存されます。';
      helpTooltip.style.cssText = `
        display: none;
        position: absolute;
        background: #fff;
        border: 2px solid #ccc;
        padding: 8px 10px;
        font-size: 16px;
        font-weight: normal;
        color: #333;
        max-width: 225px;
        z-index: 10002;
      `;

      helpBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isVisible = helpTooltip.style.display === 'block';
        helpTooltip.style.display = isVisible ? 'none' : 'block';
      });

      // オーバーレイ背景クリック
      overlay.addEventListener('click', e => {
        if (helpTooltip.style.display === 'block') {
          helpTooltip.style.display = 'none';
          e.preventDefault();
          return;
        }
        if (e.target === overlay) overlay.remove();
      });

      title.style.position = 'relative';
      title.appendChild(helpBtn);
      title.appendChild(helpTooltip);
      box.appendChild(title);

      const checkboxes = {};
      SETTING_ITEMS.forEach(item => {
        const entries = SELECTOR_MAP[item.key] ?? [];
        const supported = entries.length === 0 || entries.some(e => document.querySelector(e.selector));

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'margin-bottom: 10px;';

        const label = document.createElement('label');
        label.style.cssText = `display: flex; align-items: center; gap: 8px; cursor: ${supported ? 'pointer' : 'default'};`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = supported && current[item.key] !== false;
        cb.disabled = !supported;
        cb.style.cssText = `width: 16px; height: 16px; cursor: ${supported ? 'pointer' : 'default'};`;
        checkboxes[item.key] = cb;

        const labelText = document.createElement('span');
        labelText.textContent = item.label;
        labelText.style.cssText = `color: ${supported ? '#000' : '#bbb'};`;

        label.appendChild(cb);
        label.appendChild(labelText);
        wrapper.appendChild(label);

        if (!supported) {
          wrapper.addEventListener('click', () => {
            if (helpTooltip.style.display === 'block') return;
            alert(`現在のページから「${item.label}」を取得できないため、選択できません`);
          });
        }

        box.appendChild(wrapper);
      });

      const saveBtn = document.createElement('button');
      saveBtn.textContent = '保存する';
      saveBtn.style.cssText = `
        margin-top: 8px;
        width: 100%;
        padding: 8px;
        background: #5f4fac;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-family: 'Hiragino Mincho ProN', serif;
        cursor: pointer;
      `;
      saveBtn.addEventListener('mouseenter', () => saveBtn.style.background = '#4a3c8a');
      saveBtn.addEventListener('mouseleave', () => saveBtn.style.background = '#5f4fac');
      saveBtn.addEventListener('click', () => {
        const newSettings = {};
        SETTING_ITEMS.forEach(item => {
          newSettings[item.key] = checkboxes[item.key].checked;
        });
        const anyChecked = Object.values(newSettings).some(v => v);
        if (!anyChecked) {
          saveBtn.textContent = '最低1つ選択してください';
          saveBtn.style.background = '#a94442';
          setTimeout(() => {
            saveBtn.textContent = '保存する';
            saveBtn.style.background = '#5f4fac';
          }, 2000);
          return;
        }
        saveSettings(newSettings);
        overlay.remove();
        buildText();
        buildPanel();
      });

      box.appendChild(saveBtn);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    // 新しいウィンドウを開く関数
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
          font-family: '游明朝', 'Yu Mincho', 'YuMincho', 'Hiragino Mincho Pro', serif;
          font-feature-settings: 'pkna';
          text-shadow: 0 0 0px;
          -moz-osx-font-smoothing: grayscale;
          -webkit-font-smoothing: antialiased;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        #novelDisplay {
          writing-mode: vertical-rl;
          white-space: nowrap;
          letter-spacing: 0.27em;
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
        #yesButton,
        #noButton,
        #jsonCopyBtn,
        #cancelBtn,
        #saveBtn {
          font-family: inherit;
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
          <script src="https://cdn.jsdelivr.net/gh/kuansy373/novel-viewer-bookmarklet@f2c1f7f27088bcbed8d82b031571b50c392c3f0a/js/novel-window.js"></script>
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
    openNovelWindow();
  }
  if (document.readyState !== 'loading') {
    run();
  } else {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
})()
