// The Scout tab: the matches the team has scouted, and the tap counters for scouting 1 to 4 teams in a match.
// Each team's result is its own doc, so scouts watching the same match never overwrite each other.
import season from './seasons/2027.js';
import { esc } from './ui.js';
import { openPitForm } from './pits.js';

const PERIODS = { auto: 'Auto', teleop: 'Teleop' };
const SLOTS = [['red', 'Red 1'], ['red', 'Red 2'], ['blue', 'Blue 1'], ['blue', 'Blue 2']];
// Which alliance this device's scout watches. Usually two scouts split a match, one per alliance; saved on this device.
const SIDES = { both: 'Both', red: 'Red', blue: 'Blue' };
const SIDE_KEY = 'ftc-scout-side';

// Set by the app (main.js): where pages and dialogs go, the backend, the team's data and how to show errors.
let ui;
export const startScouting = (context) => { ui = context; };

// ---------- points ----------
// Counts are { auto: { id: taps }, teleop: { id: taps } }, where id is a season action, a foul, or a custom button's id.

export const labelOf = (id, buttons) =>
  [...season.actions, ...season.fouls, ...buttons].find((b) => b.id === id)?.label ?? 'Deleted button';

// Points scored in each period, and foul points given to the other alliance.
export function matchPoints(counts, buttons) {
  const points = { auto: 0, teleop: 0, fouls: 0 };
  for (const period of Object.keys(PERIODS)) {
    for (const [id, taps] of Object.entries(counts[period])) {
      const foul = season.fouls.find((f) => f.id === id);
      const action = season.actions.find((a) => a.id === id);
      if (foul) points.fouls += taps * foul.points;
      else points[period] += taps * (action ? action.points[period] : buttons.find((b) => b.id === id)?.points ?? 0);
    }
  }
  return points;
}

export const pointsText = ({ auto, teleop, fouls }) =>
  `${auto + teleop} points (auto ${auto}, teleop ${teleop})${fouls ? ` · gave ${fouls} in fouls` : ''}`;

// ---------- list ----------

export function renderScoutList() {
  const matches = [...ui.state.matches].sort((a, b) => b.match - a.match || a.team - b.team);
  ui.page.innerHTML = `
    <div class="row"><h1>Scout</h1>
      <div class="row"><button id="pit-scout" class="secondary">Pit scout</button><button id="new-match">Scout a match</button></div>
    </div>
    <p class="muted">${esc(season.name)}</p>
    ${matches.length ? `
      <ul class="route-list">${matches.map((m) => `
        <li><button class="route-card" data-id="${esc(m.id)}">
          <span class="chip ${esc(m.alliance)}">${m.team}</span>
          <span><strong>Match ${m.match}${m.event ? ` · ${esc(m.event)}` : ''}</strong><span class="muted small">${esc(pointsText(m.points))}</span></span>
        </button></li>`).join('')}
      </ul>`
    : '<div class="card empty"><p class="muted">No matches scouted yet.</p></div>'}`;
  ui.page.querySelector('#new-match').onclick = () => openSetup();
  ui.page.querySelector('#pit-scout').onclick = () => openPitForm(null, renderScoutList);
  ui.page.querySelector('.route-list')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (card) openMatchDialog(ui.state.matches.find((m) => m.id === card.dataset.id));
  });
}

