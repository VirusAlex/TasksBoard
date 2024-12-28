import { DataProvider } from './dataProvider.js';

export class ServerDataProvider extends DataProvider {
    constructor(serverUrl, accessToken) {
        super();
        this.serverUrl = serverUrl;
        this.accessToken = accessToken;
        this.cache = {
            boards: null,
            settings: null
        };
    }

    async _fetchWithAuth(endpoint, options = {}) {
        const url = `${this.serverUrl}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch from ${endpoint}:`, error);
            throw error;
        }
    }

    async getData() {
        try {
            const data = await this._fetchWithAuth('/api/data');
            
            // Убеждаемся, что у всех элементов есть поле order
            if (Array.isArray(data.boards)) {
                data.boards.forEach((board, boardIndex) => {
                    board.order = board.order ?? boardIndex;
                    if (Array.isArray(board.columns)) {
                        board.columns.forEach((column, columnIndex) => {
                            column.order = column.order ?? columnIndex;
                            if (Array.isArray(column.tasks)) {
                                column.tasks.forEach((task, taskIndex) => {
                                    task.order = task.order ?? taskIndex;
                                });
                                column.tasks.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
                            }
                        });
                        board.columns.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
                    }
                });
                data.boards.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
            }

            return data;
        } catch (error) {
            console.error('Failed to get data from server:', error);
            return {
                selectedBoardId: null,
                isCalendarView: false,
                boards: []
            };
        }
    }

    async saveData(data) {
        try {
            // Убеждаемся, что у всех элементов есть поле order перед сохранением
            if (Array.isArray(data.boards)) {
                data.boards.forEach((board, boardIndex) => {
                    board.order = boardIndex;
                    if (Array.isArray(board.columns)) {
                        board.columns.forEach((column, columnIndex) => {
                            column.order = columnIndex;
                            if (Array.isArray(column.tasks)) {
                                column.tasks.forEach((task, taskIndex) => {
                                    task.order = taskIndex;
                                });
                            }
                        });
                    }
                });
            }

            await this._fetchWithAuth('/api/data', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            await this.invalidateCache();
            return true;
        } catch (error) {
            console.error('Failed to save data to server:', error);
            return false;
        }
    }

    async updateBoardOrder(boardIds) {
        try {
            const data = await this.getData();
            const boardsMap = new Map(data.boards.map(b => [b.id, b]));
            
            data.boards = boardIds.map((id, index) => {
                const board = boardsMap.get(id);
                if (board) {
                    board.order = index;
                    return board;
                }
            }).filter(Boolean);

            await this.saveData(data);
            return true;
        } catch (error) {
            console.error('Failed to update board order:', error);
            return false;
        }
    }

    async updateColumnOrder(boardId, columnIds) {
        try {
            const data = await this.getData();
            const board = data.boards.find(b => b.id === boardId);
            if (!board) return false;

            const columnsMap = new Map(board.columns.map(c => [c.id, c]));
            board.columns = columnIds.map((id, index) => {
                const column = columnsMap.get(id);
                if (column) {
                    column.order = index;
                    return column;
                }
            }).filter(Boolean);

            await this.saveData(data);
            return true;
        } catch (error) {
            console.error('Failed to update column order:', error);
            return false;
        }
    }

    async updateTaskOrder(columnId, taskIds) {
        try {
            const data = await this.getData();
            const column = data.boards.flatMap(b => b.columns).find(c => c.id === columnId);
            if (!column) return false;

            const tasksMap = new Map(column.tasks.map(t => [t.id, t]));
            column.tasks = taskIds.map((id, index) => {
                const task = tasksMap.get(id);
                if (task) {
                    task.order = index;
                    return task;
                }
            }).filter(Boolean);

            await this.saveData(data);
            return true;
        } catch (error) {
            console.error('Failed to update task order:', error);
            return false;
        }
    }

    async moveTask(taskId, newColumnId, newOrder) {
        try {
            const data = await this.getData();
            let task = null;
            let oldColumn = null;

            // Находим задачу и её старую колонку
            for (const board of data.boards) {
                for (const column of board.columns) {
                    const foundTask = column.tasks.find(t => t.id === taskId);
                    if (foundTask) {
                        task = foundTask;
                        oldColumn = column;
                        break;
                    }
                }
                if (task) break;
            }

            if (!task || !oldColumn) return false;

            // Находим новую колонку
            const newColumn = data.boards.flatMap(b => b.columns).find(c => c.id === newColumnId);
            if (!newColumn) return false;

            // Удаляем задачу из старой колонки и обновляем порядок
            oldColumn.tasks = oldColumn.tasks.filter(t => t.id !== taskId);
            oldColumn.tasks.forEach((t, index) => t.order = index);

            // Добавляем задачу в новую колонку и обновляем порядок
            task.order = newOrder;
            newColumn.tasks.splice(newOrder, 0, task);
            newColumn.tasks.forEach((t, index) => t.order = index);

            await this.saveData(data);
            return true;
        } catch (error) {
            console.error('Failed to move task:', error);
            return false;
        }
    }

    async invalidateCache() {
        this.cache = {
            boards: null,
            settings: null
        };
    }
} 