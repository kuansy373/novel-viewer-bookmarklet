console.log('novel-window loaded');

const data = window.__NOVEL_DATA__;

const {
  parts,
  pageCharCounts,
  validPageCount
} = data;

const container = document.getElementById('novelDisplay');

function renderPart(pageIndex) {
  container.innerHTML = '';

  const frag = document.createDocumentFragment();

  const page = parts[pageIndex] || {
    overlap: [],
    main: []
  };

  for (const chunkHTML of page.overlap) {
    const span = document.createElement('span');
    span.style.opacity = '0.5';
    span.innerHTML = chunkHTML;
    frag.appendChild(span);
  }

  for (const chunkHTML of page.main) {
    const span = document.createElement('span');
    span.innerHTML = chunkHTML;
    frag.appendChild(span);
  }

  container.appendChild(frag);
}

renderPart(0);
