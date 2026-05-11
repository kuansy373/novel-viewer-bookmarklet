(() => {

  // webページのDOM完成を待って実行
  function run() {

    let text = '';

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

    function extractWithRubyTags(node) {

      let result = '';
      const ALLOWED_TAGS = new Set(['ruby', 'rb', 'rp', 'rt', 'em']);
      const ALLOWED_ATTRS = new Set(['class', 'id', 'lang', 'title', 'dir']);

      function traverse(el) {
        for (const child of el.childNodes) {

          if (child.nodeType === Node.TEXT_NODE) {
            result += escapeHTML(child.textContent);

          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();

            if (ALLOWED_TAGS.has(tagName)) {
              const attrs = Array.from(child.attributes)
                .filter(attr => !/^on/i.test(attr.name))
                .filter(attr => ALLOWED_ATTRS.has(attr.name))
                .map(attr => ` ${attr.name}="${escapeHTML(attr.value)}"`)
                .join('');

              result += `<${tagName}${attrs}>`;
              traverse(child);
              result += `</${tagName}>`;
            } else if (tagName === 'br') {
              result += '\n';
            } else {
              traverse(child);
            }
          }
        }
      }

      traverse(node);
      return result;
    }

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
      text += extractWithRubyTags(node);
    });

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
        padding: 1px 3px;
        margin-top: -4px;
        cursor: move;
        color: #8578c1;
        width: 19px;
        height: 23px;
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

    // 可視文字長を測る
    const measurer = document.createElement('div');
    measurer.style.cssText = 'position:absolute; visibility:hidden; pointer-events:none;';
    document.body.appendChild(measurer);

    measurer.innerHTML = text;
    measurer.querySelectorAll('rt, rp').forEach(el => el.remove());
    const fullText = measurer.textContent;
    const totalVisibleChars = fullText.length;
    console.log('総文字数:', totalVisibleChars);
    measurer.remove();

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

    // ドラッグボタン
    function createEqualsIcon({ bg = 'transparent', color = '#5f4fac' } = {}) {
      return `
      <svg width="100%" height="100%" viewBox="0 0 22 24" xmlns="http://www.w3.org/2000/svg">
        <rect width="22" height="24" rx="4" fill="${bg}"/>
        <rect x="3.3" y="6.5" width="16" height="3.3" rx="2" fill="${color}"/>
        <rect x="3.3" y="14" width="16" height="3.3" rx="2" fill="${color}"/>
      </svg>`;
    }

    // ドラッグ関数
    function makeDraggable(dragHandle, dragTarget, dragDoc) {
      let isDragging = false;
      let offsetX = 0;
      let offsetY = 0;

      dragHandle.addEventListener('mousedown', e => {
        isDragging = true;
        const rect = dragTarget.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        e.preventDefault();
      });

      dragDoc.addEventListener('mousemove', e => {
        if (!isDragging) return;
        dragTarget.style.left = e.clientX - offsetX + 'px';
        dragTarget.style.top  = e.clientY - offsetY + 'px';
        dragTarget.style.right = 'auto';
        dragTarget.style.bottom = 'auto';
      });

      dragDoc.addEventListener('mouseup', () => {
        isDragging = false;
      });

      dragHandle.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const rect = dragTarget.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;
        isDragging = true;
        e.preventDefault();
      });

      dragDoc.addEventListener('touchmove', e => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        dragTarget.style.left = touch.clientX - offsetX + 'px';
        dragTarget.style.top  = touch.clientY - offsetY + 'px';
      }, { passive: false });

      dragDoc.addEventListener('touchend', () => {
        isDragging = false;
      });
    }

    // ドラッグ関数呼び出し
    makeDraggable(
      textInfoPanel.querySelector('#dragHandle'),
      textInfoPanel,
      document
    );

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

    // テキスト全体から可視文字位置と対応するHTML位置のマップを作成
    function buildPositionMap(html) {
      const map = [];
      let htmlPos = 0;
      let visiblePos = 0;
      let rubyDepth = 0;

      // rt / rp の中かどうか
      const skipStack = [];
      let skipVisible = false;

      while (htmlPos < html.length) {
        const ch = html[htmlPos];

        // タグ開始
        if (ch === '<') {
          const tag = parseTag(html, htmlPos);
          if (!tag) break;

          // ruby 深さ管理
          if (tag.name === 'ruby') {
            rubyDepth += tag.isClosing ? -1 : 1;
            rubyDepth = Math.max(0, rubyDepth);
          }

          // rt / rp は可視文字として数えない
          if (tag.name === 'rt' || tag.name === 'rp') {
            if (!tag.isClosing) {
              skipStack.push(tag.name);
              skipVisible = true;
            } else {
              skipStack.pop();
              skipVisible = skipStack.length > 0;
            }
          }

          htmlPos = tag.end + 1;
          continue;
        }

        // テキストノード文字
        if (!skipVisible) {
          map.push({ visiblePos, htmlPos, rubyDepth });
          visiblePos++;
        }

        htmlPos++;
      }

      map.push({ visiblePos, htmlPos: html.length, rubyDepth });
      return map;
    }

    // 可視文字位置からHTML位置を取得
    function getHtmlPos(map, targetVisiblePos) {
      // map は visiblePos 昇順である想定
      let lo = 0, hi = map.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (map[mid].visiblePos < targetVisiblePos) lo = mid + 1;
        else hi = mid;
      }
      return map[lo] ? map[lo].htmlPos : (map.length ? map[map.length - 1].htmlPos : 0);
    }

    const fullHTML = text;

    // タグ内を避ける関数
    function avoidInsideRuby(posMap, visiblePos) {
      while (visiblePos > 0 && posMap[visiblePos]?.rubyDepth > 0) {
        visiblePos--;
      }
      return visiblePos;
    }

    // 各ページを作成する関数
    function createPagePart({
      pageIndex,
      numPages,
      prevEndVisiblePos,
      overlap,
      charsPerPage,
      fullText,
      fullHTML,
      posMap
    }) {
      let startVisiblePos = prevEndVisiblePos;

      if (pageIndex > 0) {
        const rawOverlapStart = Math.max(0, prevEndVisiblePos - overlap);
        startVisiblePos = avoidInsideRuby(posMap, rawOverlapStart);
      }

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

      const partHTML = fullHTML.slice(startHtmlPos, endHtmlPos);

      let part;

      if (pageIndex > 0 && overlap > 0) {
        const overlapEndHtmlPos = getHtmlPos(
          posMap,
          startVisiblePos + overlap
        );

        const overlapLengthInHTML = overlapEndHtmlPos - startHtmlPos;

        const overlapPart = partHTML.slice(0, overlapLengthInHTML);
        const mainPart = partHTML.slice(overlapLengthInHTML);

        part = {
          overlap: [overlapPart],
          main: chunkHTMLSafe(mainPart, 50)
        };
      } else {
        part = {
          overlap: [],
          main: chunkHTMLSafe(partHTML, 50)
        };
      }

      const actualStartPos =
        pageIndex > 0 ? Math.max(0, prevEndVisiblePos - overlap) : 0;

      const actualLen = endVisiblePos - actualStartPos;

      return {
        part,
        endVisiblePos,
        actualLen
      };
    }

    // 位置マップ作成
    const posMap = buildPositionMap(fullHTML);

    // 均等分割でパート作成
    const parts = [];

    let prevEndVisiblePos = 0;  // 前ページの終わり位置を保持
    const overlap = 10;         // 重複させたい文字数
    const pageCharCounts = [];  // 各ページの実際の文字数を保存する配列

    for (let i = 0; i < numPages; i++) {
      const { part, endVisiblePos, actualLen } = createPagePart({
        pageIndex: i,
        numPages,
        prevEndVisiblePos,
        overlap,
        charsPerPage,
        fullText,
        fullHTML,
        posMap
      });

      parts.push(part);
      pageCharCounts.push(actualLen);
      console.log(`ページ${i + 1}: ${actualLen}文字`);

      const partInfo = document.createElement('div');
      partInfo.style.cssText = panelStyles.partInfo;
      partInfo.innerHTML = createPartInfoHTML(i + 1, actualLen);
      partsList.appendChild(partInfo);

      prevEndVisiblePos = endVisiblePos;
    }

    // 有効なページ数を計算
    const validPageCount = pageCharCounts.filter(count => count > 0).length;

    // 新しいウィンドウを開く関数
    function openNovelWindow() {

      const data = {
        totalVisibleChars,
        numPages,
        parts,
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
          </script>
          <script src="https://cdn.jsdelivr.net/gh/kuansy373/novel-viewer-bookmarklet@383dcd3ea518e46da61d1a986e6c10cd844a36b8/js/novel-window.js"></script>
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
