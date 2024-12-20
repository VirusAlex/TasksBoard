import { generateId } from '../utils.js';

export function initTaskManager(data, saveData) {
  function findTaskById(taskId) {
    for (const board of data.boards) {
      for (const column of board.columns) {
        const task = column.tasks.find(t => t.id === taskId);
        if (task) return task;
      }
    }
    return null;
  }

  function findColumnByTaskId(taskId) {
    for (const board of data.boards) {
      for (const column of board.columns) {
        if (column.tasks.some(t => t.id === taskId)) {
          return column;
        }
      }
    }
    return null;
  }

  function findBoardByColumnId(columnId) {
    return data.boards.find(board => 
      board.columns.some(column => column.id === columnId)
    );
  }

  function getSubtasksStats(task) {
    let done = 0;
    let total = 0;

    // Ищем все задачи, у которых parentId равен id текущей задачи
    for (const board of data.boards) {
      for (const column of board.columns) {
        column.tasks.forEach(t => {
          if (t.parentId === task.id && !t.isInfo) {
            total++;
            if (t.done) done++;
          }
        });
      }
    }

    return { done, total };
  }

  function createTask(column, taskData) {
    const task = {
      id: taskData.id,
      title: taskData.title,
      description: taskData.description || '',
      color: taskData.color || null,
      done: false,
      doneDate: null,
      doneColor: null,
      deadline: taskData.deadline || null,
      repeating: taskData.repeating || false,
      resetTime: taskData.resetTime || null,
      isInfo: taskData.isInfo || false,
      parentId: taskData.parentId || null,
      collapsed: false
    };

    column.tasks.push(task);
    saveData();
    return task;
  }

  function deleteTask(taskId) {
    for (const board of data.boards) {
      for (const column of board.columns) {
        const taskIndex = column.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          // Рекурсивно удаляем все сабтаски
          const task = column.tasks[taskIndex];
          // Ищем и удаляем все задачи, у которых parentId равен taskId
          for (const col of board.columns) {
            col.tasks = col.tasks.filter(t => {
              if (t.parentId === taskId) {
                deleteTask(t.id); // Рекурсивно удаляем сабтаски сабтасков
                return false;
              }
              return true;
            });
          }
          
          // Удаляем саму задачу
          column.tasks.splice(taskIndex, 1);
          saveData();
          return true;
        }
      }
    }
    return false;
  }

  function moveTask(taskId, targetColumnId, targetIndex) {
    const task = findTaskById(taskId);
    if (!task) return false;

    // Находим исходную колонку
    const sourceColumn = findColumnByTaskId(taskId);
    if (!sourceColumn) return false;

    // Находим целевую колонку
    let targetColumn;
    for (const board of data.boards) {
      targetColumn = board.columns.find(col => col.id === targetColumnId);
      if (targetColumn) break;
    }
    if (!targetColumn) return false;

    // Если это был сабтаск, удаляем parentId
    if (task.parentId) {
      task.parentId = null;
    }

    // Удаляем задачу из исходной колонки
    sourceColumn.tasks = sourceColumn.tasks.filter(t => t.id !== taskId);

    // Вставляем задачу в целевую колонку
    if (targetIndex === undefined || targetIndex === null) {
      targetColumn.tasks.push(task);
    } else {
      targetColumn.tasks.splice(targetIndex, 0, task);
    }

    saveData();
    return true;
  }

  function addSubtask(parentTaskId, subtaskData) {
    const parentTask = findTaskById(parentTaskId);
    if (!parentTask) return null;

    const column = findColumnByTaskId(parentTaskId);
    if (!column) return null;

    // Создаем сабтаск
    const subtask = createTask(column, {
      ...subtaskData,
      parentId: parentTaskId
    });

    saveData();
    return subtask;
  }

  function updateTask(taskId, updates) {
    const task = findTaskById(taskId);
    if (!task) return false;

    Object.assign(task, updates);
    saveData();
    return true;
  }

  function toggleTaskDone(taskId) {
    const task = findTaskById(taskId);
    if (!task) return false;

    task.done = !task.done;
    if (task.done) {
      task.doneDate = new Date().toISOString();
    } else {
      task.doneDate = null;
    }

    saveData();
    return true;
  }

  return {
    findTaskById,
    findColumnByTaskId,
    findBoardByColumnId,
    getSubtasksStats,
    createTask,
    deleteTask,
    moveTask,
    addSubtask,
    updateTask,
    toggleTaskDone
  };
} 