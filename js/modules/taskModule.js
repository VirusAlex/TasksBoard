import {generateId, formatDateTime, formatTimeLeft, formatDeadlineTime} from '../utils.js';
import {showConfirmDialog, renderLinkedText, hexToRGB, updateLineNumbers} from './uiComponents.js';
import * as BoardModule from './boardModule.js';
import * as RenderModule from './renderModule.js';
import * as DragDrop from './dragAndDrop.js';
import * as ColumnModule from './columnModule.js';
import {getCurrentProvider} from '../data/dataProvider.js';
import './types.js';

// Сохраняем ссылки на обработчики событий для каждой задачи
const taskHandlers = new Map();

// Функция для очистки обработчиков задачи
/** @param {string} taskId */
function cleanupTaskHandlers(taskId) {
    if (!taskId) return;

    const handlers = taskHandlers.get(taskId);
    if (handlers) {
        const {taskEl} = handlers.elements;
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

            const checkbox = Array.from(taskEl.querySelectorAll('input[type="checkbox"]')).find(el => el.closest('.task') === taskEl);
            if (checkbox) {
                checkbox.removeEventListener('change', checkboxChangeHandler);
            }
        }

        // Удаляем запись об обработчиках
        taskHandlers.delete(taskId);
    }
}

/** @param {string} taskId */
export async function deleteTask(taskId) {
    const board = await BoardModule.getSelectedBoard();
    if (!board) return false;

    return await getCurrentProvider().deleteTask(taskId);
}

// Функции для работы с сабтасками
/**
 * @param taskId
 * @returns {Promise<TaskData | null>}
 */
export async function findTaskById(taskId) {
    return await getCurrentProvider().getData().then(data => {
        return data.tasks.find(task => task.id === taskId) || null;
    });
}

// Функция для добавления обработчиков drag & drop
export function addTaskHandlers(taskEl) {
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
        if (DragDrop.isProcessingDrop) return;
        taskEl.classList.remove('dragging');
        DragDrop.removeAllDropIndicators();
    };

    const dragOverHandler = (e) => {
        const draggingTask = document.querySelector('.task.dragging');
        if (!draggingTask) return;
        DragDrop.showTaskDropIndicator(e, taskEl, draggingTask);
    };

    const dropHandler = async (e) => {
        await DragDrop.handleTaskDrop(e, taskEl);
    };

    const dblClickHandler = async (e) => {
        e.stopPropagation();

        /** @type {TaskData | null} */
        const task = await findTaskById(taskEl.dataset.taskId);
        if (!task) throw new Error('Task not found: ' + taskEl.dataset.taskId);

        const columnEl = taskEl.closest('.column');
        const columnId = columnEl.dataset.columnId;
        /** @type {ColumnData | null} */
        const column = await ColumnModule.findColumnById(columnId);
        if (!column) throw new Error('Column not found: ' + columnId);

        await openTaskDialog(column, task);
    };

    // Добавляем обработчики
    taskEl.addEventListener('dragstart', dragStartHandler);
    taskEl.addEventListener('dragend', dragEndHandler);
    taskEl.addEventListener('dragover', dragOverHandler);
    taskEl.addEventListener('drop', dropHandler);
    taskEl.addEventListener('dblclick', dblClickHandler);

    // Сохраняем ссылки на обработчики
    taskHandlers.set(taskId, {
        elements: {taskEl},
        dragStartHandler,
        dragEndHandler,
        dragOverHandler,
        dropHandler,
        dblClickHandler
    });
}

// Функция рендеринга задачи
/**
 * @param {TaskData} task
 * @param {HTMLElement} container
 */
