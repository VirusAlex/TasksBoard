// Глобальные переменные для отслеживания состояния перетаскивания
let isDragging = false;
let draggedElement = null;
let initialX = 0;
let initialY = 0;
let currentX = 0;
let currentY = 0;
let xOffset = 0;
let yOffset = 0;
let draggedClone = null;
let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let longPressTimer = null;
let lastTapTime = 0;
let lastTapElement = null;
const LONG_PRESS_DELAY = 200; // Задержка в мс
const MOVE_THRESHOLD = 10; // Минимальное смещение для начала перетаскивания
const DOUBLE_TAP_DELAY = 300; // Максимальное время между тапами

export function initTouchDrag() {
  // Добавляем обработчики для всех перетаскиваемых элементов
  document.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function createDragEvent(type, touch) {
  return new CustomEvent(type, {
    bubbles: true,
    cancelable: true,
    detail: {
      clientX: touch.clientX,
      clientY: touch.clientY,
      screenX: touch.screenX,
      screenY: touch.screenY,
      target: draggedElement,
      dataTransfer: {
        getData: () => draggedElement.dataset.transferData || '',
        setData: (_, data) => {
          draggedElement.dataset.transferData = data;
        }
      }
    }
  });
}

function startDragging(e, target) {
  isDragging = true;
  draggedElement = target;

  const touch = e.touches[0];
  
  // Проверяем, поддерживает ли браузер нативный drag and drop
  const hasNativeDragDrop = e.type === 'dragstart' || ('dataTransfer' in e && e.dataTransfer.effectAllowed);
  
  if (!hasNativeDragDrop) {
    const rect = target.getBoundingClientRect();
    xOffset = touch.clientX - rect.left;
    yOffset = touch.clientY - rect.top;

    draggedClone = target.cloneNode(true);
    draggedClone.classList.add('dragging');
    draggedClone.style.position = 'fixed';
    draggedClone.style.pointerEvents = 'none';
    draggedClone.style.width = rect.width + 'px';
    draggedClone.style.opacity = '0.8';
    
    draggedClone.style.left = (touch.clientX - xOffset) + 'px';
    draggedClone.style.top = (touch.clientY - yOffset) + 'px';
    
    document.body.appendChild(draggedClone);

    initialX = touch.clientX - xOffset;
    initialY = touch.clientY - yOffset;
  }

  draggedElement.classList.add('dragging');
  draggedElement.style.opacity = '0.4';

  if (draggedElement.classList.contains('column')) {
    draggedElement.dataset.transferData = draggedElement.dataset.columnId;
  } else if (draggedElement.classList.contains('task')) {
    draggedElement.dataset.transferData = draggedElement.dataset.taskId;
  }

  const dragStartEvent = createDragEvent('dragstart', touch);
  draggedElement.dispatchEvent(dragStartEvent);
}

function handleTouchStart(e) {
  const target = e.target.closest('.task, .column');
  if (!target) return;

  // Не начинаем перетаскивание, если тап был на чекбоксе
  if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') return;

  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();

  // Проверяем на двойной тап
  const timeSinceLastTap = touchStartTime - lastTapTime;
  const isSameElement = target === lastTapElement;
  
  if (timeSinceLastTap < DOUBLE_TAP_DELAY && isSameElement) {
    // Это двойной тап - создаем и диспатчим событие dblclick
    clearTimeout(longPressTimer); // Отменяем запуск перетаскивания
    
    // Для колонок проверяем, что тап был по заголовку
    if (target.classList.contains('column')) {
      const header = e.target.closest('.column-header');
      if (!header) return;
      
      // Диспатчим событие на заголовок колонки, а не на саму колонку
      const dblClickEvent = new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      header.dispatchEvent(dblClickEvent);
    } else {
      // Для тасков диспатчим как обычно
      const dblClickEvent = new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      target.dispatchEvent(dblClickEvent);
    }
    
    lastTapTime = 0; // Сбрасываем время последнего тапа
    lastTapElement = null;
    return;
  }

  // Запоминаем время и элемент последнего тапа
  lastTapTime = touchStartTime;
  lastTapElement = target;

  // Для колонок проверяем, что начали тащить за заголовок
  if (target.classList.contains('column')) {
    const header = target.querySelector('.column-header');
    if (!e.target.closest('.column-header')) return;
  }

  // Запускаем таймер для определения долгого нажатия
  longPressTimer = setTimeout(() => {
    startDragging(e, target);
  }, LONG_PRESS_DELAY);
}

function handleTouchMove(e) {
  const touch = e.touches[0];
  
  // Если перетаскивание еще не начато, проверяем на превышение порога движения
  if (!isDragging) {
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    
    // Если движение превысило порог, отменяем таймер долгого нажатия
    if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
      clearTimeout(longPressTimer);
    }
    return;
  }

  e.preventDefault();

  // Обновляем позицию клона только если он существует
  if (draggedClone) {
    currentX = touch.clientX - initialX;
    currentY = touch.clientY - initialY;
    draggedClone.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  }

  const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!elemBelow) return;

  const dragOverEvent = createDragEvent('dragover', touch);
  elemBelow.dispatchEvent(dragOverEvent);
}

function handleTouchEnd(e) {
  // Очищаем таймер долгого нажатия
  clearTimeout(longPressTimer);

  if (!isDragging) {
    // Если это был короткий тап, не делаем ничего
    return;
  }

  e.preventDefault();

  const touch = e.changedTouches[0];
  const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);

  if (dropTarget) {
    const dropEvent = createDragEvent('drop', touch);
    dropTarget.dispatchEvent(dropEvent);
  }

  const dragEndEvent = createDragEvent('dragend', touch);
  draggedElement.dispatchEvent(dragEndEvent);

  draggedElement.style.opacity = '';
  draggedElement.classList.remove('dragging');
  delete draggedElement.dataset.transferData;
  draggedElement = null;
  isDragging = false;
  xOffset = 0;
  yOffset = 0;

  if (draggedClone) {
    draggedClone.remove();
    draggedClone = null;
  }
} 