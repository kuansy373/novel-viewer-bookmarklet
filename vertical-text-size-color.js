(() => {
  
  // webページのDOM完成を待って実行
  function run() {

    // ==============================
    // Vertical text
    // ==============================
    
    let text = '';
    
    // HTMLエスケープ用関数（属性値を安全にする）
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
    
    // 許可する属性（ホワイトリスト）
    const ALLOWED_ATTRS = ['class', 'id', 'lang', 'title', 'dir'];
    
    // rubyタグなどを保持したままテキストを抽出する関数
    function extractWithRubyTags(node) {
      let result = '';
    
      // ノードを再帰的に巡回する
      function traverse(el) {
        for (const child of el.childNodes) {
    
          if (child.nodeType === Node.TEXT_NODE) {
            result += escapeHTML(child.textContent);
    
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();
    
            if (['ruby', 'rb', 'rp', 'rt', 'em'].includes(tagName)) {
              
              const attrs = Array.from(child.attributes)
                .filter(attr => !/^on/i.test(attr.name))
                .filter(attr => ALLOWED_ATTRS.includes(attr.name))
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
      'body > h1, ' +        // タイトル
      'body > h2, ' +        // サブタイトル
      'body > h3, ' +        // 小見出し
      '.metadata, ' +        // メタ情報（作者名など）
      '.main_text, ' +       // 本文テキスト
      // 小説家になろう
      '.p-novel__title, ' +  // 小説タイトル
      '.p-novel__text, ' +   // 本文テキスト
      // カクヨム
      '.widget-episodeTitle, ' +  // エピソードタイトル
      '.widget-episodeBody p, ' + // 本文段落
      // アルファポリス
      '.novel-title, ' +     // 小説タイトル
      '.novel-body p, ' +    // 本文段落
      '.chapter-title, ' +   // 章タイトル
      '.episode-title, ' +   // エピソードタイトル
      '#novelBody'           // 本文全体コンテナ
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
    const panelStyls = {
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
    
    // HTML生成関数
    function createPanelHTML(totalChars, numPages, charsPerPage) {
      return `
        <div id="contentContainer" style="${panelStyls.contentContainer}">
          <div style="${panelStyls.header}">
            🔖 テキスト情報
            <div id="dragHandle" style="${panelStyls.dragHandle}">🟰</div>
          </div>
          <div>
            <strong>総文字数:</strong>
            <span style="${panelStyls.valueSpan}">
              ${totalChars.toLocaleString()}
            </span>
          </div>
          <div>
            <strong>ページ数:</strong>
            <span style="${panelStyls.valueSpan}">
              ${numPages}
            </span>
          </div>
          <div>
            <strong>目標文字数/ページ:　</strong>
            <span style="${panelStyls.valueSpan}">
              ${charsPerPage.toLocaleString()}
            </span>
          </div>
          <div style="${panelStyls.divider}">
            <strong>各ページの文字数</strong>
          </div>
            <div id="partsList" style="${panelStyls.partsList}"></div>
          </div>
        </div>
        <div id="popupRetry" style="${panelStyls.popupRetry}">
          小説タブを開く
        </div>
      `;
    }
    
    function createPartInfoHTML(partNumber, charCount) {
      return `
        <strong>ページ${partNumber}:</strong>
        <span style="${panelStyls.valueSpan}">
          ${charCount.toLocaleString()}文字
        </span>
      `;
    }
    
    // テキスト情報パネルを作成
    const textInfoPanel = document.createElement('div');
    textInfoPanel.style.cssText = panelStyls.panel;
    document.body.appendChild(textInfoPanel);
    
    // 可視文字長を測るための要素
    const measurer = document.createElement('div');
    measurer.style.cssText = 'position:absolute; visibility:hidden; pointer-events:none;';
    document.body.appendChild(measurer);
    
    // HTMLから可視文字数を取得
    measurer.innerHTML = text;
    const fullText = measurer.textContent;
    const totalVisibleChars = fullText.length;
    
    console.log('総文字数:', totalVisibleChars);
    
    // 1ページあたりの上限文字数
    const MAX_PER_PAGE = 10000;
    
    // 必要なページ数を計算（文字数均等分割）
    const numPages = Math.ceil(totalVisibleChars / MAX_PER_PAGE);
    const charsPerPage = Math.ceil(totalVisibleChars / numPages);
    
    console.log('ページ数:', numPages);
    console.log('1ページあたりの目標文字数:', charsPerPage);
  
    // パネルに基本情報を表示
    textInfoPanel.innerHTML = createPanelHTML(totalVisibleChars, numPages, charsPerPage);
    const partsList = textInfoPanel.querySelector('#partsList');

    // 再実行リンク
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
    
      // タッチ対応
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
    
    // <ruby>の外でspan分割する
    function chunkHTMLSafe(html, chunkSize) {
      const chunks = [];
      const len = html.length;
      let i = 0, last = 0, count = 0, rubyDepth = 0;
    
      while (i < len) {
        const ch = html[i];
    
        if (ch === '<') {
          const end = html.indexOf('>', i + 1);
          if (end === -1) break;
    
          const tagContent = html.slice(i + 1, end);
          const isClosing = /^\s*\//.test(tagContent);
          const nameMatch = tagContent.replace(/^\s*\//, '').match(/^([a-zA-Z0-9-]+)/);
          const name = nameMatch ? nameMatch[1].toLowerCase() : '';
    
          if (name === 'ruby') {
            rubyDepth += isClosing ? -1 : 1;
            if (rubyDepth < 0) rubyDepth = 0;
          }
          i = end + 1;
          continue;
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
    function buildPositionMap(container) {
      const map = [];
      let visiblePos = 0;
    
      function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const len = node.textContent.length;
          for (let i = 0; i < len; i++) {
            map.push({
              visiblePos: visiblePos++,
              node,
              offset: i
            });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          node.childNodes.forEach(walk);
        }
      }
    
      walk(container);
      return map;
    }
    
    const posMap = buildPositionMap(measurer);
    
    function rangeFromVisiblePos(map, startPos, endPos) {
      const range = document.createRange();
    
      const start = map[startPos];
      const end = map[endPos];
    
      if (!start || !end) return null;
    
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset + 1);
    
      return range;
    }
    
    function rangeToHTML(range) {
      const frag = range.cloneContents();
      const div = document.createElement('div');
      div.appendChild(frag);
      return div.innerHTML;
    }
        
    // 均等分割でパートを作成
    const parts = [];
    
    let prevEndVisiblePos = 0;  // 前ページの終わり位置を保持
    const overlap = 10;         // 重複させたい文字数
    const pageCharCounts = [];  // 各ページの実際の文字数を保存する配列
    
    for (let i = 0; i < numPages; i++) {
      let startVisiblePos = prevEndVisiblePos;
      if (i > 0) {
          startVisiblePos = Math.max(0, prevEndVisiblePos - overlap);
      }
      let endVisiblePos = startVisiblePos + charsPerPage;
      
      // 最後のページは残り全部
      if (i === numPages - 1) {
        endVisiblePos = Math.min(endVisiblePos, posMap.length - 1);
      } else {
        // 切り替え目標位置より先方5%の範囲で区切りのいい文字を探す
        const searchStart = endVisiblePos;
        const searchEnd = Math.min(fullText.length, endVisiblePos + Math.floor(charsPerPage * 0.05));
        
        let bestPos = endVisiblePos;
        
        const delimiters = ['　','。','」','…'];
        let found = false;
        
        for (const delimiter of delimiters) {
          for (let j = searchStart; j < searchEnd; j++) {
            if (fullText[j] === delimiter) {
              bestPos = j;
              found = true;
              break;
            }
          }
          if (found) break;
        }
        
        endVisiblePos = bestPos;
      }
      
      // HTML位置に変換
      const range = rangeFromVisiblePos(
        posMap,
        startVisiblePos,
        endVisiblePos
      );
      
      let partHTML = range ? rangeToHTML(range) : '';
    
      // 重複処理
      if (i > 0 && overlap > 0) {
        let overlapPart = '';
        let mainPart = partHTML;
        
        if (i > 0 && overlap > 0) {
          const overlapRange = rangeFromVisiblePos(
            posMap,
            startVisiblePos,
            startVisiblePos + overlap
          );
          overlapPart = overlapRange ? rangeToHTML(overlapRange) : '';
        
          const mainRange = rangeFromVisiblePos(
            posMap,
            startVisiblePos + overlap,
            endVisiblePos
          );
          mainPart = mainRange ? rangeToHTML(mainRange) : '';
        }
        
        // メイン部分のみ50文字チャンク分割
        const mainChunks = chunkHTMLSafe(mainPart, 50);
        
        parts.push({
          overlap: [overlapPart],
          main: mainChunks
        });
      } else {
        const chunks = chunkHTMLSafe(partHTML, 50);
        parts.push({
          overlap: [],
          main: chunks
        });
      }
  
      // 実際の文字数を計算（重複部分を含む）
      const actualStartPos = i > 0 ? Math.max(0, prevEndVisiblePos - overlap) : 0;
      const actualLen = endVisiblePos - actualStartPos;
      console.log(`ページ${i + 1}: ${actualLen}文字`);
      pageCharCounts.push(actualLen);   // 文字数を配列に追加
  
      // デバッグパネルにページ情報を追加
      const partInfo = document.createElement('div');
      partInfo.style.cssText = panelStyls.partInfo;
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
    
    // 新しいウィンドウを開いてセットアップ
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
        
        // ページ切り替えオーバーレイの作成
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
        
        function showOverlay(defaultPage, maxPage, onYes) {
          overlayElements.message.textContent = '';
          overlayElements.pageInput.value = defaultPage;
          overlayElements.pageInput.max = maxPage;
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
              cleanup();
              onYes(targetPage);
            }
          };
          
          // いいえ
          const handleNo = () => {
            overlayElements.overlay.style.display = 'none';
            cleanup();
            isSwitching = false;
            promptShownForward = false;
            promptShownBackward = false;
          };
      
          // オーバーレイ背景クリックで閉じる
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
              win.requestAnimationFrame(() => {
                win.renderPart(currentIndex);
                win.scrollTo(0, 0);
                win.setTimeout(() => {
                  if (typeof scrollSliderRight !== 'undefined') scrollSliderRight.value = 0;
                  if (typeof scrollSliderLeft !== 'undefined') scrollSliderLeft.value = 0;
                  if (typeof scrollSpeed !== 'undefined') scrollSpeed = 0;
                  isSwitching = false;
                }, 50);
                promptShownForward = false;
                promptShownBackward = false;
              });
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
                  if (typeof scrollSliderRight !== 'undefined') scrollSliderRight.value = 0;
                  if (typeof scrollSliderLeft !== 'undefined') scrollSliderLeft.value = 0;
                  if (typeof scrollSpeed !== 'undefined') scrollSpeed = 0;
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
        
        // === 右スライダー ===
        const scrollSliderRight = doc.createElement('input');
        scrollSliderRight.type = 'range';
        scrollSliderRight.min = 0;
        scrollSliderRight.max = 25;
        scrollSliderRight.value = 0;
        Object.assign(scrollSliderRight.style, {
          appearance: 'none',
          border: 'none',
          position: 'fixed',
          height: '210vh',
          bottom: '-108vh',
          right: '30px',
          zIndex: '9999',
          width: '80px',
          opacity: '1',
        });
        doc.body.appendChild(scrollSliderRight);
      
        // === 左スライダー ===
        const scrollSliderLeft = doc.createElement('input');
        scrollSliderLeft.type = 'range';
        scrollSliderLeft.min = 0;
        scrollSliderLeft.max = 25;
        scrollSliderLeft.value = 0;
        Object.assign(scrollSliderLeft.style, {
          appearance: 'none',
          border: 'none',
          position: 'fixed',
          height: '210vh',
          bottom: '-108vh',
          left: '30px',
          zIndex: '9999',
          width: '80px',
          opacity: '1',
          direction: 'rtl', // 左用は増加方向反転
        });
        doc.body.appendChild(scrollSliderLeft);
        
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
        scrollSliderRight.addEventListener('input', () => {
          syncScrollSpeed(scrollSliderRight.value);
          scrollSliderLeft.value = scrollSliderRight.value;
        });
        scrollSliderLeft.addEventListener('input', () => {
          syncScrollSpeed(scrollSliderLeft.value);
          scrollSliderRight.value = scrollSliderLeft.value;
        });
        win.requestAnimationFrame(forceScroll);
          
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
          <label><input id="scrollBoth" class="settingCheckbox" type="checkbox"><span class="labelText"> Both sides</span></label><br>
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
                sl.style.border = id === 'scrollB' ? '1px solid currentcolor' : 'none';
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
        
        // Right/Left/Both
        const rightbox = doc.getElementById('scrollRight');
        const leftbox = doc.getElementById('scrollLeft');
        const bothbox = doc.getElementById('scrollBoth');
        
        function updateDisplay() {
          scrollSliderRight.style.display = (rightbox.checked || bothbox.checked) ? 'block' : 'none';
          scrollSliderLeft.style.display = (leftbox.checked || bothbox.checked) ? 'block' : 'none';
        }
        
        function uncheckOthers(current) {
          [rightbox, leftbox, bothbox].forEach(box => {
            if (box !== current) box.checked = false;
          });
        }
        
        rightbox.checked = true;
        updateDisplay();
        
        [rightbox, leftbox, bothbox].forEach(box => {
          box.addEventListener('change', e => {
            if (e.target.checked) uncheckOthers(box);
            updateDisplay();
          });
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
        
        // 開くボタン △
        const sUIOpenBtn = doc.createElement('div');
        sUIOpenBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24">
            <polygon points="12,6.144 20,20 4,20" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        `;
        Object.assign(sUIOpenBtn.style, {
          position: 'fixed',
          top: '10px',
          left: '18px',
          fontSize: '14px',
          color: 'unset',
          opacity: '0.3',
          cursor: 'pointer',
          zIndex: '10006',
          display: 'block'
        });
        doc.body.appendChild(sUIOpenBtn);
        
        scrollUI.style.display = 'none';
        sUIOpenBtn.addEventListener('click', () => {
          scrollUI.style.display = 'block';
        });
      
        // 閉じるボタン ✕
        const sUICloseBtn = doc.createElement('div');
        sUICloseBtn.textContent = '✕';
        Object.assign(sUICloseBtn.style, {
          position: 'absolute',
          top: '5px',
          right: '10px',
          cursor: 'pointer',
          fontSize: '16px',
          color: 'unset',
        });
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
        
        // 操作対象は #novelDisplay
        let target = doc.getElementById('novelDisplay');
        if (!target) {
          console.error('#novelDisplay が見つかりません（win側）');
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
        const modes = ['Font shadow','Font weight','Font size'];
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
          else if (currentMode === 'Font shadow') {
            slider.min = 0;
            slider.max = 30;
            slider.step = 1;
          
            // 現在のスライダー値を保持（前回の設定を使う）
            let blur = parseInt(target.dataset.textShadow || 0);
            slider.value = blur;
            label.textContent = `Font shadow: ${slider.value}px`;
          
            slider.oninput = () => {
              const b = slider.value;
              if (b > 0) {
                target.style.textShadow = `0 0 ${b}px`;
              } else {
                target.style.textShadow = 'none';
              }
              label.textContent = `Font shadow: ${b}px`;
          
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
        Object.assign(fUIOpenBtn.style, {
          position: 'fixed',
          top: '10px',
          right: '18px',
          opacity: '0.3',
          color: 'unset',
          cursor: 'pointer',
          zIndex: '10006'
        });
        doc.body.appendChild(fUIOpenBtn);
      
        fUIOpenBtn.addEventListener('click', () => {
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
          fUIOpenBtn.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
      
        // 閉じるボタン ✕
        const fUICloseBtn = doc.createElement('div');
        fUICloseBtn.textContent = '✕';
        Object.assign(fUICloseBtn.style, {
          position: 'absolute',
          top: '0px',
          right: '9px',
          cursor: 'pointer',
          fontSize: '16px',
          color: 'unset',
        });
        panel.appendChild(fUICloseBtn);
      
        fUICloseBtn.addEventListener('click', () => {
          panel.style.display = 'none';
          fUIOpenBtn.style.display = 'block';
        });
      
        // 初期化
        updateControls();
        
        // ==============================
        // Color Pickr
        // ==============================
      
        if (win.__pickrLoaded) return;
        win.__pickrLoaded = true;
        
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

        // スコープ確保のためthenの外で宣言
        let applyStyle;
        
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
          
            #bgLockIcon,
            #fgLockIcon {
              font-size: 14px;
              margin: 0px 0px;
              border: 1px solid;
              display: inline-block;
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
              border: 1px solid; !important;
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
              <button id="randomColorBtn">🎨Random</button>
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
      
          // --- ユーティリティ関数 ---
          const getHex = (prop) => {
            const rgb = getComputedStyle(doc.body)[prop];
            if (!rgb || rgb === 'transparent' || rgb.startsWith('rgba(0, 0, 0, 0)')) {
              return null
            }
            const nums = rgb.match(/\d+/g)?.map(Number);
            return nums && nums.length >= 3 ? '#' + nums.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('') : null
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
              scrollbar-color: ${currentFg} ${currentBg};
            }`;
          };
      
          const updateSwatch = (swatch, current, saved) => {
            if (!swatch) return;
            swatch.querySelector('.color-current').style.background = current;
            swatch.querySelector('.color-saved').style.background = saved
          };
      
          const updateColorHexDisplays = () => {
            doc.getElementById("bgHex").value = currentBg;
            doc.getElementById("fgHex").value = currentFg;
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
          const contrastEl = doc.getElementById('contrastRatio');
          const updateContrast = () => (contrastEl.textContent = getContrast(currentFg, currentBg));
          let savedFg = getHex('color') || '#000000';
          let savedBg = getHex('backgroundColor') || '#ffffff';
          let currentFg = savedFg;
          let currentBg = savedBg;
          
          // --- pcr-appドラッグ用グローバル変数を追加 ---
          let globalDragStyle = null;
          let globalDragRuleIndex = null;
      
          const initPickr = (id, prop) => {
            const swatch = doc.getElementById(id + 'Swatch');
            const isFg = prop === 'color';
            const getSaved = () => (isFg ? savedFg : savedBg);
            const setSaved = (v) => (isFg ? (savedFg = v) : (savedBg = v));
            const getCurrent = () => (isFg ? currentFg : currentBg);
            const setCurrent = (v) => (isFg ? (currentFg = v) : (currentBg = v));
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
              // --- pcr-appドラッグボタン追加 ---
              win.setTimeout(() => {
                // すべてのpcr-appにドラッグボタンを追加
                doc.querySelectorAll('.pcr-app').forEach(app => {
                  if (app.querySelector('.pcr-drag-handle')) return;
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
      
                    // --- ドラッグ処理 ---
                    let isDragging = false, offsetX = 0, offsetY = 0;
      
                    // --- グローバルなドラッグ用CSSルールを使う ---
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
                });
              }, 0);
            });
              
            pickr.on('init', instance => {
              win.setTimeout(() => {
                doc.querySelectorAll('.pcr-app').forEach(app => {
                  // すでにコピー用ボタンがあればスキップ
                  if (app.querySelector('.pcr-copy')) return;
            
                  const resultInput = app.querySelector('.pcr-result');
                  if (resultInput) {
                    // Copy ボタン生成
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
                    // .pcr-result の右隣に追加
                    resultInput.insertAdjacentElement('afterend', hexCopyBtn);
                    // クリック時にクリップボードへコピー
                    doc.querySelectorAll(".pcr-copy").forEach(function(button){
                      button.addEventListener("click", function(){
                        const app = button.closest('.pcr-app');
                        const resultInput = app.querySelector('.pcr-result');
                    
                        if (resultInput && resultInput.value !== "-") {
                          win.navigator.clipboard.writeText(resultInput.value).then(function(){
                            button.textContent = "Copied!";
                            win.setTimeout(function(){ button.textContent = "Copy"; }, 1500);
                          }).catch(function(err){
                            win.console.error("コピーに失敗しました:", err);
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
                currentBg = savedBg = color;
                applyStyle('background-color', color);
                updateSwatch(doc.getElementById('bgSwatch'), color, color);
                updateContrast()
              },
              show: () => {},
              destroyAndRemove: () => {},
            };
            fgPickr = {
              setColor: (color) => {
                currentFg = savedFg = color;
                applyStyle('color', color);
                updateSwatch(doc.getElementById('fgSwatch'), color, color);
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
            const bgLocked = doc.getElementById('color-toggle-bg-lock').checked;
            const fgLocked = doc.getElementById('color-toggle-fg-lock').checked;
            const bgColor = doc.getElementById('bgHex').value;
            const fgColor = doc.getElementById('fgHex').value;
            const bgLockIcon = doc.getElementById('bgLockIcon');
            const fgLockIcon = doc.getElementById('fgLockIcon');
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
          // ランダムに生成される色のhsl範囲
          function getRandomHSL() {
            return {
              h: Math.floor(Math.random() * 360),
              s: Math.floor(Math.random() * 101) ,
              l: Math.floor(Math.random() * 101)
            }
          }
        
          function changeColors() {
            const bgLocked = doc.getElementById("color-toggle-bg-lock").checked;
            const fgLocked = doc.getElementById("color-toggle-fg-lock").checked;
            const contrastMin = parseFloat(doc.getElementById("contrastMin").value) || 1;
            const contrastMax = parseFloat(doc.getElementById("contrastMax").value) || 21;
            let trials = 0;
            const maxTrials = 300;
            // --- HSLオブジェクトが不正な場合は必ず初期化 ---
            if (!win.__bgHSL || typeof win.__bgHSL.h !== 'number' || typeof win.__bgHSL.s !== 'number' || typeof win.__bgHSL.l !== 'number') {
              win.__bgHSL = hexToHSL(currentBg);
            }
            if (!win.__fgHSL || typeof win.__fgHSL.h !== 'number' || typeof win.__fgHSL.s !== 'number' || typeof win.__fgHSL.l !== 'number') {
              win.__fgHSL = hexToHSL(currentFg);
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
                if (!bgLocked) currentBg = savedBg = bgHex;
                if (!fgLocked) currentFg = savedFg = fgHex;
                applyStyle("background-color", savedBg);
                applyStyle("color", savedFg);
                updateSwatch(doc.getElementById("bgSwatch"), savedBg, savedBg);
                updateSwatch(doc.getElementById("fgSwatch"), savedFg, savedFg);
                updateContrast();
                updateColorHexDisplays();
                updateLockIcons();
                return
              }
            }
            win.alert("指定されたコントラスト範囲に合うランダム色の組み合わせが見つかりませんでした。")
          }
          doc.getElementById("randomColorBtn").onclick = changeColors;
          doc.getElementById("swapColorsBtn").onclick = () => {
            // ロック状態を無視して完全にスワップ
            [currentFg, currentBg] = [currentBg, currentFg];
            [savedFg, savedBg] = [currentFg, currentBg];
            applyStyle("color", currentFg);
            applyStyle("background-color", currentBg);
            updateSwatch(doc.getElementById("bgSwatch"), currentBg, savedBg);
            updateSwatch(doc.getElementById("fgSwatch"), currentFg, savedFg);
            updateColorHexDisplays();
            updateContrast();
            win.__bgHSL = hexToHSL(currentBg);
            win.__fgHSL = hexToHSL(currentFg);
            updateLockIcons();
          };
          // Pickr UI コンテナとスタイルを初期非表示にする
          container.style.display = 'none';
          style.disabled = true;
          // □ ボタン作成関数（スタイルも内部に集約）
          function createPickrOpenButton() {
            const pickrOpen = doc.createElement('div');
            pickrOpen.id = 'pickrOpen';
            pickrOpen.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1"/>
              </svg>
            `;
            Object.assign(pickrOpen.style, {
              cursor: 'pointer',
              position: 'fixed',
              top: '80px',
              right: '18px',
              opacity: '0.3',
              color: 'unset',
              zIndex: '20000'
            });
          
            pickrOpen.onclick = () => {
              container.style.display = 'block';
              style.disabled = false;
              pickrOpen.remove();
            };
          
            doc.body.appendChild(pickrOpen);
            return pickrOpen;
          }
          
          // 最初の □ ボタンを作成
          createPickrOpenButton();
          
          // Pickr の閉じるボタンの処理
          doc.getElementById('pickrClose').onclick = () => {
            // UI を閉じる
            container.style.display = 'none';
            style.disabled = true;
          
            // □ ボタンを再生成
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
          <div class="ui-header">
            <span>Apply Style with One Tap</span>
            <div id="oUICloseBtn" style="cursor:pointer; padding-right:5px;">✕</div>
          </div>
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
        
        // ヘッダーのスタイル
        const header = onetapUI.querySelector('.ui-header');
        Object.assign(header.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 'bold',
          marginBottom: '10px',
        });
      
        // ボタン群のスタイル
        const buttonsContainer = onetapUI.querySelector('.ui-buttons');
        Object.assign(buttonsContainer.style, {
          display: 'flex',
          flexDirection: 'column',
          marginLeft: '5px',
          gap: '10px',
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
      
        // ☆ 開くボタン
        const oUIOpenBtn = doc.createElement('div');
        oUIOpenBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24">
            <polygon points="12,2 15,10 23,10 17,15 19,23 12,18 5,23 7,15 1,10 9,10" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        `;
        Object.assign(oUIOpenBtn.style, {
          position: 'fixed',
          top: '80px',
          left: '18px',
          cursor: 'pointer',
          zIndex: '10000',
          opacity: '0.3',
        });
        doc.body.appendChild(oUIOpenBtn);
      
        // UIをbodyに追加
        doc.body.appendChild(onetapUI);
        
        // --- ボタンごとのイベント登録 ---
        for (let i = 1; i <= 8; i++) {
          doc.getElementById(`saveBtn${i}`).onclick = () => saveStyle(`Style${i}`);
          doc.getElementById(`applyBtn${i}`).onclick = () => applyStyleByName(`Style${i}`);
        }
        
        // 保存されたスタイルを保持するローカル変数
        const savedStyles = {};
        
        // APPLYボタンの色を初期化
        function initApplyButtonStyle() {
          const styles = ['Style1', 'Style2', 'Style3', 'Style4', 'Style5', 'Style6', 'Style7', 'Style8'];
        
          for (const styleName of styles) {
            const applyBtn = doc.getElementById(`applyBtn${styleName.slice(-1)}`);
            if (applyBtn && savedStyles[styleName]) {
              const data = savedStyles[styleName];
              if (data.color) applyBtn.style.color = data.color;
              if (data.backgroundColor) applyBtn.style.backgroundColor = data.backgroundColor;
            }
          }
        }
        
        // ページ読み込み時に呼ぶ
        initApplyButtonStyle();
        
        // 開くボタン ☆
        oUIOpenBtn.onclick = () => {
          onetapUI.style.display = 'block';
        };
        // 閉じるボタン ✕
        doc.getElementById('oUICloseBtn').onclick = () => {
          onetapUI.style.display = 'none';
        };
        
        // RGB → HEX 変換関数
        function rgbToHex(rgb) {
          const result = rgb.match(/\d+/g);
          if (!result) return rgb; // マッチしなければそのまま返す
          let r = parseInt(result[0], 10).toString(16).padStart(2, "0");
          let g = parseInt(result[1], 10).toString(16).padStart(2, "0");
          let b = parseInt(result[2], 10).toString(16).padStart(2, "0");
          return `#${r}${g}${b}`;
        }
        
        // SAVEボタン
        async function saveStyle(name) {
          const target = doc.getElementById('novelDisplay');
          if (!target) return win.alert('対象要素が見つかりません');
          const computed = window.getComputedStyle(target);
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
              both:         ['scrollBoth', 'checked'],
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
            scrollSettings
          };
        
          // オーバーレイで確認
          const confirmed = await showSaveConfirmOverlay(name, savePreview);
          if (!confirmed) return;
        
          // ローカル変数に保存
          savedStyles[name] = savePreview;
        
          // 保存成功後にAPPLYボタンに色を反映
          const num = name.replace('Style', '');
          const applyBtn = doc.getElementById(`applyBtn${num}`);
          if (applyBtn) {
            applyBtn.style.color = color;
            applyBtn.style.backgroundColor = backgroundColor;
          }
          win.alert(`☆ 保存しました！`);
        }
        
        let __saveConfirmOpen = false;
        // オーバーレイを表示する関数
        function showSaveConfirmOverlay(name, savePreview) {
          
          // 既にオーバーレイが開いていれば二重表示を防ぐ
          if (__saveConfirmOpen) return Promise.resolve(false);
          __saveConfirmOpen = true;
          isSwitching = true;
          
          return new Promise((resolve) => {
            // オーバーレイを作成
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
            
            // プリティプリントチェックボックスコンテナ
            const checkboxContainer = doc.createElement('div');
            checkboxContainer.style.cssText = `
              margin: 0 0 12px 0;
              display: flex;
              align-items: center;
              gap: 8px;
            `;
            
            const prettyCheckbox = doc.createElement('input');
            prettyCheckbox.type = 'checkbox';
            prettyCheckbox.id = 'prettyPrintCheckbox';
            prettyCheckbox.checked = false;
            prettyCheckbox.style.cssText = `
              cursor: pointer;
            `;
            
            const prettyLabel = doc.createElement('label');
            prettyLabel.htmlFor = 'prettyPrintCheckbox';
            prettyLabel.textContent = 'プリティプリント';
            prettyLabel.id = 'prettyLabel';
            prettyLabel.style.cssText = `
              cursor: pointer;
              font-size: 14px;
              user-select: none;
            `;
        
            // コピーボタン
            const jsonCopyBtn = doc.createElement('button');
            jsonCopyBtn.textContent = 'コピー';
            jsonCopyBtn.id = 'jsonCopyBtn';
            jsonCopyBtn.style.cssText = `
              padding: 6px 12px;
              margin-left: auto;
              color: unset;
              border: 1px solid currentcolor;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            `;
            
            jsonCopyBtn.onclick = async () => {
              if (jsonCopyBtn.disabled) return;
              try {
                jsonCopyBtn.disabled = true;
                const textToCopy = prettyCheckbox.checked ? jsonTextFormatted : jsonTextCompressed;
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
            
            checkboxContainer.appendChild(prettyCheckbox);
            checkboxContainer.appendChild(prettyLabel);
            checkboxContainer.appendChild(jsonCopyBtn);
            
            // プレビューコンテナ
            const previewContainer = doc.createElement('div');
            previewContainer.style.cssText = `
              position: relative;
              margin: 0 0 20px 0;
            `;
            
            // プレビュー内容
            const preview = doc.createElement('pre');
            const jsonTextFormatted = JSON.stringify(savePreview, null, 2);
            const jsonTextCompressed = JSON.stringify(savePreview);
            preview.textContent = jsonTextCompressed;
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
            
            // プリティプリントチェックイベント
            prettyCheckbox.onchange = () => {
              if (prettyCheckbox.checked) {
                preview.textContent = jsonTextFormatted;
                preview.style.whiteSpace = 'pre-wrap';
              } else {
                preview.textContent = jsonTextCompressed;
                preview.style.whiteSpace = 'nowrap';
              }
            };
            
            // ボタンコンテナ
            const buttonContainer = doc.createElement('div');
            buttonContainer.style.cssText = `
              display: flex;
              gap: 12px;
              justify-content: flex-end;
            `;
        
            // 操作の処理まとめ
            const cleanupAndResolve = (result) => {
              if (overlay.parentNode) doc.body.removeChild(overlay);
              __saveConfirmOpen = false;
              isSwitching = false;
              doc.removeEventListener('keydown', handleKeydown); // イベントリスナーを削除
              resolve(result);
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
                saveBtn.click(); // 「保存する」ボタンをクリック
              }
            };
            doc.addEventListener('keydown', handleKeydown); // キーイベントを登録
            
            // 組み立て
            previewContainer.appendChild(preview);
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(saveBtn);
            box.appendChild(title);
            box.appendChild(checkboxContainer);
            box.appendChild(previewContainer);
            box.appendChild(buttonContainer);
            overlay.appendChild(box);
            doc.body.appendChild(overlay);
        
            // 現在のフォントを要素に適用
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
            
            /// フォーカスをオーバーレイに移してキーボードの影響を抑える
            overlay.tabIndex = -1;
            overlay.focus();
            // オーバーレイ領域をクリックで閉じる
            overlay.onclick = (e) => {
              if (e.target === overlay) cleanupAndResolve(false);
            };
          });
        }

        function isPlainObject(obj) {
          return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
        }

        function hasValidStyleProperty(styleObj, validKeys) {
          if (!isPlainObject(styleObj)) return false;
        
          return Object.keys(styleObj).some(key => validKeys.has(key));
        }

        // jsonInputのSAVEボタン
        doc.getElementById('bulkSaveBtn').onclick = () => {
          const bulkJsonInput = doc.getElementById('bulkJsonInput');
          const jsonText = bulkJsonInput.value.trim();
          const VALID_STYLE_KEYS = new Set([
            'color',
            'backgroundColor',
            'fontSize',
            'fontWeight',
            'textShadow',
            'fontFamily',
            'scrollSettings'
          ]);

          if (!jsonText) {
            win.alert('JSONデータを入力してください');
            return;
          }
          
          let parsedData;
          try {
            parsedData = JSON.parse(jsonText);
          } catch (e) {
            win.alert('JSONの解析に失敗しました:\n' + e.message);
            return;
          }
          
          if (!isPlainObject(parsedData)) {
            win.alert('JSONの形式が正しくありません');
            return;
          }

          const keys = Object.keys(parsedData);

          // Styleキーを抽出
          const styleKeys = keys.filter(k => /^Style\d+$/.test(k));

          // --- Styleキーなしの場合 ---
          if (styleKeys.length === 0) {

            // 既存のStyle番号を取得し、空いているStyle数字を付与
            const usedNums = Object.keys(savedStyles)
              .map(k => /^Style(\d+)$/.exec(k))
              .filter(Boolean)
              .map(m => Number(m[1]));

            let newNum = 1;
            while (usedNums.includes(newNum)) {
              newNum++;
            }

            parsedData = {
              [`Style${newNum}`]: parsedData
            };

          }
          
          // --- 保存処理 ---
          for (const key of Object.keys(parsedData)) {
            const styleObj = parsedData[key];

            if (!hasValidStyleProperty(styleObj, VALID_STYLE_KEYS)) {
              win.alert(`${key} に有効なスタイルプロパティがありません`);
              return;
            }

            savedStyles[key] = styleObj;
          }

          win.alert('JSONデータを保存しました！');
          bulkJsonInput.value = '';
          initApplyButtonStyle();

        };

        // APPLYボタン
        async function applyStyleByName(name) {
          
          const proceed = win.confirm(`☆ ${name} を反映します！`);
          if (!proceed) return;
        
          const data = savedStyles[name];
          if (!data) return win.alert(`${name} は保存されていません`);
        
          if (applyStyleData(data)) {
            onetapUI.style.display = 'none';
          }
        }
        
        // jsonInputのAPPLYボタン
        doc.getElementById('applyJsonBtn').onclick = async () => {
          const jsonInput = doc.getElementById('jsonInput');
          const jsonText = jsonInput.value.trim();
        
          if (!jsonText) {
            win.alert('JSONデータを入力してください');
            return;
          }
        
          try {
            let data = JSON.parse(jsonText); // メソッドでJSON構文のチェック

            const keys = Object.keys(data); // 自前でのJSONチェック

            // Styleで始まるキーだけを抽出
            const styleKeys = keys.filter(k => k.startsWith('Style'));

            if (styleKeys.length > 0) {
              if (styleKeys.length === 1 && keys.length === 1) {
                // StyleX が1つだけ → 中身を使う
                data = data[styleKeys[0]];
              } else {
                // Styleが複数、または Style以外と混在
                win.alert('個別のJSONを入力してください');
                jsonInput.value = '';
                return;
              }
            }
        
            const proceed = win.confirm(`☆ JSONデータを反映します！`);
            if (!proceed) return;
        
            if (applyStyleData(data)) {
              onetapUI.style.display = 'none';
              jsonInput.value = '';
            }
          } catch (e) {
            win.alert('JSONの解析に失敗しました:\n' + e.message);
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
        
          // --- 文字スタイル反映 ---
          if (data.color) {
            applyStyle('color', data.color);
            const fgHex = doc.getElementById('fgHex');
            if (fgHex) fgHex.value = data.color;
          }
          if (data.backgroundColor) {
            applyStyle('background-color', data.backgroundColor);
            const bgHex = doc.getElementById('bgHex');
            if (bgHex) bgHex.value = data.backgroundColor;
          }
          if (data.color && data.backgroundColor) {
            applyStyle('scrollbar-color', `${data.color} ${data.backgroundColor}`);
          }
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
        
          // --- スクロールUIのval反映 ---
          if (data.scrollSettings) {
            const s = data.scrollSettings;
            const uiMap = {
              scrollB:        { prop: 'checked', value: s.border },
              scrollC:        { prop: 'checked', value: s.colorIn },
              scrollS:        { prop: 'value',   value: s.shadow },
              scrollBoth:     { prop: 'checked', value: s.both },
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
            // Right/Left/Both の表示更新
            updateDisplay();
          }
          updateControls();
          return true;
        }
        
        // --- 保存済みのすべてのJSONを表示するボタンのイベント登録 ---
        doc.getElementById('viewAllJsonBtn').onclick = () => {
          const newTab = win.open();
          if (!newTab) {
            win.alert('新しいタブを開けませんでした。ポップアップブロックを確認してください。');
            return;
          }
      
          const newDoc = newTab.document;
      
          // head要素
          const head = newDoc.createElement("head");
          
          const meta = newDoc.createElement("meta");
          meta.name = "viewport";
          meta.content = "width=device-width, initial-scale=1";
          head.appendChild(meta);
      
          const title = newDoc.createElement("title");
          title.textContent = "保存済みJSON";
          head.appendChild(title);
      
          const style = newDoc.createElement("style");
          style.textContent = `
            body { font-family: sans-serif; padding: 16px; }
            pre { white-space: pre-wrap; word-wrap: break-word; border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
            .controls { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
            .controls-left { display: flex; align-items: center; }
            button { margin-left: 8px; font-size: 15px; cursor: pointer; }
            button:disabled { opacity: 0.5; cursor: not-allowed; }
            #jsonDisplay[contenteditable="true"] { border: 3px dashed #000000; border-radius: 0px; }
          `;
          head.appendChild(style);

          // ブラウザが生成した空の<head>を組み立てた<head>に差し替え
          newDoc.head.replaceWith(head);
      
          // body要素
          const body = newDoc.body;
          body.innerHTML = `
            <div class="controls">
              <div class="controls-left">
                <label id="prettyPrintLabel">
                  <input type="checkbox" id="prettyPrintCheckbox"> プリティプリント
                </label>
                <button id="copyJsonBtn">コピー</button>
              </div>
              <button id="editBtn">編集</button>
            </div>
            <pre id="jsonDisplay"></pre>
          `;
      
          // scriptロジックをJSとして挿入（即実行される）
          const script = newDoc.createElement("script");
          script.textContent = `
            const savedStyles = ${JSON.stringify(savedStyles)};
            let currentJson = savedStyles;
      
            const jsonDisplay = document.getElementById('jsonDisplay');
            const prettyCheckbox = document.getElementById('prettyPrintCheckbox');
            const prettyLabel = document.getElementById('prettyPrintLabel');
            const copyJsonBtn = document.getElementById('copyJsonBtn');
            const editBtn = document.getElementById('editBtn');
            let isEditing = false;
      
            const updateJsonDisplay = () => {
              if (isEditing) return;
              const jsonText = prettyCheckbox.checked
                ? JSON.stringify(currentJson, null, 2)
                : JSON.stringify(currentJson);
              jsonDisplay.textContent = jsonText;
            };
      
            prettyCheckbox.addEventListener('change', updateJsonDisplay);
      
            copyJsonBtn.addEventListener('click', async () => {
              try {
                const jsonText = jsonDisplay.textContent;
                await navigator.clipboard.writeText(jsonText);
                alert('JSONをコピーしました！');
              } catch (err) {
                alert('コピーに失敗しました: ' + err);
              }
            });
      
            editBtn.addEventListener('click', () => {
              isEditing = !isEditing;
              if (isEditing) {
                editBtn.textContent = '編集中…';
                jsonDisplay.contentEditable = 'true';
                prettyCheckbox.disabled = true;
                prettyLabel.style.opacity = "0.5";
                copyJsonBtn.disabled = true;
              } else {
                editBtn.textContent = '編集';
                jsonDisplay.contentEditable = 'false';
                prettyCheckbox.disabled = false;
                prettyLabel.style.opacity = "1";
                copyJsonBtn.disabled = false;
                try {
                  currentJson = JSON.parse(jsonDisplay.textContent);
                } catch (e) {
                  alert("JSONの形式が正しくありません");
                }
              }
            });
      
            updateJsonDisplay();
      
            // CSSOM、レイアウト計算途中のDOM構築によるviewport崩れ対策
            requestAnimationFrame(() => {
              jsonDisplay.style.display = 'none';
              jsonDisplay.offsetHeight;
              jsonDisplay.style.display = '';
            });
            
          `;
          newDoc.body.appendChild(script);
        };
      });
    }
    openNovelWindow();
  }
  if (document.readyState !== 'loading') {
    run();
  } else {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
})()
