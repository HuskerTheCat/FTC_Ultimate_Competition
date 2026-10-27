// The Find tab: where each teammate is at the competition. Everyone checks in by tapping a place or typing a message,
// and can ask one teammate or the whole team where they are. Answering a question is just checking in.
import { esc } from './ui.js';

export const PLACES = { pits: 'Pits', stands: 'Stands', queue: 'Queue', field: 'Field', practice: 'Practice field' };

// Set by the app (main.js): where pages and dialogs go, the backend, the team's data and how to show errors.
let ui;
export function startFind(context) {
  ui = context;
  // Keeps "5 min ago" current while the tab is open.
  setInterval(() => { if (ui.page?.querySelector('#teammate-list')) showFind(); }, 30000);
}

const nameOf = (uid) => {
  const member = ui.state.members.find((m) => m.uid === uid);
  return member?.name || member?.email.split('@')[0] || 'Someone';
};
const checkInOf = (uid) => ui.state.checkIns.find((c) => c.uid === uid);

// The latest question to `uid` that they haven't answered with a check-in since, or undefined.
export function openPingTo(uid) {
  const ping = ui.state.pings.find((p) => p.uid === uid);
  return ping && !(checkInOf(uid)?.at > ping.at) ? ping : undefined;
}

function ago(at) {
  const minutes = Math.floor((Date.now() - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : 'over a day ago';
}

const spotText = (checkIn) => [PLACES[checkIn.place], checkIn.note].filter(Boolean).join(' · ');

export function renderFind() {
  ui.page.innerHTML = `
    <div class="row"><h1>Find my team</h1><button id="ask-all" class="secondary">Ask everyone</button></div>
    <section class="card">
      <h2>Where are you?</h2>
      <p id="asked-me" class="asked" hidden></p>
      <div id="places" class="places">${Object.entries(PLACES).map(([id, label]) => `<button class="secondary" data-place="${id}">${label}</button>`).join('')}</div>
      <form id="note-form" class="password">
        <input name="note" maxlength="100" placeholder="Add a message" aria-label="Message" />
        <button>Send</button>
      </form>
      <p id="my-spot" class="muted small"></p>
    </section>
    <section class="card"><ul id="teammate-list" class="members"></ul></section>`;

  const form = ui.page.querySelector('#note-form');
  // A place goes with whatever message is typed; Send sends the message on its own.
  const checkIn = (place) => {
    const note = form.note.value.trim();
    if (!place && !note) return ui.showError(new Error('Tap a place or type a message.'));
    ui.fb.checkIn({ place, note }, ui.showError);
    form.note.value = '';
  };
  ui.page.querySelector('#places').onclick = (e) => {
    const button = e.target.closest('[data-place]');
    if (button) checkIn(button.dataset.place);
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    checkIn('');
  };
  ui.page.querySelector('#ask-all').onclick = () => {
    const others = ui.state.members.filter((m) => m.uid !== ui.state.user.uid).map((m) => m.uid);
    if (!others.length) return ui.showError(new Error('Nobody else is on the team yet.'));
    ui.fb.ping(others, ui.showError);
  };
  ui.page.querySelector('#teammate-list').onclick = (e) => {
    const button = e.target.closest('[data-ask]');
    if (button) ui.fb.ping([button.dataset.ask], ui.showError);
  };
  showFind();
}

// Redraws the tab for teammates' check-ins and questions (main.js).
export function showFind() {
  const me = ui.state.user.uid;
  const mine = checkInOf(me);
  const asked = openPingTo(me);
  const askedMe = ui.page.querySelector('#asked-me');
  askedMe.hidden = !asked;
  if (asked) askedMe.textContent = `${nameOf(asked.from)} asked where you are ${ago(asked.at)}. Tap a place or send a message to answer.`;
  for (const button of ui.page.querySelectorAll('[data-place]')) button.setAttribute('aria-pressed', String(mine?.place === button.dataset.place));
  ui.page.querySelector('#my-spot').textContent = mine ? `You: ${spotText(mine)} · ${ago(mine.at)}` : 'You haven’t checked in yet.';

  // Latest check-in first; teammates who never checked in last.
  const teammates = ui.state.members.filter((m) => m.uid !== me)
    .sort((a, b) => (checkInOf(b.uid)?.at ?? 0) - (checkInOf(a.uid)?.at ?? 0));
  ui.page.querySelector('#teammate-list').innerHTML = teammates.length ? teammates.map((m) => {
    const spot = checkInOf(m.uid);
    const ping = openPingTo(m.uid);
    return `<li>
      <span class="whereabouts"><strong>${esc(nameOf(m.uid))}</strong>
        ${spot ? `<span>${esc(spotText(spot))} <span class="muted small">${ago(spot.at)}</span></span>` : '<span class="muted small">No check-in yet</span>'}
        ${ping ? `<span class="small asked-line">Asked ${ago(ping.at)}</span>` : ''}</span>
      <button class="secondary" data-ask="${esc(m.uid)}">${ping ? 'Ask again' : 'Ask'}</button>
    </li>`;
  }).join('') : '<li class="muted">Invite teammates from the ☰ menu’s Team page to see where they are.</li>';
}

// The banner on every other tab while someone is waiting for this member's answer.
export function showPingBanner(banner, onFindTab) {
  const asked = openPingTo(ui.state.user.uid);
  banner.hidden = !asked || onFindTab;
  if (asked) banner.textContent = `${nameOf(asked.from)} asked where you are. Tap to answer`;
}
