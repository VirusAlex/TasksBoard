export const defaultTaskColors = {
  pending: '#f1c40f',
  info: '#3498db',
  done: '#2ecc71'
};

export const darkThemeTaskColors = {
  pending: '#f39c12',
  info: '#2980b9',
  done: '#27ae60'
};

export function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  
  // Загружаем сохраненную тему
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    themeToggle.querySelector('span').textContent = '☀️';
  } else {  
    themeToggle.querySelector('span').textContent = '🌙';
  }

  // Обработчик переключения темы
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.querySelector('span').textContent = isDark ? '☀️' : '🌙';
  });

  return {
    isDarkTheme: () => document.body.classList.contains('dark-theme')
  };
} 