// "Copy email": calls the Clipboard API only on explicit activation and reports
// the real outcome. The address and mailto link work without it.

export function initContact(cfg) {
  const button = document.querySelector('.copy-email');
  const status = document.querySelector('.copy-status');
  if (!button || !status) return;
  const L = cfg.labels.contact;
  let timer = 0;

  button.addEventListener('click', async () => {
    clearTimeout(timer);
    button.classList.remove('is-copied');
    status.textContent = '';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(button.dataset.email);
      button.classList.add('is-copied');
      status.textContent = L.copied;
    } catch {
      status.textContent = L.copyFailed;
    }
    timer = setTimeout(() => { button.classList.remove('is-copied'); status.textContent = ''; }, 4000);
  });
  button.hidden = false;
}