export async function renderTask(task, container) {
    cleanupTaskHandlers(task.id);

    const taskEl = document.createElement('div');
    taskEl.className = 'task' + (task.done ? ' done' : '') + (task.parentId ? ' subtask' : '') + (task.isInfo ? ' info' : '');

    taskEl.draggable = true;
    taskEl.dataset.taskId = task.id;

    // Создаем header задачи
    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header';
    taskEl.appendChild(taskHeader);

    // Добавляем чекбокс
    updateTaskCheckbox(task, taskEl);

    // Добавляем контент задачи
    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';
    taskHeader.appendChild(taskContent);

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

    // Добавляем иконку повторения и информацию о сбросе
    if (task.repeating) {
        const repeatIcon = document.createElement('div');
        repeatIcon.className = 'task-repeat-icon';
        repeatIcon.innerHTML = '🔄';
        repeatIcon.title = 'Повторяющаяся задача';
        taskEl.appendChild(repeatIcon);
    }

    container.appendChild(taskEl);

    getCurrentProvider().getSubtasks(task.id).then(subtasks => {
        // Добавляем контейнер для сабтасков, если они есть
        if (subtasks?.length > 0) {
            const subtasksContainer = document.createElement('div');
            subtasksContainer.className = 'subtasks-container';

            // Рендерим каждый сабтаск внутри контейнера
            for (const subtask of subtasks) {
                renderTask(subtask, subtasksContainer);
            }

            taskEl.appendChild(subtasksContainer);

            // Если есть сабтаски, добавляем кнопку сворачивания
            const expandToggle = document.createElement('div'); // меняем span на div
            expandToggle.className = 'task-expand-toggle';
            taskEl.appendChild(expandToggle);

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

            const statsEl = document.createElement('div');
            statsEl.classList.add('subtasks-stats', 'empty');
            expandToggle.appendChild(statsEl);

            // Добавляем статистику
            updateSubtasksStats(task.id);

            expandToggle.onclick = (e) => {
                e.stopPropagation();
                const subtasksContainer = Array.from(taskEl.querySelectorAll('.subtasks-container')).find(el => el.closest('.task') === taskEl);
                if (subtasksContainer) {
                    const isExpanded = !expandToggle.classList.contains('collapsed');
                    expandToggle.classList.toggle('collapsed');
                    subtasksContainer.style.display = isExpanded ? 'none' : 'block';

                    // Сохраняем состояние
                    getCurrentProvider().updateTask(task.id, {collapsed: isExpanded});
                }
            };

            // Устанавливаем начальное состояние контейнера сабтасков
            if (subtasksContainer && task.collapsed) {
                subtasksContainer.style.display = 'none';
            }
        }
    });

    // Добавляем индикаторы времени
    fillTimeIndicators(task, taskEl);
    updateTaskColors(task, taskEl);

    // Добавляем обработчики событий
    addTaskHandlers(taskEl);

    return taskEl;
}

async function updateSubtasksStats(taskId) {
    if (!taskId) return;

    const taskEl = document.querySelector(`.task[data-task-id="${taskId}"]`);
    if (!taskEl) return;

    let statsEl = Array.from(taskEl.querySelectorAll('.subtasks-stats')).find(el => el.closest('.task') === taskEl);
    if (!statsEl) return;

    /** @type {TaskData[]} */
    const subtasks = await getCurrentProvider().getSubtasks(taskId);
    const stats = countSubtasksStats(subtasks);
    if (stats.total > 0) {
        statsEl.classList.remove('empty');
            statsEl.innerHTML = `
        <span class="stats-done">${stats.done}</span>
        <span class="stats-separator">/</span>
        <span class="stats-total">${stats.total}</span>
        `;
    } else {
        statsEl.classList.add('empty');
    }
}

function updateTaskCheckbox(task, taskEl) {
    if (!task) return;
    if (!taskEl) return;

    const taskHeader = Array.from(taskEl.querySelectorAll('.task-header')).find(el => el.closest('.task') === taskEl);
    if (!taskHeader) return;

    const handlers = taskHandlers.get(task.id);

    let checkbox = taskHeader.querySelector('input[type="checkbox"]');
    if (task.isInfo && checkbox) {
        if (handlers) {
            checkbox.removeEventListener('change', handlers.checkboxChangeHandler);
            handlers.checkboxChangeHandler = null;
        }
        checkbox.remove();
    } else if (!task.isInfo) {
        if (!checkbox) {
            checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.onclick = (e) => e.stopPropagation();
            taskHeader.prepend(checkbox);

            const checkboxChangeHandler = async () => {
                /** @type {TaskData} */
                const updates = {
                    done: checkbox.checked,
                    doneDate: checkbox.checked ? new Date().toISOString() : null
                };

                const updatedTask = await getCurrentProvider().updateTask(task.id, updates);
                await rerenderTask(updatedTask)

                // обновляем статистику в родительской задаче или в колонке
                if (task.parentId) {
                    await updateSubtasksStats(task.parentId);
                } else if (task.columnId) {
                    await ColumnModule.updateColumnStats(task.columnId);
                }
            };

            checkbox.addEventListener('change', checkboxChangeHandler);

            // Добавляем обработчик в сохраненные
            if (handlers) {
                handlers.checkboxChangeHandler = checkboxChangeHandler;
            }
        }
        checkbox.checked = task.done;
    }
}

/**
 * @param {TaskData} task
 * @param {HTMLElement} taskEl
 */
function updateTaskColors(task, taskEl) {
    if (!task) return;
    if (!taskEl) return;

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
}

/**
 * @param {TaskData} task
 * @param {HTMLElement} taskEl
 */
