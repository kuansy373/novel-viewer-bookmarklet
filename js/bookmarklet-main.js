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
      infoRow: `
        overflow: hidden;
        margin-bottom: 3px;
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
            🔖 テキスト情報
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

    const textParts = [];

    document.querySelectorAll(
      // 青空文庫
      'body > h1, ' +
      'body > h2, ' +
      'body > h3, ' +
      '.metadata, ' +
      '.main_text, ' +
      // 小説家になろう
      '.p-novel__title, ' +
      '.p-novel__text, ' +
      // カクヨム
      '.widget-episodeTitle, ' +
      '.widget-episodeBody p, ' +
      // アルファポリス
      '.novel-title, ' +
      '.novel-body p, ' +
      '.chapter-title, ' +
      '.episode-title, ' +
      '#novelBody'
    )
    .forEach(node => {
      textParts.push(extractWithRubyTags(node));
    });

    let text = textParts.join('');
    textParts.length = 0;

    // 改行の処理
    text = text.trim()
      .replace(/(\r\n|\r)+/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/\n/g, '　')
      .replace(/　{2,}/g, '　');

    const fullHTML = text;

    // 60= '<', 62='>', 47='/', 32=' '

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

    // 全文の可視文字数
    const totalVisibleChars = scan(fullHTML, 0, Infinity).visibleCount;
    console.log('総文字数:', totalVisibleChars);

    // 1ページあたりの上限文字数
    const MAX_PER_PAGE = 10000;

    // 必要なページ数を計算
    const numPages = Math.ceil(totalVisibleChars / MAX_PER_PAGE);
    const charsPerPage = Math.ceil(totalVisibleChars / numPages);
    console.log('ページ数:', numPages);
    console.log('1ページあたりの目標文字数:', charsPerPage);

    // パネル作成
    textInfoPanel.innerHTML = createPanelHTML(totalVisibleChars, numPages, charsPerPage);
    const partsList = textInfoPanel.querySelector('#partsList');

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

    // ドラッグ関数呼び出し
    makeDraggable(
      textInfoPanel.querySelector('#dragHandle'),
      textInfoPanel,
      document
    );

    // ページ分割ループ（逐次スキャン）
    const pageRanges = [];
    const pageCharCounts = [];
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
        // charsPerPage 文字分スキャン
        const { htmlPos: rawEndHtmlPos, visibleCount: scanned } =
          scan(fullHTML, startHtmlPos, charsPerPage);

        // 区切り文字まで最大5%延長（1回のスキャンで完結）
        const maxExtra = Math.floor(charsPerPage * 0.05);
        const { htmlPos: delimHtmlPos, visibleCount: extra } =
          scan(fullHTML, rawEndHtmlPos, maxExtra, true);

        endHtmlPos = delimHtmlPos;
        actualLen = scanned + extra;
      }

      // tailHtmlStart：このページの末尾10可視文字のHTML開始位置
      const { htmlPos: tailHtmlStart } =
        scan(fullHTML, startHtmlPos, Math.max(0, actualLen - 10));

      pageRanges.push({ startHtmlPos, endHtmlPos, tailHtmlStart });
      pageCharCounts.push(actualLen);
      accumulatedChars += actualLen;

      // パネルのページ一覧に追加
      const div = document.createElement('div');
      div.style.cssText = panelStyles.partInfo;
      div.innerHTML = createPartInfoHTML(i + 1, actualLen);
      partsList.appendChild(div);

      console.log(`ページ${i + 1}: ${actualLen}文字`);

      curHtmlPos = endHtmlPos;
    }

    // 有効なページ数を計算
    const validPageCount = pageCharCounts.filter(count => count > 0).length;

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
