(() => {
// ==============================
// Vertical text
// ==============================
let text = '';
  
  // ruby / rb / rp / rt / em / span のみを保持する関数
  function extractWithRubyTags(node) {
    let result = '';
    
    function traverse(el) {
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          // テキストノードはそのまま追加
          result += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tagName = child.tagName.toLowerCase();
          
          // 保持するタグの場合はタグごと追加
          if (['ruby', 'rb', 'rp', 'rt', 'em', 'span'].includes(tagName)) {
            const attrs = Array.from(child.attributes)
              .map(attr => ` ${attr.name}="${attr.value}"`)
              .join('');
            result += `<${tagName}${attrs}>`;
            traverse(child);
            result += `</${tagName}>`;
          } else if (tagName === 'br') {
            // br タグは改行に変換
            result += '\n';
          } else {
            // それ以外のタグは中身だけ処理
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
    '.widget-episodeTitle, ' + // エピソードタイトル
    '.widget-episodeBody p, ' +// 本文段落
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
  
  // body 直下のすべての要素を非表示
  document.querySelectorAll('body > *').forEach(node => {
    node.style.display = 'none'
  });
  
  // 横スクロールやズームが起きない固定レイアウトにする処理
  let vp = document.querySelector('meta[name="viewport"]');
  if (!vp) {
    vp = document.createElement('meta');
    vp.name = 'viewport';
    document.head.appendChild(vp)
  }
  vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  
  // ページトップ、ヘッダー、フッターなどを非表示に
  const hideStyle = document.createElement('style');
  hideStyle.textContent = `
    #pageTop,
    .c-navigater,
    .js-navigater-totop,
    .global-header,
    .global-footer {
      display: none !important;
    }
  `;
  document.head.appendChild(hideStyle);
  
  const container = document.createElement('div');
  container.id = 'novelDisplay';
  
  // 可視文字長を測るための要素
  const measurer = document.createElement('div');
  
  function visibleLength(html) {
    measurer.innerHTML = html;
    return measurer.textContent.length;
  }
  
  // 総文字数を取得
  const totalVisibleChars = visibleLength(text);
  console.log('総文字数:', totalVisibleChars);
  
  // 1ページあたりの上限文字数
  const MAX_PER_PAGE = 10000;
  
  // 必要なページ数を計算（文字数均等分割）
  const numPages = Math.ceil(totalVisibleChars / MAX_PER_PAGE);
  const charsPerPage = Math.ceil(totalVisibleChars / numPages);
  
  console.log('ページ数:', numPages);
  console.log('1ページあたりの目標文字数:', charsPerPage);
  
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
  
  // 小さめのチャンクに分割
  const chunkSize = 500;
  const chunks = chunkHTMLSafe(text, chunkSize);
  
  // テキスト全体から可視文字位置と対応するHTML位置のマップを作成
  function buildPositionMap(html) {
    const map = []; // [{visiblePos, htmlPos}]
    let htmlPos = 0;
    let visiblePos = 0;
    let inTag = false;
    
    while (htmlPos < html.length) {
      const ch = html[htmlPos];
      
      if (ch === '<') {
        inTag = true;
        htmlPos++;
        continue;
      }
      
      if (ch === '>') {
        inTag = false;
        htmlPos++;
        continue;
      }
      
      if (!inTag) {
        map.push({ visiblePos, htmlPos });
        visiblePos++;
      }
      
      htmlPos++;
    }
    
    map.push({ visiblePos, htmlPos: html.length }); // 最後の位置
    return map;
  }
  
  // 可視文字位置からHTML位置を取得
  function getHtmlPos(map, targetVisiblePos) {
    for (let i = 0; i < map.length; i++) {
      if (map[i].visiblePos >= targetVisiblePos) {
        return map[i].htmlPos;
      }
    }
    return map[map.length - 1].htmlPos;
  }
  
  // 全チャンクを結合
  const fullHTML = chunks.join('');
  measurer.innerHTML = fullHTML;
  const fullText = measurer.textContent;
  
  // 位置マップを作成
  const posMap = buildPositionMap(fullHTML);
  
  // 均等分割でパートを作成
  const parts = [];
  
  let prevEndVisiblePos = 0;  // 前ページの終わり位置を保持
  const overlap = 10;           // 重複させたい文字数
  
  for (let i = 0; i < numPages; i++) {
    let startVisiblePos = prevEndVisiblePos;
    if (i > 0) {
        startVisiblePos = Math.max(0, prevEndVisiblePos - overlap);
    }
    let endVisiblePos = startVisiblePos + charsPerPage;
    
    // 最後のページは残り全部
    if (i === numPages - 1) {
      endVisiblePos = fullText.length;
    } else {
      // 目標位置付近で改行を探す（ページ切り替え位置以降の5%、500文字の範囲）
      const searchStart = endVisiblePos;
      const searchEnd = Math.min(fullText.length, endVisiblePos + Math.floor(charsPerPage * 0.05));
      
      let bestPos = endVisiblePos;
      
      for (let j = searchStart; j < searchEnd; j++) {
        if (fullText[j] === '　') {
          bestPos = j;  // 最初の後方改行に合わせる
          break;
        }
      }
      
      endVisiblePos = bestPos;
    }
    
    // HTML位置に変換
    const startHtmlPos = getHtmlPos(posMap, startVisiblePos);
    const endHtmlPos = getHtmlPos(posMap, endVisiblePos);
    
    let partHTML = fullHTML.slice(startHtmlPos, endHtmlPos);
    // 重複文字7文字に透明度を指定
    if (i > 0 && overlap > 0) {
        // 重複部分の HTML 位置
        const overlapStartHtmlPos = getHtmlPos(posMap, startVisiblePos);
        const overlapEndHtmlPos   = getHtmlPos(posMap, startVisiblePos + overlap);
        
        const beforeOverlap = partHTML.slice(0, overlapEndHtmlPos - startHtmlPos);
        const afterOverlap  = partHTML.slice(overlapEndHtmlPos - startHtmlPos);
        
        partHTML = `<span style="opacity:0.5;">${beforeOverlap}</span>${afterOverlap}`;
    }
    parts.push([partHTML]);
    prevEndVisiblePos = endVisiblePos;
    
    const actualLen = visibleLength(partHTML);
    console.log(`パート${i + 1}: ${actualLen}文字`);
  }
  
  // レンダリング関数
  function renderPart(index) {
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    const list = parts[index] || [];
  
    for (const html of list) {
      const span = document.createElement('span');
      span.innerHTML = html;
      frag.appendChild(span);
    }
    container.appendChild(frag);
  }
  
  // 初回表示
  let currentIndex = 0;
  renderPart(currentIndex);
  
  // ページ切り替え
  let promptShownForward = false;
  let promptShownBackward = false;
  let isSwitching = false;
  
  window.addEventListener('scroll', () => {
    if (isSwitching) return;
  
    const scrollBottom = window.scrollY + window.innerHeight;
    const scrollTop = window.scrollY;
    const bodyHeight = document.body.offsetHeight;
  
    // 下方向: 最下部で次パート
    if (
      totalVisibleChars > 10000 &&
      scrollBottom >= bodyHeight - 5 &&
      currentIndex < parts.length - 1 &&
      !promptShownForward
    ) {
      if (typeof scrollSliderRight !== 'undefined') scrollSliderRight.value = 0;
      if (typeof scrollSliderLeft !== 'undefined') scrollSliderLeft.value = 0;
      if (typeof scrollSpeed !== 'undefined') scrollSpeed = 0;
  
      promptShownForward = true;
      const ok = window.confirm("続きを読み込みますか？");
      if (ok) {
        isSwitching = true;
        currentIndex++;
        renderPart(currentIndex);
        window.scrollTo(0, 0);
        setTimeout(() => { isSwitching = false; }, 5000);
        promptShownForward = false;
        promptShownBackward = false;
      }
    } else if (scrollBottom < bodyHeight - window.innerHeight / 100) {
      promptShownForward = false;
    }
  
    // 上方向: 最上部で前パート
    if (
      currentIndex > 0 &&
      scrollTop <= 5 &&
      !promptShownBackward
    ) {
      if (typeof scrollSliderRight !== 'undefined') scrollSliderRight.value = 0;
      if (typeof scrollSliderLeft !== 'undefined') scrollSliderLeft.value = 0;
      if (typeof scrollSpeed !== 'undefined') scrollSpeed = 0;
  
      promptShownBackward = true;
      const ok = window.confirm("前の文章に戻りますか？");
      if (ok) {
        isSwitching = true;
        currentIndex--;
        renderPart(currentIndex);
        const prevPartHeight = container.scrollHeight;
        window.scrollTo(0, prevPartHeight - window.innerHeight);
        setTimeout(() => { isSwitching = false; }, 5000);
        promptShownForward = false;
        promptShownBackward = false;
      }
    } else if (scrollTop > window.innerHeight / 100) {
      promptShownBackward = false;
    }
  });

  // スタイル
  container.style.cssText = `
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
  `;
  document.body.appendChild(container);
  
  const initialBodyStyle = `
  display: flex;
  justify-content: center;
  font-family: '游明朝', 'Yu Mincho', YuMincho, 'Hiragino Mincho Pro', serif;
  font-feature-settings: 'pkna';
  text-shadow: 0 0 0px;
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
`;
document.body.style.cssText = initialBodyStyle;
// === 右スライダー ===
const scrollSliderRight = document.createElement('input');
scrollSliderRight.type = 'range';
scrollSliderRight.min = 0;
scrollSliderRight.max = 25;
scrollSliderRight.value = 0;
Object.assign(scrollSliderRight.style, {
  all: 'unset',
  position: 'fixed',
  height: '210vh',
  bottom: '-108vh',
  right: '30px',
  zIndex: '9999',
  width: '80px',
  opacity: '1',
});
document.body.appendChild(scrollSliderRight);
// === 左スライダー ===
const scrollSliderLeft = document.createElement('input');
scrollSliderLeft.type = 'range';
scrollSliderLeft.min = 0;
scrollSliderLeft.max = 25;
scrollSliderLeft.value = 0;
Object.assign(scrollSliderLeft.style, {
  all: 'unset',
  position: 'fixed',
  height: '210vh',
  bottom: '-108vh',
  left: '30px',
  zIndex: '9999',
  width: '80px',
  opacity: '1',
  direction: 'rtl', // 左用は増加方向反転
});
document.body.appendChild(scrollSliderLeft);

// === スクロール処理 ===
const scroller = document.scrollingElement || document.documentElement;
let scrollSpeed = 0;
let lastTimestamp = null;

function forceScroll(timestamp) {
  if (lastTimestamp !== null && scrollSpeed !== 0) {
    const elapsed = timestamp - lastTimestamp;
    scroller.scrollTop += (scrollSpeed * elapsed) / 1000;
  }
  lastTimestamp = timestamp;
  requestAnimationFrame(forceScroll);
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
requestAnimationFrame(forceScroll);
  
// ==============================
// Slider Settings
// ==============================
const scrollUI = document.createElement('div');
Object.assign(scrollUI.style, {
  all: 'unset',
  position: 'fixed',
  top: '10px',
  left: '10px',
  padding: '8px',
  background: 'inherit',
  border: '1px solid',
  borderRadius: '4px',
  fontSize: '14px',
  zIndex: '10002',
  fontFamily: 'sans-serif',
});
scrollUI.innerHTML = `
  <div style="font-weight:bold;">< Slider Settings ></div>
  <label><input id="scrollB" class="settingCheckbox" type="checkbox"><span class="labelText"> Border</span></label><br>
  <label><input id="scrollC" class="settingCheckbox" type="checkbox"><span class="labelText"> Color in</span></label><br>
  <label>Shadow: <input id="scrollS" class="settingInputbox" type="number" value="0"> px</label><br>
  <label><input id="scrollBoth" class="settingCheckbox" type="checkbox"><span class="labelText"> Both sides</span></label><br>
  <label><input id="scrollRight" class="settingCheckbox" type="checkbox" checked><span class="labelText"> Right side</span></label><br>
  <label><input id="scrollLeft" class="settingCheckbox" type="checkbox"><span class="labelText"> Left side</span></label><br>
  <label>Position: <input id="scrollX" class="settingInputbox" type="number" value="30"> px</label><br>
  <label>Width: <input id="scrollW" class="settingInputbox" type="number" value="80"> px</label><br>
  <label>Opacity: <input id="scrollO" class="settingInputbox" type="text" inputmode="decimal" min="0" max="1" step="0.05" value="1"> (0~1)</label><br>
  <label>Speed scale: <input id="scrollSpeedScale" class="settingInputbox" type="number" min="0" max="20" step="1" value="10"> (0~20)</label><br>
  <label><input id="scrollHide" class="settingCheckbox" type="checkbox"><span class="labelText"> Slider ball</span></label><br>
`;
document.body.appendChild(scrollUI);
document.querySelectorAll('.settingCheckbox').forEach(cb => {
  Object.assign(cb.style, {
    all: 'revert',
    height: '15px',
    width: '15px',
    verticalAlign: 'middle',
  });
});
document.querySelectorAll('.settingInputbox').forEach(cb => {
  Object.assign(cb.style, {
    all: 'initial',
    width: '60px',
    border: '1px solid',
    color: 'unset',
  });
});
document.querySelectorAll('.labelText').forEach(span => {
  Object.assign(span.style, {
    position: 'fixed',
    paddingTop: '1.5px',
  });
});
// === イベント ===
// Border
document.getElementById('scrollB').addEventListener('change', e => {
if (e.target.checked) {
    if (scrollC.checked) scrollC.checked = false;
    scrollSliderRight.style.border = scrollSliderLeft.style.border = '1px solid';
    scrollSliderRight.style.setProperty("background", "transparent", "important");
    scrollSliderLeft.style.setProperty("background", "transparent", "important");
  } else {
    scrollSliderRight.style.border = scrollSliderLeft.style.border = 'none';
  }
});
// Color in
document.getElementById('scrollC').addEventListener('change', e => {
  if (e.target.checked) {
    if (scrollB.checked) scrollB.checked = false;
    scrollSliderRight.style.border = scrollSliderLeft.style.border = 'none';
    const borderColor = 'currentColor'; // border と同じ色
    scrollSliderRight.style.setProperty("background", borderColor, "important");
    scrollSliderLeft.style.setProperty("background", borderColor, "important");
  } else {
    scrollSliderRight.style.setProperty("background", "transparent", "important");
    scrollSliderLeft.style.setProperty("background", "transparent", "important");
  }
});
// Shadow
const scrollS = document.getElementById('scrollS');
scrollS.addEventListener('input', () => {
  let val = Number(scrollS.value) || 0;
  if (val < 0) {
    // マイナス値のときは inset にして、値は絶対値に直す
    scrollSliderRight.style.boxShadow = `inset 0 0 ${Math.abs(val)}px`;
    scrollSliderLeft.style.boxShadow  = `inset 0 0 ${Math.abs(val)}px`;
  } else {
    // プラス値のときは通常
    scrollSliderRight.style.boxShadow = `0 0 ${val}px`;
    scrollSliderLeft.style.boxShadow  = `0 0 ${val}px`;
  }
});
// 右側、左側、両側
const rightbox = document.getElementById('scrollRight');
const leftbox = document.getElementById('scrollLeft');
const bothbox = document.getElementById('scrollBoth');
// 最初に「Right side」にチェック
rightbox.checked = true;
scrollSliderRight.style.display = 'block';
scrollSliderLeft.style.display = 'none';
// Rightチェックイベント
rightbox.addEventListener('change', e => {
  if (e.target.checked) {
    if (bothbox.checked) {
      bothbox.checked = false;
    }
    if (leftbox.checked) {
        leftbox.checked = false;
      }
    scrollSliderRight.style.display = 'block';
    scrollSliderLeft.style.display = 'none';
  }else {
    scrollSliderRight.style.display = 'none';
    scrollSliderLeft.style.display = 'none';
  }
});
// Leftチェックイベント
leftbox.addEventListener('change', e => {
  if (e.target.checked) {
    if (bothbox.checked) {
      bothbox.checked = false;
    }
    if (rightbox.checked) {
      rightbox.checked = false;
    }
    scrollSliderRight.style.display = 'none';
    scrollSliderLeft.style.display = 'block';
  } else {
    scrollSliderRight.style.display = 'none';
    scrollSliderLeft.style.display = 'none';
  }
});
// Bothチェックイベント
bothbox.addEventListener('change', e => {
  if (e.target.checked) {
    if (rightbox.checked) {
      rightbox.checked = false;
    }
    if (leftbox.checked) {
      leftbox.checked = false;
    }
    scrollSliderLeft.style.display = 'block';
    scrollSliderRight.style.display = 'block';
  } else if (!leftbox.checked) {
    scrollSliderLeft.style.display = 'none';
    scrollSliderRight.style.display = 'none';
  } else {
    scrollSliderLeft.style.display = 'none';
    scrollSliderRight.style.display = 'none';
  } 
});
// 位置、長さ、透明度
document.getElementById('scrollX').addEventListener('input', e => {
  const val = parseInt(e.target.value, 10);
  scrollSliderRight.style.right = scrollSliderLeft.style.left = `${val}px`;
});
document.getElementById('scrollW').addEventListener('input', e => {
  const val = parseInt(e.target.value, 10);
  scrollSliderRight.style.width = scrollSliderLeft.style.width = `${val}px`;
});
document.getElementById('scrollO').addEventListener('input', e => {
  const val = parseFloat(e.target.value);
  scrollSliderRight.style.opacity = scrollSliderLeft.style.opacity = val;
});
const opacityInput = document.getElementById('scrollO');
let lastValue = opacityInput.value; // 直前の値を保持
opacityInput.addEventListener('input', e => {
  const currentValue = e.target.value;
  // 一瞬だけ「0」→「0.」に補完
  if (currentValue === '0' && lastValue !== '0.') {
    e.target.value = '0.';
  }
  const num = parseFloat(e.target.value);
  if (!isNaN(num) && num >= 0 && num <= 1) {
    scrollSliderRight.style.opacity = scrollSliderLeft.style.opacity = num;
  }
  lastValue = e.target.value; // 今の値を保存
});
// フォーカス時に 0 → 0. に補完（あれば）
opacityInput.addEventListener('focus', e => {
  if (e.target.value === '0') {
    e.target.value = '0.';
  }
});
// フォーカスが外れたときに 0. → 0
opacityInput.addEventListener('blur', e => {
  if (e.target.value === '0.' || e.target.value === '') {
    e.target.value = '0';
    scrollSliderRight.style.opacity = scrollSliderLeft.style.opacity = 0;
  }
}); 
// スピードスケール  
const speedScaleInput = document.getElementById('scrollSpeedScale');
let speedScale = parseFloat(speedScaleInput.value);

speedScaleInput.addEventListener('input', e => {
  const num = parseFloat(e.target.value);
  if (!isNaN(num)) {
    speedScale = num;
    syncScrollSpeed(scrollSliderRight.value);
  }
});
// 入力値を 0 ～ 20 に制限
speedScaleInput.addEventListener('input', e => {
  let num = parseFloat(e.target.value);
  if (isNaN(num)) return;
  if (num > 20) {
    num = 20;
    e.target.value = 20;
  } else if (num < 0) {
    num = 0;
    e.target.value = 0;
  }
  speedScale = num;
  syncScrollSpeed(scrollSliderRight.value);
});
// Slider ball 
document.getElementById('scrollHide').addEventListener('change', e => {
  if (e.target.checked) {
    scrollSliderRight.style.height = '200vh';
    scrollSliderRight.style.bottom = '-98vh';
    scrollSliderLeft.style.height = '200vh';
    scrollSliderLeft.style.bottom = '-98vh';
  } else {
    scrollSliderRight.style.height = '210vh';
    scrollSliderRight.style.bottom = '-108vh';
    scrollSliderLeft.style.height = '210vh';
    scrollSliderLeft.style.bottom = '-108vh';
  }
});
// ===開閉ボタン ===
const scrollUIToggle = document.createElement('button');
scrollUIToggle.innerHTML = `
<svg width="14" height="14" viewBox="0 0 24 24">
  <polygon points="12,6.144 20,20 4,20" fill="none" stroke="currentColor" stroke-width="1"/>
</svg>
`;
Object.assign(scrollUIToggle.style, {
  all: 'initial',
  position: 'fixed',
    top: '10px',
    left: '18px',
    fontSize: '14px',
    color: 'unset',
    opacity: '0.3',
    cursor: 'pointer',
    zIndex: '10001',
    display: 'block'
});
document.body.appendChild(scrollUIToggle);

scrollUI.style.display = 'none';
  scrollUIToggle.addEventListener('click', () => {
  scrollUI.style.display = 'block';
});
const scrollSCloseBtn = document.createElement('button');
scrollSCloseBtn.textContent = '✕';
Object.assign(scrollSCloseBtn.style, {
  all: 'initial',
  position: 'absolute',
  top: '4px',
  right: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'unset',
});
scrollUI.appendChild(scrollSCloseBtn);

scrollSCloseBtn.addEventListener('click', () => {
  scrollUI.style.display = 'none';
});

// ==============================
// Font Control Panel
// ==============================
['fontPanel', 'fontOpenBtn'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.remove();
});

// 操作対象は #novelDisplay
let target = document.getElementById('novelDisplay');
if (!target) {
  console.error('#novelDisplay が見つかりません');
}

// パネルコンテナ
const panel = document.createElement('div');
panel.id = 'fontPanel';
Object.assign(panel.style, {
  lineHeight: 'initial',
  position: 'fixed',
  top: '10px',
  right: '10px',
  padding: '0 8px',
  paddingBottom: '8px',
  width: '270px',
  height: '87px',
  heighr: '50px', 
  border: '1px solid',
  borderRadius: '4px',
  zIndex: '10000',
  display: 'none',
  fontFamily: 'sans-serif'
});

// モードボタン
const modes = ['Font shadow','Font weight','Font size'];
let currentMode = 'Font size';

const modeContainer = document.createElement('div');
Object.assign(modeContainer.style, {
  display: 'block',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '8px'
});

modes.forEach(mode => {
  const btn = document.createElement('button');
  btn.textContent = mode;
  Object.assign(btn.style, {
    all: 'initial',
    fontSize: '13px',
    padding: '2px 6px',
    border: '1px solid',
    borderRadius: '4px',
    color: 'unset',
    opacity: '0.5',
    cursor: 'pointer',
    textAlign: 'left',
  });
  if (mode === 'Font weight') {
    btn.style.margin = '0 4px';
  }
  if (mode === currentMode) {
    btn.style.border = '1px solid';   // 初期選択のスタイル
    btn.style.opacity = '1';
    btn.style.boxShadow = 'inset 0 0 3px';
  }
  btn.addEventListener('click', () => {
    currentMode = mode;
    [...modeContainer.children].forEach(c => {
      c.style.border = '1px solid';   // 他のボタンに付ける
      c.style.opacity = '0.6';
      c.style.boxShadow = 'none';
    });
    btn.style.border = ' 1px solid';
    btn.style.opacity = '1';
    btn.style.boxShadow = 'inset 0 0 3px'; // 選択中に付ける
    updateControls();
  });
  modeContainer.appendChild(btn);
});

// コントロールエリア
const controlArea = document.createElement('div');
Object.assign(controlArea.style, {
});

// ラベル
const label = document.createElement('div');
Object.assign(label.style, {
  fontSize: '14px',
  marginBottom: '4px'
});
  
// 増減ボタン
const decreaseBtn = document.createElement('button');
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
const increaseBtn = document.createElement('button');
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
decreaseBtn.addEventListener('click', () => {
  let value = parseInt(slider.value) - parseInt(slider.step || 1);
  if (value >= parseInt(slider.min)) {
    slider.value = value;
    slider.dispatchEvent(new Event('input')); // スライダーの処理を呼び出す
  }
});

increaseBtn.addEventListener('click', () => {
  let value = parseInt(slider.value) + parseInt(slider.step || 1);
  if (value <= parseInt(slider.max)) {
    slider.value = value;
    slider.dispatchEvent(new Event('input')); // スライダーの処理を呼び出す
  }
});
  
// スライダー
const slider = document.createElement('input');
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
const sliderContainer = document.createElement('div');
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
document.body.appendChild(panel);

// Font Family セレクトボックス
const fontFamilyContainer = document.createElement('div');
Object.assign(fontFamilyContainer.style, {
  display: 'flex',
});

// ラベル
const fontFamilyLabel = document.createElement('div');
fontFamilyLabel.textContent = 'Font family:';
Object.assign(fontFamilyLabel.style, {
  fontSize: '14px',
  marginBottom: '4px'
});
fontFamilyContainer.appendChild(fontFamilyLabel);

// セレクトボックス
const fontSelect = document.createElement('select');
  Object.assign(fontSelect.style, {
    all: 'initial',
    alignItems: 'center',
    border: '1px solid',
    color: 'unset',
    marginLeft: '10px',
    width: '155px',
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
  const opt = document.createElement('option');
  opt.value = font;
  opt.textContent = font;
  fontSelect.appendChild(opt);
});

// セレクト切り替え時にフォント適用
fontSelect.addEventListener('change', () => {
  const font = fontSelect.value;
  
  if (font === '游明朝') {
    document.body.style.cssText = initialBodyStyle;
    if (target) target.style.fontFamily = '';
    return;
  }
  if (font === 'sans-serif') {
    if (target) target.style.fontFamily = 'sans-serif';
    return;
  }
  
  const id = "gf-font-" + font.replace(/\s+/g, '-');
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" + font.replace(/ /g, '+') + "&display=swap";
    document.head.appendChild(link);
  }

  if (target) {
    target.style.fontFamily = `'${font}', sans-serif`;
  }
});
fontFamilyContainer.appendChild(fontSelect);

// controlArea に追加
controlArea.appendChild(fontFamilyContainer);

// 開閉ボタン
const openBtn = document.createElement('div');
openBtn.id = 'fontOpenBtn';
openBtn.innerHTML = `
<svg width="14" height="14" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1"/>
</svg>
`;
Object.assign(openBtn.style, {
  all: 'initial',
  position: 'fixed',
  top: '10px',
  right: '18px',
  opacity: '0.3',
  color: 'unset',
  cursor: 'pointer',
  zIndex: '10001'
});
openBtn.addEventListener('click', () => {
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  openBtn.style.display = panel.style.display === 'none' ? 'block' : 'none';
});
document.body.appendChild(openBtn);
  // 閉じるボタン ✕
const closeBtn = document.createElement('div');
closeBtn.textContent = '✕';
Object.assign(closeBtn.style, {
  all: 'initial',
  position: 'absolute',
  top: '0px',
  right: '7px',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'unset',
});
closeBtn.addEventListener('click', () => {
  panel.style.display = 'none';
  openBtn.style.display = 'block';
});
panel.appendChild(closeBtn);
// 初期化
updateControls();

// ==============================
// Color Pickr
// ============================== 
if (window.__pickrLoaded) return;
window.__pickrLoaded = true;

const load = (tag, attrs) => new Promise((resolve, reject) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    // 属性として設定
    el.setAttribute(k, v);
  }
  el.onload = resolve;
  el.onerror = reject;
  document.head.appendChild(el);
});

// バージョン固定とSRI対応可能な形に変更
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
    const style = document.createElement('style');
    style.textContent = `
      /* ---- #pickrContainer 関連 ---- */
      #pickrContainer {
        all: initial;
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 999999;
        color: unset;
        background: unset;
        padding: 7px;
        padding-bottom: 0;
        border: 1px solid;
        border-radius: 8px;
        font-family: sans-serif;
        box-shadow: 0 0 4px;
      }

      #pickrContainer,
      #pickrContainer *,
      .pcr-app,
      .pcr-app * {
        line-height: initial !important;
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
        color: unset;
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
        all: unset;
        font-size: 14px;
        margin: 0px 0px;
        border: 1px solid;
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
        background: unset !important;
        border: 1px solid !important;
      }

      .pcr-selection {
        height: 114px !important;
      }

      .pcr-color-palette {
        height: auto !important;
        border: 1px solid !important;
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
        border: 1px solid;
        border-radius: 2px;
        background-size: 0;
        transition: all .3s;
      }

      .pcr-color-preview {
        width: 22px !important;
        margin-right: 10px !important;
        border: 1px solid; !important;
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
        color: #000000 !important;
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
        background: #97DDC8! important;
        color: #000000 !important;
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
    window.applyStyle = (prop, value) => {
      if (!value) return;
      const id = prop === 'color' ? '__fgOverride' : '__bgOverride';
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('style');
        el.id = id;
        document.head.appendChild(el)
      }
      el.textContent = `
      *:not(#pickrContainer):not(#pickrContainer *):not(.pcr-app):not(.pcr-app *) {
        ${prop}: ${value};
      }`
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
              color: #000000;
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
    // ランダムに生成される色のhsl範囲
    function getRandomHSL() {
      return {
        h: Math.floor(Math.random() * 360),
        s: Math.floor(Math.random() * 101) ,
        l: Math.floor(Math.random() * 101)
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
    // Pickr UI コンテナとスタイルを初期非表示にする
    container.style.display = 'none';
    style.disabled = true;
    window.__pickrLoaded = false;
    // □ ボタンを作成して表示
    const pickrOpen = document.createElement('div');
    pickrOpen.id = 'pickrOpen';
    pickrOpen.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1"/>
    </svg>
    `;
    Object.assign(pickrOpen.style, {
      all: 'initial',
      cursor: 'pointer',
      position: 'fixed',
      top: '80px',
      right: '18px',
      opacity: '0.3',
      color: 'unset',
      zIndex: '999999'
    });
    document.body.appendChild(pickrOpen);
    // □ をクリックしたら Pickr UI を表示
    pickrOpen.onclick = () => {
      container.style.display = 'block';
      style.disabled = false;
      pickrOpen.remove();
      window.__pickrLoaded = true;
    };
    // Pickr の閉じるボタンの処理
    document.getElementById('pickrClose').onclick = () => {
      // □ ボタンを再生成
      const pickrOpen = document.createElement('div');
      pickrOpen.id = 'pickrOpen';
      pickrOpen.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
        `;
      Object.assign(pickrOpen.style, {
        all: 'initial',
        cursor: 'pointer',
        position: 'fixed',
        top: '80px',
        right: '18px',
        opacity: '0.3',
        color: 'unset',
        zIndex: '999999'
      });
      document.body.appendChild(pickrOpen);
      // Pickr UI を非表示
      container.style.display = 'none';
      style.disabled = true;
      window.__pickrLoaded = false;
      // □ をクリックしたら Pickr UI を復元
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
  
// ==============================
// ローカルサーバーで各値を保存/反映
// ============================== 
const straddleUI = document.createElement('div');
Object.assign(straddleUI.style, {
  all: 'unset',
  position: 'fixed',
  top: '80px',
  left: '10px',
  padding: '8px',
  border: '1px solid',
  borderRadius: '4px',
  fontSize: '14px',
  background: 'inherit',
  zIndex: '10002',
  fontFamily: 'sans-serif',
  display: 'none',
});

straddleUI.innerHTML = `
  <div class="ui-header">
    <span>Apply Style with One Tap</span>
    <button id="closeUIBtn" style="border:none; padding-left:10px;">✕</button>
  </div>
  <div class="ui-buttons">
    <!-- 1セット目 -->
    <div class="button-set">
      <span class="label">1.</span>
      <button id="saveBtn1" style="padding: 2px 4px;">SAVE</button>
      <span class="label">⇒</span>
      <button id="applyBtn1" style="padding: 2px 4px;">APPLY</button>
    </div>
    <!-- 2セット目 -->
    <div class="button-set">
      <span class="label">2.</span>
      <button id="saveBtn2" style="padding: 2px 4px;">SAVE</button>
      <span class="label">⇒</span>
      <button id="applyBtn2" style="padding: 2px 4px;">APPLY</button>
    </div>
    <!-- 3セット目 -->
    <div class="button-set">
      <span class="label">3.</span>
      <button id="saveBtn3" style="padding: 2px 4px;">SAVE</button>
      <span class="label">⇒</span>
      <button id="applyBtn3" style="padding: 2px 4px;">APPLY</button>
    </div>
    <!-- 4セット目 -->
    <div class="button-set">
      <span class="label">4.</span>
      <button id="saveBtn4" style="padding: 2px 4px;">SAVE</button>
      <span class="label">⇒</span>
      <button id="applyBtn4" style="padding: 2px 4px;">APPLY</button>
    </div>
  </div>
`;
// ヘッダーのスタイル
const header = straddleUI.querySelector('.ui-header');
Object.assign(header.style, {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontWeight: 'bold',
  marginBottom: '8px', // 下にスペースを追加
});
// ボタン群のスタイル
const buttons = straddleUI.querySelector('.ui-buttons');
Object.assign(buttons.style, {
  display: 'flex',
  flexDirection: 'column',
  marginLeft: '5px',
  gap: '10px',
  borderRadius: '2px',
  fontSize: '14px',
});
  //label
  document.querySelectorAll('.label').forEach(span => {
  span.style.all = 'initial',
  span.style.color = 'inherit';
  span.style.background = 'inherit';
  span.style.fontSize = '14px';
});
// ☆ ボタン
const toggleBtn = document.createElement('button');
toggleBtn.innerHTML = `
<svg width="14" height="14" viewBox="0 0 24 24">
  <polygon points="12,2 15,10 23,10 17,15 19,23 12,18 5,23 7,15 1,10 9,10" fill="none" stroke="currentColor" stroke-width="1"/>
</svg>
`;
Object.assign(toggleBtn.style, {
  all: 'initial',
  position: 'fixed',
  top: '80px',
  left: '18px',
  zIndex: '10001',
  opacity: '0.3',
});
document.body.appendChild(toggleBtn);
document.body.appendChild(straddleUI);

// --- ボタンごとのイベント登録 ---
document.getElementById('saveBtn1').onclick = () => saveStyle('style1');
document.getElementById('applyBtn1').onclick = () => applyStyleByName('style1');
document.getElementById('saveBtn2').onclick = () => saveStyle('style2');
document.getElementById('applyBtn2').onclick = () => applyStyleByName('style2');
document.getElementById('saveBtn3').onclick = () => saveStyle('style3');
document.getElementById('applyBtn3').onclick = () => applyStyleByName('style3');
document.getElementById('saveBtn4').onclick = () => saveStyle('style4');
document.getElementById('applyBtn4').onclick = () => applyStyleByName('style4');
  
// APPLYボタンの色を先に取得
async function initApplyButtonStyle() {
  const styles = ['style1', 'style2', 'style3', 'style4'];

  for (const styleName of styles) {
    try {
      const res = await fetch(`http://localhost:3000/get/${styleName}`);
      const data = await res.json();
      const applyBtn = document.getElementById(`applyBtn${styleName.slice(-1)}`);
      if (applyBtn && data) {
        if (data.color) applyBtn.style.color = data.color;
        if (data.backgroundColor) applyBtn.style.backgroundColor = data.backgroundColor;
      }
    } catch (e) {}
  }
}
// ページ読み込み時に呼ぶ
initApplyButtonStyle();