function fillTimeIndicators(task, taskEl) {
    if (!task) return;
    if (!taskEl) return;

    // Добавляем индикаторы времени

    let timeIndicators = Array.from(taskEl.querySelectorAll('.task-time-indicators')).find(el => el.closest('.task') === taskEl);

    if (!timeIndicators) {
        timeIndicators = document.createElement('div');
        timeIndicators.className = 'task-time-indicators';
        // insert after <div class="task-header">
        taskEl.insertBefore(timeIndicators, taskEl.querySelector(':scope > .task-header + *'));
    }

    let doneTime = timeIndicators.querySelector('.task-done-time');
    // Добавляем метку времени выполнения
    if (task.done && task.doneDate) {
        if (!doneTime) {
            doneTime = document.createElement('div');
            doneTime.className = 'task-done-time';
            timeIndicators.insertBefore(doneTime, timeIndicators.firstChild);
        }
        doneTime.textContent = `✓ ${formatDateTime(task.doneDate)}`;
    } else if (doneTime) {
        doneTime.remove();
    }

    let deadlineInfo = timeIndicators.querySelector('.task-deadline-info');
    // Добавляем информацию о дедлайне
    if (task.deadline) {
        if (!deadlineInfo) {
            deadlineInfo = document.createElement('div');
            deadlineInfo.className = 'task-deadline-info';
            timeIndicators.appendChild(deadlineInfo);
        }
        fillDeadlineInfo(task, deadlineInfo);
    } else if (deadlineInfo) {
        deadlineInfo.remove();
    }

    let resetInfo = timeIndicators.querySelector('.task-reset-info');
    // Добавляем информацию о сбросе для повторяющихся задач
    if (task.repeating && task.done) {
        if (!resetInfo) {
            resetInfo = document.createElement('div');
            resetInfo.className = 'task-reset-info';
            timeIndicators.appendChild(resetInfo);
        }
        fillResetInfo(task, resetInfo);
    } else if (resetInfo) {
        resetInfo.remove();
    }

    if (timeIndicators.children.length <= 0) {
        timeIndicators.remove();
    }

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
}

/**
 * @param {TaskData} task
 * @param {HTMLElement} container
 */
function fillResetInfo(task, container) {
    if (!task?.repeating || !task?.done) return;
    if (!container) return;

    container.textContent = formatTimeLeft(task.resetTime || '00:00');
}

/**
 * @param {TaskData} task
 * @param {HTMLElement} container
 */
function fillDeadlineInfo(task, container) {
    if (!task?.deadline) return;
    if (!container) return;

    const now = new Date();
    const deadline = new Date(task.deadline);
    container.classList.remove('overdue');

    if (!task.done) {
        // Для невыполненных задач показываем оставшееся время
        if (deadline <= now) {
            container.classList.add('overdue');
        }
        container.textContent = `⌛️ ${formatDeadlineTime(deadline)}`;
    } else {
        // Для выполненных задач показываем точное время дедлайна
        container.textContent = `⌛️ ${formatDateTime(deadline)}`;
    }
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
/**
 *  @param {TaskData} task
 *  @returns {Promise<string[]>}
 **/
export async function getTaskPath(task) {
    const path = [];
    let currentTask = task;

    // Собираем путь от текущей задачи до корневой
    while (currentTask?.parentId) {
        const parentTask = await findTaskById(currentTask.parentId);
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
/**
 * @param {ColumnData} column
 * @param {TaskData | null} existingTask
 * @returns {Promise<void>}
 */
export async function openTaskDialog(column, existingTask = null) {
    const dialog = document.getElementById('task-dialog');
    const form = dialog.querySelector('form');
    const titleInput = document.getElementById('task-title');
    const descriptionInput = document.getElementById('task-description');
    const insertLinkBtn = document.getElementById('insert-link-btn');
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.textContent = existingTask ? 'Сохранить' : 'Создать';

    const board = await BoardModule.getSelectedBoard();

    // Обновляем заголовок и хлебные крошки
    const breadcrumbsEl = dialog.querySelector('.dialog-breadcrumbs');
    const titleEl = dialog.querySelector('h3');

    // Формируем путь
    let breadcrumbs = [board.name, column.name];

    if (existingTask?.parentId) {
        const parentPath = await getTaskPath(existingTask);
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
            }, {once: true});
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
        insertLinkBtn.removeEventListener('click', () => {
        });
    }, {once: true});

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
        descriptionInput.removeEventListener('scroll', () => {
        });
        resizeObserver.disconnect();
    }, {once: true});

    const repeatCheckbox = document.getElementById('task-repeat');
    const infoCheckbox = document.getElementById('task-info');
    const resetTimeInput = document.getElementById('reset-time');
    const resetTimeGroup = document.querySelector('.reset-time-group');
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
                await deleteTask(existingTask.id);
                await RenderModule.render();
                dialog.close();
                return true;
            }
            return false;
        };
    } else {
        deleteBtn.style.display = 'none';
    }

    // Обработчик отправки формы
    form.onsubmit = async (e) => {
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

        const columnTasks = await getCurrentProvider().getTasks(column.id);

        /**
         * @type {TaskData}
         **/
        const taskData = {
            id: existingTask ? existingTask.id : generateId('ts'),
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),

            done: infoCheckbox.checked ? false : (existingTask ? existingTask.done : false),
            doneDate: infoCheckbox.checked ? null : (existingTask ? existingTask.doneDate : null),

            deadline: deadline,
            repeating: infoCheckbox.checked ? false : repeatCheckbox.checked,
            resetTime: infoCheckbox.checked ? null : (repeatCheckbox.checked ? resetTimeInput.value || null : null),

            columnId: existingTask ? existingTask.columnId : column.id,
            parentId: existingTask ? existingTask.parentId : null,

            isInfo: infoCheckbox.checked,
            collapsed: existingTask ? existingTask.collapsed : false,

            color: selectedTaskColor,
            doneColor: infoCheckbox.checked ? null : selectedDoneColor,

            order: existingTask ? existingTask.order : columnTasks.length
        };

        if (existingTask) {
            // Обновляем существующую задачу
            const updatedTask = await getCurrentProvider().updateTask(existingTask.id, taskData);
            await rerenderTask(updatedTask);
        } else {
            // Создаем новую задачу
            await getCurrentProvider().createTask(taskData);
            await RenderModule.render();
        }

        dialog.close();
    };

    dialog.showModal();

    const resizeObserver = new ResizeObserver(() => {
        updateLineNumbers();
    });
    resizeObserver.observe(descriptionInput);
}


