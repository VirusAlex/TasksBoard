// Модуль для работы с досками
import { generateId } from '../utils.js';
import { showConfirmDialog } from './uiComponents.js';
import * as StateModule from './stateModule.js';
import * as RenderModule from './renderModule.js';
import * as DragDrop from './dragAndDrop.js';
import * as ColumnModule from './columnModule.js';

const boardsEl = document.getElementById('boards');
const addBoardBtn = document.getElementById('add-board-btn');
const boardTitleEl = document.getElementById('board-title');
const columnsEl = document.getElementById('columns');
const addColumnBtn = document.getElementById('add-column-btn');
const mainEl = document.getElementById('main');

export function renderBoard() {
    const board = getSelectedBoard();
    if (!board) {
        boardTitleEl.textContent = 'Выберите доску или создайте новую';
        columnsEl.innerHTML = '';
        return;
    }

    // Делаем заголовок доски редактируемым
    boardTitleEl.textContent = board.name;
    boardTitleEl.style.cursor = 'pointer';
    boardTitleEl.title = 'Дважды щелкните для редактирования';

    // Добавляем обработчик двойного клика для редактирования
    boardTitleEl.addEventListener('dblclick', async () => {
        openBoardDialog(board);
    });

    columnsEl.innerHTML = '';

    board.columns.forEach(column => {
        const columnElement = ColumnModule.renderColumn(column);
        
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
export function createBoard(boardData) {
    const newBoard = {
        id: generateId(),
        name: boardData.name,
        columns: []
    };
    StateModule.getState().boards.push(newBoard);
    StateModule.getState().selectedBoardId = newBoard.id;
    return newBoard;
}

export function updateBoard(boardId, boardData) {
    const board = StateModule.getState().boards.find(b => b.id === boardId);
    if (board) {
        Object.assign(board, boardData);
    }
    return board;
}

export function deleteBoard(boardId) {
    const boardIndex = StateModule.getState().boards.findIndex(b => b.id === boardId);
    if (boardIndex !== -1) {
        StateModule.getState().boards.splice(boardIndex, 1);
        // Выбираем следующую доску или первую, если удаляем последнюю
        if (StateModule.getState().boards.length > 0) {
            StateModule.getState().selectedBoardId = StateModule.getState().boards[boardIndex]
                ? StateModule.getState().boards[boardIndex].id
                : StateModule.getState().boards[0].id;
        } else {
            StateModule.getState().selectedBoardId = null;
        }
        return true;
    }
    return false;
}

// Функции для работы с выбранной доской
export function getSelectedBoard() {
    return StateModule.getState().boards.find(b => b.id === StateModule.getState().selectedBoardId);
}

export function setSelectedBoard(boardId) {
    if (StateModule.getState().boards.some(b => b.id === boardId)) {
        StateModule.getState().selectedBoardId = boardId;
        StateModule.getState().isCalendarView = false;
        return true;
    }
    return false;
}

// Функции рендеринга
export function renderBoardsList(boardsElement) {
    boardsElement.innerHTML = '';
    StateModule.getState().boards.forEach(board => {
        const li = document.createElement('li');
        li.textContent = board.name;
        li.dataset.boardId = board.id;
        
        if (StateModule.getState().selectedBoardId === board.id) {
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

    // Настраиваем диалог
    titleEl.textContent = existingBoard ? 'Редактировать доску' : 'Новая доска';
    submitButton.textContent = existingBoard ? 'Сохранить' : 'Создать';

    // Заполняем форму данными существующей доски или очищаем
    if (existingBoard) {
        nameInput.value = existingBoard.name;
    } else {
        form.reset();
    }

    // Настраиваем кнопку удаления
    const deleteBtn = form.querySelector('.delete-btn');
    if (existingBoard) {
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = async () => {
            const confirmed = await showConfirmDialog(
                `Вы уверены, что хотите удалить доску "${existingBoard.name}" со всеми колонками и задачами?`
            );
            if (confirmed) {
                deleteBoard(existingBoard.id);
                dialog.close();
                return true;
            }
            return false;
        };
    } else {
        deleteBtn.style.display = 'none';
    }

    form.onsubmit = (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;

        let result;
        if (existingBoard) {
            // Обновляем существующую доску
            result = updateBoard(existingBoard.id, { name });
        } else {
            // Создаем новую доску
            result = createBoard({ name });
        }

        dialog.close();
        
        StateModule.saveState();
        RenderModule.render();
    };

    dialog.addEventListener('close', () => {
        StateModule.saveState();
        RenderModule.render();
    }, { once: true });

    dialog.showModal();
}