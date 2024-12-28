// Модуль для работы с календарным представлением
import { formatDateTime, formatTimeLeft, formatDeadlineTime } from '../utils.js';
import { renderLinkedText, hexToRGB } from './uiComponents.js';
import * as TaskManager from './taskModule.js';
import * as BoardManager from './boardModule.js';
import * as StateModule from './stateModule.js';
import * as RenderModule from './renderModule.js';

// Основные функции календаря
// Функция для отображения календаря
export function renderCalendar() {
  const mainCalendar = document.querySelector('.main-calendar');
  const prevMonthCal = document.querySelector('.mini-calendar.prev-month');
  const nextMonthCal = document.querySelector('.mini-calendar.next-month');

  // Очищаем и подготавливаем контейнер основного календаря
  mainCalendar.innerHTML = '<div class="calendar-grid"></div>';

  let currentDate = new Date();

  // Обновляем заголовок текущего месяца
  document.getElementById('current-month').textContent = currentDate.toLocaleString('ru', {
    month: 'long',
    year: 'numeric'
  }).replace(/^./, str => str.toUpperCase());

  // Создаем даты для предыдущего и следующего месяцев
  const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

  // Обновляем заголовки мини-календарей
  prevMonthCal.querySelector('h4').textContent = prevMonth.toLocaleString('ru', {
    month: 'long',
    year: 'numeric'
  }).replace(/^./, str => str.toUpperCase());

  nextMonthCal.querySelector('h4').textContent = nextMonth.toLocaleString('ru', {
    month: 'long',
    year: 'numeric'
  }).replace(/^./, str => str.toUpperCase());

  // Рендерим календари
  renderMonth(mainCalendar.querySelector('.calendar-grid'), currentDate, true);
  renderMonth(prevMonthCal.querySelector('.calendar-grid'), prevMonth, false);
  renderMonth(nextMonthCal.querySelector('.calendar-grid'), nextMonth, false);

  document.addEventListener('click', () => {
    document.querySelectorAll('.calendar-day').forEach(day => {
      day.classList.remove('selected');
      // Скрываем все списки задач
      const taskList = day.querySelector('.task-list');
      if (taskList) {
        taskList.style.display = 'none';
      }
    });
  });

  document.querySelector('.main-calendar')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

export function renderMonth(container, date, isMainCalendar) {
    // Сначала создаем grid-контейнер для календаря
    const calendarGrid = container.querySelector('.calendar-grid') || container;
    calendarGrid.innerHTML = '';

    // Добавляем заголовки дней недели
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    days.forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      dayHeader.textContent = day;
      calendarGrid.appendChild(dayHeader);
    });

    // Получаем первый день месяца
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    // Получаем последний день предыдущего месяца
    const lastDayPrev = new Date(date.getFullYear(), date.getMonth(), 0);

    // Корректируем день недели (0 - понедельник, 6 - воскресенье)
    let firstDayWeek = firstDay.getDay() - 1;
    if (firstDayWeek === -1) firstDayWeek = 6;

    // Добавляем дни предыдущего месяца
    for (let i = firstDayWeek - 1; i >= 0; i--) {
      const day = lastDayPrev.getDate() - i;
      addDayToCalendar(calendarGrid, day, true, new Date(date.getFullYear(), date.getMonth() - 1, day), isMainCalendar);
    }

    // Добавляем дни текущего месяца
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      addDayToCalendar(calendarGrid, i, false, new Date(date.getFullYear(), date.getMonth(), i), isMainCalendar);
    }

    // Добавляем дни следующего месяца
    const remainingDays = 42 - (firstDayWeek + lastDay.getDate());
    for (let i = 1; i <= remainingDays; i++) {
      addDayToCalendar(calendarGrid, i, true, new Date(date.getFullYear(), date.getMonth() + 1, i), isMainCalendar);
    }
}

