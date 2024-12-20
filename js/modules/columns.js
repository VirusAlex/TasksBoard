import { generateId } from '../utils.js';
import { showConfirmDialog } from './dialogs.js';

export function initColumns(data, render, saveData, getSelectedBoard, showConfirmDialog) {
  const columnsEl = document.getElementById('columns');
  const addColumnBtn = document.getElementById('add-column-btn');

  function getColumnStats(column) {
    let done = 0;
    let total = 0;

    function countTasks(tasks) {
      tasks.forEach(task => {
        if (!task.isInfo && task.parentId === null) {
          total++;
          if (task.done) done++;
        }
      });
    }
    countTasks(column.tasks);
    return { done, total };
  }

  function openColumnDialog(existingColumn = null) {
    const dialog = document.getElementById('column-dialog');
    const form = dialog.querySelector('form');
    const nameInput = document.getElementById('column-name');
    const submitButton = form.querySelector('button[type="submit"]');
    const titleEl = dialog.querySelector('h3');
    const board = getSelectedBoard();
    
    if (!board) return;

    titleEl.textContent = existingColumn ? 'Редактировать колонку' : 'Новая колонка';
    submitButton.textContent = existingColumn ? 'Сохранить' : 'Создать';

    if (existingColumn) {
      nameInput.value = existingColumn.name;
    } else {
      form.reset();
    }

    const deleteBtn = form.querySelector('.delete-btn');
    if (existingColumn) {
      deleteBtn.style.display = 'block';
      deleteBtn.onclick = async () => {
        const confirmed = await showConfirmDialog(
          `Вы уверены, что хотите удалить колонку "${existingColumn.name}" со всеми задачами?`
        );
        if (confirmed) {
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

    form.onsubmit = (e) => {
      e.preventDefault();
      
      const name = nameInput.value.trim();
      if (!name) return;

      if (existingColumn) {
        existingColumn.name = name;
      } else {
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

  // Drag & Drop для колонок
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

  function showColumnDropIndicator(e, draggingCol) {
    e.preventDefault();
    e.stopPropagation();
    removeAllDropIndicators();
    
    const indicator = document.createElement('div');
    indicator.className = 'column-drop-indicator';
    
    const columns = Array.from(document.querySelectorAll('.column'));
    const mouseX = e.clientX;
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
    
    if (closestColumn) {
      const rect = closestColumn.getBoundingClientRect();
      if (mouseX < rect.left + rect.width / 2) {
        columnsEl.insertBefore(indicator, closestColumn);
      } else {
        columnsEl.insertBefore(indicator, closestColumn.nextSibling);
      }
    } else {
      columnsEl.appendChild(indicator);
    }
  }

  function handleColumnDrop(e) {
    const draggingCol = document.querySelector('.column.dragging');
    if (!draggingCol) return;

    e.preventDefault();
    e.stopPropagation();

    const board = getSelectedBoard();
    const draggedColId = draggingCol.dataset.columnId;
    const currentIndex = board.columns.findIndex(col => col.id === draggedColId);

    const indicator = document.querySelector('.column-drop-indicator');
    if (!indicator) return;

    const nextCol = indicator.nextElementSibling;
    const nextColIndex = nextCol ? board.columns.findIndex(col => col.id === nextCol.dataset.columnId) : -1;
    
    let finalIndex = nextCol ? nextColIndex : board.columns.length;
    if (currentIndex !== -1) {
      finalIndex = currentIndex < finalIndex ? finalIndex - 1 : finalIndex;
    }

    if (finalIndex !== -1) {
      const [movedColumn] = board.columns.splice(currentIndex, 1);
      board.columns.splice(finalIndex, 0, movedColumn);
      saveData();
      render();
    }

    removeAllDropIndicators();
  }

  function removeAllDropIndicators() {
    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
  }

  // Event listeners
  addColumnBtn.addEventListener('click', () => {
    openColumnDialog();
  });

  return {
    getColumnStats,
    openColumnDialog,
    removeAllDropIndicators
  };
} 