import { generateId, formatDateTime, formatTimeLeft, formatDeadlineTime } from '../utils.js';
import { showConfirmDialog, renderLinkedText, hexToRGB, updateLineNumbers } from './uiComponents.js';
import * as BoardModule from './boardModule.js';
import * as StateModule from './stateModule.js';
import * as RenderModule from './renderModule.js';
import * as DragDrop from './dragAndDrop.js';

// Сохраняем ссылки на обработчики событий для каждой задачи
const taskHandlers = new Map();

// Функция для очистки обработчиков задачи
function cleanupTaskHandlers(taskId) {
    const handlers = taskHandlers.get(taskId);
    if (handlers) {
        const { taskEl } = handlers.elements;
        const { 
            dblClickHandler, 
            dragStartHandler, 
            dragEndHandler,
            dragOverHandler,
            dropHandler,
            checkboxChangeHandler
        } = handlers;

        // Удаляем обработчики
        if (taskEl) {
            taskEl.removeEventListener('dblclick', dblClickHandler);
            taskEl.removeEventListener('dragstart', dragStartHandler);
            taskEl.removeEventListener('dragend', dragEndHandler);
            taskEl.removeEventListener('dragover', dragOverHandler);
            taskEl.removeEventListener('drop', dropHandler);

            const checkbox = taskEl.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.removeEventListener('change', checkboxChangeHandler);
            }
        }

        // Удаляем запись об обработчиках
        taskHandlers.delete(taskId);
    }
}

// Базовые операции с задачами
export function createTask(columnId, taskData) {
    const board = BoardModule.getSelectedBoard();
    if (!board) return null;

    const column = board.columns.find(c => c.id === columnId);
    if (!column) return null;

    const newTask = {
        id: generateId(),
        title: taskData.title,
        description: taskData.description || '',
        done: false,
        doneDate: null,
        ...taskData
    };

    column.tasks.push(newTask);
    return newTask;
}

export function updateTask(taskId, taskData) {
    const task = findTaskById(taskId);
    if (task) {
        Object.assign(task, taskData);
    }
    return task;
}

export function deleteTask(taskId) {
    const board = BoardModule.getSelectedBoard();
    if (!board) return false;

    for (const column of board.columns) {
        const taskIndex = column.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            column.tasks.splice(taskIndex, 1);
            return true;
        }
    }
    return false;
}

