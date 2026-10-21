// An on-screen number pad for team and match numbers, so the phone's keyboard never opens and the page doesn't jump.
// Inputs with data-numpad="<title>" get no keyboard and open the pad when tapped; a computer's keys work on the pad too.
import { esc } from './ui.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0'];

let pad;

export function wireNumpads(root) {
  for (const input of root.querySelectorAll('input[data-numpad]')) {
    input.inputMode = 'none';
    input.onclick = () => openPad(input);
  }
}

// The new number goes into the input when the pad closes, with an input event so the page can react to it. Like a
// selected field, the first digit typed replaces the old number; Backspace edits it instead.
function openPad(input) {
  pad ??= document.body.appendChild(Object.assign(document.createElement('dialog'), { className: 'numpad' }));
  let value = input.value;
  let fresh = true;
  pad.innerHTML = `
    <form method="dialog">
      <div class="row"><span class="muted">${esc(input.dataset.numpad)}</span><output>${esc(value)}</output></div>
      <div class="keys">${KEYS.map((key) => key === 'back'
        ? '<button type="button" class="secondary" data-key="back" aria-label="Delete">⌫</button>'
        : `<button type="button" class="secondary" data-key="${key}">${key}</button>`).join('')}
        <button>Done</button>
      </div>
    </form>`;
  const output = pad.querySelector('output');
  const press = (key) => {
    if (fresh && key !== 'back') value = '';
    fresh = false;
    if (key === 'back') value = value.slice(0, -1);
    else if (value.length < input.maxLength && !(key === '0' && !value)) value += key;
    output.textContent = value;
  };
  pad.querySelector('.keys').onclick = (e) => {
    const key = e.target.closest('[data-key]')?.dataset.key;
    if (key) press(key);
  };
  pad.onkeydown = (e) => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') {
      e.preventDefault();
      pad.close();
    }
  };
  pad.onclose = () => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  pad.showModal();
}
