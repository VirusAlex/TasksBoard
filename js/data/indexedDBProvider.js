import { DataProvider } from './dataProvider.js';

export class IndexedDBProvider extends DataProvider {
    constructor() {
        super();
        this.dbName = 'TasksBoard';
        this.dbVersion = 1;
        this.initialized = false;
        this.db = null;
        this.initializationPromise = null;
        this.cache = {
            boards: null,
            settings: null
        };
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        if (this.initializationPromise) {
            await this.initializationPromise;
            return;
        }

        try {
            this.initializationPromise = this._initDatabase();
            await this.initializationPromise;
        } catch (error) {
            console.error('Failed to initialize IndexedDBProvider:', error);
            this.initializationPromise = null;
            throw error;
        }
    }

    async _initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('Failed to open IndexedDB:', event.target.error);
                reject(event.target.error);
            };

            request.onupgradeneeded = (event) => {
                console.log('Upgrading IndexedDB');
                const db = event.target.result;

                // Создаем хранилище для досок
                if (!db.objectStoreNames.contains('boards')) {
                    const boardsStore = db.createObjectStore('boards', { keyPath: 'id' });
                    boardsStore.createIndex('order', 'order', { unique: false });
                }

                // Создаем хранилище для колонок
                if (!db.objectStoreNames.contains('columns')) {
                    const columnsStore = db.createObjectStore('columns', { keyPath: 'id' });
                    columnsStore.createIndex('boardId', 'boardId', { unique: false });
                    columnsStore.createIndex('order', 'order', { unique: false });
                }

                // Создаем хранилище для задач
                if (!db.objectStoreNames.contains('tasks')) {
                    const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    tasksStore.createIndex('columnId', 'columnId', { unique: false });
                    tasksStore.createIndex('order', 'order', { unique: false });
                }

                // Создаем хранилище для настроек
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }

                console.log('IndexedDB upgrade completed');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.initialized = true;
                resolve();
            };
        });
    }

    // Вспомогательные методы для работы с транзакциями
    _getStore(storeName, mode = 'readonly') {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const transaction = this.db.transaction(storeName, mode);
        return transaction.objectStore(storeName);
    }

    async _getAllFromStore(store) {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _getFromIndex(store, indexName, key) {
        return new Promise((resolve, reject) => {
            const index = store.index(indexName);
            const request = index.getAll(IDBKeyRange.only(key));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _addToStore(store, data) {
        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _updateInStore(store, data) {
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _deleteFromStore(store, key) {
        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async _clearStore(store) {
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async _getFromStore(store, key) {
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Базовые методы для обратной совместимости
    async getData() {
        await this.initialize();
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const transaction = this.db.transaction(['boards', 'columns', 'tasks', 'settings'], 'readonly');
        const boardsStore = transaction.objectStore('boards');
        const columnsStore = transaction.objectStore('columns');
        const tasksStore = transaction.objectStore('tasks');
        const settingsStore = transaction.objectStore('settings');

        try {
            // Получаем настройки
            const settings = await this._getFromStore(settingsStore, 'app');

            // Получаем все доски и сортируем по порядку
            const boards = await this._getAllFromStore(boardsStore);
            boards.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

            // Для каждой доски получаем её колонки и задачи
            for (const board of boards) {
                // Получаем колонки для доски и сортируем по порядку
                const boardIndex = columnsStore.index('boardId');
                const columns = await this._getFromIndex(columnsStore, 'boardId', board.id);
                columns.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

                // Для каждой колонки получаем её задачи
                for (const column of columns) {
                    const columnIndex = tasksStore.index('columnId');
                    const tasks = await this._getFromIndex(tasksStore, 'columnId', column.id);
                    // Сортируем задачи по порядку
                    tasks.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
                    column.tasks = tasks;
                }
                board.columns = columns;
            }

            const result = {
                selectedBoardId: settings?.selectedBoardId || null,
                isCalendarView: settings?.isCalendarView || false,
                boards: boards
            };

            // Сохраняем результат в кэш
            this.cache = {
                boards: result.boards,
                settings: {
                    id: 'app',
                    selectedBoardId: result.selectedBoardId,
                    isCalendarView: result.isCalendarView
                }
            };

            return result;

        } catch (error) {
            console.error('Failed to get data from IndexedDB:', error);
            throw error;
        }
    }

    async saveData(data) {
        await this.initialize();
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const transaction = this.db.transaction(['boards', 'columns', 'tasks', 'settings'], 'readwrite');
        const boardsStore = transaction.objectStore('boards');
        const columnsStore = transaction.objectStore('columns');
        const tasksStore = transaction.objectStore('tasks');
        const settingsStore = transaction.objectStore('settings');

        try {
            // Очищаем все хранилища
            await Promise.all([
                this._clearStore(boardsStore),
                this._clearStore(columnsStore),
                this._clearStore(tasksStore),
            ]);

            // Сохраняем настройки
            const settingsData = {
                id: 'app',
                selectedBoardId: data.selectedBoardId,
                isCalendarView: data.isCalendarView
            };
            await this._updateInStore(settingsStore, settingsData);

            // Сохраняем доски, колонки и задачи с сохранением порядка
            if (Array.isArray(data.boards)) {
                for (let boardIndex = 0; boardIndex < data.boards.length; boardIndex++) {
                    const board = data.boards[boardIndex];
                    const { columns, ...boardData } = board;
                    // Устанавливаем порядок доски
                    boardData.order = boardIndex;
                    await this._addToStore(boardsStore, boardData);

                    if (Array.isArray(columns)) {
                        for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
                            const column = columns[columnIndex];
                            const { tasks, ...columnData } = column;
                            // Устанавливаем связь с доской и порядок колонки
                            columnData.boardId = board.id;
                            columnData.order = columnIndex;
                            await this._addToStore(columnsStore, columnData);

                            if (Array.isArray(tasks)) {
                                for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
                                    const task = tasks[taskIndex];
                                    // Добавляем связь с колонкой и порядок задачи
                                    const taskData = { 
                                        ...task, 
                                        columnId: column.id,
                                        order: taskIndex
                                    };
                                    await this._addToStore(tasksStore, taskData);
                                }
                            }
                        }
                    }
                }
            }

            await new Promise((resolve, reject) => {
                transaction.oncomplete = () => {
                    resolve();
                };
                transaction.onerror = (event) => {
                    console.error('Transaction error:', event.target.error);
                    reject(transaction.error);
                };
            });

            // Очищаем кэш после успешного сохранения
            await this.invalidateCache();

        } catch (error) {
            console.error('Failed to save data to IndexedDB:', error);
            throw error;
        }
    }

    // Реализация новых методов
    async getBoards() {
        if (this.cache.boards) {
            return this.cache.boards;
        }
        const boards = await this._getAllFromStore('boards');
        this.cache.boards = boards.sort((a, b) => a.order - b.order);
        return this.cache.boards;
    }

    async createBoard(board) {
        await this._addToStore('boards', board);
        this.cache.boards = null;
        return board;
    }

    async updateBoard(boardId, updates) {
        const board = await this._getStore('boards').get(boardId);
        if (!board) {
            throw new Error('Board not found');
        }
        const updatedBoard = { ...board, ...updates };
        await this._updateInStore('boards', updatedBoard);
        this.cache.boards = null;
        return updatedBoard;
    }

    async deleteBoard(boardId) {
        const transaction = this.db.transaction(['boards', 'columns', 'tasks', 'settings'], 'readwrite');

        try {
            // Удаляем доску
            await this._deleteFromStore('boards', boardId);

            // Находим и удаляем все колонки доски
            const columns = await this._getFromIndex('columns', 'boardId', boardId);
            await Promise.all(columns.map(column =>
                this._deleteFromStore('columns', column.id)
            ));

            // Находим и удаляем все задачи из колонок
            await Promise.all(columns.map(async column => {
                const tasks = await this._getFromIndex('tasks', 'columnId', column.id);
                return Promise.all(tasks.map(task =>
                    this._deleteFromStore('tasks', task.id)
                ));
            }));

            // Обновляем настройки, если удаляемая доска была выбрана
            const settings = await this._getStore('settings').get('app');
            if (settings?.selectedBoardId === boardId) {
                const remainingBoards = await this.getBoards();
                settings.selectedBoardId = remainingBoards.length > 0 ? remainingBoards[0].id : null;
                await this._updateInStore('settings', settings);
            }

            this.cache.boards = null;
            this.cache.settings = null;
            return true;
        } catch (error) {
            console.error('Failed to delete board:', error);
            return false;
        }
    }

    async updateBoardOrder(boardIds) {
        await this.initialize();
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const transaction = this.db.transaction(['boards'], 'readwrite');
        const store = transaction.objectStore('boards');

        try {
            const boards = await this._getAllFromStore(store);
            const boardsMap = new Map(boards.map(b => [b.id, b]));

            await Promise.all(boardIds.map(async (id, index) => {
                const board = boardsMap.get(id);
                if (board) {
                    board.order = index;
                    await this._updateInStore(store, board);
                }
            }));

            await new Promise((resolve, reject) => {
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error);
            });

            await this.invalidateCache();
        } catch (error) {
            console.error('Failed to update board order:', error);
            throw error;
        }
    }

    async getColumns(boardId) {
        const columns = await this._getFromIndex('columns', 'boardId', boardId);
        return columns.sort((a, b) => a.order - b.order);
    }

    async createColumn(column) {
        await this._addToStore('columns', column);
        return column;
    }

    async updateColumn(columnId, updates) {
        const column = await this._getStore('columns').get(columnId);
        if (!column) {
            throw new Error('Column not found');
        }
        const updatedColumn = { ...column, ...updates };
        await this._updateInStore('columns', updatedColumn);
        return updatedColumn;
    }

    async deleteColumn(columnId) {
        const transaction = this.db.transaction(['columns', 'tasks'], 'readwrite');

        try {
            // Удаляем колонку
            await this._deleteFromStore('columns', columnId);

            // Удаляем все задачи колонки
            const tasks = await this._getFromIndex('tasks', 'columnId', columnId);
            await Promise.all(tasks.map(task =>
                this._deleteFromStore('tasks', task.id)
            ));

            return true;
        } catch (error) {
            console.error('Failed to delete column:', error);
            return false;
        }
    }

    async updateColumnOrder(boardId, columnIds) {
        await this.initialize();
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const transaction = this.db.transaction(['columns'], 'readwrite');
        const store = transaction.objectStore('columns');

        try {
            const boardIndex = store.index('boardId');
            const columns = await this._getFromIndex(store, 'boardId', boardId);
            const columnsMap = new Map(columns.map(c => [c.id, c]));

            await Promise.all(columnIds.map(async (id, index) => {
                const column = columnsMap.get(id);
                if (column) {
                    column.order = index;
                    await this._updateInStore(store, column);
                }
            }));

            await new Promise((resolve, reject) => {
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error);
            });

            await this.invalidateCache();
        } catch (error) {
            console.error('Failed to update column order:', error);
            throw error;
        }
    }

    async getTasks(columnId) {
        const tasks = await this._getFromIndex('tasks', 'columnId', columnId);
        return tasks.sort((a, b) => a.order - b.order);
    }

    async createTask(task) {
        await this._addToStore('tasks', task);
        return task;
    }

    async updateTask(taskId, updates) {
        const task = await this._getStore('tasks').get(taskId);
        if (!task) {
            throw new Error('Task not found');
        }
        const updatedTask = { ...task, ...updates };
        await this._updateInStore('tasks', updatedTask);
        return updatedTask;
    }

    async deleteTask(taskId) {
        try {
            await this._deleteFromStore('tasks', taskId);
            return true;
        } catch (error) {
            console.error('Failed to delete task:', error);
            return false;
        }
    }

    async moveTask(taskId, newColumnId, newOrder) {
        const transaction = this.db.transaction(['tasks'], 'readwrite');
        const store = transaction.objectStore('tasks');

        try {
            // Получаем задачу и все задачи в новой колонке
            const task = await this._getStore('tasks').get(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const oldColumnId = task.columnId;
            const [oldColumnTasks, newColumnTasks] = await Promise.all([
                this._getFromIndex('tasks', 'columnId', oldColumnId),
                this._getFromIndex('tasks', 'columnId', newColumnId)
            ]);

            // Обновляем порядок в старой колонке
            const remainingTasks = oldColumnTasks.filter(t => t.id !== taskId);
            await Promise.all(remainingTasks.map((t, index) => {
                t.order = index;
                return this._updateInStore('tasks', t);
            }));

            // Обновляем задачу и вставляем её в новую позицию
            task.columnId = newColumnId;
            task.order = newOrder;
            await this._updateInStore('tasks', task);

            // Обновляем порядок в новой колонке
            const tasksToUpdate = newColumnTasks.filter(t => t.id !== taskId && t.order >= newOrder);
            await Promise.all(tasksToUpdate.map(t => {
                t.order = t.order + 1;
                return this._updateInStore('tasks', t);
            }));

            return task;
        } catch (error) {
            console.error('Failed to move task:', error);
            throw error;
        }
    }

    async updateTaskOrder(columnId, taskIds) {
        await this.initialize();
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const transaction = this.db.transaction(['tasks'], 'readwrite');
        const store = transaction.objectStore('tasks');

        try {
            const columnIndex = store.index('columnId');
            const tasks = await this._getFromIndex(store, 'columnId', columnId);
            const tasksMap = new Map(tasks.map(t => [t.id, t]));

            await Promise.all(taskIds.map(async (id, index) => {
                const task = tasksMap.get(id);
                if (task) {
                    task.order = index;
                    await this._updateInStore(store, task);
                }
            }));

            await new Promise((resolve, reject) => {
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error);
            });

            await this.invalidateCache();
        } catch (error) {
            console.error('Failed to update task order:', error);
            throw error;
        }
    }

    async getSettings() {
        if (this.cache.settings) {
            return this.cache.settings;
        }
        const settings = await this._getFromStore('settings', 'app') || {
            id: 'app',
            selectedBoardId: null,
            isCalendarView: false
        };
        this.cache.settings = settings;
        return settings;
    }

    async updateSettings(settings) {
        const updatedSettings = { id: 'app', ...settings };
        await this._updateInStore('settings', updatedSettings);
        this.cache.settings = updatedSettings;
        return updatedSettings;
    }

    async invalidateCache() {
        this.cache = {
            boards: null,
            settings: null
        };
    }

    async clearCache() {
        await this.invalidateCache();
    }
} 