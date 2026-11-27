import { equalsIcon as equalsIconTpl } from '../build/templates.json';

export function render(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

export function createEqualsIcon({ bg = 'transparent', color = '#5f4fac', scale = 1 } = {}) {
  return render(equalsIconTpl, {
    w: Math.round(22 * scale),
    h: Math.round(24 * scale),
    bg,
    color,
  });
}

export function makeDraggable(dragHandle, dragTarget, dragDoc, onDragEnd) {
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

  const onTouchMove = e => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    dragTarget.style.setProperty('left', touch.clientX - offsetX + 'px', 'important');
    dragTarget.style.setProperty('top',  touch.clientY - offsetY + 'px', 'important');
    e.preventDefault();
  };

  const makeDragEndHandler = (moveEvent, moveHandler) => {
    const endEvent = moveEvent === 'mousemove' ? 'mouseup' : 'touchend';
    const handler = () => {
      isDragging = false;
      if (onDragEnd) onDragEnd(
        dragTarget.style.getPropertyValue('left'),
        dragTarget.style.getPropertyValue('top')
      );
      dragDoc.removeEventListener(moveEvent, moveHandler);
      dragDoc.removeEventListener(endEvent, handler);
    };
    return handler;
  };

  const onMouseUp  = makeDragEndHandler('mousemove', onMouseMove);
  const onTouchEnd = makeDragEndHandler('touchmove',  onTouchMove);

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

/* --- */

// scan() のホットパスで毎回オブジェクトを生成しないよう、結果を再利用する
// 呼び出し元は次の parseTag() 呼び出し前に必要な値を取り出すこと
const tagResult = { end: 0, name: '', isClosing: false };

export function parseTag(html, start) {
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