// ☆ UIを開く
toggleBtn.onclick = () => {
  straddleUI.style.display = 'block';
};
// ✕ UIを閉じる
document.getElementById('closeUIBtn').onclick = () => {
  straddleUI.style.display = 'none';
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
  const target = document.getElementById('novelDisplay');
  if (!target) return alert('対象要素が見つかりません');
  
  const computed = window.getComputedStyle(target);
  let { color, backgroundColor, fontSize, fontWeight, textShadow } = computed;
  const fontFamily = fontSelect.value;

  // blur 値を抽出
  let blur = null;
  const match = textShadow.match(/(-?\d+)px$/);
  if (match) {
    blur = parseInt(match[1], 10);
  }
  // HEX に変換
  color = rgbToHex(color);
  backgroundColor = rgbToHex(backgroundColor);

  // === スクロールUIの値を取得 ===
  const scrollSettings = {
    border: document.getElementById('scrollB').checked,
    colorIn: document.getElementById('scrollC').checked,
    shadow: Number(document.getElementById('scrollS').value),
    both: document.getElementById('scrollBoth').checked,
    right: document.getElementById('scrollRight').checked,
    left: document.getElementById('scrollLeft').checked,
    position: Number(document.getElementById('scrollX').value),
    width: Number(document.getElementById('scrollW').value),
    opacity: parseFloat(document.getElementById('scrollO').value),
    speedScale: parseFloat(document.getElementById('scrollSpeedScale').value),
    hideBall: document.getElementById('scrollHide').checked,
  };
// --- ユーザーに確認 ---
  const confirmMessage =
    `☆ http://localhost:3000 に保存しますか？\n\n` +
    `--- スタイル設定 ---\n` +
    `BG: ${backgroundColor}\n` +
    `FG: ${color}\n` +
    `FontSize: ${fontSize}\n` +
    `FontWeight: ${fontWeight}\n` +
    `FontShadow: ${blur}px\n` +
    `FontFamily: ${fontFamily}\n\n` +
    `--- スライダー設定 ---\n` +
    JSON.stringify(scrollSettings, null, 2);

  if (!confirm(confirmMessage)) {
    return; // 「いいえ」の場合は中断
  }

  try {
    await fetch('http://localhost:3000/save', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ 
        name,
        color, 
        backgroundColor, 
        fontSize, 
        fontWeight, 
        textShadow: blur,
        fontFamily,
        scrollSettings
      })
    });
    // 保存成功後にAPPLYボタンに色を反映
    const applyBtn = document.getElementById(
    name === 'style1' ? 'applyBtn1' :
    name === 'style2' ? 'applyBtn2' :
    name === 'style3' ? 'applyBtn3' :
    'applyBtn4'
  );
  if (applyBtn) {
    applyBtn.style.color = color;
    applyBtn.style.backgroundColor = backgroundColor;
  }
    alert(`☆ ${name} を保存しました！`);
  } catch(e) {
    if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
      alert('ローカルサーバーが見つかりません。\nhttp://localhost:3000 を立ち上げてから再試行してください。');
    } else {
      alert('保存に失敗しました: ' + e);
    }
  }
};

