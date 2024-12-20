import { formatTimeLeft } from '../utils.js';

export function initRepeatingTasks(data, saveData, tasks) {
  let resetTimeIntervals = new Map();

  function checkTasksReset() {
    const now = new Date();
    let needsSave = false;

    data.boards.forEach(board => {
      board.columns.forEach(col => {
        col.tasks.forEach(task => {
          if (task.repeating && task.done && task.doneDate) {
            let shouldReset = false;

            if (task.resetTime) {
              const doneDate = new Date(task.doneDate);
              const [hours, minutes] = task.resetTime.split(':');
              const resetTime = new Date(doneDate);
              resetTime.setHours(hours, minutes, 0, 0);
              
              if (resetTime <= doneDate) {
                resetTime.setDate(resetTime.getDate() + 1);
              }
              
              shouldReset = now >= resetTime;
            } else {
              const doneDate = new Date(task.doneDate);
              const nextDay = new Date(doneDate);
              nextDay.setDate(nextDay.getDate() + 1);
              nextDay.setHours(0, 0, 0, 0);
              shouldReset = now >= nextDay;
            }

            if (shouldReset) {
              task.done = false;
              task.doneDate = null;
              needsSave = true;
              rerenderTask(task.id);
            }
          }
        });
      });
    });

    if (needsSave) {
      saveData();
    }
  }

  function rerenderTask(taskId) {
    const taskEl = document.querySelector(`div[data-task-id="${taskId}"]`);
    if (!taskEl) return;

    const task = tasks.findTaskById(taskId);
    if (!task) return;

    taskEl.className = 'task' + (task.done ? ' done' : '');
    
    const checkbox = taskEl.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = task.done;

    const resetInfo = taskEl.querySelector('.task-reset-info');
    if (resetInfo) resetInfo.remove();

    if (task.repeating && task.done) {
      const newResetInfo = document.createElement('div');
      newResetInfo.className = 'task-reset-info';
      
      if (task.resetTime) {
        newResetInfo.textContent = formatTimeLeft(task.resetTime);
      } else {
        newResetInfo.textContent = formatTimeLeft('00:00');
      }
      
      taskEl.appendChild(newResetInfo);
    }
  }

  // Start checking for task resets on initialization and every minute
  checkTasksReset();
  setInterval(checkTasksReset, 60000);

  return {
    checkTasksReset,
    rerenderTask
  };
} 