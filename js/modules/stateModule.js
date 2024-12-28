import { getCurrentProvider } from '../data/dataProvider.js';

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

export async function saveState() {
    try {
        await getCurrentProvider().saveData(appState);
    } catch (error) {
        console.error('Failed to save state:', error);
        throw error;
    }
}

export async function loadState() {
    try {
        const savedState = await getCurrentProvider().getData();
        if (savedState) {
            appState = savedState;
        }
        return appState;
    } catch (error) {
        console.error('Failed to load state:', error);
        // Fallback to default state
        appState = {
            boards: [],
            selectedBoardId: null,
            isCalendarView: false
        };
        return appState;
    }
}

// Функция инициализации модуля
export async function initStateModule() {
    await loadState();
    if (appState.boards.length === 0) {
        // Создаем доску по умолчанию, если нет сохраненных досок
        appState.boards.push({
            id: 'default-board',
            name: 'Моя первая доска',
            columns: []
        });
        appState.selectedBoardId = 'default-board';
        await saveState();
    }
} 