// Добавляем функцию для подсчета статистики сабтасков
/**
 * @param {TaskData[]} subtasks
 * @returns {{done: number, total: number}}
 */
function countSubtasksStats(subtasks) {
    let done = 0;
    let total = 0;

    if (!subtasks) return {done, total};

    for (const subtask of subtasks) {
        if (!subtask.isInfo) {
            total++;
            if (subtask.done) done++;
        }
    }

    return {done, total};
}

// Обновляем функцию проверки сброса задач
export async function refreshTasks() {
    /** @type {TaskData[]} */
    const allTasks = await getCurrentProvider().getData().then(data => {
        return data.tasks || [];
    });

    const now = new Date();
    allTasks.map(async task => {
        await refreshTask(task, now).catch(err => console.error(err));
    });
}

/**
 *  @param {TaskData} task
 *  @param {Date} now
 **/
async function refreshTask(task, now) {
    const taskEl = document.querySelector(`.task[data-task-id="${task.id}"]`);
    if (!taskEl) return;

    let shouldReset = false;

    if (task.repeating && task.done && task.doneDate) {

        if (task.resetTime) {
            // Берем дату выполнения и добавляем к ней время сброса
            const doneDate = new Date(task.doneDate);
            const [hours, minutes] = task.resetTime.split(':');
            const resetTime = new Date(doneDate);
            resetTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

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
            /** @type {TaskData} */
            task = await getCurrentProvider().updateTask(task.id, {done: false, doneDate: null});
            await rerenderTask(task).catch(err => console.error(err));
        }
    }

    if (!shouldReset && (task.deadline && !task.done || task.done && task.repeating)) {
        fillTimeIndicators(task, taskEl);
        updateTaskColors(task, taskEl);
    }
}

// Функция для перерисовки конкретной задачи
/** @param {TaskData} task */
async function rerenderTask(task) {
    const taskEl = document.querySelector(`.task[data-task-id="${task.id}"]`);
    if (!taskEl) return;

    // Обновляем состояние карточки
    taskEl.className = 'task' + (task.done ? ' done' : '') + (task.parentId ? ' subtask' : '') + (task.isInfo ? ' info' : '');

    let taskContent = Array.from(taskEl.querySelectorAll('.task-content')).find(el => el.closest('.task') === taskEl);
    if (!taskContent) {
        console.error('Task content not found', taskEl);
        return;
    }

    // Обновляем заголовок
    const title = taskContent.querySelector('.task-title');
    if (title) {
        renderLinkedText(title, task.title, 'task-title');
    }

    // Обновляем описание
    if (task.description) {
        let description = taskContent.querySelector('.task-description');
        if (!description) {
            description = document.createElement('div');
            description.className = 'task-description';
            taskContent.appendChild(description);
        }
        renderLinkedText(description, task.description, 'task-description');
    } else {
        const description = taskEl.querySelector('.task-description');
        if (description) description.remove();
    }

    // Обновляем чекбокс
    updateTaskCheckbox(task, taskEl);

    fillTimeIndicators(task, taskEl);
    updateTaskColors(task, taskEl);
}