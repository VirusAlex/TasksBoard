export function hexToRGB(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export function findParentByClass(element, className) {
  let current = element;
  while (current && !current.classList.contains(className)) {
    current = current.parentElement;
  }
  return current;
}

export function updateLineNumbers(textarea) {
  const lineNumbers = textarea.closest('.description-container').querySelector('.line-numbers');
  
  const lines = textarea.value.split('\n');
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
    
    numbers.push(lineNumber);
    for (let i = 2; i < visualLines; i++) {
      numbers.push('');
    }
    lineNumber++;
  });

  document.body.removeChild(tempDiv);
  lineNumbers.textContent = numbers.join('\n');
  lineNumbers.scrollTop = textarea.scrollTop;
}

export function initSidebar() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  sidebarToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
    sidebar.classList.toggle('open');
  });

  backdrop.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
    sidebar.classList.remove('open');
  });
} 