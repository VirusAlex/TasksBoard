import * as BoardManager from './boardModule.js';
import * as StateModule from './stateModule.js';
import * as CalendarModule from './calendarModule.js';

  // Обновляем функцию render
export function render() {
    const boardsEl = document.getElementById('boards');
    const boardTitleEl = document.getElementById('board-title');
    const calendarViewEl = document.getElementById('calendar-view');

    BoardManager.renderBoardsList(boardsEl);

    if (StateModule.getState().isCalendarView) {
      CalendarModule.renderCalendar();
      calendarViewEl?.classList.add('selected');
      document.getElementById('board-view').style.display = 'none';
      document.getElementById('calendar-view-content').style.display = 'block';
      boardTitleEl.textContent = 'Календарь';
    } else {
      BoardManager.renderBoard();
      calendarViewEl?.classList.remove('selected');
      document.getElementById('board-view').style.display = 'block';
      document.getElementById('calendar-view-content').style.display = 'none';
    }
  }