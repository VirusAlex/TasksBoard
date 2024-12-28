import { generateId, formatDateTime, formatTimeLeft, formatDeadlineTime } from './utils.js';
// import { saveToStorage, loadFromStorage } from './storage.js';

// Импорты новых модулей
import { 
    showConfirmDialog, 
    renderLinkedText, 
    hexToRGB, 
    updateLineNumbers 
} from './modules/uiComponents.js';
import * as DragDrop from './modules/dragAndDrop.js';
import * as TaskManager from './modules/taskModule.js';
import * as ColumnManager from './modules/columnModule.js';
import * as BoardManager from './modules/boardModule.js';
import * as Calendar from './modules/calendarModule.js';
import * as StateModule from './modules/stateModule.js';
import * as RenderModule from './modules/renderModule.js';

function initApp() {

  // Добавляем константы для цветов по умолчанию
  const defaultTaskColors = {
    pending: '#f1c40f',
    info: '#3498db',
    done: '#2ecc71'
  };

  const darkThemeTaskColors = {
    pending: '#f39c12',
    info: '#2980b9',
    done: '#27ae60'
  };

  // Инициализация
  StateModule.initStateModule();

  let resetTimeIntervals = new Map();
  let currentDate = new Date();

  // Получаем элементы
  const boardsEl = document.getElementById('boards');
  const addBoardBtn = document.getElementById('add-board-btn');
  const boardTitleEl = document.getElementById('board-title');
  const columnsEl = document.getElementById('columns');
  const addColumnBtn = document.getElementById('add-column-btn');
  const mainEl = document.getElementById('main');

  columnsEl.addEventListener('dragover', (e) => {
    const draggingCol = document.querySelector('.column.dragging');
    if (!draggingCol) return;
    e.preventDefault();
    e.stopPropagation();
    DragDrop.showColumnDropIndicator(e, draggingCol);
  });

  columnsEl.addEventListener('drop', (e) => {
    DragDrop.handleColumnDrop(e);
  });

  // Проверка повторяющихся задач: если дата сегодня > дата выполнения — снять отметку
  // Считаем, что "новый день" — это если сегодняшняя дата (YYYY-MM-DD) изменилась.
  let today = new Date().toISOString().slice(0,10);
  StateModule.getState().boards.forEach(board => {
    board.columns.forEach(col => {
      col.tasks.forEach(task => {
        if (task.repeating && task.done && task.doneDate && task.doneDate < today) {
          task.done = false;
          task.doneDate = null;
        }
      });
    });
  });

  addBoardBtn.addEventListener('click', () => {
    BoardManager.openBoardDialog();
  });

  addColumnBtn.addEventListener('click', () => {
    ColumnManager.openColumnDialog();
  });

  RenderModule.render();

  // Добавляем в начало скрипта, после объявления переменных
  const themeToggle = document.getElementById('theme-toggle');

  // Загружаем сохраненную тему
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    themeToggle.querySelector('span').textContent = '☀️';
  } else {
    themeToggle.querySelector('span').textContent = '🌙';
  }

  // Обработчик переключения темы
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.querySelector('span').textContent = isDark ? '☀️' : '🌙';
  });

  // Обновляем функцию проверки сброса задач
  function checkTasksReset() {
    const now = new Date();
    let needsSave = false;

    StateModule.getState().boards.forEach(board => {
      board.columns.forEach(col => {
        col.tasks.forEach(task => {
          if (task.repeating && task.done && task.doneDate) {
            let shouldReset = false;

            if (task.resetTime) {
              // Берем дату выполнения и добавляем к ней время сброса
              const doneDate = new Date(task.doneDate);
              const [hours, minutes] = task.resetTime.split(':');
              const resetTime = new Date(doneDate);
              resetTime.setHours(hours, minutes, 0, 0);

              // Если время сброса меньше времени выполнения - переносим на следующий день
              if (resetTime <= doneDate) {
                resetTime.setDate(resetTime.getDate() + 1);
              }

              shouldReset = now >= resetTime;
            } else {
              // Если время не задано, сброс в начале следующего дня
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
      StateModule.saveState();
    }
  }

  // Запускаем проверку при загрузке и каждую минуту
  checkTasksReset();
  setInterval(checkTasksReset, 1000);

  // Функция для перерисовки конкретной задачи
  function rerenderTask(taskId) {
    const taskEl = document.querySelector(`div[data-task-id="${taskId}"]`);
    if (!taskEl) return;

    // Находим задачу в данных
    let task = null;
    const board = BoardManager.getSelectedBoard();
    if (!board) return;

    board.columns.forEach(col => {
      const foundTask = col.tasks.find(t => t.id === taskId);
      if (foundTask) task = foundTask;
    });

    if (!task) return;

    // Обновляем состояние карточки
    taskEl.className = 'task' + (task.done ? ' done' : '');

    // Обновляем чекбокс
    const checkbox = taskEl.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = task.done;

    // Обновляем информацию о времени сброса
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

  // Добавляем после остальных обработчиков
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  // Создаем элемент для затемнения фона
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  // Обработчик клика по кнопке
  sidebarToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
    sidebar.classList.toggle('open');
  });

  // Закрытие при клике по затемнению
  backdrop.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
    sidebar.classList.remove('open');
  });

  // Закрытие при выборе доски на мобильных устройствах
  boardsEl.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      document.body.classList.remove('sidebar-open');
      sidebar.classList.remove('open');
    }
  });

  // Функция для вставки ссылки
  async function insertLink() {
    const dialog = document.getElementById('link-dialog');
    const form = dialog.querySelector('form');
    const urlInput = document.getElementById('link-url');
    const textInput = document.getElementById('link-text');
    const description = document.getElementById('task-description');

    // Очищаем форму
    form.reset();

    // Если есть выделенный текст, используем его как текст ссылки
    const selectedText = description.value.substring(
        description.selectionStart,
        description.selectionEnd
    );
    if (selectedText) {
      textInput.value = selectedText;
    }

    dialog.showModal();

    // Ждем закрытия диалога
    const closePromise = new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
    });

    form.onsubmit = (e) => {
      e.preventDefault();
      dialog.close('submit');
    };

    const result = await closePromise;
    if (result === 'submit') {
      const url = urlInput.value;
      const text = textInput.value || url;
      const link = `[${text}](${url})`;

      // Вставляем ссылку в текст
      const start = description.selectionStart;
      const end = description.selectionEnd;
      description.value =
          description.value.substring(0, start) +
          link +
          description.value.substring(end);
    }
  }

  // Функции для работы с сабтасками
  function findTaskById(taskId) {
    const board = BoardManager.getSelectedBoard();
    if (!board) {
      return null;
    }

    // Создаем плоский массив всех задач
    const allTasks = [];

    // Собираем все задачи из всех колонок
    for (const column of board.columns) {
      for (const task of column.tasks) {
        allTasks.push(task);
        if (task.subtasks && task.subtasks.length > 0) {
          collectSubtasks(task, allTasks);
        }
      }
    }

    return allTasks.find(task => task.id === taskId);
  }

  function collectSubtasks(parentTask, tasksArray) {
    if (!parentTask.subtasks) return;

    for (const subtaskId of parentTask.subtasks) {
      // Ищем сабтаск в существующем массиве задач
      const subtask = tasksArray.find(t => t.id === subtaskId);
      if (subtask) {
        if (!tasksArray.includes(subtask)) {
          tasksArray.push(subtask);
        }
        // Рекурсивно собираем сабтаски текущего сабтаска
        if (subtask.subtasks && subtask.subtasks.length > 0) {
          collectSubtasks(subtask, tasksArray);
        }
      }
    }
  }

  function isTaskAncestor(taskId, possibleAncestorId) {
    const task = findTaskById(taskId);
    if (!task || !task.parentId) return false;
    if (task.parentId === possibleAncestorId) return true;
    return isTaskAncestor(task.parentId, possibleAncestorId);
  }

  // Добавляем функцию для получения пути до задачи
  function getTaskPath(task) {
    const path = [];
    let currentTask = task;

    // Собираем путь от текущей задачи до корневой
    while (currentTask && currentTask.parentId) {
      const parentTask = findTaskById(currentTask.parentId);
      if (parentTask) {
        path.unshift(parentTask.title);
        currentTask = parentTask;
      } else {
        break;
      }
    }

    return path;
  }

  // Добавляем после остальных обработчиков
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');

  // Функция экспорта данных
  exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(StateModule.getState(), null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `taskboard-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Функция импорта данных
  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // Проверяем структуру данных
        if (!importedData.boards || !Array.isArray(importedData.boards)) {
          throw new Error('Неверный формат файла');
        }

        const confirmed = await showConfirmDialog(
            'Импорт заменит все текущие данные. Продолжить?'
        );

        if (confirmed) {
          StateModule.setState(importedData);
          StateModule.saveState();
          RenderModule.render();
        }
      } catch (err) {
        alert('Ошибка при импорте файла: ' + err.message);
      }
      // Очищаем input для возможности повторного импорта того же файла
      importFile.value = '';
    };
    reader.readAsText(file);
  });

  // Функция для отображения календаря
  function renderCalendar() {
    const mainCalendar = document.querySelector('.main-calendar');
    const prevMonthCal = document.querySelector('.mini-calendar.prev-month');
    const nextMonthCal = document.querySelector('.mini-calendar.next-month');

    // Очищаем и подготавливаем контейнер основного календаря
    mainCalendar.innerHTML = '<div class="calendar-grid"></div>';

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
  }

  function renderMonth(container, date, isMainCalendar) {
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

  function addDayToCalendar(container, dayNum, isOtherMonth, fullDate, isMainCalendar) {
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
        const currentColor = (task.done && task.doneColor ? task.doneColor : task.color) || task.info && defaultTaskColors.info || task.done && defaultTaskColors.done || defaultTaskColors.pending;
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

  function getTasksForDate(date) {
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

  // Добавляем обработчики для календаря
  const calendarViewEl = document.getElementById('calendar-view');
  calendarViewEl?.addEventListener('click', () => {
    StateModule.setState({...StateModule.getState(), isCalendarView: true, selectedBoardId: null});
    StateModule.saveState();
    RenderModule.render();
  });

  document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  function showBoardView() {
    StateModule.setState({...StateModule.getState(), isCalendarView: false});
    StateModule.saveState();
    RenderModule.render();
  }

  // Обновляем обработчики для досок
  boardsEl.addEventListener('click', (e) => {
    if (e.target.id === 'calendar-view') return;

    const li = e.target.closest('li');
    if (!li) return;

    if (BoardManager.setSelectedBoard(li.dataset.boardId)) {
        StateModule.saveState();
        RenderModule.render();
    }

    if (window.innerWidth <= 768) {
        document.body.classList.remove('sidebar-open');
        sidebar.classList.remove('open');
    }
  });


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

  // Добавляем функцию для подсчета статистики сабтасков
  function getSubtasksStats(task) {
    let done = 0;
    let total = 0;

    function countSubtasks(subtaskIds) {
      subtaskIds.forEach(subtaskId => {
        const subtask = findTaskById(subtaskId);
        if (subtask) {
          if (!subtask.isInfo) {
            total++;
            if (subtask.done) done++;
          }
          if (subtask.subtasks && subtask.subtasks.length > 0) {
            countSubtasks(subtask.subtasks);
          }
        }
      });
    }

    if (task.subtasks) {
      countSubtasks(task.subtasks);
    }

    return { done, total };
  }
}export { initApp };

