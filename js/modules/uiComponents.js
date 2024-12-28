// UI компоненты и утилиты для работы с интерфейсом

// Функции для работы с диалогами
export async function showConfirmDialog(message) {
    const dialog = document.getElementById('confirm-dialog');
    const messageEl = dialog.querySelector('#confirm-message');
    messageEl.textContent = message;

    dialog.showModal();

    return new Promise((resolve) => {
        dialog.addEventListener('close', () => {
            resolve(dialog.returnValue === 'confirm');
        }, { once: true });
    });
}

// Функции форматирования текста
export function formatDescription(text) {
    if (!text) return '';

    // Сначала обрабатываем Markdown-ссылки [text](url)
    let formatted = text.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Затем обрабатываем простые URL, исключая уже обработанные в тегах <a>
    formatted = formatted.replace(
        /(?<!["=])(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return formatted;
}

// Функция для рендеринга текста со ссылками
export function renderLinkedText(container, text, className = '') {
    container.className = className;
    container.innerHTML = formatDescription(text);
}

// Утилиты для работы с цветами
export function hexToRGB(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    // Убираем # если есть
    hex = hex.replace('#', '');

    // Парсим значения RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
}

// Функция для обновления номеров строк в текстовом редакторе
export function updateLineNumbers() {
    const textarea = document.getElementById('task-description');
    const lineNumbers = textarea.closest('.description-container').querySelector('.line-numbers');

    // Разбиваем текст на строки по реальным переносам
    const lines = textarea.value.split('\n');

    // Создаем массив номеров, где для каждой строки считаем её визуальную высоту
    const numbers = [];
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        word-wrap: break-word;
        width: ${textarea.clientWidth}px;
        font-family: ${getComputedStyle(textarea).fontFamily};
        font-size: ${getComputedStyle(textarea).fontSize};
        line-height: ${getComputedStyle(textarea).lineHeight};
        padding: ${getComputedStyle(textarea).padding};
    `;
    document.body.appendChild(tempDiv);

    let lineNumber = 1;
    lines.forEach(line => {
        tempDiv.textContent = line;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        const visualLines = Math.ceil(tempDiv.clientHeight / lineHeight);

        // Добавляем номер только для первой визуальной строки
        numbers.push(lineNumber);
        // Для остальных визуальных строк добавляем пустые строки
        for (let i = 2; i < visualLines; i++) {
            numbers.push('');
        }
        lineNumber++;
    });

    document.body.removeChild(tempDiv);

    // Обновляем содержимое
    lineNumbers.textContent = numbers.join('\n');

    // Синхронизируем скролл
    lineNumbers.scrollTop = textarea.scrollTop;
} 