// One team's result in a match: what was tapped, the notes, and Delete for mistakes.
export function openMatchDialog(match) {
  const scout = ui.state.members.find((m) => m.uid === match.scout);
  const rows = Object.keys(PERIODS).flatMap((period) => Object.entries(match.counts[period])
    .map(([id, taps]) => `<li><span>${PERIODS[period]} · ${esc(labelOf(id, ui.state.buttons))}</span><strong>${taps}</strong></li>`));
  ui.dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>${match.team} in match ${match.match}</h2>
      <p class="muted small">${esc(pointsText(match.points))}${scout ? ` · scouted by ${esc(scout.name || scout.email)}` : ''}</p>
      ${rows.length ? `<ul class="tally-list">${rows.join('')}</ul>` : '<p class="muted">Nothing tapped.</p>'}
      ${match.notes ? `<p>${esc(match.notes)}</p>` : ''}
      <div class="row">
        <button>Close</button>
        <button type="button" id="delete-match" class="danger">Delete</button>
      </div>
    </form>`;
  ui.dialog.querySelector('#delete-match').onclick = () => {
    ui.dialog.close();
    ui.fb.deleteMatch(match.id).catch(ui.showError);
  };
  ui.dialog.showModal();
}

// ---------- setup ----------

// The event and next match number follow on from the last match scouted.
function openSetup() {
  const last = ui.state.matches.reduce((a, b) => (a && a.match >= b.match ? a : b), null);
  ui.page.innerHTML = `
    <div class="row"><h1>Scout a match</h1></div>
    <form id="setup" class="card">
      <div class="row pair">
        <label>Event <input name="event" maxlength="100" value="${esc(last?.event ?? '')}" placeholder="Optional" /></label>
        <label>Match <input name="match" required inputmode="numeric" pattern="[1-9][0-9]{0,3}" value="${last ? last.match + 1 : 1}" /></label>
      </div>
      <div class="segmented" role="group" aria-label="Alliance to watch">${Object.entries(SIDES).map(([id, label]) =>
        `<button type="button" class="${id}" data-side="${id}">${label}</button>`).join('')}</div>
      <div class="row pair">${SLOTS.map(([alliance, label], i) => `
        <label data-alliance="${alliance}"><span class="chip ${alliance}">${label}</span>
          <input name="team${i}" inputmode="numeric" pattern="[1-9][0-9]{0,5}" placeholder="Team number" /></label>`).join('')}
      </div>
      <div class="row">
        <button>Start</button>
        <button type="button" id="cancel" class="secondary">Cancel</button>
      </div>
    </form>`;
  const showSide = (side) => {
    localStorage.setItem(SIDE_KEY, side);
    for (const button of ui.page.querySelectorAll('[data-side]')) button.setAttribute('aria-pressed', String(button.dataset.side === side));
    for (const label of ui.page.querySelectorAll('[data-alliance]')) label.hidden = side !== 'both' && label.dataset.alliance !== side;
  };
  showSide(localStorage.getItem(SIDE_KEY) ?? 'both');
  ui.page.querySelector('.segmented').onclick = (e) => {
    const button = e.target.closest('[data-side]');
    if (button) showSide(button.dataset.side);
  };
  ui.page.querySelector('#cancel').onclick = renderScoutList;
  ui.page.querySelector('#setup').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const teams = SLOTS.map(([alliance], i) => ({ alliance, team: Number(form[`team${i}`].value) })).filter((t, i) => t.team && !form.querySelectorAll('[data-alliance]')[i].hidden);
    if (!teams.length) return ui.showError(new Error('Type at least one team number.'));
    openCounter({ event: form.event.value.trim(), match: Number(form.match.value) }, teams);
  };
}

// ---------- counters ----------

// One column per team with a big button for everything that scores in the current period, the fouls, and the team's
// custom buttons. Undo takes back that team's last tap. Nothing is saved until Save.
function openCounter(match, teams) {
  let period = 'auto';
  const sheets = teams.map((t) => ({ ...t, counts: { auto: {}, teleop: {} }, taps: [], notes: '' }));

  const buttonsFor = () => [
    ...season.actions.filter((a) => a.points[period] != null).map((a) => ({ id: a.id, label: a.label, points: `+${a.points[period]}` })),
    ...season.fouls.map((f) => ({ id: f.id, label: f.label, points: `${f.points} to them`, foul: true })),
    ...ui.state.buttons.map((b) => ({ id: b.id, label: b.label, points: `${b.points >= 0 ? '+' : ''}${b.points}` })),
  ];

  const scored = (counts) => {
    const { auto, teleop } = matchPoints(counts, ui.state.buttons);
    return auto + teleop;
  };

  function render() {
    const buttons = buttonsFor();
    ui.page.innerHTML = `
      <div class="row"><h1>Match ${match.match}</h1>
        <div class="segmented" role="group" aria-label="Period">${Object.entries(PERIODS).map(([id, label]) =>
          `<button type="button" data-period="${id}" aria-pressed="${id === period}">${label}</button>`).join('')}</div>
      </div>
      <div class="counter">${sheets.map((sheet, i) => `
        <section class="card" data-sheet="${i}">
          <div class="row"><span class="chip ${sheet.alliance}">${sheet.team}</span>
            <strong>${scored(sheet.counts)} pts</strong></div>
          ${buttons.map((b) => `
            <button type="button" class="tally${b.foul ? ' foul' : ''}" data-id="${esc(b.id)}">
              <span>${esc(b.label)}<span class="small">${esc(b.points)}</span></span><strong>${sheet.counts[period][b.id] ?? 0}</strong>
            </button>`).join('')}
          <button type="button" class="secondary undo" ${sheet.taps.length ? '' : 'disabled'}>Undo</button>
          <textarea class="notes" rows="2" maxlength="2000" placeholder="Notes">${esc(sheet.notes)}</textarea>
        </section>`).join('')}
      </div>
      <div class="row actions">
        <button id="save-match">Save</button>
        <button id="custom-button" class="secondary">Add custom button</button>
        <button id="cancel" class="secondary">Cancel</button>
      </div>`;
    ui.page.querySelector('.segmented').onclick = (e) => {
      const button = e.target.closest('[data-period]');
      if (button) { period = button.dataset.period; render(); }
    };
    ui.page.querySelector('.counter').onclick = (e) => {
      const sheet = sheets[e.target.closest('[data-sheet]')?.dataset.sheet];
      const tally = e.target.closest('.tally');
      if (tally) {
        const { id } = tally.dataset;
        sheet.counts[period][id] = (sheet.counts[period][id] ?? 0) + 1;
        sheet.taps.push({ period, id });
        render();
      } else if (e.target.closest('.undo')) {
        const { period: p, id } = sheet.taps.pop();
        if (--sheet.counts[p][id] === 0) delete sheet.counts[p][id];
        render();
      }
    };
    ui.page.querySelector('.counter').oninput = (e) => {
      sheets[e.target.closest('[data-sheet]').dataset.sheet].notes = e.target.value;
    };
    ui.page.querySelector('#custom-button').onclick = () => openButtonDialog(render);
    ui.page.querySelector('#cancel').onclick = renderScoutList;
    ui.page.querySelector('#save-match').onclick = () => {
      for (const sheet of sheets) {
        ui.fb.saveMatch({
          season: season.id, event: match.event, match: match.match, team: sheet.team, alliance: sheet.alliance,
          counts: sheet.counts, points: matchPoints(sheet.counts, ui.state.buttons), notes: sheet.notes.trim(),
        }, ui.showError);
      }
      renderScoutList();
    };
  }
  render();
}

// A team-wide button for something the season's buttons don't cover. Points can be 0 for things only worth noting.
function openButtonDialog(onSave) {
  ui.dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>Add custom button</h2>
      <label>Name <input name="label" required maxlength="30" placeholder="e.g. Defended" /></label>
      <label>Points <input name="points" required type="number" min="-100" max="100" value="0" /></label>
      <p class="muted small">Everyone on your team gets this button.</p>
      <div class="row">
        <button>Add</button>
        <button type="button" class="secondary" id="cancel-button">Cancel</button>
      </div>
    </form>`;
  const form = ui.dialog.querySelector('form');
  ui.dialog.querySelector('#cancel-button').onclick = () => ui.dialog.close();
  form.onsubmit = () => {
    const button = { label: form.label.value.trim(), points: Number(form.points.value) };
    // Shown straight away; the team's list catches up when the save reaches the backend.
    ui.state.buttons = [...ui.state.buttons, { id: ui.fb.saveButton(button, ui.showError), ...button }];
    onSave();
  };
  ui.dialog.showModal();
}
