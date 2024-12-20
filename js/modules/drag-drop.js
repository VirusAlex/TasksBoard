import { findParentByClass } from './ui-utils.js';

export function initDragDrop(tasks, render) {
  let dropIndicator = null;
  let subtaskDropIndicator = null;

  function removeAllDropIndicators() {
    document.querySelectorAll('.drop-indicator, .task-drop-indicator, .subtask-drop-indicator').forEach(indicator => indicator.remove());
    dropIndicator = null;
    subtaskDropIndicator = null;
  }

  function showTaskDropIndicator(e, parentEl, draggingTask) {
    if (parentEl === draggingTask) return;
    e.preventDefault();
    e.stopPropagation();

    // Удаляем существующие индикаторы
    removeAllDropIndicators();

    // Если parentEl - таск
    if (parentEl.classList.contains('task')) {
      const taskEl = parentEl;
      const draggingTaskId = draggingTask.dataset.taskId;
      const targetTaskId = taskEl.dataset.taskId;

      // Проверяем, не пытаемся ли мы перетащить родительскую задачу на её дочернюю
      if (isTaskAncestor(targetTaskId, draggingTaskId)) return;

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
        // Создаем индикатор для вставки в список сабтасков
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'task-drop-indicator';
        
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
          subtasksContainer.insertBefore(dropIndicator, closestTask);
        } else {
          subtasksContainer.appendChild(dropIndicator);
        }
      } else if (mouseY > partHeight && mouseY < (partHeight * 3)) {
        // Если курсор в центральной части - показываем индикатор создания сабтаска
        subtaskDropIndicator = document.createElement('div');
        subtaskDropIndicator.className = 'subtask-drop-indicator';
        taskEl.appendChild(subtaskDropIndicator);
      } else {
        // Создаем индикатор для обычного перемещения
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'task-drop-indicator';

        if (mouseY < partHeight) {
          taskEl.parentNode.insertBefore(dropIndicator, taskEl);
        } else {
          taskEl.parentNode.insertBefore(dropIndicator, taskEl.nextSibling);
        }
      }
    } else if (parentEl.classList.contains('column')) {
      const colEl = parentEl;
      // Получаем все задачи верхнего уровня в колонке
      const tasks = Array.from(colEl.querySelectorAll('.task:not(.subtask)'));
      const addTaskBtn = colEl.querySelector('.add-btn');

      dropIndicator = document.createElement('div');
      dropIndicator.className = 'task-drop-indicator';

      // Если нет задач, просто добавляем индикатор перед кнопкой
      if (tasks.length === 0) {
        colEl.insertBefore(dropIndicator, addTaskBtn);
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
          colEl.insertBefore(dropIndicator, closestTask);
        } else {
          colEl.insertBefore(dropIndicator, closestTask.nextSibling);
        }
      } else {
        colEl.insertBefore(dropIndicator, addTaskBtn);
      }
    }
  }

  function showDropIndicator(e, column) {
    removeAllDropIndicators();

    dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';
    
    const rect = column.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    if (x < rect.width / 2) {
      column.insertAdjacentElement('beforebegin', dropIndicator);
    } else {
      column.insertAdjacentElement('afterend', dropIndicator);
    }
  }

  function isTaskAncestor(taskId, possibleAncestorId) {
    const task = tasks.findTaskById(taskId);
    if (!task || !task.parentId) return false;
    if (task.parentId === possibleAncestorId) return true;
    return isTaskAncestor(task.parentId, possibleAncestorId);
  }

  function handleColumnDragOver(e, column) {
    e.preventDefault();
    showDropIndicator(e, column);
  }

  function handleColumnDrop(e) {
    e.preventDefault();
    
    const draggingCol = document.querySelector('.column.dragging');
    if (!draggingCol || !dropIndicator) return;

    const columns = [...document.querySelectorAll('.column')];
    const board = columns[0]?.parentElement;
    if (!board) return;

    const dropIndex = [...board.children].indexOf(dropIndicator);
    const dragIndex = [...board.children].indexOf(draggingCol);
    
    if (dropIndex !== -1 && dragIndex !== -1) {
      // Получаем доску и переупорядочиваем колонки
      const boardData = tasks.findBoardByColumnId(draggingCol.dataset.columnId);
      if (boardData) {
        const column = boardData.columns.splice(dragIndex, 1)[0];
        boardData.columns.splice(dropIndex > dragIndex ? dropIndex - 1 : dropIndex, 0, column);
        render();
      }
    }

    removeAllDropIndicators();
  }

  function handleTaskDrop(e, targetEl) {
    e.preventDefault();
    e.stopPropagation();

    const draggingTask = document.querySelector('.task.dragging');
    if (!draggingTask) return;

    const draggedTaskId = draggingTask.dataset.taskId;
    const targetColumn = findParentByClass(targetEl, 'column');
    if (!targetColumn) return;

    // Если перетаскиваем на другую задачу
    if (targetEl.classList.contains('task')) {
      const targetTaskId = targetEl.dataset.taskId;
      const sourceTask = tasks.findTaskById(draggedTaskId);
      const targetTask = tasks.findTaskById(targetTaskId);
      
      if (!sourceTask || !targetTask) return;
      if (targetTask.id === sourceTask.id) return;
      if (isTaskAncestor(targetTask.id, sourceTask.id)) return;

      // Проверяем наличие индикатора сабтаска
      if (document.querySelector('.subtask-drop-indicator')) {
        // Создаем сабтаск
        const sourceColumn = tasks.findColumnByTaskId(draggedTaskId);
        if (sourceColumn) {
          const taskIndex = sourceColumn.tasks.findIndex(t => t.id === draggedTaskId);
          if (taskIndex !== -1) {
            // Удаляем задачу из колонки
            sourceColumn.tasks.splice(taskIndex, 1);
            
            // Добавляем задачу как сабтаск
            sourceTask.parentId = targetTaskId;
            sourceColumn.tasks.push(sourceTask);
            
            render();
            return;
          }
        }
      }
    }

    // Обычное перемещение задачи
    const dropIndex = [...targetColumn.children].indexOf(dropIndicator);
    if (dropIndex !== -1) {
      tasks.moveTask(draggedTaskId, targetColumn.dataset.columnId, dropIndex);
      render();
    }

    removeAllDropIndicators();
  }

  return {
    removeAllDropIndicators,
    showDropIndicator,
    showTaskDropIndicator,
    handleColumnDragOver,
    handleColumnDrop,
    handleTaskDrop
  };
} 