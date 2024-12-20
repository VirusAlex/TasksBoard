import { generateId } from './utils.js';
import { initBoardRenderer } from './modules/board-renderer.js';
import { initTaskManager } from './modules/tasks.js';
import { initDragDrop } from './modules/drag-drop.js';
import { initRepeatingTasks } from './modules/repeating-tasks.js';
import { initDataHandlers } from './modules/data.js';
import { initTheme } from './modules/theme.js';
import { initCalendar } from './modules/calendar.js';
import { initBoards } from './modules/boards.js';
import { initColumns } from './modules/columns.js';
import { showConfirmDialog, showLinkDialog } from './modules/dialogs.js';
import { initTaskDialog } from './modules/task-dialog.js';

const data = {
  boards: [],
  isCalendarView: false,
  selectedBoardId: null
};

export function initApp() {
  // Load saved data
  const savedData = localStorage.getItem('taskBoardsData');
  if (savedData) {
    try {
      Object.assign(data, JSON.parse(savedData));
    } catch (e) {
      console.error('Error loading saved data:', e);
    }
  }

  function saveData() {
    localStorage.setItem('taskBoardsData', JSON.stringify(data));
  }

  function render() {
    boards.renderBoardsList();
    
    // Обновляем отображение в зависимости от текущего вида
    const boardView = document.getElementById('board-view');
    const calendarViewContent = document.getElementById('calendar-view-content');
    const calendarViewEl = document.getElementById('calendar-view');
    const boardTitle = document.getElementById('board-title');

    if (data.isCalendarView) {
      calendarViewEl?.classList.add('selected');
      boardView.style.display = 'none';
      calendarViewContent.style.display = 'block';
      boardTitle.textContent = 'Календарь';
      calendar.renderCalendar();
    } else {
      calendarViewEl?.classList.remove('selected');
      boardView.style.display = 'block';
      calendarViewContent.style.display = 'none';
      boardRenderer.renderBoard();
    }
  }

  function getSelectedBoard() {
    return data.boards.find(board => board.id === data.selectedBoardId);
  }

  // Initialize all modules
  const tasks = initTaskManager(data, saveData);
  const taskDialog = initTaskDialog(data, tasks, saveData, render);
  const columns = initColumns(data, saveData, render, getSelectedBoard, showConfirmDialog);
  const dragDrop = initDragDrop(tasks, render);
  const boards = initBoards(data, saveData, render, showConfirmDialog);
  const boardRenderer = initBoardRenderer(data, render, saveData, getSelectedBoard, tasks, taskDialog.openTaskDialog, columns.getColumnStats, dragDrop, boards.openBoardDialog, columns.openColumnDialog);
  const repeatingTasks = initRepeatingTasks(data, saveData, tasks);
  const dataHandlers = initDataHandlers(data, saveData, render);
  const calendar = initCalendar(data, render, saveData, tasks, taskDialog.openTaskDialog, getSelectedBoard);

  // Initialize theme
  initTheme();

  // Setup event handlers
  dataHandlers.setupImportExportHandlers();

  // Setup sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  sidebarToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
    sidebar.classList.toggle('open');
  });

  backdrop.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
    sidebar.classList.remove('open');
  });

  // Setup drag & drop handlers for columns container
  const columnsEl = document.getElementById('columns');
  columnsEl.addEventListener('dragover', (e) => {
    const draggingCol = document.querySelector('.column.dragging');
    if (draggingCol) {
      dragDrop.handleColumnDragOver(e, draggingCol);
    }
  });

  columnsEl.addEventListener('drop', (e) => {
    dragDrop.handleColumnDrop(e);
  });

  // Initial render
  render();
}