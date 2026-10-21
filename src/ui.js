// Small helpers every screen uses.

// Text made safe to put in HTML.
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Asks before something that can't be undone, in the page's dialog. `onConfirm` runs only when the action is chosen.
export function confirmDialog(dialog, { title, text, action }, onConfirm) {
  dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>${esc(title)}</h2>
      <p class="muted">${esc(text)}</p>
      <div class="row">
        <button class="secondary">Cancel</button>
        <button type="button" id="confirm-action" class="danger">${esc(action)}</button>
      </div>
    </form>`;
  dialog.querySelector('#confirm-action').onclick = () => {
    dialog.close();
    onConfirm();
  };
  dialog.showModal();
}
