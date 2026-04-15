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
        margin-top: -3px;
        cursor: move;
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
            <div id="dragHandle" style="${panelStyles.dragHandle}">🟰</div>
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
    
    // 可視文字長を測るための要素
    const measurer = document.createElement('div');
    measurer.style.cssText = 'position:absolute; visibility:hidden; pointer-events:none;';
    document.body.appendChild(measurer);
    
    // HTMLから可視文字数を取得
    measurer.innerHTML = text;
    measurer.querySelectorAll('rt, rp').forEach(el => el.remove());
    const fullText = measurer.textContent;
    const totalVisibleChars = fullText.length;
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
          if (semi !== -1 && semi - i <= 10) {
            i = semi + 1;
            count++;
            if (count >= chunkSize && rubyDepth === 0) {
              chunks.push(html.slice(last, i));
              last = i;
              count = 0;
            }
            continue;
          }
        }
    
        count++;
        i++;
    
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
    
    measurer.remove();
  
    // ページが有効かチェックする関数
    function isValidPage(pageIndex) {
      return pageIndex >= 0 && 
             pageIndex < parts.length && 
             pageCharCounts[pageIndex] > 0;
    }
  
    // 有効なページ数を計算
    const validPageCount = pageCharCounts.filter(count => count > 0).length;
    
    // 新しいウィンドウを開く関数
    function openNovelWindow() {
      const html = `<!DOCTYPE html>
      <html lang="ja" style="scrollbar-width: thin;">
      <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
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
        letter-spacing: 0.25em;
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
      </body>
      </html>`;

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      const win = window.open(url, '_blank');
      if (!win) return;
      
      win.addEventListener('load', () => {
        try { URL.revokeObjectURL(url); } catch (e) {}
        
        const doc = win.document;
        
        // データを新しいウィンドウに渡す
        win.parts = parts;
        win.pageCharCounts = pageCharCounts;
        
        // レンダリング関数
        win.renderPart = function(pageIndex) {
          const container = doc.getElementById('novelDisplay');
          container.innerHTML = '';
          const frag = doc.createDocumentFragment();
          const page = win.parts[pageIndex] || { overlap: [], main: [] };
          
          for (const chunkHTML of page.overlap) {
            const span = doc.createElement('span');
            span.style.opacity = '0.5';
            span.innerHTML = chunkHTML;
            frag.appendChild(span);
          }
          
          for (const chunkHTML of page.main) {
            const span = doc.createElement('span');
            span.innerHTML = chunkHTML;
            frag.appendChild(span);
          }
          
          container.appendChild(frag);
        };
      
        // 初期表示
        win.renderPart(0);

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
            width: 30px;
            padding: 8px;
            font-size: 18px;
            border: 2px solid hsl(from currentColor h s l / 0.7);
            border-radius: 5px;
          `;
          
          const pageLabel = doc.createElement('span');
          pageLabel.textContent = 'ページ目に移動しますか？';
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
          
          const yesButton = doc.createElement('button');
          yesButton.textContent = 'はい';
          yesButton.id = 'yesButton';
          yesButton.style.cssText = `
            padding: 10px 30px;
            font-size: 16px;
            background: rgb(120,120,120,0.3);
            color: unset;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          `;
          
          const noButton = doc.createElement('button');
          noButton.textContent = 'いいえ';
          noButton.id = 'noButton';
          noButton.style.cssText = `
            padding: 10px 30px;
            font-size: 16px;
            background: rgba(120, 120, 120, 0.3);
            color: unset;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          `;
          
          buttonContainer.appendChild(yesButton);
          buttonContainer.appendChild(noButton);
          dialog.appendChild(message);
          dialog.appendChild(inputContainer);
          dialog.appendChild(buttonContainer);
          overlay.appendChild(dialog);
          doc.body.appendChild(overlay);
          
          return { overlay, message, pageInput, yesButton, noButton };
        }
        
        const overlayElements = createOverlay();

        // オーバーレイ表示関数
        function showOverlay(defaultPage, maxPage, onYes) {
          overlayElements.message.textContent = '';
          overlayElements.pageInput.value = defaultPage;
          overlayElements.pageInput.max = maxPage;
          disableBodyScroll();
          overlayElements.overlay.style.display = 'flex';
          
          // はい
          const handleYes = () => {
            const targetPage = parseInt(overlayElements.pageInput.value);
            const targetIndex = targetPage - 1;
            
            // 範囲チェックを先に実行
            if (targetPage < 1 || targetPage > maxPage) {
              win.alert(`1から${maxPage}の範囲で入力してください。`);
            } else if (!isValidPage(targetIndex)) {
              // 範囲内だが無効なページ
              win.alert(`1から${maxPage}の範囲で入力してください。\nページ${targetPage}は無効なページです。`);
            } else {
              // 有効なページへ移動
              overlayElements.overlay.style.display = 'none';
              enableBodyScroll();
              cleanup();
              onYes(targetPage);
              resetScrollSliders();
            }
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
            overlayElements.yesButton.removeEventListener('click', handleYes);
            overlayElements.noButton.removeEventListener('click', handleNo);
            overlayElements.overlay.removeEventListener('click', handleOverlayClick);
          };
      
          // イベントリスナー追加
          overlayElements.yesButton.addEventListener('click', handleYes);
          overlayElements.noButton.addEventListener('click', handleNo);
          overlayElements.overlay.addEventListener('click', handleOverlayClick);
        }
        
        // 初回表示
        let currentIndex = 0;
        win.renderPart(currentIndex);
        
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
            currentIndex < parts.length - 1 &&
            promptShownForward &&
            isValidPage(currentIndex + 1)
          ) {
            const nextPage = currentIndex + 2;
            showOverlay(nextPage, numPages, (targetPage) => {
              isSwitching = true;
              currentIndex = targetPage - 1;
              win.renderPart(currentIndex);
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
              win.renderPart(currentIndex);
              win.requestAnimationFrame(() => {
                if (currentIndex === parts.length - 1) {
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
        }
        
        function disableBodyScroll() {
          doc.body.style.overflow = 'hidden';
          doc.documentElement.style.overflow = 'hidden';
        }
        
        function enableBodyScroll() {
          doc.body.style.overflow = '';
          doc.documentElement.style.overflow = '';
        }
        
        // スライダー作成関数
        function createSlider(position, additionalStyle = {}) {
          const slider = doc.createElement('input');
          slider.type = 'range';
          slider.min = 0;
          slider.max = 25;
          slider.value = 0;
          Object.assign(slider.style, {
            appearance: 'none',
            border: 'none',
            position: 'fixed',
            height: '210vh',
            bottom: '-108vh',
            zIndex: '9999',
            width: '80px',
            opacity: '1',
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
        let lastTimestamp = null;
        
        function forceScroll(timestamp) {
          if (lastTimestamp !== null && scrollSpeed !== 0) {
            const elapsed = timestamp - lastTimestamp;
            scroller.scrollTop += (scrollSpeed * elapsed) / 1000;
          }
          lastTimestamp = timestamp;
          win.requestAnimationFrame(forceScroll);
        }
        
        // スライダー入力に応じてスクロール速度を変更
        function syncScrollSpeed(value) {
          scrollSpeed = parseInt(value, 10) * speedScale;
        }
        
        // 両方のスライダーの値を同期
        [scrollSliderRight, scrollSliderLeft].forEach(slider => {
          slider.addEventListener('input', () => {
            syncScrollSpeed(slider.value);
            scrollSliderRight.value = slider.value;
            scrollSliderLeft.value = slider.value;
          });
        });
        
        win.requestAnimationFrame(forceScroll);

        // タブまたはウィンドウの非アクティブでスライダー値リセット
        doc.addEventListener('visibilitychange', () => {
        if (doc.hidden) resetScrollSliders();
        });

        win.addEventListener('blur', resetScrollSliders);
          
        // ==============================
        // Slider Settings
        // ==============================
      
        const scrollUI = doc.createElement('div');
        Object.assign(scrollUI.style, {
          position: 'fixed',
          top: '10px',
          left: '10px',
          padding: '8px',
          background: 'inherit',
          border: '1px solid',
          borderRadius: '4px',
          fontSize: '14px',
          zIndex: '10007',
          fontFamily: 'sans-serif',
        });
        scrollUI.innerHTML = `
          <div style="font-weight:bold;">< Slider Settings ></div>
          <label><input id="scrollB" class="settingCheckbox" type="checkbox"><span class="labelText"> Border</span></label><br>
          <label><input id="scrollC" class="settingCheckbox" type="checkbox"><span class="labelText"> Color in</span></label><br>
          <label>Shadow: <input id="scrollS" class="settingInputbox" type="number" value="0"> px</label><br>
          <label>Opacity: <input id="scrollO" class="settingInputbox" type="text" inputmode="decimal" min="0" max="1" step="0.05" value="1"> (0~1)</label><br>
          <label><input id="scrollRight" class="settingCheckbox" type="checkbox" checked><span class="labelText"> Right side</span></label><br>
          <label><input id="scrollLeft" class="settingCheckbox" type="checkbox"><span class="labelText"> Left side</span></label><br>
          <label>Position: <input id="scrollX" class="settingInputbox" type="number" value="30"> px</label><br>
          <label>Width: <input id="scrollW" class="settingInputbox" type="number" value="80"> px</label><br>
          <label>Speed scale: <input id="scrollSpeedScale" class="settingInputbox" type="number" min="0" max="20" step="1" value="10"> (0~20)</label><br>
          <label><input id="scrollHide" class="settingCheckbox" type="checkbox"><span class="labelText"> Slider ball</span></label><br>
        `;
        doc.body.appendChild(scrollUI);
        doc.querySelectorAll('.settingCheckbox').forEach(cb => {
          Object.assign(cb.style, {
            height: '15px',
            width: '15px',
            verticalAlign: 'middle',
            userSelect: 'none',
          });
        });
        doc.querySelectorAll('.settingInputbox').forEach(cb => {
          Object.assign(cb.style, {
            width: '60px',
            border: '1px solid',
            color: 'unset',
          });
        });
        doc.querySelectorAll('.labelText').forEach(span => {
          Object.assign(span.style, {
            position: 'fixed',
            paddingTop: '1.5px',
          });
        });
        
        // === イベント ===
        // 共通のスタイル適用関数
        const applyToSliders = (fn) => {
          fn(scrollSliderRight);
          fn(scrollSliderLeft);
        };
        
        // Border & Color
        ['scrollB', 'scrollC'].forEach((id, i) => {
          const el = doc.getElementById(id);
          el.addEventListener('change', e => {
            if (e.target.checked) {
              const otherId = i ? 'scrollB' : 'scrollC';
              const otherEl = doc.getElementById(otherId);
              otherEl.checked = false;
              applyToSliders(sl => {
                sl.style.border = id === 'scrollB' ? '1px solid currentColor' : 'none';
                sl.style.setProperty("background", id === 'scrollC' ? "currentColor" : "transparent", "important");
              });
            } else {
              applyToSliders(sl => {
                sl.style.border = 'none';
                sl.style.setProperty("background", "transparent", "important");
              });
            }
          });
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
        let lastValue = opacityInput.value;
        
        opacityInput.addEventListener('input', e => {
          if (e.target.value === '0' && lastValue !== '0.') {
            e.target.value = '0.';
          }
          const num = parseFloat(e.target.value);
          if (!isNaN(num) && num >= 0 && num <= 1) {
            applyToSliders(el => el.style.opacity = num);
          }
          lastValue = e.target.value;
        });
        
        opacityInput.addEventListener('focus', e => {
          if (e.target.value === '0') e.target.value = '0.';
        });
        
        opacityInput.addEventListener('blur', e => {
          if (e.target.value === '0.' || e.target.value === '') {
            e.target.value = '0';
            applyToSliders(el => el.style.opacity = 0);
          }
        });
        
        // Right/Left
        const rightbox = doc.getElementById('scrollRight');
        const leftbox = doc.getElementById('scrollLeft');
        
        function updateDisplay() {
          scrollSliderRight.style.display = rightbox.checked ? 'block' : 'none';
          scrollSliderLeft.style.display = leftbox.checked ? 'block' : 'none';
        }
        
        rightbox.checked = true;
        updateDisplay();
        
        [rightbox, leftbox].forEach(box => {
          box.addEventListener('change', updateDisplay);
        });
        
        // Position & Width
        setupXWInput('scrollX', val => applyToSliders(el => {
          el.style[el === scrollSliderRight ? 'right' : 'left'] = `${val}px`;
        }));
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
        
        speedScaleInput.addEventListener('input', e => {
          let num = parseFloat(e.target.value);
          if (!isNaN(num)) {
            num = Math.max(0, Math.min(20, num));
            if (num !== parseFloat(e.target.value)) e.target.value = num;
            speedScale = num;
            syncScrollSpeed(scrollSliderRight.value);
          }
        });
        
        speedScaleInput.addEventListener('blur', e => {
          if (e.target.value === '') {
            e.target.value = '0';
            speedScale = 0;
            syncScrollSpeed(scrollSliderRight.value);
          }
        });
        
        // Slider ball 
        doc.getElementById('scrollHide').addEventListener('change', e => {
          const [height, bottom] = e.target.checked ? ['200vh', '-98vh'] : ['210vh', '-108vh'];
          applyToSliders(el => {
            el.style.height = height;
            el.style.bottom = bottom;
          });
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
          padding: '0px 5px 5px 0px',
          top: '10px',
          left: '18px',
          zIndex: '10006',
        });
        doc.body.appendChild(sUIOpenBtn);
        
        scrollUI.style.display = 'none';
        sUIOpenBtn.addEventListener('click', () => {
          scrollUI.style.display = 'block';
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
        const decreaseBtn = doc.createElement('button');
        decreaseBtn.id = 'sliderDecrease';
        decreaseBtn.textContent = '◀';
        Object.assign(decreaseBtn.style, {
          position: 'absolute',
          left: '135px',
          fontSize: '15px',
          padding: '0 6px',
          marginBottom:'3px',
          borderRadius: '4px',
          border: '1px solid',
          cursor: 'pointer'
        });
      
        const increaseBtn = doc.createElement('button');
        increaseBtn.id = 'sliderIncrease';
        increaseBtn.textContent = '▶';
        Object.assign(increaseBtn.style, {
          position: 'absolute',
          left: '255px',
          fontSize: '15px',
          padding: '0 6px',
          marginBottom:'3px',
          borderRadius: '4px',
          border: '1px solid',
          cursor: 'pointer'
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
          padding: '0px 0px 5px 5px',
          top: '10px',
          right: '18px',
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
        let applyStyle;
        let colorState;
        let updateContrast;
        let updateColorHexDisplays;

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
              background: unset;
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
              padding-bottom: 2px;
              padding-left: 0.3px;
              margin-right: 20px;
              background: #F4F4F4;
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
              <div id="dragHandle" class="hex-load-btn">🟰</div>
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
          makeDraggable(
            doc.getElementById('dragHandle'),
            doc.getElementById('pickrContainer'),
            doc
          );
      
          // bodyの色を取得しrgbをHex変換する関数
          const getHex = (prop) => {
            const rgb = getComputedStyle(doc.body)[prop];
            return rgbToHex(rgb);
          };
      
          // applyStyle関数
          applyStyle = function (prop, value) {
            if (!value) return;
      
            // scrollbar-color
            if (prop === 'scrollbar-color') {
              let el = doc.getElementById('__scrollbarOverride');
              if (!el) {
                el = doc.createElement('style');
                el.id = '__scrollbarOverride';
                doc.head.appendChild(el);
              }
              el.textContent = `
              * {
                scrollbar-color: ${value};
              }`;
      
              return;
            }
      
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
      
            updateScrollbarColor();
          };
          
          // scrollbar-colorを更新する関数
          const updateScrollbarColor = () => {
            let scrollbarEl = doc.getElementById('__scrollbarOverride');
            if (!scrollbarEl) {
              scrollbarEl = doc.createElement('style');
              scrollbarEl.id = '__scrollbarOverride';
              doc.head.appendChild(scrollbarEl);
            }
            scrollbarEl.textContent = `
            * {
              scrollbar-color: ${colorState.currentFg} ${colorState.currentBg};
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
          
          // pcr-appドラッグ用グローバル変数を追加
          let globalDragStyle = null;
          let globalDragRuleIndex = null;
          
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
            
            pickr.on('init', instance => {
              win.setTimeout(() => {
                doc.querySelectorAll('.pcr-app').forEach(app => {
                  // pcr-appドラッグボタン追加
                  if (!app.querySelector('.pcr-drag-handle')) {
                    const saveBtn = app.querySelector('.pcr-save');
                    if (saveBtn) {
                      const dragBtn = doc.createElement('button');
                      dragBtn.textContent = '🟰';
                      dragBtn.className = 'pcr-drag-handle';
                      dragBtn.style.cssText = `
                        margin: 0px !important;
                        cursor: move;
                        font-size: 16px;
                        padding: 0px 4px 3px;
                        border: 1px solid #aaa;
                        border-radius: 4px;
                        background: #F4F4F4;
                        height: 25px;
                      `;
                      saveBtn.insertAdjacentElement('afterend', dragBtn);
            
                      // ドラッグ処理
                      let isDragging = false, offsetX = 0, offsetY = 0;
            
                      // グローバルなドラッグ用CSSルールを使う
                      function applyDragCss(left, top) {
                        if (!globalDragStyle) {
                          globalDragStyle = doc.createElement('style');
                          globalDragStyle.setAttribute('data-pcr-drag', '1');
                          doc.head.appendChild(globalDragStyle);
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
                      doc.addEventListener('mousemove', e => {
                        if (!isDragging) return;
                        applyDragCss(e.clientX - offsetX, e.clientY - offsetY);
                      });
                      doc.addEventListener('mouseup', () => {
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
                      doc.addEventListener('touchmove', e => {
                        if (!isDragging || e.touches.length !== 1) return;
                        const touch = e.touches[0];
                        applyDragCss(touch.clientX - offsetX, touch.clientY - offsetY);
                      }, { passive: false });
                      doc.addEventListener('touchend', () => {
                        if (isDragging) {
                          isDragging = false;
                        }
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
                      hexCopyBtn.style.cssText = `
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
                      `;
                      resultInput.insertAdjacentElement('afterend', hexCopyBtn);
                      
                      hexCopyBtn.addEventListener("click", function(){
                        if (resultInput && resultInput.value !== "-") {
                          win.navigator.clipboard.writeText(resultInput.value).then(function(){
                            hexCopyBtn.textContent = "Copied!";
                            win.setTimeout(function(){ hexCopyBtn.textContent = "Copy"; }, 1500);
                          }).catch(function(err){
                            win.console.error("コピーに失敗しました:", err);
                          });
                        }
                      });
                    }
                  }
                });
              }, 0);
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
              updateLockIcons();
              if (isFg) win.__fgHSL = hexToHSL(hex);
              else win.__bgHSL = hexToHSL(hex);
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
                applyStyle('background-color', color);
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
              applyStyle('color', color);
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
            const contrastMin = parseFloat(doc.getElementById("contrastMin").value) || 1;
            const contrastMax = parseFloat(doc.getElementById("contrastMax").value) || 21;
            let trials = 0;
            const maxTrials = 300;

            // HSLオブジェクトが不正な場合は初期化
            if (!win.__bgHSL || typeof win.__bgHSL.h !== 'number' || typeof win.__bgHSL.s !== 'number' || typeof win.__bgHSL.l !== 'number') {
              win.__bgHSL = hexToHSL(colorState.currentBg);
            }
            if (!win.__fgHSL || typeof win.__fgHSL.h !== 'number' || typeof win.__fgHSL.s !== 'number' || typeof win.__fgHSL.l !== 'number') {
              win.__fgHSL = hexToHSL(colorState.currentFg);
            }
            while (trials < maxTrials) {
              trials++;
              if (!bgLocked) {
                win.__bgHSL = getRandomHSL()
              }
              if (!fgLocked) {
                win.__fgHSL = getRandomHSL()
              }
              const bgHex = hslToHex(win.__bgHSL.h, win.__bgHSL.s, win.__bgHSL.l);
              const fgHex = hslToHex(win.__fgHSL.h, win.__fgHSL.s, win.__fgHSL.l);
              const ratio = parseFloat(getContrast(fgHex, bgHex));
              if (ratio >= contrastMin && ratio <= contrastMax) {
                if (!bgLocked) {
                  colorState.currentBg = bgHex;
                  colorState.savedBg = bgHex;
                }
                if (!fgLocked) {
                  colorState.currentFg = fgHex;
                  colorState.savedFg = fgHex;
                }
                
                applyStyle("background-color", colorState.savedBg);
                applyStyle("color", colorState.savedFg);
                updateSwatch(doc.getElementById("bgSwatch"), colorState.currentBg, colorState.currentBg);
                updateSwatch(doc.getElementById("fgSwatch"), colorState.currentFg, colorState.currentFg);
                updateColorHexDisplays();
                updateContrast();
                updateLockIcons();
                return;
              }
            }
            win.alert("指定されたコントラスト範囲に合うランダム色の組み合わせが見つかりませんでした")
          }
          doc.getElementById("randomColorBtn").onclick = changeColors;
          doc.getElementById("swapColorsBtn").onclick = () => {
            
            // ロック状態を無視してスワップ
            [colorState.currentFg, colorState.currentBg] = [colorState.currentBg, colorState.currentFg];
            [colorState.savedFg, colorState.savedBg] = [colorState.savedBg, colorState.savedFg];

            applyStyle("color", colorState.currentFg);
            applyStyle("background-color", colorState.currentBg);
            updateSwatch(doc.getElementById("bgSwatch"), colorState.currentBg, colorState.savedBg);
            updateSwatch(doc.getElementById("fgSwatch"), colorState.currentFg, colorState.savedFg);
            updateColorHexDisplays();
            updateContrast();
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
              padding: '5px 0px 5px 5px',
              top: '75px',
              right: '18px',
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
          
          doc.querySelectorAll(".copy-btn").forEach(function(button){
            button.addEventListener("click", function(){
              var targetId = button.getAttribute("data-target");
              var targetInput = doc.getElementById(targetId);
              if (targetInput && targetInput.value !== "-") {
                win.navigator.clipboard.writeText(targetInput.value).then(function(){
                  button.textContent = "Copied!";
                  win.setTimeout(function(){ button.textContent = "Copy"; }, 1500);
                }).catch(function(err){
                  console.error("コピーに失敗しました:", err);
                });
              }
            });
          });
        }).catch((err) => {
          win.alert("Pickr の読み込みに失敗しました。CSP によってブロックされている可能性があります。");
          console.error("Pickr load error:", err);
        });

        // ==関数==
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
      
        // ==============================
        // JSONで各値を保存/反映
        // ==============================

        const onetapUI = doc.createElement('div');
        Object.assign(onetapUI.style, {
          position: 'fixed',
          top: '80px',
          left: '10px',
          padding: '8px',
          border: '1px solid',
          borderRadius: '4px',
          fontSize: '14px',
          background: 'inherit',
          zIndex: '10001',
          fontFamily: 'sans-serif',
          display: 'none',
        });

        // ボタンセットを生成
        const buttonSets = Array.from({ length: 8 }, (_, i) => 
          `<div class="button-set">
            <span class="label">${i + 1}.</span>
            <button id="saveBtn${i + 1}" class="button">SAVE</button>
            <span class="label">⇒</span>
            <button id="applyBtn${i + 1}" class="button">APPLY</button>
          </div>`
        ).join('');

        onetapUI.innerHTML = `
          <div style="font-weight:bold; margin-bottom:10px;">Apply Style with One Tap</div>
          <div class="ui-buttons">
            <div class="button-set">
              <input id="jsonInput" class="json-input" placeholder="個別のJSONを貼り付け" />
              <span class="label">⇒</span>
              <button id="applyJsonBtn" class="button">APPLY</button>
            </div>
            <div class="button-set">
              <input id="bulkJsonInput" class="json-input" placeholder="複数のJSONを貼り付け" />
              <span class="label">⇒</span>
              <button id="bulkSaveBtn" class="button">SAVE</button>
            </div>
            ${buttonSets}
            <div class="button-set">
              <button id="viewAllJsonBtn" class="button">保存済みのすべてのJSONを表示</button>
            </div>
          </div>
        `;

        // ボタン群のスタイル
        const buttonsContainer = onetapUI.querySelector('.ui-buttons');
        Object.assign(buttonsContainer.style, {
          display: 'flex',
          flexDirection: 'column',
          marginLeft: '5px',
          gap: '9px',
          fontSize: '14px',
        });

        // ボタンのスタイル
        const buttons = onetapUI.querySelectorAll('.button');
        buttons.forEach(btn => {
          Object.assign(btn.style, {
            fontSize: '14px',
            color: 'unset',
            padding: '2px 4px',
            border: '1px solid',
          });
        });

        // JSON入力欄のスタイル
        const jsonInputs = onetapUI.querySelectorAll('.json-input');
        jsonInputs.forEach(input => {
          Object.assign(input.style, {
            fontSize: '12px',
            padding: '4px',
            border: '1px solid',
            borderRadius: '2px',
            width: '130px',
            fontFamily: 'monospace',
          });
        });

        const jsonStyle  = doc.createElement('style');
        jsonStyle.textContent = `
          #jsonInput::placeholder,
          #bulkJsonInput::placeholder {
            color: unset;
            opacity: 0.7;
          }
        `;
        doc.head.appendChild(jsonStyle);

        // 数字、矢印のスタイル
        const labels = onetapUI.querySelectorAll('.label');
        labels.forEach(span => {
          Object.assign(span.style, {
            color: 'inherit',
            background: 'inherit',
            fontSize: '14px',
          });
        });

        // 開くボタン ☆
        const oUIOpenBtn = doc.createElement('div');
        oUIOpenBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24">
            <polygon points="12,2 15,10 23,10 17,15 19,23 12,18 5,23 7,15 1,10 9,10" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        `;
        Object.assign(oUIOpenBtn.style, baseOpenBtnStyle, {
          padding: '5px 5px 5px 0px',
          top: '75px',
          left: '18px',
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

        // ボタンごとのイベント登録
        for (let i = 1; i <= 8; i++) {
          doc.getElementById(`saveBtn${i}`).onclick = () => saveStyle(`Style${i}`);
          doc.getElementById(`applyBtn${i}`).onclick = () => applyStyleByName(`Style${i}`);
        }

        // 保存されたスタイルを保持するローカル変数
        const savedStyles = {};

        // APPLYボタンに保存済みスタイルの色を反映
        function updateApplyBtnColor(name) {
          const num = name.replace('Style', '');
          const data = savedStyles[name];
          const btn = doc.getElementById(`applyBtn${num}`);
          if (!btn || !data) return;
          if (data.color) btn.style.color = data.color;
          if (data.backgroundColor) btn.style.backgroundColor = data.backgroundColor;
        }

        // ページ読み込み時に全APPLYボタンを初期化
        function initApplyButtonStyle() {
          for (let i = 1; i <= 8; i++) {
            updateApplyBtnColor(`Style${i}`);
          }
        }
        initApplyButtonStyle();

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
          const scrollSettings = (() => {
            const map = {
              border:       ['scrollB', 'checked'],
              colorIn:      ['scrollC', 'checked'],
              shadow:       ['scrollS', 'value',   Number],
              right:        ['scrollRight', 'checked'],
              left:         ['scrollLeft', 'checked'],
              position:     ['scrollX', 'value',   Number],
              width:        ['scrollW', 'value',   Number],
              opacity:      ['scrollO', 'value',   parseFloat],
              speedScale:   ['scrollSpeedScale', 'value', parseFloat],
              hideBall:     ['scrollHide', 'checked']
            };
            const result = {};
            for (const key in map) {
              const [id, prop, parser] = map[key];
              const el = doc.getElementById(id);
              if (!el) {
                result[key] = null;
                continue;
              }
              const raw = el[prop];
              result[key] = parser ? parser(raw) : raw;
            }
            return result;
          })();

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
          
          win.alert(`☆ 保存しました！`);
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
              max-height: 50vh;
              overflow-y: auto;
              overscroll-behavior: contain;
              scrollbar-width: thin;
              z-index: 10008
            `;
            
            // タイトル
            const title = doc.createElement('h3');
            title.textContent = `☆ ${name} に保存しますか？`;
            title.id = 'title';
            title.style.cssText = `
              margin: 0 0 16px 0;
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
                const validationResult = validateAndParseJSON(preview.textContent);
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
              preview.contentEditable = editing ? 'true' : 'false';
              preview.style.border = editing ? 'none' : '1px solid';
              preview.style.outline = editing ? '3px dashed' : 'none';

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
              padding: 6px 12px;
              color: unset;
              border: 1px solid currentColor;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            `;
            
            jsonCopyBtn.onclick = async () => {
              if (jsonCopyBtn.disabled) return;
              try {
                jsonCopyBtn.disabled = true;
                const textToCopy = preview.textContent;
                await win.navigator.clipboard.writeText(textToCopy);
                jsonCopyBtn.textContent = 'コピー完了!';
                win.setTimeout(() => {
                  jsonCopyBtn.textContent = 'コピー';
                  jsonCopyBtn.disabled = false;
                }, 1500);
              } catch (err) {
                jsonCopyBtn.disabled = false;
                win.alert('コピーに失敗しました: ' + err);
              }
            };
            
            topContainer.appendChild(prettyCheckbox);
            topContainer.appendChild(prettyLabel);
            topContainer.appendChild(jsonEditBtn);
            topContainer.appendChild(jsonCopyBtn);
            
            // プレビューコンテナ
            const previewContainer = doc.createElement('div');
            previewContainer.style.cssText = `
              position: relative;
              margin: 0 0 20px 0;
            `;
            
            // プレビュー内容
            const preview = doc.createElement('pre');
            preview.style.cssText = `
              padding: 12px;
              border: 1px solid currentColor;
              border-radius: 4px;
              overflow-x: auto;
              font-size: 12px;
              margin: 0;
              white-space: nowrap;
              scrollbar-width: thin;
            `;

            // 編集後のcurrentDataからプレビュー内容を再生成する関数
            const updatePreviewText = () => {
              const jsonTextFormatted = JSON.stringify(currentData, null, 2);
              const jsonTextCompressed = JSON.stringify(currentData);
              if (prettyCheckbox.checked) {
                preview.textContent = jsonTextFormatted;
                preview.style.whiteSpace = 'pre-wrap';
              } else {
                preview.textContent = jsonTextCompressed;
                preview.style.whiteSpace = 'nowrap';
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
            'border',
            'colorIn',
            'shadow',
            'right',
            'left',
            'position',
            'width',
            'opacity',
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
          const hasAnyNonStyleKey = keys.some(k => !/^Style\d+$/.test(k));

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

        // JSONの検証ロジックを共通化
        function validateAndParseJSON(jsonText, allowEmpty = false) {
          if (!jsonText) {
            if (allowEmpty) {
              return { data: null };
            }
            return { error: 'JSONデータを入力してください' };
          }

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
          const jsonText = bulkJsonInput.value.trim();

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
            const msg = `${existingKeys.join(', ')} はすでに存在します。上書きしますか？`;
            if (!win.confirm(msg)) return;
          }

          // 保存実行
          for (const k of keys) {
            savedStyles[k] = styleMap[k];
          }

          win.alert(`${keys.join(', ')} に保存しました！`);
          bulkJsonInput.value = '';
          keys.forEach(updateApplyBtnColor);
        };

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

          const proceed = win.confirm('☆ JSONデータを反映します！');
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
            applyStyle('color', hex);
            colorState.currentFg = colorState.savedFg = hex;
            win.__fgHSL = hexToHSL(hex);
            const fgHex = doc.getElementById('fgHex');
            if (fgHex) fgHex.value = hex;
          }
          // background
          if (data.backgroundColor) {
            const hex = data.backgroundColor;
            applyStyle('background-color', hex);
            colorState.currentBg = colorState.savedBg = hex;
            win.__bgHSL = hexToHSL(hex);
            const bgHex = doc.getElementById('bgHex');
            if (bgHex) bgHex.value = hex;
          }
          // scrollbar-color
          if (data.color && data.backgroundColor) {
            applyStyle('scrollbar-color', `${data.color} ${data.backgroundColor}`);
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

          // スライダーセッティングUIの状態反映
          if (data.scrollSettings) {
            const s = data.scrollSettings;
            const uiMap = {
              scrollB:        { prop: 'checked', value: s.border },
              scrollC:        { prop: 'checked', value: s.colorIn },
              scrollS:        { prop: 'value',   value: s.shadow },
              scrollRight:    { prop: 'checked', value: s.right },
              scrollLeft:     { prop: 'checked', value: s.left },
              scrollX:        { prop: 'value',   value: s.position },
              scrollW:        { prop: 'value',   value: s.width },
              scrollO:        { prop: 'value',   value: s.opacity },
              scrollSpeedScale:{prop: 'value',   value: s.speedScale },
              scrollHide:     { prop: 'checked', value: s.hideBall }
            };
            Object.entries(uiMap).forEach(([id, info]) => {
              const el = doc.getElementById(id);
              if (el) el[info.prop] = info.value;
            });

            // スライダースタイルは直接適用
            if (s.border) {
              applyToSliders(el => {
                el.style.border = '1px solid';
                el.style.setProperty("background", "transparent", "important");
              });
            } else if (s.colorIn) {
              applyToSliders(el => {
                el.style.border = 'none';
                el.style.setProperty("background", "currentColor", "important");
              });
            } else {
              applyToSliders(el => {
                el.style.border = 'none';
                el.style.setProperty("background", "transparent", "important");
              });
            }

            const shadowVal = Number(s.shadow) || 0;
            const shadowStyle = shadowVal < 0 ? `inset 0 0 ${Math.abs(shadowVal)}px` : `0 0 ${shadowVal}px`;
            applyToSliders(el => el.style.boxShadow = shadowStyle);

            const posVal = parseFloat(s.position);
            if (!isNaN(posVal)) {
              applyToSliders(el => {
                el.style[el === scrollSliderRight ? 'right' : 'left'] = `${posVal}px`;
              });
            }
            const widthVal = parseFloat(s.width);
            if (!isNaN(widthVal)) {
              applyToSliders(el => el.style.width = `${widthVal}px`);
            }
            const opacityVal = parseFloat(s.opacity);
            if (!isNaN(opacityVal) && opacityVal >= 0 && opacityVal <= 1) {
              applyToSliders(el => el.style.opacity = opacityVal);
            }
            const speedVal = parseFloat(s.speedScale);
            if (!isNaN(speedVal)) {
              speedScale = Math.max(0, Math.min(20, speedVal));
              syncScrollSpeed(scrollSliderRight.value);
            }
            const [height, bottom] = s.hideBall ? ['200vh', '-98vh'] : ['210vh', '-108vh'];
            applyToSliders(el => {
              el.style.height = height;
              el.style.bottom = bottom;
            });
            updateDisplay();
          }
          updateControls();
          return true;
        }
        
        // --- 保存済みのすべてのJSONを表示するボタンのイベント登録 ---
        doc.getElementById('viewAllJsonBtn').onclick = () => {

          // 保存済みスタイルをキー順にソート
          const sortedStyles = ((o) =>
            Object.keys(o)
              .sort((a, b) =>
                parseInt(a.replace(/\D/g, ''), 10) -
                parseInt(b.replace(/\D/g, ''), 10)
              )
              .reduce((r, k) => (r[k] = o[k], r), {})
          )(savedStyles);

          const htmlContent = `<!DOCTYPE html>
          <html lang="ja">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>保存済みJSON</title>
            <style>
              body { font-family: sans-serif; padding: 16px; }
              pre { white-space: pre-wrap; word-wrap: break-word; border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
              .controls { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
              .controls-left { display: flex; align-items: center; }
              input[type="checkbox"] { cursor: pointer; }
              label { font-size: 15px; cursor: pointer; }
              button { margin-left: 8px; font-size: 15px; cursor: pointer; }
              .disabled { opacity: 0.5; cursor: not-allowed; }
              #jsonDisplay[contenteditable="true"] { border: none; outline: 3px dashed #000000; border-radius: 0px; }
            </style>
          </head>
          <body>
            <div class="controls">
              <div class="controls-left">
                <label id="prettyPrintLabel">
                  <input type="checkbox" id="prettyPrintCheckbox"> プリティプリント
                </label>
                <button id="copyJsonBtn">コピー</button>
              </div>
              <button id="allJsonEditBtn">編集</button>
            </div>
            <pre id="jsonDisplay"></pre>
            <script>
              const savedStyles = ${JSON.stringify(sortedStyles)};
              let currentJson = savedStyles;

              const jsonDisplay = document.getElementById('jsonDisplay');
              const prettyCheckbox = document.getElementById('prettyPrintCheckbox');
              const prettyLabel = document.getElementById('prettyPrintLabel');
              const copyJsonBtn = document.getElementById('copyJsonBtn');
              const allJsonEditBtn = document.getElementById('allJsonEditBtn');
              let isAllEditing = false;

              const updateJsonDisplay = () => {
                if (isAllEditing) return;
                jsonDisplay.textContent = prettyCheckbox.checked
                  ? JSON.stringify(currentJson, null, 2)
                  : JSON.stringify(currentJson);
              };

              prettyCheckbox.addEventListener('change', updateJsonDisplay);

              copyJsonBtn.addEventListener('click', async () => {
                try {
                  await navigator.clipboard.writeText(jsonDisplay.textContent);
                  alert('JSONをコピーしました！');
                } catch (err) {
                  alert('コピーに失敗しました: ' + err);
                }
              });

              allJsonEditBtn.addEventListener('click', () => {
                isAllEditing = !isAllEditing;
                if (isAllEditing) {
                  allJsonEditBtn.textContent = '編集中…';
                  jsonDisplay.contentEditable = 'true';
                  prettyCheckbox.classList.add('disabled');
                  prettyLabel.classList.add('disabled');
                  copyJsonBtn.classList.add('disabled');
                } else {
                  allJsonEditBtn.textContent = '編集';
                  jsonDisplay.contentEditable = 'false';
                  prettyCheckbox.classList.remove('disabled');
                  prettyLabel.classList.remove('disabled');
                  copyJsonBtn.classList.remove('disabled');
                  try {
                    currentJson = JSON.parse(jsonDisplay.textContent);
                  } catch (e) {
                    alert('JSONの形式が正しくありません');
                  }
                }
              });

              updateJsonDisplay();
            <\/script>
          </body>
          </html>`;

          const jsonBlob = new Blob([htmlContent], { type: 'text/html' });
          const jsonUrl = URL.createObjectURL(jsonBlob);
          const newTab = win.open(jsonUrl);

          newTab.addEventListener('load', () => URL.revokeObjectURL(jsonUrl));
        };
        // ---
        
        // ---テキスト選択メニュー---
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

        doc.addEventListener('mouseup', (e) => {
          if (!pendingSelection) return;

          showMenus(pendingSelection);
          pendingSelection = null;
        });

        doc.addEventListener('mousedown', (e) => {
          if (!menus.some(({ div }) => div.contains(e.target))) {
            hideMenus();
          }
        });

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
