// Функционал для drag and drop операций

// Функции для работы с индикаторами
export function showTaskDropIndicator(event, columnElement, draggingTask) {
    // Базовая реализация будет добавлена позже
}

export function showColumnDropIndicator(event, draggingColumn) {
    removeAllDropIndicators();

    const columnsEl = document.getElementById('columns');
    const indicator = document.createElement('div');
    indicator.className = 'column-drop-indicator';

    const columns = Array.from(columnsEl.children);
    const mouseX = event.clientX;

    // Находим ближайшую колонку
    for (const column of columns) {
        if (column === draggingColumn) continue;

        const rect = column.getBoundingClientRect();
        const columnCenter = rect.left + rect.width / 2;

        if (mouseX < columnCenter) {
            column.before(indicator);
            return;
        }
    }

    // Если не нашли место для вставки, добавляем в конец
    columnsEl.appendChild(indicator);
}

export function removeAllDropIndicators() {
    document.querySelectorAll('.subtask-drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.task-drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
}

// Обработчики событий drag and drop
export function handleTaskDrop(event, columnElement) {
    // Базовая реализация будет добавлена позже
}

export function handleColumnDrop(event) {
    const draggingCol = document.querySelector('.column.dragging');
    if (!draggingCol) return;

    event.preventDefault();
    event.stopPropagation();

    try {
        const board = getSelectedBoard();
        const draggedColId = draggingCol.dataset.columnId;
        const currentIndex = board.columns.findIndex(col => col.id === draggedColId);

        // Находим позицию для вставки
        const indicator = document.querySelector('.column-drop-indicator');
        if (!indicator) return;

        const nextCol = indicator.nextElementSibling;
        const nextColIndex = nextCol ? board.columns.findIndex(col => col.id === nextCol.dataset.columnId) : -1;

        let finalIndex = nextCol ? nextColIndex : board.columns.length;
        if (currentIndex !== -1) {
            finalIndex = currentIndex < finalIndex ? finalIndex - 1 : finalIndex;
        }

        // Перемещаем колонку в новую позицию
        if (finalIndex !== -1) {
            const [movedColumn] = board.columns.splice(currentIndex, 1);
            board.columns.splice(finalIndex, 0, movedColumn);
            return true;
        }
    } finally {
        removeAllDropIndicators();
    }
    return false;
}