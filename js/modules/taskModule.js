// Модуль для работы с задачами
import { generateId } from '../utils.js';

// Базовые операции с задачами
export function createTask(columnId, taskData) {
    // Базовая реализация будет добавлена позже
}

export function updateTask(taskId, taskData) {
    // Базовая реализация будет добавлена позже
}

export function deleteTask(taskId) {
    // Базовая реализация будет добавлена позже
}

// Функции для работы с подзадачами
export function makeSubtask(parentTaskId, subtaskId) {
    // Базовая реализация будет добавлена позже
}

export function collectSubtasks(taskId) {
    // Базовая реализация будет добавлена позже
    return [];
}

export function isTaskAncestor(potentialAncestorId, taskId) {
    // Базовая реализация будет добавлена позже
    return false;
} 