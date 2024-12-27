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

  function renderBoard() {
    const board = BoardManager.getSelectedBoard();
    if (!board) {
      boardTitleEl.textContent = 'Выберите доску или создайте новую';
      columnsEl.innerHTML = '';
      return;
    }

    // Делаем заголовок доски редактируемым
    boardTitleEl.textContent = board.name;
    boardTitleEl.style.cursor = 'pointer';
    boardTitleEl.title = 'Дважды щелкните для редактирования';

    // Добавляем обработчик двойного клика для редактирования
    boardTitleEl.addEventListener('dblclick', async () => {
      const result = await BoardManager.openBoardDialog(board);
      if (result) {
        StateModule.saveState();
        render();
      }
    });

    columnsEl.innerHTML = '';

    board.columns.forEach(column => {
      const columnElement = ColumnManager.renderColumn(column);
        
      // Добавляем обработчики drag & drop для колонки
      columnElement.addEventListener('dragover', (e) => {
          const draggingTask = document.querySelector('.task.dragging');
          const draggingCol = document.querySelector('.column.dragging');
          if (!draggingTask && !draggingCol) return;

          if (draggingTask) {
              DragDrop.showTaskDropIndicator(e, columnElement, draggingTask);
          } else {
              if (draggingCol === columnElement) return;
              DragDrop.showColumnDropIndicator(e, draggingCol);
          }
      });

      columnElement.addEventListener('drop', (e) => {
          const draggingTask = document.querySelector('.task.dragging');
          const draggingCol = document.querySelector('.column.dragging');
          if (!draggingTask && !draggingCol) return;

          e.preventDefault();
          e.stopPropagation();

          if (draggingTask) {
              DragDrop.handleTaskDrop(e, columnElement);
          } else {
              DragDrop.handleColumnDrop(e);
          }
      });

      columnsEl.appendChild(columnElement);
    });
  }

  // Обновляем функцию перемещения задачи
  function moveTaskToColumn(taskId, newColumnId, position = -1) {
    const board = BoardManager.getSelectedBoard();
    const task = findTaskById(taskId);

    if (!task) return;

    // Удаляем задачу из текущего места
    removeTaskFromCurrentPosition(task);

    // Сбрасываем parentId, так как задача теперь не сабтаск
    task.parentId = null;

    // Находим целевую колонку
    const targetColumn = board.columns.find(col => col.id === newColumnId);
    if (!targetColumn) return;

    // Вставляем задачу в нужную позицию
    if (position >= 0) {
      targetColumn.tasks.splice(position, 0, task);
    } else {
      targetColumn.tasks.push(task);
    }

    StateModule.saveState();
    render();
  }

  addBoardBtn.addEventListener('click', async () => {
    const result = await BoardManager.openBoardDialog();
    if (result) {
        StateModule.saveState();
        render();
    }
  });

  addColumnBtn.addEventListener('click', async () => {
    await ColumnManager.openColumnDialog();
  });

  // Обновляем функцию render
  function render() {
    BoardManager.renderBoardsList(boardsEl);
    const calendarViewEl = document.getElementById('calendar-view');

    if (StateModule.getState().isCalendarView) {
      renderCalendar();
      calendarViewEl?.classList.add('selected');
      document.getElementById('board-view').style.display = 'none';
      document.getElementById('calendar-view-content').style.display = 'block';
      boardTitleEl.textContent = 'Календарь';
    } else {
      renderBoard();
      calendarViewEl?.classList.remove('selected');
      document.getElementById('board-view').style.display = 'block';
      document.getElementById('calendar-view-content').style.display = 'none';
    }
  }

  render();

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

  function renderTask(task, container) {
    const taskEl = document.createElement('div');
    taskEl.className = 'task' + (task.done ? ' done' : '') + (task.parentId ? ' subtask' : '') + (task.isInfo ? ' info' : '');

    // Добавляем класс для пульсации, если есть дедлайн и он скоро
    if (!task.done && task.deadline) {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const diff = deadline - now;
      const hourInMs = 60 * 60 * 1000;

      if (diff < hourInMs || diff < 0) {
        taskEl.classList.add('deadline-warning');
      }
    }

    taskEl.draggable = true;
    taskEl.dataset.taskId = task.id;

    // Создаем header задачи
    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header';

    // Добавляем кастомные цвета
    const currentColor = task.done && task.doneColor ? task.doneColor : task.color;
    if (currentColor) {
      taskEl.style.borderLeftColor = currentColor;
      taskEl.dataset.customColor = '';

      // Добавляем осветленный фоновый цвет
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
      checkbox.onclick = (e) => e.stopPropagation();
      checkbox.onchange = () => {
        task.done = checkbox.checked;
        if (checkbox.checked) {
          task.doneDate = new Date().toISOString();
        } else {
          task.doneDate = null;
        }
        StateModule.saveState();
        render();
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

    // Добавляем иконку повторения и информацию о сбросе
    if (task.repeating) {
      const repeatIcon = document.createElement('div');
      repeatIcon.className = 'task-repeat-icon';
      repeatIcon.innerHTML = '🔄';
      repeatIcon.title = 'Повторяющаяся задача';
      taskEl.appendChild(repeatIcon);
    }

    container.appendChild(taskEl);

    // Добавляем контейнер для сабтасков, если они есть
    if (task.subtasks && task.subtasks.length > 0) {
      const subtasksContainer = document.createElement('div');
      subtasksContainer.className = 'subtasks-container';

      // Рендерим каждый сабтаск внутри контейнера
      task.subtasks.forEach(subtaskId => {
        const subtask = findTaskById(subtaskId);
        if (subtask) {
          renderTask(subtask, subtasksContainer);
        }
      });

      taskEl.appendChild(subtasksContainer);
    }

    // В функции renderTask, где добавляются индикаторы времени
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

        const updateTime = () => {
          deadlineInfo.textContent = `⌛️ ${formatDeadlineTime(deadline)}`;
        };

        updateTime();
        const intervalId = setInterval(updateTime, 1000);
        resetTimeIntervals.set(task.id, intervalId);
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

      // Очищаем предыдущий интервал для этой задачи, если он был
      if (resetTimeIntervals.has(task.id)) {
        clearInterval(resetTimeIntervals.get(task.id));
      }

      const updateTime = () => {
        resetInfo.textContent = formatTimeLeft(task.resetTime || '00:00');
      };

      updateTime();
      const intervalId = setInterval(updateTime, 1000);
      resetTimeIntervals.set(task.id, intervalId);

      timeIndicators.appendChild(resetInfo);
    }

    // Добавляем контейнер с индикаторами только если есть хотя бы один индикатор
    if (timeIndicators.children.length > 0) {
      taskEl.appendChild(timeIndicators);
    }


    // Если есть сабтаски, добавляем кнопку сворачивания
    if (task.subtasks && task.subtasks.length > 0) {
      const expandToggle = document.createElement('div'); // меняем span на div
      expandToggle.className = 'task-expand-toggle';
      if (task.collapsed) {
        expandToggle.classList.add('collapsed');
      }

      // Добавляем пустой элемент для первой колонки грида
      const spacerLeft = document.createElement('div');
      expandToggle.appendChild(spacerLeft);

      // Добавляем контейнер для стрелки
      const toggleArrow = document.createElement('span');
      toggleArrow.className = 'toggle-arrow';
      expandToggle.appendChild(toggleArrow);

      // Добавляем статистику
      const stats = getSubtasksStats(task);
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
        // Если нет статистики, добавляем пустой элемент для третьей колонки грида
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

          // Сохраняем состояние
          task.collapsed = isExpanded;
          StateModule.saveState();
        }
      };
      taskEl.appendChild(expandToggle);

      // Устанавливаем начальное состояние контейнера сабтасков
      const subtasksContainer = taskEl.querySelector('.subtasks-container');
      if (subtasksContainer && task.collapsed) {
        subtasksContainer.style.display = 'none';
      }
    }

    // Добавляем обработчики через функцию
    addTaskDragHandlers(taskEl);
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

  function makeSubtask(taskId, parentId) {
    const board = BoardManager.getSelectedBoard();
    if (!board) {
      return;
    }

    const task = findTaskById(taskId);
    const parentTask = findTaskById(parentId);
    if (!task || !parentTask) {
      return;
    }

    // Проверяем циклические зависимости
    if (isTaskAncestor(taskId, parentId)) {
      return;
    }

    // Находим колонку с родительской задачей
    const parentColumn = board.columns.find(col =>
        col.tasks.some(t => t.id === parentId)
    );

    if (!parentColumn) {
      return;
    }

    // Удаляем задачу из текущего места
    removeTaskFromCurrentPosition(task);

    // Обновляем связи в оригинальной задаче
    task.parentId = parentId;

    // Инициализируем массив subtasks для родительской задачи, если его нет
    if (!parentTask.subtasks) {
      parentTask.subtasks = [];
    }

    // Добавляем ID задачи к родительской задаче
    if (!parentTask.subtasks.includes(task.id)) {
      parentTask.subtasks.push(task.id);
    }

    // Добавляем задачу в ту же колонку, где находится родительская задача
    const taskIndex = parentColumn.tasks.findIndex(t => t.id === parentId);
    if (taskIndex !== -1) {
      // Вставляем задачу сразу после родительской задачи
      parentColumn.tasks.splice(taskIndex + 1, 0, task);
    } else {
      // Если родительская задача не найдена, добавляем в конец
      parentColumn.tasks.push(task);
    }

    // Находим нужную доску
    const boardIndex = StateModule.getState().boards.findIndex(b => b.id === board.id);
    if (boardIndex !== -1) {
      // Обновляем состояние доски
      StateModule.getState().boards[boardIndex] = board;
    }

    StateModule.saveState();
    render();
  }

  function isTaskAncestor(taskId, possibleAncestorId) {
    const task = findTaskById(taskId);
    if (!task || !task.parentId) return false;
    if (task.parentId === possibleAncestorId) return true;
    return isTaskAncestor(task.parentId, possibleAncestorId);
  }

  function removeTaskFromCurrentPosition(task) {
    if (!task) {
      return;
    }

    const board = BoardManager.getSelectedBoard();
    if (!board) {
      return;
    }

    // Если это сабтаск, удаляем из родителя
    if (task.parentId) {
      const parentTask = findTaskById(task.parentId);

      if (parentTask && parentTask.subtasks) {
        parentTask.subtasks = parentTask.subtasks.filter(id => id !== task.id);
      }
    }

    // Удаляем из колонки
    for (const column of board.columns) {
      const index = column.tasks.findIndex(t => t.id === task.id);
      if (index !== -1) {
        column.tasks.splice(index, 1);
        break;
      }
    }
  }

  // Добавляем глобальную переменную для отслеживания состояния
  let isProcessingDrop = false;

  function addTaskDragHandlers(taskEl) {
    // Добавляем обработчики начала и конца перетаскивания
    taskEl.addEventListener('dragstart', (e) => {
      e.stopPropagation(); // Предотвращаем всплытие, чтобы не перетаскивалась колонка
      taskEl.classList.add('dragging');
    });

    taskEl.addEventListener('dragend', (e) => {
      e.stopPropagation();
      taskEl.classList.remove('dragging');
      DragDrop.removeAllDropIndicators();
    });

    // Обработчик dragover с логикой третей
    taskEl.addEventListener('dragover', (e) => {
      const draggingTask = document.querySelector('.task.dragging');
      if (!draggingTask) return;
      showTaskDropIndicator(e, taskEl, draggingTask);
    });

    taskEl.addEventListener('drop', (e) => {
      handleTaskDrop(e, taskEl);
    });

    // Добавляем обработчик двойного клика для редактирования
    taskEl.addEventListener('dblclick', async (e) => {
      e.stopPropagation(); // Останавливаем всплытие события

      const task = TaskManager.findTaskById(taskEl.dataset.taskId);
      if (task) {
        // Находим колонку, в которой находится задача (или её родитель, если это сабтаск)
        const column = BoardManager.getSelectedBoard().columns.find(col => {
          return col.tasks.some(t => {
            if (t.id === task.id) return true; // Сама задача в колонке
            return !!(task.parentId && t.id === task.parentId);
          });
        });

        if (column) {
          await TaskManager.openTaskDialog(column, task);
        }
      }
    });
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

  // Добавляем после остальных функций
  function handleTaskDrop(e, container) {
    if (isProcessingDrop) return;

    const draggingTask = document.querySelector('.task.dragging');
    if (!draggingTask) return;

    e.preventDefault();
    e.stopPropagation();
    isProcessingDrop = true;

    try {
      const draggedTaskId = draggingTask.dataset.taskId;
      const board = BoardManager.getSelectedBoard();

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
        makeSubtask(draggedTaskId, targetTask.dataset.taskId);
      } else if (taskIndicator && parentTaskEl) {
        // Случай 2: Перемещение внутри списка сабтасков
        const draggedTask = findTaskById(draggedTaskId);
        const parentTask = findTaskById(parentTaskEl.dataset.taskId);
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
        removeTaskFromCurrentPosition(draggedTask);
        column.tasks.push(draggedTask);
        draggedTask.parentId = parentTask.id;
        parentTask.subtasks.splice(finalIndex, 0, draggedTaskId);

        StateModule.saveState();
        render();
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

        moveTaskToColumn(draggedTaskId, columnId, finalIndex);
      }
    } finally {
      isProcessingDrop = false;
      DragDrop.removeAllDropIndicators();
    }
  }

  function showTaskDropIndicator(e, parentEl, draggingTask) {
    if (parentEl === draggingTask) return;
    e.preventDefault();
    e.stopPropagation();

    // Удаляем существующие индикаторы
    DragDrop.removeAllDropIndicators();

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
          render();
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
              render();
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

  async function openTaskFromCalendar(task) {
    // Переключаемся на нужную доску
    StateModule.setState({...StateModule.getState(), selectedBoardId: task.boardId});

    // Находим колонку
    const board = BoardManager.getSelectedBoard();
    const column = board.columns.find(col => col.id === task.columnId);

    if (column) {
      // Переключаемся на вид досок и открываем диалог задачи
      showBoardView();
      await TaskManager.openTaskDialog(column, task);
    }
  }

  // Добавляем обработчики для календаря
  const calendarViewEl = document.getElementById('calendar-view');
  calendarViewEl?.addEventListener('click', () => {
    StateModule.setState({...StateModule.getState(), isCalendarView: true, selectedBoardId: null});
    StateModule.saveState();
    render();
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
    render();
  }

  // Обновляем обработчики для досок
  boardsEl.addEventListener('click', (e) => {
    if (e.target.id === 'calendar-view') return;

    const li = e.target.closest('li');
    if (!li) return;

    if (BoardManager.setSelectedBoard(li.dataset.boardId)) {
        StateModule.saveState();
        render();
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