// Вспомогательные функции
export function addDayToCalendar(container, dayNum, isOtherMonth, fullDate, isMainCalendar) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day' + (isOtherMonth ? ' other-month' : '');

    // Проверяем, является ли день сегодняшним
    const today = new Date();
    if (fullDate.toDateString() === today.toDateString()) {
      dayEl.classList.add('today');
    }

    if (isMainCalendar) {
      dayEl.addEventListener('click', (e) => {
        // Снимаем выделение со всех дней
        document.querySelectorAll('.calendar-day').forEach(day => {
          day.classList.remove('selected');
          // Скрываем все списки задач
          const taskList = day.querySelector('.task-list');
          if (taskList) {
            taskList.style.display = 'none';
          }
        });

        // Выделяем текущий день и показываем его список задач
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

    // Находим задачи для этого дня
    const tasks = getTasksForDate(fullDate);
    if (tasks.length > 0) {
      const markers = document.createElement('div');
      markers.className = 'task-markers';

      tasks.forEach(task => {
        const marker = document.createElement('div');
        marker.className = 'task-marker' +
            (task.done ? ' done' : '') +
            (!task.done && new Date(task.deadline) < today ? ' overdue' : '');

        // Устанавливаем цвет маркера в соответствии с цветом задачи
        const currentColor = (task.done && task.doneColor ? task.doneColor : task.color) || task.info && TaskManager.defaultTaskColors.info || task.done && TaskManager.defaultTaskColors.done || TaskManager.defaultTaskColors.pending;
        if (currentColor) {
          marker.style.background = currentColor;
        }

        markers.appendChild(marker);
      });

      dayEl.appendChild(markers);

      // Добавляем всплывающий список задач
      if (isMainCalendar) {
        const taskList = document.createElement('div');
        taskList.className = 'task-list';

        // Создаем контейнер для контента
        const taskListContent = document.createElement('div');
        taskListContent.className = 'task-list-content';

        tasks.forEach(task => {
          // Создаем клон функции renderTask для календаря
          const taskEl = document.createElement('div');
          taskEl.className = 'task' + (task.done ? ' done' : '') + (task.isInfo ? ' info' : '');

          // Добавляем класс для пульсации, если есть дедлайн и он скоро
          if (!task.done && task.deadline) {
            const deadline = new Date(task.deadline);
            const diff = deadline - today;
            const hourInMs = 60 * 60 * 1000;

            if (diff < hourInMs || diff < 0) {
              taskEl.classList.add('deadline-warning');
            }
          }

          // Создаем header задачи
          const taskHeader = document.createElement('div');
          taskHeader.className = 'task-header';

          // Добавляем кастомные цвета
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

          // Добавляем чекбокс
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
              StateModule.saveState();
              RenderModule.render();
            };
            taskHeader.appendChild(checkbox);
          }

          // Добавляем контент задачи
          const taskContent = document.createElement('div');
          taskContent.className = 'task-content';

          // Заголовок
          const title = document.createElement('div');
          renderLinkedText(title, task.title, 'task-title');
          taskContent.appendChild(title);

          // Описание
          if (task.description) {
            const descEl = document.createElement('div');
            renderLinkedText(descEl, task.description, 'task-description');
            taskContent.appendChild(descEl);
          }

          taskHeader.appendChild(taskContent);
          taskEl.appendChild(taskHeader);

          // Добавляем иконку повторения
          if (task.repeating) {
            const repeatIcon = document.createElement('div');
            repeatIcon.className = 'task-repeat-icon';
            repeatIcon.innerHTML = '🔄';
            repeatIcon.title = 'Повторяющаяся задача';
            taskEl.appendChild(repeatIcon);
          }

          // Добавляем индикаторы времени
          const timeIndicators = document.createElement('div');
          timeIndicators.className = 'task-time-indicators';

          // Добавляем метку времени выполнения
          if (task.done && task.doneDate) {
            const doneTime = document.createElement('div');
            doneTime.className = 'task-done-time';
            doneTime.textContent = `✓ ${formatDateTime(task.doneDate)}`;
            timeIndicators.appendChild(doneTime);
          }

          // Добавляем информацию о дедлайне
          if (task.deadline) {
            const deadlineInfo = document.createElement('div');
            deadlineInfo.className = 'task-deadline-info';
            const now = new Date();
            const deadline = new Date(task.deadline);

            if (!task.done) {
              // Для невыполненных задач показываем оставшееся время
              if (deadline <= now) {
                deadlineInfo.classList.add('overdue');
              }
              deadlineInfo.textContent = `⌛️ ${formatDeadlineTime(deadline)}`;
            } else {
              // Для выполненных задач показываем точное время дедлайна
              deadlineInfo.textContent = `⌛️ ${formatDateTime(deadline)}`;
            }

            timeIndicators.appendChild(deadlineInfo);
          }
          // Добавляем информацию о сбросе для повторяющихся задач
          else if (task.repeating && task.done) {
            const resetInfo = document.createElement('div');
            resetInfo.className = 'task-reset-info';
            resetInfo.textContent = formatTimeLeft(task.resetTime || '00:00');
            timeIndicators.appendChild(resetInfo);
          }

          // Добавляем контейнер с индикаторами только если есть хотя бы один индикатор
          if (timeIndicators.children.length > 0) {
            taskEl.appendChild(timeIndicators);
          }

          // Добавляем обработчик клика для открытия задачи
          taskEl.onclick = (e) => {
            e.stopPropagation();
            openTaskFromCalendar(task);
          };

          taskListContent.appendChild(taskEl);
        });

        taskList.appendChild(taskListContent);
        dayEl.appendChild(taskList);
      }
    }

    container.appendChild(dayEl);
}

// Функции для работы с датами в календаре
export function getTasksForDate(date) {
    const tasks = [];
    // Устанавливаем время в начало дня для корректного сравнения
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    StateModule.getState().boards.forEach(board => {
      board.columns.forEach(column => {
        column.tasks.forEach(task => {
          if (task.deadline) {
            const taskDate = new Date(task.deadline);
            // Устанавливаем время в начало дня для задачи
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
    // Переключаемся на нужную доску
    StateModule.setState({...StateModule.getState(), selectedBoardId: task.boardId});

    // Находим колонку
    const board = BoardManager.getSelectedBoard();
    const column = board.columns.find(col => col.id === task.columnId);

    if (column) {
      // Переключаемся на вид досок и открываем диалог задачи
      showBoardView();
      TaskManager.openTaskDialog(column, task);
    }
  }

  function showBoardView() {
    StateModule.setState({...StateModule.getState(), isCalendarView: false});
    StateModule.saveState();
    RenderModule.render();
  }