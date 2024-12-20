import { showConfirmDialog } from './dialogs.js';
import { formatDateTime } from '../utils.js';

export function initTaskDialog(data, tasks, saveData, render) {
  function openTaskDialog(column, existingTask = null) {
    const dialog = document.getElementById('task-dialog');
    const form = dialog.querySelector('form');
    const titleInput = document.getElementById('task-title');
    const descriptionInput = document.getElementById('task-description');
    const submitButton = form.querySelector('button[type="submit"]');
    const titleEl = dialog.querySelector('h3');
    const breadcrumbsEl = dialog.querySelector('.dialog-breadcrumbs');
    const infoCheckbox = document.getElementById('task-info');
    const repeatCheckbox = document.getElementById('task-repeat');
    const resetTimeGroup = document.querySelector('.reset-time-group');
    const resetTimeInput = document.getElementById('reset-time');
    const clearTimeBtn = document.querySelector('.clear-time-btn');
    const deadlineGroup = document.getElementById('deadline-group');
    const deadlineEnabled = document.getElementById('task-deadline-enabled');
    const deadlineInputs = document.getElementById('deadline-inputs');
    const deadlineDate = document.getElementById('deadline-date');
    const deadlineTime = document.getElementById('deadline-time');
    const taskColors = document.getElementById('task-colors');
    const doneColorGroup = document.getElementById('done-color-group');
    const doneColors = document.getElementById('done-colors');

    titleEl.textContent = existingTask ? 'Редактировать задачу' : 'Новая задача';
    submitButton.textContent = existingTask ? 'Сохранить' : 'Создать';

    // Set up breadcrumbs
    const board = data.boards.find(b => b.columns.includes(column));
    if (board) {
      breadcrumbsEl.textContent = `${board.name} → ${column.name}`;
    }

    if (existingTask) {
      titleInput.value = existingTask.title;
      descriptionInput.value = existingTask.description || '';
      infoCheckbox.checked = existingTask.isInfo || false;
      repeatCheckbox.checked = existingTask.repeating || false;
      resetTimeInput.value = existingTask.resetTime || '';
      
      if (existingTask.deadline) {
        deadlineEnabled.checked = true;
        const deadline = new Date(existingTask.deadline);
        deadlineDate.value = deadline.toISOString().split('T')[0];
        deadlineTime.value = deadline.toTimeString().slice(0, 5);
        deadlineInputs.style.display = 'block';
      } else {
        deadlineEnabled.checked = false;
        deadlineInputs.style.display = 'none';
      }

      // Set up colors
      if (existingTask.color) {
        const colorOption = taskColors.querySelector(`[data-color="${existingTask.color}"]`);
        if (colorOption) {
          colorOption.classList.add('selected');
        } else {
          const customColor = document.getElementById('custom-task-color');
          customColor.value = existingTask.color;
          customColor.parentElement.classList.add('selected');
        }
      }

      if (existingTask.doneColor) {
        const doneColorOption = doneColors.querySelector(`[data-color="${existingTask.doneColor}"]`);
        if (doneColorOption) {
          doneColorOption.classList.add('selected');
        } else {
          const customDoneColor = document.getElementById('custom-done-color');
          customDoneColor.value = existingTask.doneColor;
          customDoneColor.parentElement.classList.add('selected');
        }
      }
    } else {
      form.reset();
      taskColors.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
      doneColors.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
      taskColors.querySelector('.color-option').classList.add('selected');
      doneColors.querySelector('.color-option').classList.add('selected');
    }

    // Show/hide reset time input based on repeat checkbox
    resetTimeGroup.style.display = repeatCheckbox.checked ? 'block' : 'none';
    repeatCheckbox.addEventListener('change', () => {
      resetTimeGroup.style.display = repeatCheckbox.checked ? 'block' : 'none';
    });

    // Show/hide deadline inputs based on deadline checkbox
    deadlineEnabled.addEventListener('change', () => {
      deadlineInputs.style.display = deadlineEnabled.checked ? 'block' : 'none';
    });

    // Clear time button handler
    clearTimeBtn.onclick = () => {
      resetTimeInput.value = '';
    };

    // Color picker handlers
    function setupColorPickers(container) {
      container.querySelectorAll('.color-option').forEach(option => {
        option.onclick = () => {
          container.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
          option.classList.add('selected');
        };
      });
    }

    setupColorPickers(taskColors);
    setupColorPickers(doneColors);

    // Reset color buttons
    document.getElementById('reset-task-color').onclick = () => {
      taskColors.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
      taskColors.querySelector('.color-option').classList.add('selected');
    };

    document.getElementById('reset-done-color').onclick = () => {
      doneColors.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
      doneColors.querySelector('.color-option').classList.add('selected');
    };

    // Show/hide done color group based on info checkbox
    doneColorGroup.style.display = infoCheckbox.checked ? 'none' : 'block';
    infoCheckbox.addEventListener('change', () => {
      doneColorGroup.style.display = infoCheckbox.checked ? 'none' : 'block';
    });

    const deleteBtn = form.querySelector('.delete-btn');
    if (existingTask) {
      deleteBtn.style.display = 'block';
      deleteBtn.onclick = async () => {
        const confirmed = await showConfirmDialog(
          `Вы уверены, что хотите удалить задачу "${existingTask.title}"?`
        );
        if (confirmed) {
          tasks.deleteTask(existingTask.id);
          render();
          dialog.close();
        }
      };
    } else {
      deleteBtn.style.display = 'none';
    }

    form.onsubmit = (e) => {
      e.preventDefault();
      
      const title = titleInput.value.trim();
      if (!title) return;

      const description = descriptionInput.value.trim();
      const isInfo = infoCheckbox.checked;
      const repeating = repeatCheckbox.checked;
      const resetTime = repeating ? resetTimeInput.value : null;
      
      let deadline = null;
      if (deadlineEnabled.checked && deadlineDate.value) {
        const date = new Date(deadlineDate.value);
        if (deadlineTime.value) {
          const [hours, minutes] = deadlineTime.value.split(':');
          date.setHours(hours, minutes);
        }
        deadline = date.toISOString();
      }

      const selectedTaskColor = taskColors.querySelector('.color-option.selected');
      const selectedDoneColor = doneColors.querySelector('.color-option.selected');
      
      const taskColor = selectedTaskColor.classList.contains('custom') 
        ? document.getElementById('custom-task-color').value
        : selectedTaskColor.dataset.color;
        
      const doneColor = selectedDoneColor.classList.contains('custom')
        ? document.getElementById('custom-done-color').value
        : selectedDoneColor.dataset.color;

      if (existingTask) {
        tasks.updateTask(existingTask.id, {
          title,
          description,
          isInfo,
          repeating,
          resetTime,
          deadline,
          color: taskColor,
          doneColor: !isInfo ? doneColor : null
        });
      } else {
        tasks.createTask(column, title, description, null, {
          isInfo,
          repeating,
          resetTime,
          deadline,
          color: taskColor,
          doneColor: !isInfo ? doneColor : null
        });
      }

      saveData();
      render();
      dialog.close();
    };

    dialog.showModal();
  }

  return {
    openTaskDialog
  };
} 