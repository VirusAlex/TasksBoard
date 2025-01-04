import { generateId, formatDateTime, formatTimeLeft, formatDeadlineTime } from './utils.js';
import { initTouchDrag } from './modules/touchDragHandler.js';

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

  let data = JSON.parse(localStorage.getItem('taskBoardsData') || 'null') || {
    boards: [],
    selectedBoardId: null,
    isCalendarView: false
  };
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
    showColumnDropIndicator(e, draggingCol);
  });

  columnsEl.addEventListener('drop', (e) => {
    handleColumnDrop(e);
  });

  // Проверка повторяющихся задач: если дата сегодня > дата выполнения — снять отметку
  // Считаем, что "новый день" — это если сегодняшняя дата (YYYY-MM-DD) изменилась.
  let today = new Date().toISOString().slice(0,10);
  data.boards.forEach(board => {
    board.columns.forEach(col => {
      col.tasks.forEach(task => {
        if (task.repeating && task.done && task.doneDate && task.doneDate < today) {
          task.done = false;
          task.doneDate = null;
        }
      });
    });
  });

  function saveData() {
    localStorage.setItem('taskBoardsData', JSON.stringify(data));
  }

  function renderBoardsList() {
    boardsEl.innerHTML = '';
    data.boards.forEach(board => {
      const li = document.createElement('li');
      li.textContent = board.name;
      li.dataset.boardId = board.id;
      
      if (data.selectedBoardId === board.id) {
        li.className = 'selected';
      }
      
      boardsEl.appendChild(li);
    });
  }

  function getSelectedBoard() {
    return data.boards.find(b => b.id === data.selectedBoardId);
  }

  function renderBoard() {
    const board = getSelectedBoard();
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
    boardTitleEl.addEventListener('dblclick', () => {
      openBoardDialog(board);
    });

    columnsEl.innerHTML = '';

    board.columns.forEach(column => {
      const colEl = document.createElement('div');
      colEl.className = 'column';
      colEl.dataset.columnId = column.id;
      colEl.draggable = true;

      // Обновляем структуру заголовка колонки
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

      colEl.addEventListener('dragstart', (e) => {
        // Проверяем, что начали тащить за заголовок колонки
        const header = colEl.querySelector('.column-header');
        if (!e.target.contains(header)) {
          e.preventDefault();
          return;
        }

        colEl.classList.add('dragging');
        document.body.classList.add('dragging');
        // Устанавливаем данные для переноса
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', colEl.dataset.columnId);
        } else if (e.detail?.dataTransfer) {
          e.detail.dataTransfer.setData('text/plain', colEl.dataset.columnId);
        }
      });

      colEl.addEventListener('dragend', () => {
        colEl.classList.remove('dragging');
        document.body.classList.remove('dragging');
        removeAllDropIndicators();
      });

      // ================================
      // Обработчики Drag & Drop тасков внутри колонки
      // ================================
      // Обработчик перемещения таска над колонкой
      colEl.addEventListener('dragover', (e) => {
        const draggingTask = document.querySelector('.task.dragging');
        const draggingCol = document.querySelector('.column.dragging');
        if (!draggingTask && !draggingCol) return;

        if (draggingTask) {
          showTaskDropIndicator(e, colEl, draggingTask);
        } else {
          // Если перетаскиваем колонку
          if (draggingCol === colEl) return;
          showColumnDropIndicator(e, draggingCol);
        }
      });

      // Обработчик отпускания таска над колонкой
      colEl.addEventListener('drop', (e) => {
        console.log('colEl drop: ', JSON.stringify(e));
        if (isProcessingDrop) return;

        const draggingTask = document.querySelector('.task.dragging');
        const draggingCol = document.querySelector('.column.dragging');
        if (!draggingTask && !draggingCol) return;

        e.preventDefault();
        e.stopPropagation();

        if (draggingTask) {
          handleTaskDrop(e, colEl);
        } else {
          handleColumnDrop(e);
        }
      });
      // ================================

      column.tasks
          .filter(task => !task.parentId) // Только задачи верхнего уровня
          .forEach(task => renderTask(task, colEl));

      // Кнопка добавления задачи
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

  // Обновляем функцию перемещения задачи
  function moveTaskToColumn(taskId, newColumnId, position = -1) {
    const board = getSelectedBoard();
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

    saveData();
    render();
  }

  addBoardBtn.addEventListener('click', () => {
    openBoardDialog();
  });

  addColumnBtn.addEventListener('click', () => {
    openColumnDialog();
  });

  // Обновляем функцию render
  function render() {
    renderBoardsList();
    const calendarViewEl = document.getElementById('calendar-view');

    if (data.isCalendarView) {
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

  // Инициализация
  if (data.boards.length === 0) {
    // Создадим одну доску по умолчанию
    const defaultBoard = {
      id: generateId(),
      name: "Моя первая доска",
      columns: [{
        id: generateId(),
        name: "To Do",
        tasks: []
      }]
    };
    data.boards.push(defaultBoard);
    data.selectedBoardId = defaultBoard.id;
    saveData();
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

  // Добавляем новую функцию для работы с диалогом
  function openTaskDialog(column, existingTask = null) {
    const dialog = document.getElementById('task-dialog');
    const form = dialog.querySelector('form');
    const titleInput = document.getElementById('task-title');
    const descriptionInput = document.getElementById('task-description');
    const insertLinkBtn = document.getElementById('insert-link-btn');

    // Add event listener for insert link button
    insertLinkBtn.addEventListener('click', async () => {
      const linkDialog = document.getElementById('link-dialog');
      const linkForm = linkDialog.querySelector('form');
      const urlInput = document.getElementById('link-url');
      const textInput = document.getElementById('link-text');

      // Clear form
      linkForm.reset();

      // If there's selected text, use it as link text
      const selectedText = descriptionInput.value.substring(
        descriptionInput.selectionStart,
        descriptionInput.selectionEnd
      );
      if (selectedText) {
        textInput.value = selectedText;
      }

      linkDialog.showModal();

      // Wait for dialog close
      const closePromise = new Promise(resolve => {
        linkDialog.addEventListener('close', () => resolve(linkDialog.returnValue), { once: true });
      });

      linkForm.onsubmit = (e) => {
        e.preventDefault();
        linkDialog.close('submit');
      };

      const result = await closePromise;
      if (result === 'submit') {
        const url = urlInput.value;
        const text = textInput.value || url;
        const link = `[${text}](${url})`;

        // Insert link into text
        const start = descriptionInput.selectionStart;
        const end = descriptionInput.selectionEnd;
        descriptionInput.value =
          descriptionInput.value.substring(0, start) +
          link +
          descriptionInput.value.substring(end);
      }
    });

    // Remove event listener when dialog closes
    dialog.addEventListener('close', () => {
      insertLinkBtn.removeEventListener('click', () => {});
    }, { once: true });

    descriptionInput.addEventListener('input', updateLineNumbers);
    descriptionInput.addEventListener('scroll', () => {
      const lineNumbers = descriptionInput.closest('.description-container').querySelector('.line-numbers');
      lineNumbers.scrollTop = descriptionInput.scrollTop;
    });

    // Вызываем updateLineNumbers при открытии диалога
    setTimeout(updateLineNumbers, 0);

    // Добавляем очистку обработчиков при закрытии диалога
    dialog.addEventListener('close', () => {
      descriptionInput.removeEventListener('input', updateLineNumbers);
      descriptionInput.removeEventListener('scroll', () => {});
      resizeObserver.disconnect();
    }, { once: true });

    const repeatCheckbox = document.getElementById('task-repeat');
    const infoCheckbox = document.getElementById('task-info'); // Добавляем эту строку
    const resetTimeInput = document.getElementById('reset-time');
    const resetTimeGroup = document.querySelector('.reset-time-group');
    const submitButton = form.querySelector('button[type="submit"]');
    const deadlineGroup = document.getElementById('deadline-group');
    const deadlineEnabled = document.getElementById('task-deadline-enabled');
    const deadlineInputs = document.getElementById('deadline-inputs');
    const deadlineDate = document.getElementById('deadline-date');
    const deadlineTime = document.getElementById('deadline-time');

    // Добавляем минимальную дату (сегодня) для выбора дедлайна
    // const today = new Date().toISOString().split('T')[0];
    // deadlineDate.min = today;

    const taskColorsEl = document.getElementById('task-colors');
    const doneColorsEl = document.getElementById('done-colors');
    const doneColorGroup = document.getElementById('done-color-group');
    const customTaskColorInput = document.getElementById('custom-task-color');
    const customDoneColorInput = document.getElementById('custom-done-color');
    const resetTaskColorBtn = document.getElementById('reset-task-color');
    const resetDoneColorBtn = document.getElementById('reset-done-color');

    resetTaskColorBtn.addEventListener('click', () => {
      updateSelectedColor(taskColorsEl, null);
    });

    resetDoneColorBtn.addEventListener('click', () => {
      updateSelectedColor(doneColorsEl, null);
    });

    // Функция для обновления выбранного цвета
    function updateSelectedColor(container, color) {
      container.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
        if (color && option.dataset.color === color) {
          option.classList.add('selected');
        }
      });
    }

    // Обработчики для выбора цвета
    taskColorsEl.addEventListener('click', (e) => {
      const option = e.target.closest('.color-option');
      if (!option) return;

      const color = option.dataset.color;
      updateSelectedColor(taskColorsEl, color);
    });

    doneColorsEl.addEventListener('click', (e) => {
      const option = e.target.closest('.color-option');
      if (!option) return;

      const color = option.dataset.color;
      updateSelectedColor(doneColorsEl, color);
    });

    // Обработчики для кастомных цветов
    customTaskColorInput.addEventListener('input', (e) => {
      const color = e.target.value;
      e.target.closest('.color-option').dataset.color = color;
      updateSelectedColor(taskColorsEl, color);
    });

    customDoneColorInput.addEventListener('input', (e) => {
      const color = e.target.value;
      e.target.closest('.color-option').dataset.color = color;
      updateSelectedColor(doneColorsEl, color);
    });

    // Показываем/скрываем выбор цвета выполнения
    function updateColorGroups() {
      doneColorGroup.style.display = infoCheckbox.checked ? 'none' : 'block';
    }

    const board = getSelectedBoard();

    // Сохраняем subtasks существующей задачи, чтобы не потерять их при редактировании
    const existingSubtasks = existingTask ? existingTask.subtasks : [];

    // Обновляем заголовок и хлебные крошки
    const breadcrumbsEl = dialog.querySelector('.dialog-breadcrumbs');
    const titleEl = dialog.querySelector('h3');

    // Формируем путь
    let breadcrumbs = [board.name, column.name];

    if (existingTask && existingTask.parentId) {
      const parentPath = getTaskPath(existingTask);
      breadcrumbs = breadcrumbs.concat(parentPath);
    }

    breadcrumbsEl.textContent = breadcrumbs.join(' → ');
    titleEl.textContent = existingTask ? existingTask.title : 'Новая задача';

    // Обновляем текст кнопки в зависимости от режима
    submitButton.textContent = existingTask ? 'Сохранить' : 'Создать';

    // Обновляем видимость поля дедлайна при изменении повторяемости
    const handleRepeatChange = () => {
      resetTimeGroup.style.display = repeatCheckbox.checked ? 'block' : 'none';
      if (repeatCheckbox.checked) {
        deadlineGroup.style.display = 'none';
        deadlineEnabled.checked = false;
        deadlineInputs.style.display = 'none';
      } else {
        deadlineGroup.style.display = '';
        resetTimeInput.value = '';
      }
    };

    // Обработчик изменения чекбокса дедлайна
    const handleDeadlineChange = () => {
      deadlineInputs.style.display = deadlineEnabled.checked ? 'block' : 'none';
      if (!deadlineEnabled.checked) {
        deadlineDate.value = '';
        deadlineTime.value = '';
      }
    };

    deadlineEnabled.addEventListener('change', handleDeadlineChange);

    // Обновляем видимость поля дедлайна при изменении типа задачи
    const handleInfoChange = () => {
      if (infoCheckbox.checked) {
        // Если задача стала информационной - сбрасываем все связанные поля
        repeatCheckbox.checked = false;
        resetTimeGroup.style.display = 'none';
        resetTimeInput.value = '';
        // Скрываем группу с повторением
        repeatCheckbox.closest('.form-group').style.display = 'none';
        deadlineGroup.style.display = 'none';
        deadlineEnabled.checked = false;
        deadlineInputs.style.display = 'none';
      } else {
        // Показываем группу с повторением обратно
        repeatCheckbox.closest('.form-group').style = '';
        deadlineGroup.style.display = '';
      }
    };

    // Добавляем обработчики
    repeatCheckbox.addEventListener('change', handleRepeatChange);
    infoCheckbox.addEventListener('change', handleInfoChange);
    infoCheckbox.addEventListener('change', updateColorGroups);

    // Удаляем обработчики при закрытии диалога
    const cleanup = () => {
      repeatCheckbox.removeEventListener('change', handleRepeatChange);
      infoCheckbox.removeEventListener('change', handleInfoChange);
      dialog.removeEventListener('close', cleanup);
    };

    dialog.addEventListener('close', cleanup);

    // При открытии диалога проверяем начальное состояние
    if (existingTask) {
      titleInput.value = existingTask.title;
      descriptionInput.value = existingTask.description || '';
      infoCheckbox.checked = existingTask.isInfo || false;
      repeatCheckbox.checked = existingTask.repeating || false;
      resetTimeInput.value = existingTask.resetTime || '';

      // Устанавливаем значения дедлайна
      if (existingTask.deadline) {
        const deadline = new Date(existingTask.deadline);
        deadlineEnabled.checked = true;
        deadlineDate.value = deadline.toISOString().split('T')[0];
        deadlineTime.value = deadline.toTimeString().slice(0, 5);
        deadlineInputs.style.display = 'block';
      } else {
        deadlineEnabled.checked = false;
        deadlineInputs.style.display = 'none';
      }

      updateSelectedColor(taskColorsEl, existingTask.color || null);
      updateSelectedColor(doneColorsEl, existingTask.doneColor || null);
      updateColorGroups();
      handleInfoChange();
      handleRepeatChange();
    } else {
      form.reset();
      resetTimeGroup.style.display = 'none';
      deadlineInputs.style.display = 'none';

      updateSelectedColor(taskColorsEl, null);
      updateSelectedColor(doneColorsEl, null);
      updateColorGroups();
      handleInfoChange();
    }

    // Настраиваем кнопку удаления
    const deleteBtn = form.querySelector('.delete-btn');
    if (existingTask) {
      deleteBtn.style.display = 'block';
      deleteBtn.onclick = async () => {
        const confirmed = await showConfirmDialog(
            `Вы уверены, что хотите удалить задачу "${existingTask.title}"?`
        );
        if (confirmed) {
          const taskIndex = column.tasks.findIndex(t => t.id === existingTask.id);
          if (taskIndex !== -1) {
            column.tasks.splice(taskIndex, 1);
            saveData();
            render();
            dialog.close();
          }
        }
      };
    } else {
      deleteBtn.style.display = 'none';
    }

    // Обработчик отправки формы
    form.onsubmit = (e) => {
      e.preventDefault();

      const selectedTaskColor = taskColorsEl.querySelector('.color-option.selected')?.dataset.color;
      const selectedDoneColor = doneColorsEl.querySelector('.color-option.selected')?.dataset.color;

      // Собираем данные о дедлайне
      let deadline = null;
      if (!infoCheckbox.checked && !repeatCheckbox.checked && deadlineEnabled.checked) {
        if (deadlineDate.value && deadlineTime.value) {
          deadline = new Date(deadlineDate.value + 'T' + deadlineTime.value).toISOString();
        }
      }

      const taskData = {
        id: existingTask ? existingTask.id : generateId(),
        title: titleInput.value.trim(),
        description: descriptionInput.value.trim(),
        // Если задача информационная - сбрасываем все связанные поля
        done: infoCheckbox.checked ? false : (existingTask ? existingTask.done : false),
        doneDate: infoCheckbox.checked ? null : (existingTask ? existingTask.doneDate : null),
        repeating: infoCheckbox.checked ? false : repeatCheckbox.checked,
        resetTime: infoCheckbox.checked ? null : (repeatCheckbox.checked ? resetTimeInput.value || null : null),
        parentId: existingTask ? existingTask.parentId : null,
        subtasks: existingSubtasks,
        isInfo: infoCheckbox.checked,
        collapsed: existingTask ? existingTask.collapsed : false,
        color: selectedTaskColor,
        doneColor: infoCheckbox.checked ? null : selectedDoneColor,
        deadline: deadline
      };

      if (existingTask) {
        // Обновляем существующую задачу
        const taskIndex = column.tasks.findIndex(t => t.id === existingTask.id);
        if (taskIndex !== -1) {
          column.tasks[taskIndex] = taskData;
        }
      } else {
        // Создаем новую задачу
        column.tasks.push(taskData);
      }

      saveData();
      render();
      dialog.close();
    };

    dialog.showModal();

    // В функции openTaskDialog добавляем:
    const resizeObserver = new ResizeObserver(() => {
      updateLineNumbers();
    });
    resizeObserver.observe(descriptionInput);
  }

  // Обновляем функцию проверки сброса задач
  function checkTasksReset() {
    const now = new Date();
    let needsSave = false;

    data.boards.forEach(board => {
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
      saveData();
    }
  }

  // Запускаем проверку при загрузке и каждую минуту
  checkTasksReset();
  setInterval(checkTasksReset, 1000);

  // Функция для работы с диалогом колонки
  function openColumnDialog(existingColumn = null) {
    const dialog = document.getElementById('column-dialog');
    const form = dialog.querySelector('form');
    const nameInput = document.getElementById('column-name');
    const submitButton = form.querySelector('button[type="submit"]');
    const titleEl = dialog.querySelector('h3');
    const board = getSelectedBoard();

    if (!board) return;

    // Настраиваем диалог
    titleEl.textContent = existingColumn ? 'Редактировать колонку' : 'Новая колонка';
    submitButton.textContent = existingColumn ? 'Сохранить' : 'Создать';

    // Заполняем форму данными существующей колонки или очищаем
    if (existingColumn) {
      nameInput.value = existingColumn.name;
    } else {
      form.reset();
    }

    // Настраиваем кнопку удаления
    const deleteBtn = form.querySelector('.delete-btn');
    if (existingColumn) {
      deleteBtn.style.display = 'block';
      deleteBtn.onclick = async () => {
        const confirmed = await showConfirmDialog(
            `Вы уверены, что хотите удалить колонку "${existingColumn.name}" со всеми задачами?`
        );
        if (confirmed) {
          const board = getSelectedBoard();
          const columnIndex = board.columns.findIndex(c => c.id === existingColumn.id);
          if (columnIndex !== -1) {
            board.columns.splice(columnIndex, 1);
            saveData();
            render();
            dialog.close();
          }
        }
      };
    } else {
      deleteBtn.style.display = 'none';
    }

    // Обработчик отправки формы
    form.onsubmit = (e) => {
      e.preventDefault();

      const name = nameInput.value.trim();
      if (!name) return;

      if (existingColumn) {
        // Обновляем существующую колонку
        existingColumn.name = name;
      } else {
        // Создаем новую колонку
        board.columns.push({
          id: generateId(),
          name: name,
          tasks: []
        });
      }

      saveData();
      render();
      dialog.close();
    };

    dialog.showModal();
  }

  // Функция для работы с диалогом доски
  function openBoardDialog(existingBoard = null) {
    const dialog = document.getElementById('board-dialog');
    const form = dialog.querySelector('form');
    const nameInput = document.getElementById('board-name');
    const submitButton = form.querySelector('button[type="submit"]');
    const titleEl = dialog.querySelector('h3');

    // Настраиваем диалог
    titleEl.textContent = existingBoard ? 'Редактировать доску' : 'Новая доска';
    submitButton.textContent = existingBoard ? 'Сохранить' : 'Создать';

    // Заполняем форму данными существующей доски или очищаем
    if (existingBoard) {
      nameInput.value = existingBoard.name;
    } else {
      form.reset();
    }

    // Настраиваем кнопку удаления
    const deleteBtn = form.querySelector('.delete-btn');
    if (existingBoard) {
      deleteBtn.style.display = 'block';
      deleteBtn.onclick = async () => {
        const confirmed = await showConfirmDialog(
            `Вы уверены, что хотите удалить доску "${existingBoard.name}" со всеми колонками и задачами?`
        );
        if (confirmed) {
          const boardIndex = data.boards.findIndex(b => b.id === existingBoard.id);
          if (boardIndex !== -1) {
            data.boards.splice(boardIndex, 1);
            // Выбираем следующую доску или первую, если удаляем последнюю
            if (data.boards.length > 0) {
              data.selectedBoardId = data.boards[boardIndex]
                  ? data.boards[boardIndex].id
                  : data.boards[0].id;
            } else {
              data.selectedBoardId = null;
            }
            saveData();
            render();
            dialog.close();
          }
        }
      };
    } else {
      deleteBtn.style.display = 'none';
    }

    // Обработчик отправки формы
    form.onsubmit = (e) => {
      e.preventDefault();

      const name = nameInput.value.trim();
      if (!name) return;

      if (existingBoard) {
        // Обновляем существующую доску
        existingBoard.name = name;
      } else {
        // Создаем новую доску
        const newBoard = {
          id: generateId(),
          name: name,
          columns: []
        };
        data.boards.push(newBoard);
        data.selectedBoardId = newBoard.id;
      }

      saveData();
      render();
      dialog.close();
    };

    dialog.showModal();
  }

  // Функция для перерисовки конкретной задачи
  function rerenderTask(taskId) {
    const taskEl = document.querySelector(`div[data-task-id="${taskId}"]`);
    if (!taskEl) return;

    // Находим задачу в данных
    let task = null;
    const board = getSelectedBoard();
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
        saveData();
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
          saveData();
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

  // Функция для показа диалога подтверждения
  async function showConfirmDialog(message) {
    const dialog = document.getElementById('confirm-dialog');
    const messageEl = dialog.querySelector('#confirm-message');
    messageEl.textContent = message;

    dialog.showModal();

    return new Promise((resolve) => {
      dialog.addEventListener('close', () => {
        resolve(dialog.returnValue === 'confirm');
      }, { once: true });
    });
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

  // Функции форматирования (добавляем в начало скрипта, после объявления переменных)
  function formatDescription(text) {
    // Сначала обрабатываем Markdown-ссылки [text](url)
    let formatted = text.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Затем обрабатываем простые URL, исключая уже обработанные в тегах <a>
    formatted = formatted.replace(
        /(?<!["=])(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return formatted;
  }

  // Обновляем рендеринг текста с ссылками
  function renderLinkedText(container, text, className = '') {
    container.className = className;
    container.innerHTML = formatDescription(text);
  }

  // Функции для работы с сабтасками
  function findTaskById(taskId) {
    const board = getSelectedBoard();
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
    const board = getSelectedBoard();
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
    const boardIndex = data.boards.findIndex(b => b.id === board.id);
    if (boardIndex !== -1) {
      // Обновляем состояние доски
      data.boards[boardIndex] = board;
    }

    saveData();
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

    const board = getSelectedBoard();
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
      document.body.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', taskEl.dataset.taskId);
      } else if (e.detail?.dataTransfer) {
        e.detail.dataTransfer.setData('text/plain', taskEl.dataset.taskId);
      }
    });

    taskEl.addEventListener('dragend', (e) => {
      e.stopPropagation();
      taskEl.classList.remove('dragging');
      document.body.classList.remove('dragging');
      removeAllDropIndicators();
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
    taskEl.addEventListener('dblclick', (e) => {
      e.stopPropagation(); // Останавливаем всплытие события

      const task = findTaskById(taskEl.dataset.taskId);
      if (task) {
        // Находим колонку, в которой находится задача (или её родитель, если это сабтаск)
        const column = getSelectedBoard().columns.find(col => {
          return col.tasks.some(t => {
            if (t.id === task.id) return true; // Сама задача в колонке
            return !!(task.parentId && t.id === task.parentId);
          });
        });

        if (column) {
          openTaskDialog(column, task);
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

  // Обновляем функцию для подсчета статистики колонки
  function getColumnStats(column) {
    let done = 0;
    let total = 0;

    function countTasks(tasks) {
      tasks.forEach(task => {
        if (!task.isInfo && task.parentId === null) { // Не учитываем информационные задачи
          total++;
          if (task.done) done++;
        }
      });
    }
    countTasks(column.tasks);
    return { done, total };
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
      let draggedTaskId;
      if (e.dataTransfer) {
        draggedTaskId = e.dataTransfer.getData('text/plain');
      } else if (e.detail?.dataTransfer) {
        draggedTaskId = e.detail.dataTransfer.getData('text/plain');
      } else {
        draggedTaskId = draggingTask.dataset.transferData;
      }
      if (!draggedTaskId) return;

      const board = getSelectedBoard();

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

        saveData();
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
      removeAllDropIndicators();
    }
  }

  function handleColumnDrop(e) {
    if (isProcessingDrop) return;
    const draggingCol = document.querySelector('.column.dragging');
    if (!draggingCol) return;

    e.preventDefault();
    e.stopPropagation();
    isProcessingDrop = true;

    try {
      let draggedColId;
      if (e.dataTransfer) {
        draggedColId = e.dataTransfer.getData('text/plain');
      } else if (e.detail?.dataTransfer) {
        draggedColId = e.detail.dataTransfer.getData('text/plain');
      } else {
        draggedColId = draggingCol.dataset.transferData;
      }
      if (!draggedColId) return;

      const board = getSelectedBoard();
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
        const [movedColumn] = board.columns.splice(currentIndex, 1);
        board.columns.splice(finalIndex, 0, movedColumn);
        saveData();
        render();
      }
    } finally {
      isProcessingDrop = false;
      removeAllDropIndicators();
    }
  }

  function showColumnDropIndicator(e, draggingCol) {
    e.preventDefault();
    e.stopPropagation();
    // Удаляем существующие индикаторы
    removeAllDropIndicators();

    const indicator = document.createElement('div');
    indicator.className = 'column-drop-indicator';

    // Находим ближайшую колонку к курсору
    const columns = Array.from(document.querySelectorAll('#columns > .column'));
    const mouseX = e.detail?.clientX || e.clientX;
    let closestColumn = null;
    let minDistance = Infinity;

    columns.forEach(col => {
      if (col === draggingCol) return;
      const rect = col.getBoundingClientRect();
      const colMiddle = rect.left + rect.width / 2;
      const distance = Math.abs(mouseX - colMiddle);

      if (distance < minDistance) {
        minDistance = distance;
        closestColumn = col;
      }
    });

    const columnsContainer = document.getElementById('columns');
    if (closestColumn) {
      const rect = closestColumn.getBoundingClientRect();
      if (mouseX < rect.left + rect.width / 2) {
        columnsContainer.insertBefore(indicator, closestColumn);
      } else {
        const nextColumn = closestColumn.nextElementSibling;
        if (nextColumn) {
          columnsContainer.insertBefore(indicator, nextColumn);
        } else {
          columnsContainer.appendChild(indicator);
        }
      }
    } else {
      columnsContainer.appendChild(indicator);
    }
  }

  function showTaskDropIndicator(e, parentEl, draggingTask) {
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
      const mouseY = (e.detail?.clientY || e.clientY) - taskRect.top;

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

  function removeAllDropIndicators() {
    document.querySelectorAll('.subtask-drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.task-drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
  }

  function hexToRGB(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    // Убираем # если есть
    hex = hex.replace('#', '');

    // Парсим значения RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
  }

  function updateLineNumbers() {
    const textarea = document.getElementById('task-description');
    const lineNumbers = textarea.closest('.description-container').querySelector('.line-numbers');

    // Разбиваем текст на строки по реальным переносам
    const lines = textarea.value.split('\n');

    // Создаем массив номеров, где для каждой строки считаем её визуальную высоту
    const numbers = [];
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      width: ${textarea.clientWidth}px;
      font-family: ${getComputedStyle(textarea).fontFamily};
      font-size: ${getComputedStyle(textarea).fontSize};
      line-height: ${getComputedStyle(textarea).lineHeight};
      padding: ${getComputedStyle(textarea).padding};
    `;
    document.body.appendChild(tempDiv);

    let lineNumber = 1;
    lines.forEach(line => {
      // Считаем, сколько визуальных строк занимает текущая строка
      tempDiv.textContent = line;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const visualLines = Math.ceil(tempDiv.clientHeight / lineHeight);

      // Добавляем номер только для первой визуальной строки
      numbers.push(lineNumber);
      // Для остальных визуальных строк добавляем пустые строки
      for (let i = 2; i < visualLines; i++) {
        numbers.push('');
      }
      lineNumber++;
    });

    document.body.removeChild(tempDiv);

    // Обновляем содержимое
    lineNumbers.textContent = numbers.join('\n');

    // Синхронизируем высоту
    //lineNumbers.style.height = `${textarea.scrollHeight}px`;

    // Синхронизируем скролл
    lineNumbers.scrollTop = textarea.scrollTop;
  }

  // Добавляем после остальных обработчиков
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');

  // Функция экспорта данных
  exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(data, null, 2);
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
          data = importedData;
          saveData();
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
              saveData();
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

    data.boards.forEach(board => {
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
    data.selectedBoardId = task.boardId;

    // Находим колонку
    const board = getSelectedBoard();
    const column = board.columns.find(col => col.id === task.columnId);

    if (column) {
      // Переключаемся на вид досок и открываем диалог задачи
      showBoardView();
      openTaskDialog(column, task);
    }
  }

  // Добавляем обработчики для календаря
  const calendarViewEl = document.getElementById('calendar-view');
  calendarViewEl?.addEventListener('click', () => {
    data.isCalendarView = true;
    data.selectedBoardId = null;
    saveData();
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
    data.isCalendarView = false;
    saveData();
    render();
  }

  // Обновляем обработчики для досок
  boardsEl.addEventListener('click', (e) => {
    if (e.target.id === 'calendar-view') return;

    const li = e.target.closest('li');
    if (!li) return;

    boardsEl.querySelectorAll('li').forEach(el => el.classList.remove('selected'));
    li.classList.add('selected');

    data.selectedBoardId = li.dataset.boardId;
    data.isCalendarView = false;
    saveData();
    render();

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

  // Инициализируем обработку touch-событий для drag & drop
  initTouchDrag();
}export { initApp };

