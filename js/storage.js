// Константы для конфигурации
const DB_NAME = 'TasksBoard';
const DB_VERSION = 1;
const STORAGE_KEY = 'taskBoardsData';

// Класс для работы с данными
class StorageManager {
  constructor() {
    this.isIndexedDBSupported = this._checkIndexedDBSupport();
    this._initStorage();
  }

  // Проверка поддержки IndexedDB
  _checkIndexedDBSupport() {
    try {
      return 'indexedDB' in window && indexedDB !== null;
    } catch (e) {
      console.warn('IndexedDB is not supported:', e);
      return false;
    }
  }

  // Инициализация хранилища
  async _initStorage() {
    if (this.isIndexedDBSupported) {
      try {
        await this._initIndexedDB();
      } catch (e) {
        console.warn('Failed to initialize IndexedDB, falling back to localStorage:', e);
        this.isIndexedDBSupported = false;
      }
    }
  }

  // Инициализация IndexedDB
  async _initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Создаем хранилище для досок
        if (!db.objectStoreNames.contains('boards')) {
          const boardsStore = db.createObjectStore('boards', { keyPath: 'id' });
          boardsStore.createIndex('name', 'name', { unique: false });
        }

        // Создаем хранилище для задач
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('boardId', 'boardId', { unique: false });
          tasksStore.createIndex('columnId', 'columnId', { unique: false });
          tasksStore.createIndex('parentId', 'parentId', { unique: false });
          tasksStore.createIndex('deadline', 'deadline', { unique: false });
        }

        // Создаем хранилище для настроек
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // Получение данных
  async getData() {
    if (this.isIndexedDBSupported) {
      try {
        return await this._getDataFromIndexedDB();
      } catch (e) {
        console.warn('Failed to get data from IndexedDB, falling back to localStorage:', e);
        return this._getDataFromLocalStorage();
      }
    }
    return this._getDataFromLocalStorage();
  }

  // Сохранение данных
  async saveData(data) {
    if (this.isIndexedDBSupported) {
      try {
        await this._saveDataToIndexedDB(data);
      } catch (e) {
        console.warn('Failed to save data to IndexedDB, falling back to localStorage:', e);
        this._saveDataToLocalStorage(data);
      }
    } else {
      this._saveDataToLocalStorage(data);
    }
  }

  // Получение данных из localStorage
  _getDataFromLocalStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to get data from localStorage:', e);
      return null;
    }
  }

  // Сохранение данных в localStorage
  _saveDataToLocalStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save data to localStorage:', e);
      throw e;
    }
  }

  // Получение данных из IndexedDB
  async _getDataFromIndexedDB() {
    const data = {
      boards: [],
      selectedBoardId: null,
      isCalendarView: false
    };

    // Получаем настройки
    const settings = await this._getAllFromStore('settings');
    const selectedBoard = settings.find(s => s.key === 'selectedBoardId');
    const calendarView = settings.find(s => s.key === 'isCalendarView');

    if (selectedBoard) data.selectedBoardId = selectedBoard.value;
    if (calendarView) data.isCalendarView = calendarView.value;

    // Получаем доски
    data.boards = await this._getAllFromStore('boards');

    // Получаем задачи для каждой доски
    for (const board of data.boards) {
      for (const column of board.columns) {
        const tasks = await this._getTasksByIndex('columnId', column.id);
        column.tasks = tasks;
      }
    }

    return data;
  }

  // Сохранение данных в IndexedDB
  async _saveDataToIndexedDB(data) {
    const transaction = this.db.transaction(['boards', 'tasks', 'settings'], 'readwrite');
    const boardsStore = transaction.objectStore('boards');
    const tasksStore = transaction.objectStore('tasks');
    const settingsStore = transaction.objectStore('settings');

    // Сохраняем настройки
    await this._putToStore(settingsStore, { key: 'selectedBoardId', value: data.selectedBoardId });
    await this._putToStore(settingsStore, { key: 'isCalendarView', value: data.isCalendarView });

    // Очищаем старые данные
    await this._clearStore(boardsStore);
    await this._clearStore(tasksStore);

    // Сохраняем доски и задачи
    for (const board of data.boards) {
      const boardCopy = { ...board };
      delete boardCopy.columns; // Удаляем колонки из копии доски
      await this._putToStore(boardsStore, boardCopy);

      for (const column of board.columns) {
        for (const task of column.tasks) {
          const taskCopy = { ...task, boardId: board.id, columnId: column.id };
          await this._putToStore(tasksStore, taskCopy);
        }
      }
    }
  }

  // Вспомогательные методы для работы с IndexedDB
  async _getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async _getTasksByIndex(indexName, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('tasks', 'readonly');
      const store = transaction.objectStore('tasks');
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async _putToStore(store, item) {
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve(request.result);
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
}

// Экспортируем экземпляр класса
const storageManager = new StorageManager();
export default storageManager; 