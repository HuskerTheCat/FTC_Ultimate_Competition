// Small helpers every screen uses.

// Text made safe to put in HTML.
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Asks before something that can't be undone, in the page's dialog. `onConfirm` runs only when the action is chosen,
// `onCancel` (if given) when the dialog is closed any other way.
export function confirmDialog(dialog, { title, text, action }, onConfirm, onCancel = null) {
  dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>${esc(title)}</h2>
      <p class="muted">${esc(text)}</p>
      <div class="row">
        <button class="secondary">Cancel</button>
        <button type="button" id="confirm-action" class="danger">${esc(action)}</button>
      </div>
    </form>`;
  let confirmed = false;
  dialog.querySelector('#confirm-action').onclick = () => {
    confirmed = true;
    dialog.close();
    onConfirm();
  };
  dialog.addEventListener('close', () => { if (!confirmed) onCancel?.(); }, { once: true });
  dialog.showModal();
}

// Small line icons that take the button's text color.
export const icon = (paths) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export const ICON_SCAN = icon('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>');
export const ICON_CHEVRON = icon('<path d="m6 9 6 6 6-6"/>');
export const ICON_TROPHY = icon('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>');
export const ICON_PLAY = icon('<path d="m7 4 13 8-13 8Z"/>');
export const ICON_CLIPBOARD = icon('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>');

// A button that opens a menu next to it, inside one .menuwrap. A tap outside or Escape closes it. Returns show(open).
export function wireMenu(toggle, menu) {
  const show = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.onclick = () => show(menu.hidden);
  const close = (e) => {
    // The menu was replaced by a new screen: stop listening.
    if (!toggle.isConnected) {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    } else if (e.type === 'keydown' ? e.key === 'Escape' : !toggle.parentElement.contains(e.target)) show(false);
  };
  document.addEventListener('pointerdown', close);
  document.addEventListener('keydown', close);
  return show;
}
