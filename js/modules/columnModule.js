// Модуль для работы с колонками
import { generateId } from '../utils.js';
import { showConfirmDialog } from './uiComponents.js';
import * as BoardManager from './boardModule.js';
import * as TaskManager from './taskModule.js';
import * as DragDrop from './dragAndDrop.js';
import * as StateModule from './stateModule.js';
import * as RenderModule from './renderModule.js';

// Сохраняем ссылки на обработчики событий для каждой колонки
const columnHandlers = new Map();

// Базовые операции с колонками
export function createColumn(boardId, columnData) {
    const newColumn = {
        id: generateId(),
        name: columnData.name,
        tasks: []
    };
    return newColumn;
}

export function updateColumn(columnId, columnData) {
    const board = BoardManager.getSelectedBoard();
    if (!board) return null;

    const column = board.columns.find(c => c.id === columnId);
    if (column) {
        Object.assign(column, columnData);
    }
    return column;
}

export function deleteColumn(columnId) {
    const board = BoardManager.getSelectedBoard();
    if (!board) return false;

    const columnIndex = board.columns.findIndex(c => c.id === columnId);
    if (columnIndex !== -1) {
        board.columns.splice(columnIndex, 1);
        return true;
    }
    return false;
}

// Вспомогательные функции
export function getColumnStats(column) {
    if (!column.tasks) return { total: 0, done: 0 };

    const stats = {
        total: 0,
        done: 0
    };

    column.tasks.forEach(task => {
        if (!task.isInfo && !task.parentId) { // Считаем только основные задачи
            stats.total++;
            if (task.done) stats.done++;
        }
    });

    return stats;
}

// Функция для очистки обработчиков колонки
function cleanupColumnHandlers(columnId) {
    const handlers = columnHandlers.get(columnId);
    if (handlers) {
        const { headerEl, columnEl } = handlers.elements;
        const { dblClickHandler, dragStartHandler, dragEndHandler, dragOverHandler, dropHandler } = handlers;

        // Удаляем обработчики
        if (headerEl) {
            headerEl.removeEventListener('dblclick', dblClickHandler);
        }
        if (columnEl) {
            columnEl.removeEventListener('dragstart', dragStartHandler);
            columnEl.removeEventListener('dragend', dragEndHandler);
            columnEl.removeEventListener('dragover', dragOverHandler);
            columnEl.removeEventListener('drop', dropHandler);
        }

        // Удаляем запись об обработчиках
        columnHandlers.delete(columnId);
    }
}

