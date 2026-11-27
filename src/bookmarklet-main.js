import { createEqualsIcon, makeDraggable, parseTag, render } from './shared.js';
import mainStyles from '../build/bookmarklet-main.min.css';
import {
  panel as panelTpl,
  settings as settingsTpl,
  settingsItem as settingsItemTpl,
  settingsNotice as settingsNoticeTpl,
  novelWindow as novelWindowTpl,
} from '../build/templates.json';

import novelWindowCode from '../build/novel-window.bundle.txt';

(() => {

  // WebページのDOM完成を待って実行
  function run() {

    // PC幅でレンダリングされたページがスマホで縮小表示される場合のサイズ補正
    const scale = Math.max(1, window.innerWidth / window.outerWidth);
    const scalePx = n => Math.round(n * scale);

    // 補正済みのサイズをCSS変数として渡す
    const shadowHost = document.createElement('div');
    const cssVars = {
      '--base-font-size': scalePx(13),
      '--handle-w':       scalePx(22),
      '--handle-h':       scalePx(24),
      '--checkbox-size':  scalePx(12),
    };
    for (const [name, px] of Object.entries(cssVars)) {
      shadowHost.style.setProperty(name, `${px}px`);
    }
    document.body.appendChild(shadowHost);

    const shadow = shadowHost.attachShadow({ mode: 'open' });
    const styleEl = document.createElement('style');
    styleEl.textContent = mainStyles;
    shadow.appendChild(styleEl);

    const textInfoPanel = document.createElement('div');
    textInfoPanel.className = 'panel';
    shadow.appendChild(textInfoPanel);

    /* --- 定数・設定 --- */

    const ALLOWED_TAGS = new Set(['ruby', 'rt', 'em']);

    const MAX_CHARS_PER_PAGE = 10000;
    const TAIL_PREVIEW_CHARS = 10;
    const DELIMITER_SEARCH_MARGIN = 0.05;
    const DELIMITER_CODES = new Set([
      12288, // 　（全角スペース）
      12290, // 。
      12301, // 」
      8230,  // …
    ]);

    const SETTINGS_KEY = 'nvl-vwr-bkmrklt:settings';
    const FIELDS = [
      { key: 'includeTitle', label: 'タイトル', selectors: [
        { selector: '.title',                          extract: true }, // 青空文庫
        { selector: 'body > h1',                       extract: true }, // 青空文庫
        { selector: '.p-novel__title',                 extract: true }, // なろう
        { selector: '.p-novel__subtitle-episode',      extract: true }, // なろう（スマホ）
        { selector: '.widget-episodeTitle',            extract: true }, // カクヨム
        { selector: '.p-novel-episode__episode-title', extract: true }, // アルファポリス
      ] },
      { key: 'includeAuthor', label: '作者名', selectors: [
        { selector: '.author',                    extract: true }, // 青空文庫
        { selector: '.editor',                    extract: true }, // 青空文庫
        { selector: 'body > h2',                  extract: true }, // 青空文庫
        { selector: '#contentMain-header-author', extract: false }, // カクヨム（PCのみ）
        { selector: '.p-novel-episode__author',   extract: false }, // アルファポリス
      ] },
      { key: 'includeBody', label: '小説本文', selectors: [
        { selector: '.main_text',                extract: true }, // 青空文庫
        { selector: '.p-novel__text:not(.p-novel__text--preface):not(.p-novel__text--afterword)', extract: true }, // なろう
        { selector: '.widget-episodeBody p',     extract: true }, // カクヨム
        { selector: '.p-novel-episode__text',    extract: true }, // アルファポリス
      ] },
      { key: 'includeForeword', label: '作者まえがき', notice: true, selectors: [
        { selector: '.p-novel__text--preface', extract: false }, // なろう
      ] },
      { key: 'includeAfterword', label: '作者あとがき', notice: true, selectors: [
        { selector: '.p-novel__text--afterword', extract: false }, // なろう
      ] },
    ];

    /* --- 関数 --- */

    /* 設定の読み書き */

    function getMatchedEntry(field) {
      return field.selectors.find(e => document.querySelector(e.selector));
    }

    function isAvailable(field) {
      return getMatchedEntry(field) !== undefined;
    }

    function hasNotice(field) {
      return field.notice !== undefined;
    }

    function getDefaultSettings() {
      return Object.fromEntries(FIELDS.map(field => [field.key, {
        extract: getMatchedEntry(field)?.extract ?? false,
        notice: field.notice ?? false,
      }]));
    }

    function normalizeSettings(saved) {
      const defaults = getDefaultSettings();
      const getBooleanOrDefault = (key, prop) => {
        const value = saved?.[key]?.[prop];
        return typeof value === 'boolean' ? value : defaults[key][prop];
      };
      return Object.fromEntries(FIELDS.map(field => [
        field.key,
        {
          extract: getBooleanOrDefault(field.key, 'extract'),
          notice: hasNotice(field) ? getBooleanOrDefault(field.key, 'notice') : false,
        },
      ]));
    }

    function loadSettings() {
      let saved = null;
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (e) {
        console.warn(`${SETTINGS_KEY}: localStorage 読み込み失敗:`, e);
      }
      return normalizeSettings(saved);
    }

    function saveSettings(settings) {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e) {
        alert('localStorage への保存に失敗しました');
      }
    }

    // 「 抽出OFF && 通知ON && 現在のページに存在する」項目のメッセージ一覧
    function getNotices() {
      const settings = loadSettings();
      return FIELDS
        .filter(field => {
          const { extract, notice } = settings[field.key];
          return notice && !extract && isAvailable(field);
        })
        .map(field => `通知: ${field.label} が存在します`);
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
              // rp: 不要なので無視
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
        if (html.charCodeAt(h) === 60) { // '<'
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
        if (html.charCodeAt(pos) === 60) { // '<'
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

    /* UI構築 */

    function createPanelHTML(totalChars, numPages, charsPerPage) {
      return render(panelTpl, {
        equalsIcon: createEqualsIcon({ scale }),
        totalChars: totalChars.toLocaleString(),
        numPages,
        charsPerPage: charsPerPage.toLocaleString(),
      });
    }

    // 抽出・ページ分割の結果。buildText と buildPanel が更新する
    // openNovelWindow がそのまま novel-window.js に渡すため、ここには渡すデータだけを置く
    const novelData = {
      novelHtml: '',
      totalVisibleChars: 0,
      numPages: 0,
      pageRanges: [],
      pageCharCounts: [],
      validPageCount: 0,
    };

    function buildText() {
      const settings = loadSettings();

      const allSelectors = [...new Set(
        FIELDS
          .filter(field => settings[field.key].extract)
          .flatMap(field => field.selectors.map(e => e.selector))
      )];

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

      novelData.novelHtml = text;
      novelData.totalVisibleChars = scan(text, 0, Infinity).visibleCount;

      novelData.numPages = Math.ceil(novelData.totalVisibleChars / MAX_CHARS_PER_PAGE);
    }

    function buildPanel() {
      const { novelHtml, totalVisibleChars, numPages } = novelData;
      const charsPerPage = Math.ceil(totalVisibleChars / numPages);

      textInfoPanel.innerHTML = createPanelHTML(totalVisibleChars, numPages, charsPerPage);
      const partsList = shadow.getElementById('partsList');

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
          endHtmlPos = novelHtml.length;
          actualLen = totalVisibleChars - accumulatedChars;
        } else {
          const { htmlPos: rawEndHtmlPos, visibleCount: scanned } =
            scan(novelHtml, startHtmlPos, charsPerPage);
          const maxExtra = Math.floor(charsPerPage * DELIMITER_SEARCH_MARGIN);
          const { htmlPos: delimHtmlPos, visibleCount: extra } =
            scan(novelHtml, rawEndHtmlPos, maxExtra, true);
          endHtmlPos = delimHtmlPos;
          actualLen = scanned + extra;
        }

        const { htmlPos: tailHtmlStart } =
          scan(novelHtml, startHtmlPos, Math.max(0, actualLen - TAIL_PREVIEW_CHARS));

        pageRanges.push({ startHtmlPos, endHtmlPos, tailHtmlStart });
        pageCharCounts.push(actualLen);
        accumulatedChars += actualLen;

        const div = document.createElement('div');
        div.className = 'part-info';
        div.innerHTML = `<strong>ページ${i + 1}:</strong><span class="value">${actualLen.toLocaleString()}文字</span>`;
        partsList.appendChild(div);

        curHtmlPos = endHtmlPos;
      }

      novelData.pageRanges = pageRanges;
      novelData.pageCharCounts = pageCharCounts;
      novelData.validPageCount = pageCharCounts.filter(count => count > 0).length;

      const settingsBtn = shadow.getElementById('settingsBtn');
      const openNovelBtn = shadow.getElementById('openNovelBtn');
      const dragHandle = shadow.getElementById('dragHandle');

      settingsBtn.addEventListener('click', toggleSettings);
      openNovelBtn.addEventListener('click', openNovelWindow);
      makeDraggable(dragHandle, textInfoPanel, document);
    }

    // 「一度でも有効にされた項目」を記憶する。
    // 一度有効になった = このサイト（オリジン）ではその項目が存在し得ると分かったので、
    // 現在のページに存在しなくても、以降は操作可能にしてよい。
    // toggleSettings を複数回開いても保持するため、外側で宣言する
    const everEnabledKeys = new Set();

    function toggleSettings() {
      const existing = shadow.getElementById('novelBmSettingsOverlay');
      if (existing) { existing.remove(); return; }

      const current = loadSettings();

      FIELDS
        .filter(field => current[field.key].extract)
        .forEach(field => everEnabledKeys.add(field.key));

      const itemsHTML = FIELDS.map(field => {
        const { key, label } = field;
        const disabled = !isAvailable(field) && !everEnabledKeys.has(key);
        const notice = hasNotice(field)
          ? render(settingsNoticeTpl, { key, checked: current[key].notice ? 'checked' : '' })
          : '';
        return render(settingsItemTpl, {
          key,
          label,
          disabled,
          labelClass: disabled ? ' label--disabled' : '',
          extractAttrs: [current[key].extract && 'checked', disabled && 'disabled']
            .filter(Boolean).join(' '),
          notice,
        });
      }).join('');

      const overlay = document.createElement('div');
      overlay.id = 'novelBmSettingsOverlay';
      overlay.className = 'overlay';
      overlay.innerHTML = render(settingsTpl, { items: itemsHTML });

      overlay.querySelector('#helpBtn').addEventListener('click', () => {
        alert(`- 左のチェックボックスは「縦一行に含める内容」の選択です。\n- 右のチェックボックスは「縦一行に含まないとき、現在のページから取得できれば通知するもの」の選択です。「縦一行に含みたくないが、読み飛ばしたくない」ときにチェックしてください\n- 設定は ${window.location.hostname} の localStorage に保存されます。`);
      });

      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
      });

      overlay.querySelectorAll('.item[data-disabled="true"]').forEach(wrapper => {
        wrapper.addEventListener('click', e => {
          if (e.target.closest('.notice')) return; // 通知設定は常に操作可能
          const { label } = FIELDS.find(field => field.key === wrapper.dataset.key);
          alert(`現在のページから「${label}」を取得できないため、変更できません`);
        });
      });

      const saveBtn = overlay.querySelector('#saveBtn');
      saveBtn.addEventListener('click', () => {
        const newSettings = Object.fromEntries(FIELDS.map(({ key }) => [key, {
          extract: overlay.querySelector(`.extract-checkbox[data-key="${key}"]`).checked,
          notice: overlay.querySelector(`.notice-checkbox[data-key="${key}"]`)?.checked ?? false,
        }]));

        const anyChecked = Object.values(newSettings).some(s => s.extract);
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

      const payload = { ...novelData, notices: getNotices() };

      const html = render(novelWindowTpl, {
        script: novelWindowCode.replace(/<\/script/gi, '<\\/script'),
      });

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
          payload,
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
