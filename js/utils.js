   // Генерация простых ID
export function generateId() {
    return 'id-' + Math.random().toString(36).substr(2, 9);
}
  
  // Функция для форматирования даты и времени
export function formatDateTime(isoString) {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Форматируем время
    const time = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Определяем, как показывать дату
    if (date.toDateString() === today.toDateString()) {
      return `сегодня в ${time}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `вчера в ${time}`;
    } else {
      return `${date.toLocaleDateString('ru-RU')} в ${time}`;
    }
}

  // Функция для форматирования оставшегося времени
export function formatTimeLeft(targetTime) {
    const now = new Date();
    const target = new Date();
    const [hours, minutes] = targetTime.split(':');
    target.setHours(hours, minutes, 0, 0);
    
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    
    const diff = target - now;
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
      return `↻ ${hoursLeft}ч ${minutesLeft}м`;
    }
    return `↻ ${minutesLeft}м`;
}

  // Обновляем функцию форматирования времени
export function formatDeadlineTime(date) {
    const now = new Date();
    const target = new Date(date);

    const diff = Math.abs(target - now);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const postfix = target <= now ? " назад" : "";

    if (days > 0) {
      return `${days}д ${hours}ч${postfix}`;
    }
    if (hours > 0) {
      return `${hours}ч ${minutes}м${postfix}`;
    }
    return `${minutes}м${postfix}`;
}