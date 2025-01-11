// Модуль для работы с досками
import { showConfirmDialog } from './uiComponents.js';
import * as RenderModule from './renderModule.js';
import * as DragDrop from './dragAndDrop.js';
import * as ColumnModule from './columnModule.js';
import { getCurrentProvider } from '../data/dataProvider.js';
import './types.js';

const boardTitleEl = document.getElementById('board-title');
const columnsContainerEl = document.getElementById('columns');

// Сохраняем ссылки на обработчики событий
let currentBoardTitleHandler = null;
let currentColumnsDragOverHandler = null;
let currentColumnsDropHandler = null;

export async function initBoardModule() {
    /** @type {AppData} */
    const data = await getCurrentProvider().getData();
    if (data?.boards?.length === 0) {
        // Создаем доску по умолчанию, если нет сохраненных досок
        await createBoard('Моя первая доска');
    }
}

/**
 * @param {string} selectedBoardId
 */
export async function renderBoard(selectedBoardId) {
    console.debug('Render board is called: ', selectedBoardId);

    const board = await getSelectedBoard();
    if (!board) {
        boardTitleEl.textContent = 'Выберите доску или создайте новую';
        columnsContainerEl.innerHTML = '';
        return;
    }

    // Очищаем старые обработчики
    if (currentBoardTitleHandler) {
        boardTitleEl.removeEventListener('dblclick', currentBoardTitleHandler);
    }
    if (currentColumnsDragOverHandler) {
        columnsContainerEl.removeEventListener('dragover', currentColumnsDragOverHandler);
    }
    if (currentColumnsDropHandler) {
        columnsContainerEl.removeEventListener('drop', currentColumnsDropHandler);
    }

    // Делаем заголовок доски редактируемым
    boardTitleEl.textContent = board.name;
    boardTitleEl.style.cursor = 'pointer';
    boardTitleEl.title = 'Дважды щелкните для редактирования';

    // Создаем новый обработчик для заголовка доски
    currentBoardTitleHandler = () => {
        openBoardDialog(board);
    };
    boardTitleEl.addEventListener('dblclick', currentBoardTitleHandler);

    columnsContainerEl.innerHTML = '';

    // Создаем новые обработчики для drag & drop
    currentColumnsDragOverHandler = (e) => {
        const draggingCol = document.querySelector('.column.dragging');
        if (!draggingCol) return;
        e.preventDefault();
        e.stopPropagation();
        DragDrop.showColumnDropIndicator(e, draggingCol);
    };

    currentColumnsDropHandler = (e) => {
        DragDrop.handleColumnDrop(e);
    };

    columnsContainerEl.addEventListener('dragover', currentColumnsDragOverHandler);
    columnsContainerEl.addEventListener('drop', currentColumnsDropHandler);

    // Сортируем колонки по полю order перед отображением
    getCurrentProvider().getColumns(board.id).then(async boardColumns => {
        /** @type {ColumnData[]} */
        const sortedColumns = (boardColumns || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        await Promise.all(sortedColumns.map(async column => {
            // Создаем колонку
            const columnElement = await ColumnModule.renderColumn(column, columnsContainerEl);
        }));
    });
}

// Базовые операции с досками
/**
 * @param {string} name
 * @returns {Promise<BoardData>}
 */
export async function createBoard(name) {
    /** @type {BoardData} */
    const newBoard = await getCurrentProvider().createBoard(name);
    await getCurrentProvider().updateSettings({ selectedBoardId: newBoard.id }).catch(console.error);
    return newBoard;
}

/** @param {string} boardId */
export async function deleteBoard(boardId) {
    await getCurrentProvider().deleteBoard(boardId)
        .then(() => {
            // После успешного удаления обновляем порядок оставшихся досок
            return getCurrentProvider().updateBoardOrder();
        })
        .catch(console.error);
}

// Функции для работы с выбранной доской
/**
 * @returns {Promise<BoardData | null>}
 */
export async function getSelectedBoard() {
    /** @type {AppData} */
    const data = await getCurrentProvider().getData();
    if (!data?.selectedBoardId) return null
    return (data.boards || []).find(b => b.id === data.selectedBoardId) || null;
}

/** @param {string} boardId */
export async function setSelectedBoard(boardId) {
    await getCurrentProvider().updateSettings({
        selectedBoardId: boardId,
        isCalendarView: false
    }).catch(console.error);

    await RenderModule.render();
}

// Функции рендеринга
export async function renderBoardsList(boardsElement) {
    /** @type {AppData} */
    const state = await getCurrentProvider().getData();
    if (!state) return;

    boardsElement.innerHTML = '';

    // Сортируем доски по полю order перед отображением
    /** @type {BoardData[]} */
    const sortedBoards = (state.boards || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (const board of sortedBoards) {
        const li = document.createElement('li');
        li.textContent = board.name;
        li.dataset.boardId = board.id;

        if (state.selectedBoardId === board.id) {
            li.className = 'selected';
        }

        boardsElement.appendChild(li);
    }
}

// Диалог для работы с доской
/** @param {BoardData | null} existingBoard */
export function openBoardDialog(existingBoard = null) {
    const dialog = document.getElementById('board-dialog');
    const form = dialog.querySelector('form');
    const nameInput = document.getElementById('board-name');
    const submitButton = form.querySelector('button[type="submit"]');
    const titleEl = dialog.querySelector('h3');
    const deleteBtn = form.querySelector('.delete-btn');

    // Настраиваем диалог
    titleEl.textContent = existingBoard ? 'Редактировать доску' : 'Новая доска';
    submitButton.textContent = existingBoard ? 'Сохранить' : 'Создать';

    // Заполняем форму данными существующей доски или очищаем
    if (existingBoard) {
        nameInput.value = existingBoard.name;
    } else {
        form.reset();
    }

    // Создаем обработчики
    const handleDelete = async () => {
        const confirmed = await showConfirmDialog(
            `Вы уверены, что хотите удалить доску "${existingBoard.name}" со всеми колонками и задачами?`
        );
        if (confirmed) {
            await deleteBoard(existingBoard.id);
            await RenderModule.render();
            dialog.close('deleted');
            return true;
        }
        return false;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;

        if (existingBoard) {
            await getCurrentProvider().updateBoard(existingBoard.id, { name: name });
            const boardTitleEl = document.getElementById('board-title');
            if (boardTitleEl) boardTitleEl.textContent = name;
        } else {
            await createBoard(name);
            await RenderModule.render();
        }

        dialog.close('submit');
    };

    const handleClose = async () => {
        // Удаляем все обработчики
        form.removeEventListener('submit', handleSubmit);
        if (existingBoard) {
            deleteBtn.removeEventListener('click', handleDelete);
        }
        dialog.removeEventListener('close', handleClose);
    };

    // Добавляем обработчики
    form.addEventListener('submit', handleSubmit);
    if (existingBoard) {
        deleteBtn.style.display = 'block';
        deleteBtn.addEventListener('click', handleDelete);
    } else {
        deleteBtn.style.display = 'none';
    }

    dialog.addEventListener('close', handleClose, { once: true });
    dialog.showModal();
}