import { formatDateTime, formatTimeLeft, formatDeadlineTime } from '../utils.js';
import { hexToRGB } from './ui-utils.js';
import { defaultTaskColors } from './theme.js';

export function initBoardRenderer(
  data, 
  render, 
  saveData, 
  getSelectedBoard, 
  tasks, 
  openTaskDialog, 
  getColumnStats, 
  dragDrop,
  openBoardDialog,
  openColumnDialog
) {
  function renderBoard() {
    const board = getSelectedBoard();
    if (!board) {
      document.getElementById('board-title').textContent = 'Выберите доску или создайте новую';
      document.getElementById('columns').innerHTML = '';
      return;
    }

    const boardTitleEl = document.getElementById('board-title');
    const columnsEl = document.getElementById('columns');

    boardTitleEl.textContent = board.name;
    boardTitleEl.style.cursor = 'pointer';
    boardTitleEl.title = 'Дважды щелкните для редактирования';
    
    boardTitleEl.addEventListener('dblclick', () => {
      openBoardDialog(board);
    });

    columnsEl.innerHTML = '';

    board.columns.forEach(column => {
      const colEl = document.createElement('div');
      colEl.className = 'column';
      colEl.dataset.columnId = column.id;
      colEl.draggable = true;
      
      colEl.addEventListener('dragstart', () => {
        colEl.classList.add('dragging');
      });

      colEl.addEventListener('dragend', () => {
        colEl.classList.remove('dragging');
        dragDrop.removeAllDropIndicators();
      });

      colEl.addEventListener('dragover', (e) => {
        dragDrop.handleColumnDragOver(e, colEl);
      });

      colEl.addEventListener('drop', (e) => {
        dragDrop.handleColumnDrop(e);
      });
      
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

      headerEl.addEventListener('dblclick', () => {
        openColumnDialog(column);
      });

      column.tasks
        .filter(task => !task.parentId)
        .forEach(task => renderTask(task, colEl));

      const addTaskBtn = document.createElement('button');
      addTaskBtn.className = 'add-btn';
      addTaskBtn.textContent = '+ Добавить задачу';
      addTaskBtn.onclick = () => {
        openTaskDialog(column);
      };
      colEl.appendChild(addTaskBtn);

      columnsEl.appendChild(colEl);
    });
  }

  function renderTask(task, container) {
    const taskEl = document.createElement('div');
    taskEl.className = 'task' + (task.done ? ' done' : '') + (task.parentId ? ' subtask' : '') + (task.isInfo ? ' info' : '');
    taskEl.draggable = true;
    taskEl.dataset.taskId = task.id;
    
    if (!task.done && task.deadline) {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const diff = deadline - now;
      const hourInMs = 60 * 60 * 1000;
      
      if (diff < hourInMs || diff < 0) {
        taskEl.classList.add('deadline-warning');
      }
    }

    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header';

    const currentColor = task.done && task.doneColor ? task.doneColor : task.color;
    if (currentColor) {
      taskEl.style.borderLeftColor = currentColor;
      taskEl.dataset.customColor = '';
      
      const alpha = task.done ? '0.1' : '0.05';
      const rgb = hexToRGB(currentColor);
      taskEl.style.setProperty('--task-bg-color', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
      
      if (task.done && task.doneColor) {
        const doneRgb = hexToRGB(task.doneColor);
        taskEl.style.setProperty('--task-done-bg-color', `rgba(${doneRgb.r}, ${doneRgb.g}, ${doneRgb.b}, 0.15)`);
      }
    }

    if (!task.isInfo) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.onclick = (e) => e.stopPropagation();
      checkbox.onchange = () => {
        task.done = checkbox.checked;
        if (checkbox.checked) {
          task.doneDate = new Date().toISOString();
        } else {
          task.doneDate = null;
        }
        saveData();
        render();
      };
      taskHeader.appendChild(checkbox);
    }

    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';
    
    const title = document.createElement('div');
    renderLinkedText(title, task.title, 'task-title');
    taskContent.appendChild(title);
    
    if (task.description) {
      const descEl = document.createElement('div');
      renderLinkedText(descEl, task.description, 'task-description');
      taskContent.appendChild(descEl);
    }
    
    taskHeader.appendChild(taskContent);
    taskEl.appendChild(taskHeader);

    if (task.repeating) {
      const repeatIcon = document.createElement('div');
      repeatIcon.className = 'task-repeat-icon';
      repeatIcon.innerHTML = '🔄';
      repeatIcon.title = 'Повторяющаяся задача';
      taskEl.appendChild(repeatIcon);
    }

    const timeIndicators = document.createElement('div');
    timeIndicators.className = 'task-time-indicators';

    if (task.done && task.doneDate) {
      const doneTime = document.createElement('div');
      doneTime.className = 'task-done-time';
      doneTime.textContent = `✓ ${formatDateTime(task.doneDate)}`;
      timeIndicators.appendChild(doneTime);
    }

    if (task.deadline) {
      const deadlineInfo = document.createElement('div');
      deadlineInfo.className = 'task-deadline-info';
      const now = new Date();
      const deadline = new Date(task.deadline);
      
      if (!task.done) {
        if (deadline <= now) {
          deadlineInfo.classList.add('overdue');
        }
        deadlineInfo.textContent = `⌛️ ${formatDeadlineTime(deadline)}`;
      } else {
        deadlineInfo.textContent = `⌛️ ${formatDateTime(deadline)}`;
      }
      
      timeIndicators.appendChild(deadlineInfo);
    }
    else if (task.repeating && task.done) {
      const resetInfo = document.createElement('div');
      resetInfo.className = 'task-reset-info';
      resetInfo.textContent = formatTimeLeft(task.resetTime || '00:00');
      timeIndicators.appendChild(resetInfo);
    }

    if (timeIndicators.children.length > 0) {
      taskEl.appendChild(timeIndicators);
    }

    addTaskDragHandlers(taskEl);

    container.appendChild(taskEl);

    if (task.subtasks && task.subtasks.length > 0) {
      const subtasksContainer = document.createElement('div');
      subtasksContainer.className = 'subtasks-container';
      
      task.subtasks.forEach(subtaskId => {
        const subtask = tasks.findTaskById(subtaskId);
        if (subtask) {
          renderTask(subtask, subtasksContainer);
        }
      });
      
      taskEl.appendChild(subtasksContainer);

      const expandToggle = document.createElement('div');
      expandToggle.className = 'task-expand-toggle' + (task.collapsed ? ' collapsed' : '');
      
      const spacerLeft = document.createElement('div');
      expandToggle.appendChild(spacerLeft);
      
      const toggleArrow = document.createElement('span');
      toggleArrow.className = 'toggle-arrow';
      expandToggle.appendChild(toggleArrow);
      
      const stats = tasks.getSubtasksStats(task);
      if (stats.total > 0) {
        const statsEl = document.createElement('div');
        statsEl.className = 'subtasks-stats';
        statsEl.innerHTML = `
          <span class="stats-done">${stats.done}</span>
          <span class="stats-separator">/</span>
          <span class="stats-total">${stats.total}</span>
        `;
        expandToggle.appendChild(statsEl);
      } else {
        const spacerRight = document.createElement('div');
        expandToggle.appendChild(spacerRight);
      }
      
      expandToggle.onclick = (e) => {
        e.stopPropagation();
        const subtasksContainer = taskEl.querySelector('.subtasks-container');
        if (subtasksContainer) {
          const isExpanded = !expandToggle.classList.contains('collapsed');
          expandToggle.classList.toggle('collapsed');
          subtasksContainer.style.display = isExpanded ? 'none' : 'block';
          
          task.collapsed = isExpanded;
          saveData();
        }
      };
      taskEl.appendChild(expandToggle);

      if (task.collapsed) {
        subtasksContainer.style.display = 'none';
      }
    }
  }

  function addTaskDragHandlers(taskEl) {
    taskEl.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      taskEl.classList.add('dragging');
    });

    taskEl.addEventListener('dragend', (e) => {
      e.stopPropagation();
      taskEl.classList.remove('dragging');
      dragDrop.removeAllDropIndicators();
    });

    taskEl.addEventListener('dragover', (e) => {
      const draggingTask = document.querySelector('.task.dragging');
      if (!draggingTask) return;
      dragDrop.showTaskDropIndicator(e, taskEl, draggingTask);
    });

    taskEl.addEventListener('drop', (e) => {
      dragDrop.handleTaskDrop(e, taskEl);
    });

    taskEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      
      const task = tasks.findTaskById(taskEl.dataset.taskId);
      if (task) {
        const column = getSelectedBoard().columns.find(col => {
          return col.tasks.some(t => {
            if (t.id === task.id) return true;
            return !!(task.parentId && t.id === task.parentId);
          });
        });
        
        if (column) {
          openTaskDialog(column, task);
        }
      }
    });
  }

  function renderLinkedText(container, text, className = '') {
    container.className = className;
    container.innerHTML = formatDescription(text);
  }

  function formatDescription(text) {
    let formatted = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    formatted = formatted.replace(
      /(?<!["=])(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    return formatted;
  }

  return {
    renderBoard,
    renderTask,
    renderLinkedText
  };
} 