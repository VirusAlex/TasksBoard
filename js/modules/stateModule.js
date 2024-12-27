// Состояние приложения
let appState = {
    boards: [],
    selectedBoardId: null,
    isCalendarView: false
};

// Функции для работы с состоянием
export function getState() {
    return appState;
}

export function setState(newState) {
    appState = newState;
}

export function saveState() {
    localStorage.setItem('taskBoardsData', JSON.stringify(appState));
}

export function loadState() {
    const savedState = JSON.parse(localStorage.getItem('taskBoardsData') || 'null' || {
        boards: [],
        selectedBoardId: null,
        isCalendarView: false
    });
    
    if (savedState) {
        appState = savedState;
    }
    return appState;
}

// Функция инициализации модуля
export function initStateModule() {
    loadState();
    if (appState.boards.length === 0) {
        // Создаем доску по умолчанию, если нет сохраненных досок
        appState.boards.push({
            id: 'default-board',
            name: 'Моя первая доска',
            columns: []
        });
        appState.selectedBoardId = 'default-board';
        saveState();
    }
} 