// APPLYボタン
async function applyStyleByName(name) {
  const target = document.getElementById('novelDisplay');
  if (!target) return alert('対象要素が見つかりません');

  // --- ユーザーに確認 ---
  const proceed = confirm(`☆ ${name} を反映します！`);
  if (!proceed) return;

  try {
    const res = await fetch(`http://localhost:3000/get/${name}`);
    const data = await res.json();
    if (!data) return alert(`${name} は保存されていません`);
    
    // --- 文字スタイル反映 ---
    if (data.color) {
      applyStyle('color', data.color);
      const fgHex = document.getElementById('fgHex');
      if (fgHex) fgHex.value = data.color;
    }
    if (data.backgroundColor) {
      applyStyle('background-color', data.backgroundColor);
      const bgHex = document.getElementById('bgHex');
      if (bgHex) bgHex.value = data.backgroundColor;
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

    // --- スクロールUIを反映 ---
    if (data.scrollSettings) {
      const s = data.scrollSettings;

      document.getElementById('scrollB').checked = s.border;
      document.getElementById('scrollC').checked = s.colorIn;
      document.getElementById('scrollS').value = s.shadow;
      document.getElementById('scrollBoth').checked = s.both;
      document.getElementById('scrollRight').checked = s.right;
      document.getElementById('scrollLeft').checked = s.left;
      document.getElementById('scrollX').value = s.position;
      document.getElementById('scrollW').value = s.width;
      document.getElementById('scrollO').value = s.opacity;
      document.getElementById('scrollSpeedScale').value = s.speedScale;
      document.getElementById('scrollHide').checked = s.hideBall;

      // イベント強制発火
      document.getElementById('scrollB').dispatchEvent(new Event('change'));
      document.getElementById('scrollC').dispatchEvent(new Event('change'));
      document.getElementById('scrollS').dispatchEvent(new Event('input'));
      document.getElementById('scrollRight').dispatchEvent(new Event('change'));
      document.getElementById('scrollLeft').dispatchEvent(new Event('change'));
      document.getElementById('scrollBoth').dispatchEvent(new Event('change'));
      document.getElementById('scrollX').dispatchEvent(new Event('input'));
      document.getElementById('scrollW').dispatchEvent(new Event('input'));
      document.getElementById('scrollO').dispatchEvent(new Event('input'));
      document.getElementById('scrollSpeedScale').dispatchEvent(new Event('input'));
      document.getElementById('scrollHide').dispatchEvent(new Event('change'));
    }

    updateControls();
    straddleUI.style.display = 'none';
  } catch(e) {
    if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
      alert('ローカルサーバーが見つかりません。\nhttp://localhost:3000 を立ち上げてから再試行してください。');
    } else {
      alert('データの取得に失敗しました: ' + e);
    }
  }
};

})()
