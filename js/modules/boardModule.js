// Модуль для работы с досками
import { generateId } from '../utils.js';
import { showConfirmDialog } from './uiComponents.js';
import * as RenderModule from './renderModule.js';
import * as DragDrop from './dragAndDrop.js';
import * as ColumnModule from './columnModule.js';
import { getCurrentProvider } from '../data/dataProvider.js';

const boardTitleEl = document.getElementById('board-title');
const columnsEl = document.getElementById('columns');

// Сохраняем ссылки на обработчики событий
let currentBoardTitleHandler = null;
let currentColumnsDragOverHandler = null;
let currentColumnsDropHandler = null;

export async function renderBoard() {
    const board = await getSelectedBoard();
    console.log(board);
    if (!board) {
        boardTitleEl.textContent = 'Выберите доску или создайте новую';
        columnsEl.innerHTML = '';
        return;
    }

    // Очищаем старые обработчики
    if (currentBoardTitleHandler) {
        boardTitleEl.removeEventListener('dblclick', currentBoardTitleHandler);
    }
    if (currentColumnsDragOverHandler) {
        columnsEl.removeEventListener('dragover', currentColumnsDragOverHandler);
    }
    if (currentColumnsDropHandler) {
        columnsEl.removeEventListener('drop', currentColumnsDropHandler);
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

    columnsEl.innerHTML = '';

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

    columnsEl.addEventListener('dragover', currentColumnsDragOverHandler);
    columnsEl.addEventListener('drop', currentColumnsDropHandler);

    // Сортируем колонки по полю order перед отображением
    const sortedColumns = [...(board.columns || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    sortedColumns.forEach(async column => {
        const columnElement = await ColumnModule.renderColumn(column);
        
        // Добавляем обработчики drag & drop для колонки
        columnElement.addEventListener('dragover', (e) => {
            const draggingTask = document.querySelector('.task.dragging');
            const draggingCol = document.querySelector('.column.dragging');
            if (!draggingTask && !draggingCol) return;

            if (draggingTask) {
                DragDrop.showTaskDropIndicator(e, columnElement, draggingTask);
            } else {
                if (draggingCol === columnElement) return;
                DragDrop.showColumnDropIndicator(e, draggingCol);
            }
        });

        columnElement.addEventListener('drop', (e) => {
            const draggingTask = document.querySelector('.task.dragging');
            const draggingCol = document.querySelector('.column.dragging');
            if (!draggingTask && !draggingCol) return;

            e.preventDefault();
            e.stopPropagation();

            if (draggingTask) {
                DragDrop.handleTaskDrop(e, columnElement);
            } else {
                DragDrop.handleColumnDrop(e);
            }
        });

        columnsEl.appendChild(columnElement);
    });
}

// Базовые операции с досками
export async function createBoard(boardData) {
    const boards = await getCurrentProvider().getBoards().catch(console.error);
    const newBoard = {
        id: generateId(),
        name: boardData.name,
        columns: [],
        order: boards.length // Новая доска добавляется в конец
    };

    await getCurrentProvider().createBoard(newBoard).catch(console.error);
    await getCurrentProvider().updateSettings({ selectedBoardId: newBoard.id }).catch(console.error);

    await RenderModule.render();

    return newBoard;
}

export async function updateBoard(boardId, boardData) {
    const boards = await getCurrentProvider().getBoards();
    console.log(boards);
    const board = boards.find(b => b.id === boardId);
    if (board) {
        Object.assign(board, boardData);
        // Используем специальный метод для обновления доски
        await getCurrentProvider().updateBoard(boardId, boardData)
            .catch(console.error);
    }
    await RenderModule.render();
    return board;
}

export async function deleteBoard(boardId) {
    await getCurrentProvider().deleteBoard(boardId)
        .then(() => {
            // После успешного удаления обновляем порядок оставшихся досок
            return getCurrentProvider().updateBoardOrder(state.boards.map(b => b.id));
        })
        .catch(console.error);

    await RenderModule.render();

    return true;
}

// Функции для работы с выбранной доской
export async function getSelectedBoard() {
    const data = await getCurrentProvider().getData();
    return data.boards.find(b => b.id === data.selectedBoardId);
}

export async function setSelectedBoard(boardId) {
    await getCurrentProvider().updateSettings({
        selectedBoardId: boardId,
        isCalendarView: false
    }).catch(console.error);

    await RenderModule.render();
}

// Функции рендеринга
export async function renderBoardsList(boardsElement) {
    const state = await getCurrentProvider().getData().catch(console.error);
    boardsElement.innerHTML = '';

    // Сортируем доски по полю order перед отображением
    const sortedBoards = [...state.boards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    sortedBoards.forEach(board => {
        const li = document.createElement('li');
        li.textContent = board.name;
        li.dataset.boardId = board.id;

        if (state.selectedBoardId === board.id) {
            li.className = 'selected';
        }

        boardsElement.appendChild(li);
    });
}

// Диалог для работы с доской
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
            await updateBoard(existingBoard.id, { name });
        } else {
            await createBoard({ name });
        }

        dialog.close('submit');
    };

    const handleClose = () => {
        // Удаляем все обработчики
        form.removeEventListener('submit', handleSubmit);
        if (existingBoard) {
            deleteBtn.removeEventListener('click', handleDelete);
        }
        dialog.removeEventListener('close', handleClose);

        RenderModule.render();
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