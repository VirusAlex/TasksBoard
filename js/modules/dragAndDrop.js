import * as BoardManager from './boardModule.js';
import * as TaskManager from './taskModule.js';
import * as RenderModule from './renderModule.js';
import { getCurrentProvider } from '../data/dataProvider.js';

// Добавляем глобальную переменную для отслеживания состояния
let isProcessingDrop = false;

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

    // Если нет задач, просто добавляем индикатор перед кнопкой
    if (tasks.length === 0) {
      // Если задач нет, добавляем индикатор перед кнопкой добавления
      colEl.insertBefore(indicator, addTaskBtn);
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
      const rect = closestTask.getBoundingClientRect();
      if (mouseY < rect.top + rect.height / 2) {
        colEl.insertBefore(indicator, closestTask);
      } else {
        colEl.insertBefore(indicator, closestTask.nextSibling);
      }
    } else {
      colEl.insertBefore(indicator, addTaskBtn);
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
    document.querySelectorAll('.subtask-drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.task-drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
}

// Обработчики событий drag and drop
export async function handleTaskDrop(e, container) {
    if (isProcessingDrop) return;

    const draggingTask = document.querySelector('.task.dragging');
    if (!draggingTask) return;

    e.preventDefault();
    e.stopPropagation();
    isProcessingDrop = true;

    try {
      const draggedTaskId = draggingTask.dataset.taskId;
      const board = await BoardManager.getSelectedBoard();

      // Определяем тип контейнера и цели
      const isColumn = container.classList.contains('column');
      const targetTask = container.classList.contains('task') ? container : null;

      // Получаем колонку
      const colEl = isColumn ? container : container.closest('.column');
      const columnId = colEl.dataset.columnId;
      const column = board.columns.find(col => col.id === columnId);

      // Проверяем наличие индикаторов
      const subtaskIndicator = targetTask?.querySelector('.subtask-drop-indicator');
      const taskIndicator = colEl.querySelector('.task-drop-indicator');
      const parentTaskEl = taskIndicator?.closest('.task');

      if (subtaskIndicator && targetTask) {
        // Случай 1: Создание сабтаска
        await TaskManager.makeSubtask(draggedTaskId, targetTask.dataset.taskId);
      } else if (taskIndicator && parentTaskEl) {
        // Случай 2: Перемещение внутри списка сабтасков
        const draggedTask = await TaskManager.findTaskById(draggedTaskId);
        const parentTask = await TaskManager.findTaskById(parentTaskEl.dataset.taskId);
        const tasks = parentTask.subtasks;

        // Определяем позицию вставки
        const prevTask = taskIndicator.previousElementSibling;
        const nextTask = taskIndicator.nextElementSibling;
        const currentIndex = tasks.findIndex(task => task === draggedTaskId);
        const prevIndex = prevTask?.dataset ? tasks.findIndex(task => task === prevTask.dataset.taskId) : -1;
        const nextIndex = nextTask?.dataset ? tasks.findIndex(task => task === nextTask.dataset.taskId) : -1;

        if ((nextIndex === currentIndex || prevIndex === currentIndex) && currentIndex !== -1) return;

        let finalIndex = nextTask ? nextIndex : tasks.length;
        if (currentIndex !== -1) {
          finalIndex = currentIndex < finalIndex ? finalIndex - 1 : finalIndex;
        }

        // Обновляем позицию
        await TaskManager.removeTaskFromCurrentPosition(draggedTask);
        column.tasks.push(draggedTask);
        draggedTask.parentId = parentTask.id;
        parentTask.subtasks.splice(finalIndex, 0, draggedTaskId);

        StateModule.saveState();
        RenderModule.render();
      } else if (taskIndicator) {
        // Случай 3: Обычное перемещение в колонку
        const tasks = column.tasks;

        // Если есть индикатор, находим его позицию среди задач
        const nextTask = taskIndicator.nextElementSibling;
        const prevTask = taskIndicator.previousElementSibling;
        let prevIndex = prevTask && prevTask.dataset ? tasks.findIndex(task => task.id === prevTask.dataset.taskId) : -1;
        let nextIndex = nextTask && nextTask.dataset ? tasks.findIndex(task => task.id === nextTask.dataset.taskId) : -1;
        let currentIndex = tasks.findIndex(task => task.id === draggingTask.dataset.taskId);

        // Если индикатор находится рядом с текущим таском, то не перемещаем
        if ((nextIndex === currentIndex || prevIndex === currentIndex) && currentIndex !== -1) return;

        // учесть, если перетаскиваемый таск уже в этой колонке
        let finalIndex = nextTask ? nextIndex : tasks.length;
        if (currentIndex !== -1) {
          finalIndex = currentIndex < finalIndex ? finalIndex - 1 : finalIndex;
        }

        await moveTaskToColumn(draggedTaskId, columnId, finalIndex);
      }
    } finally {
      isProcessingDrop = false;
      removeAllDropIndicators();
    }
  }

  async function moveTaskToColumn(taskId, newColumnId, position = -1) {
    const board = await BoardManager.getSelectedBoard();
    const task = await TaskManager.findTaskById(taskId);
    const parentTask = await TaskManager.findTaskById(task.parentId);

    if (!task) return;

    // Находим целевую колонку
    const targetColumn = board.columns.find(col => col.id === newColumnId);
    if (!targetColumn) return;

    // Вставляем задачу в нужную позицию
    if (position >= 0) {
      targetColumn.tasks.splice(position, 0, task);
    } else {
      targetColumn.tasks.push(task);
    }
    
    await Promise.all(targetColumn.tasks.map(async (task, index) => {
      if (task.order === index) return;

      let changes = {};
      changes.order = index;

      if (task.id === taskId) {
        changes.columnId = newColumnId;
        changes.parentId = null;
      }

      await getCurrentProvider().updateTask(task.id, changes);
    }));
    await getCurrentProvider().updateTask(parentTask.id, { subtasks: (parentTask.subtasks || []).filter(id => id !== taskId) });

    await RenderModule.render();
  }

export async function handleColumnDrop(event) {
    const draggingCol = document.querySelector('.column.dragging');
    if (!draggingCol) return;

    event.preventDefault();
    event.stopPropagation();

    try {
        const board = await BoardManager.getSelectedBoard();
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
            const boardColumns = Object.assign([], board.columns);
            const [movedColumn] = boardColumns.splice(currentIndex, 1);
            boardColumns.splice(finalIndex, 0, movedColumn);

            await Promise.all(boardColumns.map(async (col, index) => {
                await getCurrentProvider().updateColumn(col.id, { order: index });
            }));

            await RenderModule.render();
        }
    } finally {
        removeAllDropIndicators();
    }
    return false;
}