// Функция рендеринга колонки
export function renderColumn(column) {
    // Очищаем старые обработчики для этой колонки
    cleanupColumnHandlers(column.id);

    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.columnId = column.id;
    colEl.draggable = true;

    // Обновляем структуру заголовка колонки
    const headerEl = document.createElement('div');
    headerEl.className = 'column-header';

    const titleEl = document.createElement('h3');
    titleEl.textContent = column.name;
    headerEl.appendChild(titleEl);

    const stats = getColumnStats(column);
    if (stats.total > 0) {
        const statsEl = document.createElement('div');
        statsEl.className = 'column-stats';
        statsEl.innerHTML = `
            <span class="stats-done">${stats.done}</span>
            <span class="stats-separator">/</span>
            <span class="stats-total">${stats.total}</span>
        `;
        headerEl.appendChild(statsEl);
    }

    colEl.appendChild(headerEl);

    // Создаем обработчики событий
    const dblClickHandler = async () => {
        await openColumnDialog(column);
    };

    const dragStartHandler = (e) => {
        // Проверяем, что начали тащить за заголовок колонки
        const header = colEl.querySelector('.column-header');
        if (!e.target.contains(header)) {
            e.preventDefault();
            return;
        }

        colEl.classList.add('dragging');
        // Устанавливаем данные для переноса
        e.dataTransfer.setData('text/plain', colEl.dataset.columnId);
    };

    const dragEndHandler = () => {
        colEl.classList.remove('dragging');
        DragDrop.removeAllDropIndicators();
    };

    const dragOverHandler = (e) => {
        const draggingTask = document.querySelector('.task.dragging');
        const draggingCol = document.querySelector('.column.dragging');
        if (!draggingTask && !draggingCol) return;

        if (draggingTask) {
            DragDrop.showTaskDropIndicator(e, colEl, draggingTask);
        } else {
            if (draggingCol === colEl) return;
            DragDrop.showColumnDropIndicator(e, draggingCol);
        }
    };

    const dropHandler = (e) => {
        const draggingTask = document.querySelector('.task.dragging');
        const draggingCol = document.querySelector('.column.dragging');
        if (!draggingTask && !draggingCol) return;

        e.preventDefault();
        e.stopPropagation();

        if (draggingTask) {
            DragDrop.handleTaskDrop(e, colEl);
        } else {
            DragDrop.handleColumnDrop(e);
        }
    };

    // Добавляем обработчики
    headerEl.addEventListener('dblclick', dblClickHandler);
    colEl.addEventListener('dragstart', dragStartHandler);
    colEl.addEventListener('dragend', dragEndHandler);
    colEl.addEventListener('dragover', dragOverHandler);
    colEl.addEventListener('drop', dropHandler);

    // Сохраняем ссылки на обработчики
    columnHandlers.set(column.id, {
        elements: { headerEl, columnEl: colEl },
        dblClickHandler,
        dragStartHandler,
        dragEndHandler,
        dragOverHandler,
        dropHandler
    });

    // Рендерим задачи
    column.tasks
        .filter(task => !task.parentId) // Только задачи верхнего уровня
        .forEach(task => TaskManager.renderTask(task, colEl));

    // Кнопка добавления задачи
    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'add-btn';
    addTaskBtn.textContent = '+ Добавить задачу';
    addTaskBtn.onclick = () => {
        TaskManager.openTaskDialog(column);
    };
    colEl.appendChild(addTaskBtn);

    return colEl;
}

// Функции для работы с диалогом колонки
export function openColumnDialog(existingColumn = null) {
    const dialog = document.getElementById('column-dialog');
    const form = dialog.querySelector('form');
    const nameInput = document.getElementById('column-name');
    const submitButton = form.querySelector('button[type="submit"]');
    const titleEl = dialog.querySelector('h3');
    const deleteBtn = form.querySelector('.delete-btn');
    const board = BoardManager.getSelectedBoard();

    if (!board) return;

    // Настраиваем диалог
    titleEl.textContent = existingColumn ? 'Редактировать колонку' : 'Новая колонка';
    submitButton.textContent = existingColumn ? 'Сохранить' : 'Создать';

    // Заполняем форму данными существующей колонки или очищаем
    if (existingColumn) {
        nameInput.value = existingColumn.name;
    } else {
        form.reset();
    }

    // Создаем обработчики
    const handleDelete = async () => {
        const confirmed = await showConfirmDialog(
            `Вы уверены, что хотите удалить колонку "${existingColumn.name}" со всеми задачами?`
        );
        if (confirmed) {
            if (deleteColumn(existingColumn.id)) {
                dialog.close('deleted');
                return true;
            }
        }
        return false;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;

        if (existingColumn) {
            updateColumn(existingColumn.id, { name });
        } else {
            const newColumn = createColumn(board.id, { name });
            board.columns.push(newColumn);
        }
        dialog.close('submit');
    };

    const handleClose = () => {
        // Удаляем все обработчики
        form.removeEventListener('submit', handleSubmit);
        if (existingColumn) {
            deleteBtn.removeEventListener('click', handleDelete);
        }
        dialog.removeEventListener('close', handleClose);

        StateModule.saveState();
        RenderModule.render();
    };

    // Добавляем обработчики
    form.addEventListener('submit', handleSubmit);
    if (existingColumn) {
        deleteBtn.style.display = 'block';
        deleteBtn.addEventListener('click', handleDelete);
    } else {
        deleteBtn.style.display = 'none';
    }

    dialog.addEventListener('close', handleClose, { once: true });
    dialog.showModal();
}