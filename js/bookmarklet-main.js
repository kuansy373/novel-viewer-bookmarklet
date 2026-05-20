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

    const ALLOWED_TAGS = new Set(['ruby', 'rb', 'rp', 'rt', 'em']);
    const ALLOWED_ATTRS = new Set(['class', 'id', 'lang', 'title', 'dir']);

    function extractWithRubyTags(node) {

      const result = [];

      function traverse(el) {
        for (const child of el.childNodes) {

          if (child.nodeType === Node.TEXT_NODE) {
            result.push(escapeHTML(child.textContent));

          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();

            if (ALLOWED_TAGS.has(tagName)) {
              let attrs = '';
              for (const attr of child.attributes) {
                if (/^on/i.test(attr.name)) continue;
                if (!ALLOWED_ATTRS.has(attr.name)) continue;
                attrs += ` ${attr.name}="${escapeHTML(attr.value)}"`;
              }

              result.push(`<${tagName}${attrs}>`);
              traverse(child);
              result.push(`</${tagName}>`);
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

    // カクヨムの傍点
    text = text.replace(/<em class="emphasisDots">([\s\S]*?)<\/em>/gi, (_, content) => {
      const chars = content.replace(/<\/?span>/gi, '');
      return `<ruby><rb>${chars}</rb><rp>（</rp><rt>・・・</rt><rp>）</rp></ruby>`;
    });

    // 改行の処理
    text = text.trim()
      .replace(/(\r\n|\r)+/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/\n/g, '　')
      .replace(/　{2,}/g, '　');

    // HTMLタグ解析関数
    function parseTag(html, start) {
      const end = html.indexOf('>', start + 1);
      if (end === -1) return null;

      const content = html.slice(start + 1, end);
      const isClosing = /^\s*\//.test(content);
      const nameMatch = content.replace(/^\s*\//, '').match(/^([a-zA-Z0-9-]+)/);

      return {
        end,
        name: nameMatch ? nameMatch[1].toLowerCase() : '',
        isClosing
      };
    }

    // テキスト全体から可視文字位置と対応するHTML位置のマップを作成
    function buildPositionMap(html) {

      const capacity = html.length + 1;

      const htmlPosMap = new Uint32Array(capacity);
      const visibleChars = [];

      let visiblePos = 0;

      let htmlPos = 0;
      let skipDepth = 0;

      while (htmlPos < html.length) {

        const ch = html[htmlPos];

        if (ch === '<') {

          const tag = parseTag(html, htmlPos);
          if (!tag) break;

          if (tag.name === 'rt' || tag.name === 'rp') {
            if (!tag.isClosing) skipDepth++;
            else if (skipDepth > 0) skipDepth--;
          }

          htmlPos = tag.end + 1;
          continue;
        }

        if (skipDepth === 0) {
          htmlPosMap[visiblePos] = htmlPos;
          visibleChars.push(ch);
          visiblePos++;
        }

        htmlPos++;
      }

      htmlPosMap[visiblePos] = html.length;

      return {
        htmlPosMap,
        visibleLength: visiblePos,
        visibleText: visibleChars.join('')
      };
    }

    // 可視文字位置からHTML位置を取得
    function getHtmlPos(posMap, visiblePos) {
      return posMap.htmlPosMap[visiblePos];
    }

    const fullHTML = text;

    const posMap = buildPositionMap(fullHTML);
    const totalVisibleChars = posMap.visibleLength;
    const fullText = posMap.visibleText;
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

    // 各ページを作成する関数
    function createPagePart({
      pageIndex,
      numPages,
      prevEndVisiblePos,
      charsPerPage,
      fullText,
      fullHTML,
      posMap
    }) {
      const startVisiblePos = prevEndVisiblePos;
      let endVisiblePos = startVisiblePos + charsPerPage;

      if (pageIndex === numPages - 1) {
        endVisiblePos = fullText.length;
      } else {
        const searchStart = endVisiblePos;
        const searchEnd = Math.min(
          fullText.length,
          // 5%先の範囲で自然な区切り文字
          endVisiblePos + Math.floor(charsPerPage * 0.05)
        );

        let bestPos = endVisiblePos;
        const delimiters = ['　', '。', '」', '…'];

        outer:
        for (const d of delimiters) {
          for (let j = searchStart; j < searchEnd; j++) {
            if (fullText[j] === d) {
              bestPos = j + 1;
              break outer;
            }
          }
        }
        endVisiblePos = bestPos;
      }

      const startHtmlPos = getHtmlPos(posMap, startVisiblePos);
      const endHtmlPos =
        pageIndex === numPages - 1
          ? fullHTML.length
          : getHtmlPos(posMap, endVisiblePos);


      // 末尾10文字のHTMLだけ別途保持（半透明で次ページに追加）
      const tailVisibleStart = Math.max(startVisiblePos, endVisiblePos - 10);
      const tailHtmlStart = getHtmlPos(posMap, tailVisibleStart);

      return {
        startHtmlPos,
        endHtmlPos,
        tailHtmlStart,
        endVisiblePos,
        actualLen: endVisiblePos - startVisiblePos
      };
    }

    // 均等分割でパート作成
    const pageRanges = [];

    let prevEndVisiblePos = 0;  // 前ページの終わり位置を保持
    const pageCharCounts = [];  // 各ページの実際の文字数を保存する配列

    for (let i = 0; i < numPages; i++) {
      const { startHtmlPos, endHtmlPos, tailHtmlStart, endVisiblePos, actualLen } = createPagePart({
        pageIndex: i,
        numPages,
        prevEndVisiblePos,
        charsPerPage,
        fullText,
        fullHTML,
        posMap
      });

      pageRanges.push({ startHtmlPos, endHtmlPos, tailHtmlStart });
      pageCharCounts.push(actualLen);
      console.log(`ページ${i + 1}: ${actualLen}文字`);
      prevEndVisiblePos = endVisiblePos;

      const partInfo = document.createElement('div');
      partInfo.style.cssText = panelStyles.partInfo;
      partInfo.innerHTML = createPartInfoHTML(i + 1, actualLen);
      partsList.appendChild(partInfo);
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

      const safeJson = JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');

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
          contain-intrinsic-size: 1000px;
          will-change: scroll-position;
          transform: translateZ(0);
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
          window.__NOVEL_DATA__ = ${safeJson};
          window.createEqualsIcon = ${createEqualsIcon.toString()};
          window.makeDraggable = ${makeDraggable.toString()};
          window.parseTag = ${parseTag.toString()};
          </script>
          <script src="https://cdn.jsdelivr.net/gh/kuansy373/novel-viewer-bookmarklet@c4e18a1e9bfcf338c170bc15237ea20e047c524b/js/novel-window.js"></script>
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
