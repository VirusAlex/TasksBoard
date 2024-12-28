import * as BoardManager from './boardModule.js';
import * as CalendarModule from './calendarModule.js';
import { getCurrentProvider } from '../data/dataProvider.js';

  // Обновляем функцию render
export async function render() {
    const boardsEl = document.getElementById('boards');
    const boardTitleEl = document.getElementById('board-title');
    const calendarViewEl = document.getElementById('calendar-view');

    BoardManager.renderBoardsList(boardsEl);

    const state = await getCurrentProvider().getData();

    if (state.isCalendarView) {
      CalendarModule.renderCalendar();
      calendarViewEl?.classList.add('selected');
      document.getElementById('board-view').style.display = 'none';
      document.getElementById('calendar-view-content').style.display = 'block';
      boardTitleEl.textContent = 'Календарь';
    } else {
      await BoardManager.renderBoard();
      calendarViewEl?.classList.remove('selected');
      document.getElementById('board-view').style.display = 'block';
      document.getElementById('calendar-view-content').style.display = 'none';
    }
  }