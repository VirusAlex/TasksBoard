import * as BoardModule from './boardModule.js';
import * as TaskModule from './taskModule.js';
import * as RenderModule from './renderModule.js';
import * as ColumnModule from './columnModule.js';
import {getCurrentProvider} from '../data/dataProvider.js';

// Добавляем глобальную переменную для отслеживания состояния
export let isProcessingDrop = false;

// Функционал для drag and drop операций

// Функции для работы с индикаторами
export function showTaskDropIndicator(e, parentEl, draggingTask) {
    if (parentEl === draggingTask) return;
    e.preventDefault();
    e.stopPropagation();

    // Удаляем существующие индикаторы
    removeAllDropIndicators();

    const indicator = document.createElement('div');
    indicator.className = 'task-drop-indicator';

    // Если parentEl - таск
    if (parentEl.classList.contains('task')) {
        const taskEl = parentEl;

        const taskRect = taskEl.getBoundingClientRect();
        const partHeight = taskRect.height / 4;
        const mouseY = e.clientY - taskRect.top;

        const subtasksContainer = taskEl.querySelector('.subtasks-container');
        // Проверяем, если есть контейнер сабтасков - находимся ли мы над ним
        let aboveSubtasksContainer = false;
        if (subtasksContainer) {
            const subtasksContainerRect = subtasksContainer.getBoundingClientRect();
            if (e.clientY > subtasksContainerRect.top && e.clientY < subtasksContainerRect.bottom) {
                aboveSubtasksContainer = true;
            }
        }
        if (subtasksContainer && aboveSubtasksContainer) {
            // Вычисляем позицию вставки
            const indicator = document.createElement('div');
            indicator.className = 'task-drop-indicator';
            // Вставляем индикатор в позицию под курсором
            // Находим ближайшую задачу к курсору
            let closestTask = null;
            let minDistance = Infinity;

            subtasksContainer.childNodes.forEach(node => {
                if (node.nodeType === 1) { // Проверяем, что это элемент
                    const rect = node.getBoundingClientRect();
                    const distance = Math.abs(e.clientY - rect.top);
                    if (distance < minDistance) {
                        closestTask = node;
                        minDistance = distance;
                    }
                }
            });

            if (closestTask) {
                subtasksContainer.insertBefore(indicator, closestTask);
            } else {
                subtasksContainer.appendChild(indicator);
            }
        } else if (mouseY > partHeight && mouseY < (partHeight * 3)) { // Проверяем, находится ли курсор в центральной части
            // Если у задачи еще нет сабтасков, показываем индикатор создания сабтаска
            const indicator = document.createElement('div');
            indicator.className = 'subtask-drop-indicator';
            taskEl.appendChild(indicator);
        } else {
            // Обрабатываем обычное перемещение
            // Создаем индикатор перемещения
            const indicator = document.createElement('div');
            indicator.className = 'task-drop-indicator';

            // Определяем, куда вставлять индикатор
            if (mouseY < partHeight) {
                taskEl.parentNode.insertBefore(indicator, taskEl);
            } else {
                taskEl.parentNode.insertBefore(indicator, taskEl.nextSibling);
            }
        }
    } else if (parentEl.classList.contains('column')) {
        const colEl = parentEl;
        // Получаем все задачи верхнего уровня в колонке
        const tasks = Array.from(colEl.querySelectorAll('.task:not(.subtask)'));
        const addTaskBtn = colEl.querySelector('.add-btn');
        const tasksContainer = colEl.querySelector('.tasks-container');

        // Если нет задач, просто добавляем индикатор в tasks-container
        if (tasks.length === 0) {
            tasksContainer.appendChild(indicator);
            return;
        }

        // Находим ближайшую задачу к курсору
        const mouseY = e.clientY;
        let closestTask = null;
        let minDistance = Infinity;

        tasks.forEach(task => {
            const rect = task.getBoundingClientRect();
            const taskMiddle = rect.top + rect.height / 2;
            const distance = Math.abs(mouseY - taskMiddle);

            if (distance < minDistance) {
                minDistance = distance;
                closestTask = task;
            }
        });

        if (closestTask) {
            const taskParent = closestTask.parentNode;
            const rect = closestTask.getBoundingClientRect();
            if (mouseY < rect.top + rect.height / 2) {
                taskParent.insertBefore(indicator, closestTask);
            } else {
                taskParent.insertBefore(indicator, closestTask.nextSibling);
            }
        } else {
            tasksContainer.insertBefore(indicator, addTaskBtn);
        }
    }
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
    // console.log("removeAllDropIndicators stacktrace: ", new Error().stack);
    document.querySelectorAll('.subtask-drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.task-drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
}

// Обработчики событий drag and drop
export async function handleTaskDrop(e, container) {
    if (isProcessingDrop) return;

    const draggedTaskEl = document.querySelector('.task.dragging');
    if (!draggedTaskEl) return;

    e.preventDefault();
    e.stopPropagation();
    isProcessingDrop = true;

    try {
        /** @type {string} */
        const draggedTaskId = draggedTaskEl.dataset.taskId;

        /** @type {TaskData | null} */
        const draggedTask = await TaskModule.findTaskById(draggedTaskId);
        if (!draggedTask) throw new Error('Task not found: ' + draggedTaskId);
        let oldParentId = draggedTask.parentId;
        let oldColumnId = draggedTask.columnId;

        // Определяем тип контейнера и цели
        const isColumn = container.classList.contains('column');
        const targetTask = container.classList.contains('task') ? container : null;

        // Получаем колонку
        const colEl = isColumn ? container : container.closest('.column');
        const columnId = colEl.dataset.columnId;

        /** @type {ColumnData | null} */
        const column = await ColumnModule.findColumnById(columnId);
        if (!column) throw new Error('Column not found: ' + columnId);

        // Проверяем наличие индикаторов
        const subtaskIndicator = targetTask?.querySelector('.subtask-drop-indicator');
        const taskIndicator = colEl.querySelector('.task-drop-indicator');
        const parentTaskEl = taskIndicator?.closest('.task');

        if (subtaskIndicator && targetTask) {
            // Случай 1: Создание сабтаска
            console.log('Создание сабтаска');

            /** @type {TaskData | null} */
            const newParentTask = await TaskModule.findTaskById(targetTask.dataset.taskId);
            if (!newParentTask) throw new Error('Parent task not found: ' + targetTask.dataset.taskId);

            // Если задача перемещается из колонки
            if (oldColumnId) {
                /** @type {ColumnData[]} */
                const oldColumnTasks = await getCurrentProvider().getTasks(oldColumnId);
                const newOldColumnTasks = oldColumnTasks.filter(t => t.id !== draggedTaskId);
                await Promise.all(newOldColumnTasks.map(async (task, index) => {
                    if (task.order === index) return;
                    await getCurrentProvider().updateTask(task.id, {order: index});
                }));
            }

            // Если задача перемещается из другой задачи
            if (oldParentId && oldParentId !== newParentTask.id) {
                /** @type {TaskData[]} */
                const oldParentSubtasks = await getCurrentProvider().getSubtasks(oldParentId);
                const newOldParentSubtasks = oldParentSubtasks.filter(t => t.id !== draggedTaskId);
                await Promise.all(newOldParentSubtasks.map(async (task, index) => {
                    if (task.order === index) return;
                    await getCurrentProvider().updateTask(task.id, {order: index});
                }));
            }

            const subtasks = await getCurrentProvider().getSubtasks(newParentTask.id);

            /** @type {TaskData} */
            let updates = {
                order: subtasks.length,
                parentId: newParentTask.id,
                columnId: null
            };
            await getCurrentProvider().updateTask(draggedTaskId, updates);

            targetTask.querySelector(':scope > .subtasks-container').appendChild(draggedTaskEl);
            await TaskModule.updateSubtasksStats(newParentTask.id);
            await ColumnModule.updateColumnStats(oldColumnId);
            await TaskModule.updateSubtasksStats(oldParentId);

        } else if (taskIndicator && parentTaskEl) {
            // Случай 2: Перемещение внутрь списка сабтасков
            console.log('Перемещение внутрь списка сабтасков');

            /** @type {TaskData | null} */
            const newParentTask = await TaskModule.findTaskById(parentTaskEl.dataset.taskId);
            if (!newParentTask) throw new Error('Parent task not found: ' + parentTaskEl.dataset.taskId);

            /** @type {TaskData[]} */
            const newParentSubtasks = await getCurrentProvider().getSubtasks(newParentTask.id).then(tasks => tasks.filter(t => t.id !== draggedTaskId));

            // Определяем позицию вставки
            const prevTask = taskIndicator.previousElementSibling;
            const nextTask = taskIndicator.nextElementSibling;
            const prevIndex = prevTask && prevTask?.dataset?.taskId !== draggedTaskId ? newParentSubtasks.findIndex(task => task.id === prevTask.dataset.taskId) : -1;
            const nextIndex = nextTask && nextTask?.dataset?.taskId !== draggedTaskId ? newParentSubtasks.findIndex(task => task.id === nextTask.dataset.taskId) : -1;

            if (prevTask?.dataset?.taskId === draggedTaskId || nextTask?.dataset?.taskId === draggedTaskId) return;

            let finalIndex = nextIndex !== -1 ? nextIndex : prevIndex !== -1 ? prevIndex + 1 : newParentSubtasks.length;

            // Если задача перемещается из колонки
            if (oldColumnId) {
                /** @type {ColumnData[]} */
                const oldColumnTasks = await getCurrentProvider().getTasks(oldColumnId);
                const newOldColumnTasks = oldColumnTasks.filter(t => t.id !== draggedTaskId);
                await Promise.all(newOldColumnTasks.map(async (task, index) => {
                    if (task.order === index) return;
                    await getCurrentProvider().updateTask(task.id, {order: index});
                }));
            }

            // Если задача перемещается из другой задачи
            if (oldParentId && oldParentId !== newParentTask.id) {
                /** @type {TaskData[]} */
                const oldParentSubtasks = await getCurrentProvider().getSubtasks(oldParentId);
                const newOldParentSubtasks = oldParentSubtasks.filter(t => t.id !== draggedTaskId);
                await Promise.all(newOldParentSubtasks.map(async (task, index) => {
                    if (task.order === index) return;
                    await getCurrentProvider().updateTask(task.id, {order: index});
                }));
            }

            // Обновляем позицию
            newParentSubtasks.splice(finalIndex, 0, draggedTask);
            await Promise.all(newParentSubtasks.map(async (task, index) => {
                if (task.order === index && task.id !== draggedTaskId) return;

                /** @type {TaskData} */
                let updates = {order: index};
                if (task.id === draggedTaskId) {
                    updates.parentId = newParentTask.id;
                    updates.columnId = null;
                }

                await getCurrentProvider().updateTask(task.id, updates);
            }));

            taskIndicator.parentNode.insertBefore(draggedTaskEl, taskIndicator);
            await TaskModule.updateSubtasksStats(newParentTask.id);
            await ColumnModule.updateColumnStats(oldColumnId);
            await TaskModule.updateSubtasksStats(oldParentId);

        } else if (taskIndicator) {
            // Случай 3: Обычное перемещение в колонку
            console.log('Обычное перемещение в колонку');

            /** @type {TaskData[]} */
            const columnTasks = await getCurrentProvider().getTasks(column.id).then(tasks => tasks.filter(t => t.id !== draggedTaskId));

            // Если есть индикатор, находим его позицию среди задач
            const nextTask = taskIndicator.nextElementSibling;
            const prevTask = taskIndicator.previousElementSibling;
            let prevIndex = prevTask && prevTask?.dataset?.taskId !== draggedTaskId ? columnTasks.findIndex(task => task.id === prevTask.dataset.taskId) : -1;
            let nextIndex = nextTask && nextTask?.dataset?.taskId !== draggedTaskId ? columnTasks.findIndex(task => task.id === nextTask.dataset.taskId) : -1;

            // Если индикатор находится рядом с текущим таском, то не перемещаем
            if (prevTask?.dataset?.taskId === draggedTaskId || nextTask?.dataset?.taskId === draggedTaskId) return;

            let finalIndex = nextIndex !== -1 ? nextIndex : prevIndex !== -1 ? prevIndex + 1 : columnTasks.length;

            // Если задача перемещается из другой колонки
            if (oldColumnId && oldColumnId !== column.id) {
                /** @type {ColumnData[]} */
                const oldColumnTasks = await getCurrentProvider().getTasks(oldColumnId);
                const newOldColumnTasks = oldColumnTasks.filter(t => t.id !== draggedTaskId);
                await Promise.all(newOldColumnTasks.map(async (task, index) => {
                    if (task.order === index) return;
                    await getCurrentProvider().updateTask(task.id, {order: index});
                }));
            }

            // Если задача раньше была сабтаском
            if (oldParentId) {
                /** @type {TaskData[]} */
                const oldParentSubtasks = await getCurrentProvider().getSubtasks(oldParentId);
                const newOldParentSubtasks = oldParentSubtasks.filter(t => t.id !== draggedTaskId);
                await Promise.all(newOldParentSubtasks.map(async (task, index) => {
                    if (task.order === index) return;
                    await getCurrentProvider().updateTask(task.id, {order: index});
                }));
            }

            // Обновляем позицию
            columnTasks.splice(finalIndex, 0, draggedTask);
            await Promise.all(columnTasks.map(async (task, index) => {
                if (task.order === index && task.id !== draggedTaskId) return;

                /** @type {TaskData} */
                let updates = {order: index};
                if (task.id === draggedTaskId) {
                    updates.columnId = column.id;
                    updates.parentId = null;
                }

                await getCurrentProvider().updateTask(task.id, updates);
            }));

            taskIndicator.parentNode.insertBefore(draggedTaskEl, taskIndicator);
            await ColumnModule.updateColumnStats(columnId);
            await ColumnModule.updateColumnStats(oldColumnId);
            await TaskModule.updateSubtasksStats(oldParentId);
        }

        // await RenderModule.render();
    } finally {
        isProcessingDrop = false;
        draggedTaskEl.classList.remove('dragging');
        removeAllDropIndicators();
    }
}

export async function handleColumnDrop(event) {
    if (isProcessingDrop) return;

    const draggingCol = document.querySelector('.column.dragging');
    if (!draggingCol) return;

    event.preventDefault();
    event.stopPropagation();

    isProcessingDrop = true;

    try {
        const board = await BoardModule.getSelectedBoard();
        if (!board) throw new Error('Board not found');

        const boardColumns = await getCurrentProvider().getColumns(board.id);

        const draggedColId = draggingCol.dataset.columnId;
        const currentIndex = boardColumns.findIndex(col => col.id === draggedColId);

        // Находим позицию для вставки
        const indicator = document.querySelector('.column-drop-indicator');
        if (!indicator) return;

        const nextCol = indicator.nextElementSibling;
        const nextColIndex = nextCol ? boardColumns.findIndex(col => col.id === nextCol.dataset.columnId) : -1;

        let finalIndex = nextCol ? nextColIndex : boardColumns.length;
        if (currentIndex !== -1) {
            finalIndex = currentIndex < finalIndex ? finalIndex - 1 : finalIndex;
        }

        // Перемещаем колонку в новую позицию
        if (finalIndex !== -1) {
            const newBoardColumns = Object.assign([], boardColumns);
            const [movedColumn] = newBoardColumns.splice(currentIndex, 1);
            newBoardColumns.splice(finalIndex, 0, movedColumn);

            await Promise.all(newBoardColumns.map(async (col, index) => {
                await getCurrentProvider().updateColumn(col.id, {order: index});
            }));

            await RenderModule.render();
        }
    } finally {
        isProcessingDrop = false;
        draggingCol.classList.remove('dragging');
        removeAllDropIndicators();
    }
    return false;
}