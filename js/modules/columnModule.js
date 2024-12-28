// Модуль для работы с колонками
import { generateId } from '../utils.js';
import { showConfirmDialog } from './uiComponents.js';
import { getSelectedBoard } from './boardModule.js';
import * as TaskManager from './taskModule.js';
import { showColumnDropIndicator, handleColumnDrop, removeAllDropIndicators } from './dragAndDrop.js';
import * as StateModule from './stateModule.js';
import * as RenderModule from './renderModule.js';

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
    const board = getSelectedBoard();
    if (!board) return null;

    const column = board.columns.find(c => c.id === columnId);
    if (column) {
        Object.assign(column, columnData);
    }
    return column;
}

export function deleteColumn(columnId) {
    const board = getSelectedBoard();
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

// Функции для работы с диалогом колонки
export function openColumnDialog(existingColumn = null) {
    const dialog = document.getElementById('column-dialog');
    const form = dialog.querySelector('form');
    const nameInput = document.getElementById('column-name');
    const submitButton = form.querySelector('button[type="submit"]');
    const titleEl = dialog.querySelector('h3');
    const board = getSelectedBoard();

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

    // Настраиваем кнопку удаления
    const deleteBtn = form.querySelector('.delete-btn');
    if (existingColumn) {
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = async () => {
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
    } else {
        deleteBtn.style.display = 'none';
    }

    dialog.showModal();

    form.onsubmit = (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;

        if (existingColumn) {
            // Обновляем существующую колонку
            updateColumn(existingColumn.id, { name });
        } else {
            // Создаем новую колонку
            const newColumn = createColumn(board.id, { name });
            board.columns.push(newColumn);
        }
        dialog.close();
    };

    dialog.addEventListener('close', () => {
        StateModule.saveState();
        RenderModule.render();
    }, { once: true });
}

// Функция рендеринга колонки
export function renderColumn(column) {
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

    // Добавляем обработчики событий
    headerEl.addEventListener('dblclick', async () => {
        await openColumnDialog(column);
    });

    colEl.addEventListener('dragstart', (e) => {
        // Проверяем, что начали тащить за заголовок колонки
        const header = colEl.querySelector('.column-header');
        if (!e.target.contains(header)) {
            e.preventDefault();
            return;
        }

        colEl.classList.add('dragging');
        // Устанавливаем данные для переноса
        e.dataTransfer.setData('text/plain', colEl.dataset.columnId);
    });

    colEl.addEventListener('dragend', () => {
        colEl.classList.remove('dragging');
        removeAllDropIndicators();
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