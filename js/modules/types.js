/**
 * @typedef {Object} TaskData
 * @property {string} id ID задачи
 * @property {string} title Заголовок задачи
 * @property {string} description Описание задачи
 * @property {boolean} done Выполнена ли задача
 * @property {string | null} doneDate Дата выполнения задачи
 * @property {string | null} deadline Дедлайн задачи
 * @property {boolean} repeating Повторяется ли задача
 * @property {string | null} resetTime Время сброса задачи
 * @property {string | null} columnId ID колонки, в которой находится задача. Если задача находится в родительской задаче, то null
 * @property {string | null} parentId ID родительской задачи. Если задача находится в колонке, то null
 * @property {boolean} isInfo Является ли задача информационной
 * @property {boolean} collapsed Свернута ли задача
 * @property {string | null} color Цвет задачи
 * @property {string | null} doneColor Цвет выполненной задачи
 * @property {number} order Порядок задачи в колонке или в родительской задаче
 */

/**
 * @typedef {Object} ColumnData
 * @property {string} id ID колонки
 * @property {string} name Название колонки
 * @property {string} boardId ID доски, на которой находится колонка
 * @property {number} order Порядок колонки
 */

/**
 * @typedef {Object} BoardData
 * @property {string} id ID доски
 * @property {string} name Название доски
 * @property {number} order Порядок доски
 */

/**
 * @typedef {Object} AppData
 * @extends AppSettings
 * @property {BoardData[] | null} boards Массив досок
 * @property {ColumnData[] | null} columns Массив колонок
 * @property {TaskData[] | null} tasks Массив задач
 */

/**
 * @typedef {Object} AppSettings
 * @property {string | null} selectedBoardId ID выбранной доски
 * @property {boolean} isCalendarView Показывается ли календарь
 */

export {};