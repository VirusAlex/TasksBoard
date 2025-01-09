import {DataProvider} from './dataProvider.js';
import {generateId} from "../utils.js";

export class IndexedDBProvider extends DataProvider {
    constructor() {
        super();
        this.dbName = 'TasksBoard';
        this.dbVersion = 2;
        this.initialized = false;
        this.db = null;
        this.initializationPromise = null;
        // this.cache = null;
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
                console.debug('Upgrading IndexedDB');
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

                let tasksStore;
                // Создаем хранилище для задач
                if (!db.objectStoreNames.contains('tasks')) {
                    tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    tasksStore.createIndex('columnId', 'columnId', { unique: false });
                    tasksStore.createIndex('parentId', 'parentId', { unique: false });
                    tasksStore.createIndex('order', 'order', { unique: false });
                } else {
                    tasksStore = event.target.transaction.objectStore('tasks');
                    if (!tasksStore.indexNames.contains('parentId')) {
                        tasksStore.createIndex('parentId', 'parentId', { unique: false });
                    }
                }

                // Создаем хранилище для настроек
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }

                console.debug('IndexedDB upgrade completed');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.initialized = true;
                resolve();
            };
        });
    }

    // Вспомогательные методы для работы с транзакциями
    _getTransaction(storeNames, mode = 'readonly') {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        return this.db.transaction(storeNames, mode);
    }

    _getStore(storeName, mode = 'readonly', transaction = null) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        if (!transaction) {
            transaction = this.db.transaction([storeName], mode);
        }
        return transaction.objectStore(storeName);
    }

    /**
     * @param {string[]} storeNames
     * @param {'readonly' | 'readwrite' | 'versionchange'} mode
     * @param {IDBTransaction | null} transaction
     */
    _getStores(storeNames, mode = 'readonly', transaction = null) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        if (!transaction) {
            transaction = this.db.transaction(storeNames, mode);
        }

        // getting an object like {boards: IDBObjectStore, columns: IDBObjectStore, tasks: IDBObjectStore}
        return storeNames.reduce((a, v) => ({...a, [v]: transaction.objectStore(v)}), {});
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

    /**
     * @param {IDBObjectStore} store
     * @param {string} key
     * @returns {Promise<any>}
     */
    async _getFromStore(store, key) {
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Базовые методы для обратной совместимости
    /** @returns {Promise<AppData>} */
    async getData() {
        // if (this.cache) {
        //     return this.cache;
        // }

        await this.initialize();
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        /** @type {IDBObjectStore} */
        const {boards: boardsStore, columns: columnsStore, tasks: tasksStore, settings: settingsStore} = this._getStores(['boards', 'columns', 'tasks', 'settings']);

        try {
            // Получаем настройки
            const settings = await this._getFromStore(settingsStore, 'app');

            // Получаем все доски и сортируем по порядку
            /** @type {BoardData[]} */
            const boards = await this._getAllFromStore(boardsStore);
            boards.sort(sortByOrder);

            // // Для каждой доски получаем её колонки и задачи
            // for (const board of boards) {
            //     // Получаем колонки для доски и сортируем по порядку
            //     const columns = await this._getFromIndex(columnsStore, 'boardId', board.id);
            //     columns.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
            //
            //     // Для каждой колонки получаем её задачи
            //     for (const column of columns) {
            //         const tasks = await this._getFromIndex(tasksStore, 'columnId', column.id);
            //         // Сортируем задачи по порядку
            //         tasks.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
            //         column.tasks = tasks;
            //     }
            //     board.columns = columns;
            // }

            const columns = await this._getAllFromStore(columnsStore);
            columns.sort(sortByOrder);

            const tasks = await this._getAllFromStore(tasksStore);
            tasks.sort(sortByOrder);

            /** @type {AppData} */
            const result = {
                selectedBoardId: settings?.selectedBoardId || null,
                isCalendarView: settings?.isCalendarView || false,
                boards: boards,
                columns: columns,
                tasks: tasks
            };

            // // Сохраняем результат в кэш
            // this.cache = result;
            // return this.cache;

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
        const {boardsStore, columnsStore, tasksStore, settingsStore} = this._getStores(['boards', 'columns', 'tasks', 'settings'], 'readwrite', transaction);

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

            // // Очищаем кэш после успешного сохранения
            // await this.invalidateCache();

        } catch (error) {
            console.error('Failed to save data to IndexedDB:', error);
            throw error;
        }
    }

    // Реализация новых методов
    /** @returns {Promise<BoardData[]>} */
    async getBoards() {
        // if (!this.cache) {
        //     await this.getData();
        // }
        // return this.cache.boards;

        /** @type {BoardData[]} */
        const boards = await this.getData().then(data => data.boards || []);
        boards.sort(sortByOrder);
        return boards;
    }

    /**
     * @param {string} name
     * @returns {Promise<BoardData>}
     */
    async createBoard(name) {
        const store = await this._getStore('boards', 'readwrite');

        /** @type {BoardData} */
        const board = {
            id: generateId('br'),
            name: name,
            order: (await this._getAllFromStore(store)).length
        }

        await this._addToStore(store, board);
        return board;
    }

    /**
     * @param {string} boardId
     * @param {Partial<BoardData>} updates
     * @returns {Promise<BoardData>}
     */
    async updateBoard(boardId, updates) {
        if (updates.columns) {
            throw new Error('Columns cannot be updated directly');
        }

        const store = await this._getStore('boards', 'readwrite');

        /** @type {BoardData | null} */
        const board = await this._getFromStore(store, boardId);
        if (!board) {
            throw new Error('Board not found');
        }

        /** @type {BoardData} */
        const updatedBoard = { ...board, ...updates };
        await this._updateInStore(store, updatedBoard);

        // if (this.cache?.boards) {
        //     const index = this.cache.boards.findIndex(b => b.id === boardId);
        //     if (index !== -1) {
        //         this.cache.boards[index] = updatedBoard;
        //     }
        // } else {
        //     await this.invalidateCache();
        // }

        return updatedBoard;
    }

    /**
     * @param {string} boardId
     * @returns {Promise<boolean>}
     */
    async deleteBoard(boardId) {
        const {boards: boardsStore, columns: columnsStore, tasks: tasksStore, settings: settingsStore} = this._getStores(['boards', 'columns', 'tasks', 'settings'], 'readwrite');

        try {
            // Удаляем доску
            await this._deleteFromStore(boardsStore, boardId);

            // Находим и удаляем все колонки доски
            /** @type {ColumnData[]} */
            const columns = await this._getFromIndex(columnsStore, 'boardId', boardId);
            await Promise.all(columns.map(column =>
                this._deleteFromStore(columnsStore, column.id)
            ));

            // Находим и удаляем все задачи из колонок
            await Promise.all(columns.map(async column => {
                /** @type {TaskData[]} */
                const tasks = await this._getFromIndex(tasksStore, 'columnId', column.id);
                return Promise.all(tasks.map(task =>
                    this._deleteFromStore(tasksStore, task.id)
                ));
            }));

            // Обновляем настройки, если удаляемая доска была выбрана
            const settings = await this._getFromStore(settingsStore, 'app');
            if (settings?.selectedBoardId === boardId) {
                /** @type {BoardData[]} */
                const remainingBoards = await this._getAllFromStore(boardsStore);
                settings.selectedBoardId = remainingBoards.length > 0 ? remainingBoards[0].id : null;
                await this._updateInStore(settingsStore, settings);
            }

            // if (this.cache?.boards) {
            //     const index = this.cache.boards.findIndex(b => b.id === boardId);
            //     if (index !== -1) {
            //         this.cache.boards.splice(index, 1);
            //     }
            // } else {
            //     await this.invalidateCache();
            // }

            return true;
        } catch (error) {
            console.error('Failed to delete board:', error);
            return false;
        }
    }

    async updateBoardOrder() {
        await this.initialize();
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const boardsStore = this._getStore('boards', 'readwrite');

        try {
            /** @type {BoardData[]} */
            const boards = await this._getAllFromStore(boardsStore);
            boards.sort(sortByOrder);

            await Promise.all(boards.map(async (board, index) => {
                board.order = index;
                await this._updateInStore(boardsStore, board);
            }));

            // if (this.cache) {
            //     this.cache.boards.sort((a, b) => a.order - b.order);
            // }
        } catch (error) {
            console.error('Failed to update board order:', error);
            throw error;
        }
    }

    /**
     * @param {string} boardId
     * @returns {Promise<ColumnData[]>}
     */
    async getColumns(boardId) {
        // if (!this.cache) {
        //     await this.getData();
        // }
        // if (!this.cache.boards) {
        //     return [];
        // }
        //
        // /** @type {BoardData | null} */
        // const board = this.cache.boards.find(b => b.id === boardId);
        // return board?.columns || [];

        /** @type {ColumnData[]} */
        const columns = await this.getData().then(data => (data.columns || []).filter(c => c.boardId === boardId));
        columns.sort(sortByOrder);
        return columns;
    }

    /**
     * @param {string} name
     * @param {string} boardId
     * @returns {Promise<ColumnData>}
     */
    async createColumn(name, boardId) {
        if (!name || !boardId) {
            throw new Error('Name and board ID are required');
        }

        const columnsStore = await this._getStore('columns', 'readwrite');
        const newColumn = {
            id: generateId('cl'),
            name: name,
            boardId: boardId,
            order: (await this._getFromIndex(columnsStore, 'boardId', boardId) || []).length
        }

        await this._addToStore(columnsStore, newColumn);

        // if (this.cache?.boards) {
        //     const board = this.cache.boards.find(b => b.id === column.boardId);
        //     if (board) {
        //         if (!board.columns) {
        //             board.columns = [];
        //         }
        //         board.columns.push(column);
        //     }
        // } else {
        //     await this.invalidateCache();
        // }

        return newColumn;
    }

    /**
     * @param {string} columnId
     * @param {Partial<ColumnData>} updates
     * @returns {Promise<ColumnData>}
     */
    async updateColumn(columnId, updates) {
        if (updates.tasks) {
            throw new Error('Tasks cannot be updated directly');
        }

        const store = await this._getStore('columns', 'readwrite');
        /** @type {ColumnData | null} */
        const column = await this._getFromStore(store, columnId);
        if (!column?.id) {
            throw new Error('Column not found: ' + columnId);
        }
        /** @type {ColumnData} */
        const updatedColumn = { ...column, ...updates };
        await this._updateInStore(store, updatedColumn);

        // if (this.cache?.boards) {
        //     const board = this.cache.boards.find(b => b.id === updatedColumn.boardId);
        //     if (board) {
        //         const index = board.columns.findIndex(c => c.id === columnId);
        //         if (index !== -1) {
        //             board.columns[index] = { ...board.columns[index], ...updates };
        //         } else {
        //             await this.invalidateCache();
        //         }
        //     } else {
        //         await this.invalidateCache();
        //     }
        // } else {
        //     await this.invalidateCache();
        // }

        return updatedColumn;
    }

    /**
     * @param {string} columnId
     * @returns {Promise<boolean>}
     */
    async deleteColumn(columnId) {
        const {
            columns: columnStore,
            tasks: taskStore
        } = this._getStores(['columns', 'tasks'], 'readwrite');

        try {
            // Удаляем колонку
            await this._deleteFromStore(columnStore, columnId);

            // Удаляем все задачи колонки
            const tasks = await this._getFromIndex(taskStore, 'columnId', columnId);
            await Promise.all(tasks.map(task =>
                this._deleteFromStore(taskStore, task.id)
            ));

            // if (this.cache?.boards) {
            //     const board = this.cache.boards.find(b => b.columns.some(c => c.id === columnId));
            //     if (board) {
            //         const index = board.columns.findIndex(c => c.id === columnId);
            //         if (index !== -1) {
            //             board.columns.splice(index, 1);
            //         }
            //     }
            // } else {
            //     await this.invalidateCache();
            // }

            return true;
        } catch (error) {
            console.error('Failed to delete column:', error);
            return false;
        }
    }

    /**
     * @param {string} boardId
     * @returns {Promise<boolean>}
     */
    async updateColumnOrder(boardId) {
        await this.initialize();
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const columnsStore = this._getStore('columns', 'readwrite');

        try {
            /** @type {ColumnData[]} */
            const columns = await this._getFromIndex(columnsStore, 'boardId', boardId);
            columns.sort(sortByOrder);

            await Promise.all(columns.map(async (column, index) => {
                column.order = index;
                await this._updateInStore(columnsStore, column);
            }));

            // if (this.cache?.boards) {
            //     const board = this.cache.boards.find(b => b.id === boardId);
            //     if (board) {
            //         board.columns.sort((a, b) => a.order - b.order);
            //     }
            // } else {
            //     await this.invalidateCache();
            // }

        } catch (error) {
            console.error('Failed to update column order:', error);
            throw error;
        }
    }

    /**
     *  @param {string} columnId
     *  @returns {Promise<TaskData[]>}
     **/
    async getTasks(columnId) {
        /** @type {TaskData[]} */
        const tasks = await this.getData().then(data => (data.tasks || []).filter(t => t.columnId === columnId && !t.parentId));
        tasks.sort(sortByOrder);
        return tasks;
    }

    /**
     * @param {string} parentId
     * @returns {Promise<TaskData[]>}
     */
    async getSubtasks(parentId) {
        /** @type {TaskData[]} */
        const tasks = await this.getData().then(data => (data.tasks || []).filter(t => t.parentId === parentId));
        tasks.sort(sortByOrder);
        return tasks;
    }

    /**
     * @param {TaskData} task
     * @returns {Promise<TaskData>}
     */
    async createTask(task) {
        if (!task) {
            throw new Error('Task data is required');
        }

        if (!task.columnId) {
            throw new Error('Column ID is required for task: ' + JSON.stringify(task));
        }

        if (task.subtasks) {
            throw new Error('Subtasks cannot be created directly');
        }

        const taskStore = await this._getStore('tasks', 'readwrite');
        await this._addToStore(taskStore, task);

        // if (this.cache?.boards) {
        //     const column = this.cache.boards
        //         .flatMap(b => b.columns)
        //         .find(c => c.id === task.columnId);
        //     if (column) {
        //         if (!column.tasks) {
        //             column.tasks = [];
        //         }
        //         column.tasks.push(task);
        //     } else {
        //         await this.invalidateCache();
        //     }
        // } else {
        //     await this.invalidateCache();
        // }

        return task;
    }

    /**
     * @param {string} taskId
     * @param {Partial<TaskData>} updates
     * @returns {Promise<TaskData>}
     */
    async updateTask(taskId, updates) {
        if (updates.subtasks) {
            throw new Error('Subtasks cannot be updated directly');
        }

        const taskStore = await this._getStore('tasks', 'readwrite');
        /** @type {TaskData | null} */
        const task = await this._getFromStore(taskStore, taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        /** @type {TaskData} */
        const updatedTask = { ...task, ...updates };
        await this._updateInStore(taskStore, updatedTask);

        // if (this.cache?.boards) {
        //     const column = this.cache.boards
        //         .flatMap(b => b.columns)
        //         .find(c => c.id === updatedTask.columnId);
        //     if (column) {
        //         const index = column.tasks.findIndex(t => t.id === taskId);
        //         if (index !== -1) {
        //             column.tasks[index] = updatedTask;
        //         } else {
        //             column.tasks.push(updatedTask);
        //         }
        //     } else {
        //         await this.invalidateCache();
        //     }
        // } else {
        //     await this.invalidateCache();
        // }

        return updatedTask;
    }

    /**
     *  @param {string} taskId
     *  @returns {Promise<boolean>}
     **/
    async deleteTask(taskId) {
        if (!taskId) {
            throw new Error('Task ID is required');
        }

        const taskStore = await this._getStore('tasks', 'readwrite');

        try {
            await this._deleteFromStore(taskStore, taskId);

            // if (this.cache?.boards) {
            //     const column = this.cache.boards
            //         .flatMap(b => b.columns)
            //         .find(c => c.tasks.some(t => t.id === taskId));
            //     if (column) {
            //         const index = column.tasks.findIndex(t => t.id === taskId);
            //         if (index !== -1) {
            //             column.tasks.splice(index, 1);
            //         } else {
            //             await this.invalidateCache();
            //         }
            //     } else {
            //         await this.invalidateCache();
            //     }
            // } else {
            //     await this.invalidateCache();
            // }

            return true;
        } catch (error) {
            console.error('Failed to delete task:', error);
            return false;
        }
    }

    /**
     * @param {string} taskId
     * @param {string} newColumnId
     * @param {number} newOrder
     * @param {string} newParentId
     * @returns {Promise<TaskData>}
     */
    async moveTask(taskId, newColumnId, newOrder, newParentId) {
        const taskStore = await this._getStore('tasks', 'readwrite');

        try {
            // Получаем задачу и все задачи в новой колонке
            /** @type {TaskData | null} */
            const task = await this._getFromStore(taskStore, taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const oldColumnId = task.columnId;
            /** @type {TaskData[]} */
            const oldColumnTasks = await this._getFromIndex(taskStore, 'columnId', oldColumnId) || [];
            oldColumnTasks.sort(sortByOrder);
            /** @type {TaskData[]} */
            const newColumnTasks = await this._getFromIndex(taskStore, 'columnId', newColumnId) || [];
            newColumnTasks.sort(sortByOrder);

            // Обновляем порядок в старой колонке
            /** @type {TaskData[]} */
            const remainingTasks = oldColumnTasks.filter(t => t.id !== taskId);

            await Promise.all(remainingTasks.map((t, index) => {
                t.order = index;
                return this._updateInStore(taskStore, t);
            }));

            // Обновляем задачу и вставляем её в новую позицию
            task.columnId = newColumnId;
            task.order = newOrder;
            await this._updateInStore(taskStore, task);

            // Обновляем порядок в новой колонке
            const tasksToUpdate = newColumnTasks.filter(t => t.id !== taskId && t.order >= newOrder);
            await Promise.all(tasksToUpdate.map(t => {
                t.order = t.order + 1;
                return this._updateInStore(taskStore, t);
            }));

            // if (this.cache?.boards) {
            //     const oldColumn = this.cache.boards
            //         .flatMap(b => b.columns)
            //         .find(c => c.id === oldColumnId);
            //     const newColumn = this.cache.boards
            //         .flatMap(b => b.columns)
            //         .find(c => c.id === newColumnId);
            //     if (oldColumn && newColumn) {
            //         const oldIndex = oldColumn.tasks.findIndex(t => t.id === taskId);
            //         const newIndex = newColumn.tasks.findIndex(t => t.id === taskId);
            //         if (oldIndex !== -1) {
            //             oldColumn.tasks.splice(oldIndex, 1);
            //         }
            //         if (newIndex === -1) {
            //             newColumn.tasks.splice(newOrder, 0, task);
            //         } else {
            //             newColumn.tasks[newIndex] = task;
            //         }
            //     } else {
            //         await this.invalidateCache();
            //     }
            // } else {
            //     await this.invalidateCache();
            // }

            return task;
        } catch (error) {
            console.error('Failed to move task:', error);
            throw error;
        }
    }

    /**
     * @param {string} columnId
     */
    async updateTaskOrder(columnId) {
        await this.initialize();
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const taskStore = this._getStore('tasks', 'readwrite');

        try {
            /** @type {TaskData[]} */
            const tasks = await this._getFromIndex(taskStore, 'columnId', columnId);
            tasks.sort(sortByOrder);

            await Promise.all(tasks.map(async (task, index) => {
                task.order = index;
                await this._updateInStore(taskStore, task);
            }));

            // if (this.cache?.boards) {
            //     const column = this.cache.boards
            //         .flatMap(b => b.columns)
            //         .find(c => c.id === columnId);
            //     if (column) {
            //         column.tasks.sort((a, b) => a.order - b.order);
            //     }
            // } else {
            //     await this.invalidateCache();
            // }
            //
            // await this.invalidateCache();
        } catch (error) {
            console.error('Failed to update task order:', error);
            throw error;
        }
    }


    /**
     * @returns {Promise<AppSettings>}
     */
    async getSettings() {
        // if (!this.cache) {
        //     await this.getData();
        // }
        // return {
        //     selectedBoardId: this.cache.selectedBoardId,
        //     isCalendarView: this.cache.isCalendarView
        // };

        return this.getData().then(data => ({
            selectedBoardId: data.selectedBoardId,
            isCalendarView: data.isCalendarView
        }));
    }

    /**
     * @param {Partial<AppSettings>} settings
     * @returns {Promise<AppSettings>}
     */
    async updateSettings(settings) {
        /** @type {AppSettings} */
        const updatedSettings = { id: 'app', ...settings };

        const settingsStore = await this._getStore('settings', 'readwrite');

        await this._updateInStore(settingsStore, updatedSettings);

        // if (this.cache) {
        //     this.cache.selectedBoardId = settings.selectedBoardId;
        //     this.cache.isCalendarView = settings.isCalendarView;
        // } else {
        //     await this.invalidateCache();
        // }

        return updatedSettings;
    }

    async invalidateCache() {
        // this.cache = null;
        throw new Error('Not implemented');
    }

    async clearCache() {
        // await this.invalidateCache();
        throw new Error('Not implemented');
    }
}

function sortByOrder(a, b) {
    return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
}