import { formatDateTime, formatDeadlineTime } from '../utils.js';
import { hexToRGB } from './ui-utils.js';
import { defaultTaskColors } from './theme.js';

export function initCalendar(data, render, saveData, tasks, openTaskDialog, getSelectedBoard) {
  let currentDate = new Date();
  const calendarViewEl = document.getElementById('calendar-view');
  const boardView = document.getElementById('board-view');
  const calendarViewContent = document.getElementById('calendar-view-content');
  const boardTitle = document.getElementById('board-title');

  function showCalendarView() {
    data.isCalendarView = true;
    data.selectedBoardId = null;
    saveData();
    render();

    // Обновляем отображение
    calendarViewEl?.classList.add('selected');
    boardView.style.display = 'none';
    calendarViewContent.style.display = 'block';
    boardTitle.textContent = 'Календарь';
  }

  function renderCalendar() {
    const mainCalendar = document.querySelector('.main-calendar');
    const prevMonthCal = document.querySelector('.mini-calendar.prev-month');
    const nextMonthCal = document.querySelector('.mini-calendar.next-month');
    
    if (!mainCalendar || !prevMonthCal || !nextMonthCal) {
      console.warn('Calendar elements not found');
      return;
    }

    mainCalendar.innerHTML = '<div class="calendar-grid"></div>';
    
    document.getElementById('current-month').textContent = currentDate.toLocaleString('ru', { 
      month: 'long', 
      year: 'numeric' 
    }).replace(/^./, str => str.toUpperCase());

    const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    prevMonthCal.querySelector('h4').textContent = prevMonth.toLocaleString('ru', { 
      month: 'long', 
      year: 'numeric' 
    }).replace(/^./, str => str.toUpperCase());

    nextMonthCal.querySelector('h4').textContent = nextMonth.toLocaleString('ru', { 
      month: 'long', 
      year: 'numeric' 
    }).replace(/^./, str => str.toUpperCase());

    renderMonth(mainCalendar.querySelector('.calendar-grid'), currentDate, true);
    renderMonth(prevMonthCal.querySelector('.calendar-grid'), prevMonth, false);
    renderMonth(nextMonthCal.querySelector('.calendar-grid'), nextMonth, false);
  }

  function renderMonth(container, date, isMainCalendar) {
    const calendarGrid = container.querySelector('.calendar-grid') || container;
    calendarGrid.innerHTML = '';
    
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    days.forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      dayHeader.textContent = day;
      calendarGrid.appendChild(dayHeader);
    });

    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDayPrev = new Date(date.getFullYear(), date.getMonth(), 0);
    
    let firstDayWeek = firstDay.getDay() - 1;
    if (firstDayWeek === -1) firstDayWeek = 6;

    for (let i = firstDayWeek - 1; i >= 0; i--) {
      const day = lastDayPrev.getDate() - i;
      addDayToCalendar(calendarGrid, day, true, new Date(date.getFullYear(), date.getMonth() - 1, day), isMainCalendar);
    }

    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      addDayToCalendar(calendarGrid, i, false, new Date(date.getFullYear(), date.getMonth(), i), isMainCalendar);
    }

    const remainingDays = 42 - (firstDayWeek + lastDay.getDate());
    for (let i = 1; i <= remainingDays; i++) {
      addDayToCalendar(calendarGrid, i, true, new Date(date.getFullYear(), date.getMonth() + 1, i), isMainCalendar);
    }
  }

  function addDayToCalendar(container, dayNum, isOtherMonth, fullDate, isMainCalendar) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day' + (isOtherMonth ? ' other-month' : '');
    
    const today = new Date();
    if (fullDate.toDateString() === today.toDateString()) {
      dayEl.classList.add('today');
    }

    if (isMainCalendar) {
      dayEl.addEventListener('click', (e) => {
        document.querySelectorAll('.calendar-day').forEach(day => {
          day.classList.remove('selected');
          const taskList = day.querySelector('.task-list');
          if (taskList) {
            taskList.style.display = 'none';
          }
        });
        
        dayEl.classList.add('selected');
        const taskList = dayEl.querySelector('.task-list');
        if (taskList) {
          taskList.style.display = 'block';
        }
        e.stopPropagation();
      });
    }

    const dateEl = document.createElement('div');
    dateEl.className = 'date';
    dateEl.textContent = dayNum;
    dayEl.appendChild(dateEl);

    const tasks = getTasksForDate(fullDate);
    if (tasks.length > 0) {
      const markers = document.createElement('div');
      markers.className = 'task-markers';
      
      tasks.forEach(task => {
        const marker = document.createElement('div');
        marker.className = 'task-marker' + 
          (task.done ? ' done' : '') + 
          (!task.done && new Date(task.deadline) < today ? ' overdue' : '');
        
        const currentColor = (task.done && task.doneColor ? task.doneColor : task.color) || 
          task.info && defaultTaskColors.info || 
          task.done && defaultTaskColors.done || 
          defaultTaskColors.pending;
        
        if (currentColor) {
          marker.style.background = currentColor;
        }
        
        markers.appendChild(marker);
      });
      
      dayEl.appendChild(markers);

      if (isMainCalendar) {
        const taskList = document.createElement('div');
        taskList.className = 'task-list';
        
        const taskListContent = document.createElement('div');
        taskListContent.className = 'task-list-content';
        
        tasks.forEach(task => {
          const taskEl = createTaskElement(task);
          taskListContent.appendChild(taskEl);
        });
        
        taskList.appendChild(taskListContent);
        dayEl.appendChild(taskList);
      }
    }

    container.appendChild(dayEl);
  }

  function createTaskElement(task) {
    const taskEl = document.createElement('div');
    taskEl.className = 'task' + (task.done ? ' done' : '') + (task.isInfo ? ' info' : '');
    
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
      checkbox.onclick = (e) => {
        e.stopPropagation();
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
    title.className = 'task-title';
    title.textContent = task.title;
    taskContent.appendChild(title);
    
    if (task.description) {
      const descEl = document.createElement('div');
      descEl.className = 'task-description';
      descEl.textContent = task.description;
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

    if (timeIndicators.children.length > 0) {
      taskEl.appendChild(timeIndicators);
    }

    taskEl.onclick = (e) => {
      e.stopPropagation();
      openTaskFromCalendar(task);
    };
    
    return taskEl;
  }

  function getTasksForDate(date) {
    const tasks = [];
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    data.boards.forEach(board => {
      board.columns.forEach(column => {
        column.tasks.forEach(task => {
          if (task.deadline) {
            const taskDate = new Date(task.deadline);
            const taskStartOfDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
            if (taskStartOfDay.getTime() === startOfDay.getTime()) {
              tasks.push({...task, boardId: board.id, columnId: column.id});
            }
          }
        });
      });
    });

    return tasks;
  }

  function openTaskFromCalendar(task) {
    data.isCalendarView = false;
    data.selectedBoardId = task.boardId;
    
    const board = getSelectedBoard();
    const column = board?.columns.find(col => col.id === task.columnId);
    
    if (column) {
      showBoardView();
      openTaskDialog(column, task);
    }
  }

  function showBoardView() {
    data.isCalendarView = false;
    saveData();
    render();
  }

  // Event listeners
  calendarViewEl?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showCalendarView();
  });

  document.getElementById('prev-month')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('next-month')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.calendar-day').forEach(day => {
      day.classList.remove('selected');
      const taskList = day.querySelector('.task-list');
      if (taskList) {
        taskList.style.display = 'none';
      }
    });
  });

  document.querySelector('.main-calendar')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  return {
    renderCalendar,
    showCalendarView
  };
} 