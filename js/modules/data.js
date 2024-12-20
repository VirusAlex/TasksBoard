import { showConfirmDialog } from './dialogs.js';

export function initDataHandlers(data, saveData, render) {
  function exportData() {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks-board-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        if (!validateImportedData(importedData)) {
          throw new Error('Invalid data format');
        }
        
        const confirmed = await showConfirmDialog(
          'Это действие заменит все текущие данные. Продолжить?'
        );
        
        if (confirmed) {
          Object.assign(data, importedData);
          saveData();
          render();
        }
      } catch (err) {
        alert('Ошибка при импорте данных: ' + err.message);
      }
    };
    
    reader.readAsText(file);
  }

  function validateImportedData(importedData) {
    if (!importedData || typeof importedData !== 'object') return false;
    if (!Array.isArray(importedData.boards)) return false;
    
    for (const board of importedData.boards) {
      if (!board.id || !board.name || !Array.isArray(board.columns)) return false;
      
      for (const column of board.columns) {
        if (!column.id || !column.name || !Array.isArray(column.tasks)) return false;
        
        for (const task of column.tasks) {
          if (!task.id || !task.title) return false;
        }
      }
    }
    
    return true;
  }

  function setupImportExportHandlers() {
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input');
    
    if (exportBtn) {
      exportBtn.addEventListener('click', exportData);
    }
    
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.click();
      });
      
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          importData(file);
          importInput.value = '';
        }
      });
    }
  }

  return {
    exportData,
    importData,
    setupImportExportHandlers
  };
} 