// Функции для работы с сабтасками
export function findTaskById(taskId) {
    const board = BoardModule.getSelectedBoard();
    if (!board) return null;

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

export function collectSubtasks(parentTask, tasksArray) {
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

export function makeSubtask(taskId, parentId) {
    const board = BoardModule.getSelectedBoard();
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
    RenderModule.render();
  }

export function isTaskAncestor(taskId, possibleAncestorId) {
    const task = findTaskById(taskId);
    if (!task || !task.parentId) return false;
    if (task.parentId === possibleAncestorId) return true;
    return isTaskAncestor(task.parentId, possibleAncestorId);
}

export function removeTaskFromCurrentPosition(task) {
    if (!task) return;

    const board = BoardModule.getSelectedBoard();
    if (!board) return;

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

// Функция для добавления обработчиков drag & drop
export function addTaskDragHandlers(taskEl) {
    const taskId = taskEl.dataset.taskId;
    
    // Очищаем старые обработчики для этой задачи
    cleanupTaskHandlers(taskId);

    // Создаем обработчики
    const dragStartHandler = (e) => {
        e.stopPropagation();
        taskEl.classList.add('dragging');
    };

    const dragEndHandler = (e) => {
        e.stopPropagation();
        taskEl.classList.remove('dragging');
        DragDrop.removeAllDropIndicators();
    };

    const dragOverHandler = (e) => {
        const draggingTask = document.querySelector('.task.dragging');
        if (!draggingTask) return;
        DragDrop.showTaskDropIndicator(e, taskEl, draggingTask);
    };

    const dropHandler = (e) => {
        DragDrop.handleTaskDrop(e, taskEl);
    };

    const dblClickHandler = async (e) => {
        e.stopPropagation();

        const task = findTaskById(taskEl.dataset.taskId);
        if (task) {
            // Находим колонку, в которой находится задача (или её родитель, если это сабтаск)
            const column = BoardModule.getSelectedBoard().columns.find(col => {
                return col.tasks.some(t => {
                    if (t.id === task.id) return true; // Сама задача в колонке
                    return !!(task.parentId && t.id === task.parentId);
                });
            });

            if (column) {
                openTaskDialog(column, task);
            }
        }
    };

    // Добавляем обработчики
    taskEl.addEventListener('dragstart', dragStartHandler);
    taskEl.addEventListener('dragend', dragEndHandler);
    taskEl.addEventListener('dragover', dragOverHandler);
    taskEl.addEventListener('drop', dropHandler);
    taskEl.addEventListener('dblclick', dblClickHandler);

    // Сохраняем ссылки на обработчики
    taskHandlers.set(taskId, {
        elements: { taskEl },
        dragStartHandler,
        dragEndHandler,
        dragOverHandler,
        dropHandler,
        dblClickHandler
    });

    // Добавляем обработчик для чекбокса, если он есть
    const checkbox = taskEl.querySelector('input[type="checkbox"]');
    if (checkbox) {
        const checkboxChangeHandler = () => {
            const task = findTaskById(taskId);
            if (task) {
                task.done = checkbox.checked;
                if (checkbox.checked) {
                    task.doneDate = new Date().toISOString();
                } else {
                    task.doneDate = null;
                }
                StateModule.saveState();
                RenderModule.render();
            }
        };

        checkbox.addEventListener('change', checkboxChangeHandler);
        
        // Добавляем обработчик в сохраненные
        const handlers = taskHandlers.get(taskId);
        if (handlers) {
            handlers.checkboxChangeHandler = checkboxChangeHandler;
        }
    }
}

// Функция рендеринга задачи
export function renderTask(task, container) {
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

    // Добавляем обработчики событий
    addTaskDragHandlers(taskEl);

    return taskEl;
}

// Добавляем константы для цветов по умолчанию
export const defaultTaskColors = {
    pending: '#f1c40f',
    info: '#3498db',
    done: '#2ecc71'
};

export const darkThemeTaskColors = {
    pending: '#f39c12',
    info: '#2980b9',
    done: '#27ae60'
};

// Функция для получения пути до задачи
export function getTaskPath(task) {
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

// Функция для работы с диалогом задачи
export function openTaskDialog(column, existingTask = null) {
    const dialog = document.getElementById('task-dialog');
    const form = dialog.querySelector('form');
    const titleInput = document.getElementById('task-title');
    const descriptionInput = document.getElementById('task-description');
    const insertLinkBtn = document.getElementById('insert-link-btn');
    const board = BoardModule.getSelectedBoard();

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

    // Add event listener for insert link button
    insertLinkBtn.addEventListener('click', async () => {
        const linkDialog = document.getElementById('link-dialog');
        const linkForm = linkDialog.querySelector('form');
        const urlInput = document.getElementById('link-url');
        const textInput = document.getElementById('link-text');
        const cancelBtn = linkDialog.querySelector('button[type="button"]');

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

        // Создаем одноразовые обработчики
        const handleSubmit = (e) => {
            e.preventDefault();
            linkDialog.returnValue = 'submit';
            linkDialog.close();
        };

        const handleCancel = () => {
            linkDialog.returnValue = 'cancel';
            linkDialog.close();
        };

        const handleClose = () => {
            // Удаляем обработчики
            linkForm.removeEventListener('submit', handleSubmit);
            cancelBtn.removeEventListener('click', handleCancel);
            linkDialog.removeEventListener('close', handleClose);
        };

        // Добавляем обработчики
        linkForm.addEventListener('submit', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        linkDialog.addEventListener('close', handleClose);

        linkDialog.showModal();

        // Wait for dialog close
        const result = await new Promise(resolve => {
            linkDialog.addEventListener('close', () => {
                resolve(linkDialog.returnValue === 'submit' ? 'submit' : 'cancel');
            }, { once: true });
        });

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
    const infoCheckbox = document.getElementById('task-info');
    const resetTimeInput = document.getElementById('reset-time');
    const resetTimeGroup = document.querySelector('.reset-time-group');
    const submitButton = form.querySelector('button[type="submit"]');
    const deadlineGroup = document.getElementById('deadline-group');
    const deadlineEnabled = document.getElementById('task-deadline-enabled');
    const deadlineInputs = document.getElementById('deadline-inputs');
    const deadlineDate = document.getElementById('deadline-date');
    const deadlineTime = document.getElementById('deadline-time');

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
                if (deleteTask(existingTask.id)) {
                    StateModule.saveState();
                    RenderModule.render();
                    dialog.close();
                    return true;
                }
            }
            return false;
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

        StateModule.saveState();
        RenderModule.render();
        dialog.close();
    };

    dialog.showModal();

    const resizeObserver = new ResizeObserver(() => {
        updateLineNumbers();
    });
    resizeObserver.observe(descriptionInput);
}


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


  // Обновляем функцию проверки сброса задач
export function checkTasksReset() {
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

// Функция для перерисовки конкретной задачи
function rerenderTask(taskId) {
    const taskEl = document.querySelector(`div[data-task-id="${taskId}"]`);
    if (!taskEl) return;

    // Находим задачу в данных
    let task = null;
    const board = BoardModule.getSelectedBoard();
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