// Data Provider Interface
export class DataProvider {
    // Базовые методы для обратной совместимости
    async getData() {
        throw new Error('Method not implemented');
    }

    async saveData(data) {
        throw new Error('Method not implemented');
    }

    async initialize() {
        throw new Error('Method not implemented');
    }

    // Методы для досок
    async getBoards() {
        throw new Error('Method not implemented');
    }

    async createBoard(board) {
        throw new Error('Method not implemented');
    }

    async updateBoard(boardId, updates) {
        throw new Error('Method not implemented');
    }

    async deleteBoard(boardId) {
        throw new Error('Method not implemented');
    }

    async updateBoardOrder(boardIds) {
        throw new Error('Method not implemented');
    }

    // Методы для колонок
    async getColumns(boardId) {
        throw new Error('Method not implemented');
    }

    async createColumn(column) {
        throw new Error('Method not implemented');
    }

    async updateColumn(columnId, updates) {
        throw new Error('Method not implemented');
    }

    async deleteColumn(columnId) {
        throw new Error('Method not implemented');
    }

    async updateColumnOrder(boardId, columnIds) {
        throw new Error('Method not implemented');
    }

    // Методы для задач
    async getTasks(columnId) {
        throw new Error('Method not implemented');
    }

    async createTask(task) {
        throw new Error('Method not implemented');
    }

    async updateTask(taskId, updates) {
        throw new Error('Method not implemented');
    }

    async deleteTask(taskId) {
        throw new Error('Method not implemented');
    }

    async moveTask(taskId, newColumnId, newOrder) {
        throw new Error('Method not implemented');
    }

    async updateTaskOrder(columnId, taskIds) {
        throw new Error('Method not implemented');
    }

    // Методы для настроек
    async getSettings() {
        throw new Error('Method not implemented');
    }

    async updateSettings(settings) {
        throw new Error('Method not implemented');
    }

    // Методы для кеширования
    async invalidateCache() {
        throw new Error('Method not implemented');
    }

    async clearCache() {
        throw new Error('Method not implemented');
    }
}

// Storage Types Enum
export const StorageType = {
    LOCAL_STORAGE: 'localStorage',
    INDEXED_DB: 'indexedDB',
    SERVER: 'server'
};

// Data Provider Factory
let currentProvider = null;

export async function initializeDataProvider(config = { type: StorageType.LOCAL_STORAGE }) {
    if (currentProvider) {
        // If we're switching to a different provider type
        if (
            (config.type === StorageType.SERVER && !(currentProvider instanceof ServerDataProvider)) ||
            (config.type === StorageType.INDEXED_DB && !(currentProvider instanceof IndexedDBProvider)) ||
            (config.type === StorageType.LOCAL_STORAGE && !(currentProvider instanceof LocalStorageProvider))
        ) {
            currentProvider = null;
        } else {
            // Same type, reuse existing provider
            return currentProvider;
        }
    }

    try {
        switch (config.type) {
            case StorageType.SERVER:
                if (!config.apiUrl || !config.apiToken) {
                    throw new Error('Server configuration requires apiUrl and apiToken');
                }
                const { ServerDataProvider } = await import('./serverDataProvider.js');
                currentProvider = new ServerDataProvider(config.apiUrl, config.apiToken);
                break;
            case StorageType.INDEXED_DB:
                const { IndexedDBProvider } = await import('./indexedDBProvider.js');
                currentProvider = new IndexedDBProvider();
                break;
            case StorageType.LOCAL_STORAGE:
            default:
                const { LocalStorageProvider } = await import('./localStorageProvider.js');
                currentProvider = new LocalStorageProvider();
                break;
        }
        
        await currentProvider.initialize();
        return currentProvider;
    } catch (error) {
        currentProvider = null;
        throw error;
    }
}

export function getCurrentProvider() {
    if (!currentProvider) {
        throw new Error('Data provider not initialized');
    }
    return currentProvider;
}

export function getCurrentStorageType() {
    if (!currentProvider) return null;
    if (currentProvider instanceof ServerDataProvider) return StorageType.SERVER;
    if (currentProvider instanceof IndexedDBProvider) return StorageType.INDEXED_DB;
    return StorageType.LOCAL_STORAGE;
} 