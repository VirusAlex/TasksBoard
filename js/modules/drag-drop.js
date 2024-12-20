import { findParentByClass } from './ui-utils.js';

export function initDragDrop(tasks, render) {
  let dropIndicator = null;

  function removeAllDropIndicators() {
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.task-drop-indicator').forEach(el => el.remove());
  }

  function showDropIndicator(e, column) {
    removeAllDropIndicators();

    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    
    const rect = column.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    if (x < rect.width / 2) {
      column.insertAdjacentElement('beforebegin', indicator);
    } else {
      column.insertAdjacentElement('afterend', indicator);
    }
    
    dropIndicator = indicator;
  }

  function showTaskDropIndicator(e, targetTask, draggingTask) {
    e.preventDefault();
    e.stopPropagation();
    
    removeAllDropIndicators();

    // Проверяем, не пытаемся ли мы перетащить задачу на саму себя
    if (targetTask === draggingTask) return;

    // Проверяем, не пытаемся ли мы перетащить родительскую задачу на её дочернюю
    const draggingTaskId = draggingTask.dataset.taskId;
    const targetTaskId = targetTask.dataset.taskId;
    if (isAncestorTask(draggingTaskId, targetTaskId)) return;

    const indicator = document.createElement('div');
    indicator.className = 'task-drop-indicator';
    
    const rect = targetTask.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    if (y < rect.height / 2) {
      targetTask.insertAdjacentElement('beforebegin', indicator);
    } else {
      targetTask.insertAdjacentElement('afterend', indicator);
    }
    
    dropIndicator = indicator;
  }

  function isAncestorTask(draggingTaskId, targetTaskId) {
    const targetTask = tasks.findTaskById(targetTaskId);
    if (!targetTask) return false;

    let currentTask = targetTask;
    while (currentTask.parentId) {
      if (currentTask.parentId === draggingTaskId) return true;
      currentTask = tasks.findTaskById(currentTask.parentId);
      if (!currentTask) break;
    }
    return false;
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

  function handleTaskDrop(e, targetTask) {
    e.preventDefault();
    e.stopPropagation();

    const draggingTask = document.querySelector('.task.dragging');
    if (!draggingTask || !dropIndicator) return;

    const draggingTaskId = draggingTask.dataset.taskId;
    const targetTaskId = targetTask.dataset.taskId;
    const targetColumn = findParentByClass(targetTask, 'column');

    if (!targetColumn) return;

    const sourceTask = tasks.findTaskById(draggingTaskId);
    const targetTaskObj = tasks.findTaskById(targetTaskId);
    
    if (!sourceTask || !targetTaskObj) return;

    // Если перетаскиваем на другую задачу (создание сабтаска)
    if (draggingTask !== targetTask) {
      const rect = targetTask.getBoundingClientRect();
      const y = e.clientY - rect.top;
      
      // Если перетаскиваем в середину задачи - создаем сабтаск
      if (y >= rect.height * 0.25 && y <= rect.height * 0.75) {
        // Проверяем, не является ли целевая задача уже сабтаском
        if (!targetTaskObj.parentId) {
          // Удаляем задачу из текущей позиции
          const sourceColumn = tasks.findColumnByTaskId(draggingTaskId);
          if (sourceColumn) {
            const taskIndex = sourceColumn.tasks.findIndex(t => t.id === draggingTaskId);
            if (taskIndex !== -1) {
              // Удаляем задачу из колонки
              sourceColumn.tasks.splice(taskIndex, 1);
              
              // Добавляем задачу обратно в ту же колонку, но как сабтаск
              sourceTask.parentId = targetTaskId;
              if (!targetTaskObj.subtasks) {
                targetTaskObj.subtasks = [];
              }
              targetTaskObj.subtasks.push(draggingTaskId);
              sourceColumn.tasks.push(sourceTask);
              
              render();
              return;
            }
          }
        }
      }
    }

    // Обычное перемещение задачи
    const dropIndex = [...targetColumn.children].indexOf(dropIndicator);
    if (dropIndex !== -1) {
      tasks.moveTask(draggingTaskId, targetColumn.dataset.columnId, dropIndex);
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