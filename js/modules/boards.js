import { generateId } from '../utils.js';
import { showConfirmDialog } from './dialogs.js';

export function initBoards(data, render, saveData, showConfirmDialog) {
  const boardsEl = document.getElementById('boards');
  const addBoardBtn = document.getElementById('add-board-btn');
  const boardTitleEl = document.getElementById('board-title');

  // Инициализация
  if (data.boards.length === 0) {
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

  function openBoardDialog(existingBoard = null) {
    const dialog = document.getElementById('board-dialog');
    const form = dialog.querySelector('form');
    const nameInput = document.getElementById('board-name');
    const submitButton = form.querySelector('button[type="submit"]');
    const titleEl = dialog.querySelector('h3');

    titleEl.textContent = existingBoard ? 'Редактировать доску' : 'Новая доска';
    submitButton.textContent = existingBoard ? 'Сохранить' : 'Создать';

    if (existingBoard) {
      nameInput.value = existingBoard.name;
    } else {
      form.reset();
    }

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

    form.onsubmit = (e) => {
      e.preventDefault();
      
      const name = nameInput.value.trim();
      if (!name) return;

      if (existingBoard) {
        existingBoard.name = name;
      } else {
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

  // Event listeners
  addBoardBtn.addEventListener('click', () => {
    openBoardDialog();
  });

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
      document.getElementById('sidebar').classList.remove('open');
    }
  });

  return {
    renderBoardsList,
    getSelectedBoard,
    openBoardDialog
  };
} 