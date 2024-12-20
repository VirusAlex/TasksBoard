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

export function showLinkDialog() {
  const dialog = document.getElementById('link-dialog');
  const form = dialog.querySelector('form');
  const urlInput = document.getElementById('link-url');
  const textInput = document.getElementById('link-text');
  const description = document.getElementById('task-description');

  form.reset();

  const selectedText = description.value.substring(
    description.selectionStart,
    description.selectionEnd
  );
  if (selectedText) {
    textInput.value = selectedText;
  }

  dialog.showModal();

  return new Promise(resolve => {
    const handleClose = () => {
      dialog.removeEventListener('close', handleClose);
      form.removeEventListener('submit', handleSubmit);
      resolve(null);
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      const url = urlInput.value;
      const text = textInput.value || url;
      dialog.removeEventListener('close', handleClose);
      form.removeEventListener('submit', handleSubmit);
      dialog.close();
      resolve({ url, text });
    };

    dialog.addEventListener('close', handleClose);
    form.addEventListener('submit', handleSubmit);
  });
} 