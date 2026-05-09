console.log('novel-window loaded');

const data = window.__NOVEL_DATA__;

console.log(data);

const container =
  document.getElementById('novelDisplay');

if (container && data) {
  container.textContent =
    'novel-window.js 読み込み成功';
}
