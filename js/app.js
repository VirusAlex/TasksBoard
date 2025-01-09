import { showConfirmDialog } from './modules/uiComponents.js';
import * as TaskModule from './modules/taskModule.js';
import * as BoardModule from './modules/boardModule.js';
import * as Calendar from './modules/calendarModule.js';
import * as RenderModule from './modules/renderModule.js';
import * as ColumnModule from './modules/columnModule.js';
import { initializeDataProvider } from './data/dataProvider.js';
import './modules/types.js';

async function initApp(config = { type: 'local' }) {
  try {
    // Initialize data provider
    await initializeDataProvider(config);

    // // Initialize state
    // await StateModule.initStateModule();
    await BoardModule.initBoardModule();

    // Get elements
    const boardsEl = document.getElementById('boards');
    const addBoardBtn = document.getElementById('add-board-btn');
    const addColumnBtn = document.getElementById('add-column-btn');

    addBoardBtn.addEventListener('click', () => {
      BoardModule.openBoardDialog();
    });

    addColumnBtn.addEventListener('click', () => {
      ColumnModule.openColumnDialog();
    });

    await RenderModule.render();

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

    // Запускаем проверку при загрузке и каждую минуту
    await TaskModule.refreshTasks();
    setInterval(TaskModule.refreshTasks, 1000);

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
            await RenderModule.render();
          }
        } catch (err) {
          alert('Ошибка при импорте файла: ' + err.message);
        }
        // Очищаем input для возможности повторного импорта того же файла
        importFile.value = '';
      };
      reader.readAsText(file);
    });

    // Добавляем обработчики для календаря
    const calendarViewEl = document.getElementById('calendar-view');
    calendarViewEl?.addEventListener('click', async () => {
      StateModule.setState({...StateModule.getState(), isCalendarView: true, selectedBoardId: null});
      StateModule.saveState();
      await RenderModule.render();
    });


    let currentDate = new Date();

    document.getElementById('prev-month').addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      Calendar.renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      Calendar.renderCalendar();
    });

    // Обновляем обработчики для досок
    boardsEl.addEventListener('click', async (e) => {
      if (e.target.id === 'calendar-view') return;

      const li = e.target.closest('li');
      if (!li) return;

      await BoardModule.setSelectedBoard(li.dataset.boardId);

      if (window.innerWidth <= 768) {
          document.body.classList.remove('sidebar-open');
          sidebar.classList.remove('open');
      }
    });

  } catch (error) {
    console.error('Failed to initialize app:', error);
    // Show error to user
    alert('Failed to initialize application. Please check your connection and reload the page.');
  }
}

// Export the initialization function
export { initApp };

