// The Scout tab: the matches the team has scouted, and the tap counters for scouting 1 to 4 teams in a match.
// Each team's result is its own doc, so scouts watching the same match never overwrite each other.
import season from './seasons/2027.js';
import { esc } from './ui.js';
import { openPitForm } from './pits.js';
import { wireNumpads } from './numpad.js';

const PERIODS = { auto: 'Auto', teleop: 'Teleop' };
const SLOTS = [['red', 'Red 1'], ['red', 'Red 2'], ['blue', 'Blue 1'], ['blue', 'Blue 2']];
// Which alliance this device's scout watches. Usually two scouts split a match, one per alliance; saved on this device.
const SIDES = { both: 'Both', red: 'Red', blue: 'Blue' };
const SIDE_KEY = 'ftc-scout-side';
// The match being scouted, kept on this device until it's saved or discarded, so a reload or a locked phone loses nothing.
const DRAFT_KEY = 'ftc-scout-draft';

// Set by the app (main.js): where pages and dialogs go, the backend, the team's data and how to show errors.
let ui;
export const startScouting = (context) => { ui = context; };

// ---------- points ----------
// Counts are { auto: { id: taps }, teleop: { id: taps } }, where id is a season action, a foul, or a custom button's id.

export const labelOf = (id, buttons) =>
  [...season.actions, ...season.fouls, ...season.cards, ...buttons].find((b) => b.id === id)?.label ?? 'Deleted button';

// Points scored in each period, and foul points given to the other alliance.
export function matchPoints(counts, buttons) {
  const points = { auto: 0, teleop: 0, fouls: 0 };
  for (const period of Object.keys(PERIODS)) {
    for (const [id, taps] of Object.entries(counts[period])) {
      const foul = season.fouls.find((f) => f.id === id);
      const action = season.actions.find((a) => a.id === id);
      if (season.cards.some((c) => c.id === id)) continue;
      if (foul) points.fouls += taps * foul.points;
      else points[period] += taps * (action ? action.points[period] : buttons.find((b) => b.id === id)?.points ?? 0);
    }
  }
  return points;
}

export const pointsText = ({ auto, teleop, fouls }) =>
  `${auto + teleop} points (auto ${auto}, teleop ${teleop})${fouls ? ` · gave ${fouls} in fouls` : ''}`;

// ---------- list ----------

// An unsaved match on this device for this team.
function loadDraft() {
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  return draft?.project === ui.state.connection.config.projectId ? draft : null;
}

// Opening the tab goes straight back to a match still being scouted.
export function renderScoutList() {
  const draft = loadDraft();
  if (draft) return openCounter(draft.match, draft.sheets, draft.period);
  const matches = [...ui.state.matches].sort((a, b) => b.match - a.match || a.team - b.team);
  ui.page.innerHTML = `
    <div class="row"><h1>Scout</h1>
      <div class="row"><button id="pit-scout" class="secondary">Pit scout</button><button id="new-match">Match scout</button></div>
    </div>
    <p class="muted">${esc(season.name)}</p>
    ${matches.length ? `
      <ul class="route-list">${matches.map((m) => `
        <li><button class="route-card" data-id="${esc(m.id)}">
          <span class="chip ${esc(m.alliance)}">${m.team}</span>
          <span><strong>Match ${m.match}${m.event ? ` · ${esc(m.event)}` : ''}</strong><span class="muted small">${esc(pointsText(m.points))} · by ${esc(scoutName(m))}</span></span>
        </button></li>`).join('')}
      </ul>`
    : '<div class="card empty"><p class="muted">No matches scouted yet.</p></div>'}`;
  ui.page.querySelector('#new-match').onclick = () => openSetup();
  ui.page.querySelector('#pit-scout').onclick = () => openPitForm(null, renderScoutList);
  ui.page.querySelector('.route-list')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (card) openMatchDialog([ui.state.matches.find((m) => m.id === card.dataset.id)]);
  });
}

export const scoutName = (record) => {
  const member = ui.state.members.find((m) => m.uid === record.scout);
  return member ? member.name || member.email : 'a former member';
};

// One team in one match, as each scout who watched it saw it: what was tapped, the notes, and Delete for mistakes.
export function openMatchDialog(records) {
  const { team, match } = records[0];
  ui.dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>${team} in match ${match}</h2>
      ${records.map((record) => {
        const rows = Object.keys(PERIODS).flatMap((period) => Object.entries(record.counts[period])
          .map(([id, taps]) => `<li><span>${PERIODS[period]} · ${esc(labelOf(id, ui.state.buttons))}</span><strong>${taps}</strong></li>`));
        return `
          <section>
            <p class="muted small">${esc(pointsText(record.points))} · by ${esc(scoutName(record))}</p>
            ${rows.length ? `<ul class="tally-list">${rows.join('')}</ul>` : '<p class="muted">Nothing tapped.</p>'}
            ${record.notes ? `<p>${esc(record.notes)}</p>` : ''}
            <button type="button" class="danger" data-delete="${esc(record.id)}">Delete</button>
          </section>`;
      }).join('')}
      <div class="row"><button>Close</button></div>
    </form>`;
  ui.dialog.querySelector('form').onclick = (e) => {
    const id = e.target.closest('[data-delete]')?.dataset.delete;
    if (!id) return;
    ui.dialog.close();
    ui.fb.deleteMatch(id).catch(ui.showError);
  };
  ui.dialog.showModal();
}

// ---------- setup ----------

// The event and next match number follow on from the last match scouted.
function openSetup() {
  const last = ui.state.matches.reduce((a, b) => (a && a.match >= b.match ? a : b), null);
  ui.page.innerHTML = `
    <div class="row"><h1>Match scout</h1></div>
    <form id="setup" class="card">
      <div class="row pair">
        <label>Event <input name="event" maxlength="100" value="${esc(last?.event ?? '')}" placeholder="Optional" /></label>
        <label>Match <input name="match" required data-numpad="Match" maxlength="4" pattern="[1-9][0-9]{0,3}" value="${last ? last.match + 1 : 1}" /></label>
      </div>
      <div class="segmented" role="group" aria-label="Alliance to watch">${Object.entries(SIDES).map(([id, label]) =>
        `<button type="button" class="${id}" data-side="${id}">${label}</button>`).join('')}</div>
      <div class="row pair">${SLOTS.map(([alliance, label], i) => `
        <label data-alliance="${alliance}"><span class="chip ${alliance}">${label}</span>
          <input name="team${i}" data-numpad="${label}" maxlength="6" pattern="[1-9][0-9]{0,5}" placeholder="Team number" /></label>`).join('')}
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
  wireNumpads(ui.page);
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
    openCounter({ event: form.event.value.trim(), match: Number(form.match.value) },
      teams.map((t) => ({ ...t, counts: { auto: {}, teleop: {} }, taps: [], notes: '', open: [] })));
  };
}

// ---------- counters ----------

// One column per team with a big button for everything that scores in the current period, the fouls, and the team's
// custom buttons; things done once a period (leave, park) are checkboxes. Undo takes back that team's last counter tap.
// Nothing is saved until Save.
// `sheets` are the teams' columns: their counts, taps (for Undo), notes and open (the groups shown unfolded).
function openCounter(match, sheets, period = 'auto') {
  const saveDraft = () => localStorage.setItem(DRAFT_KEY, JSON.stringify({ project: ui.state.connection.config.projectId, match, sheets, period }));
  const close = () => {
    localStorage.removeItem(DRAFT_KEY);
    renderScoutList();
  };

  const buttonsFor = () => [
    ...season.actions.filter((a) => a.points[period] != null)
      .map((a) => ({ id: a.id, label: a.label, points: `+${a.points[period]}`, once: a.once, group: a.group })),
    ...season.fouls.map((f) => ({ id: f.id, label: f.label, points: `${f.points} to them`, foul: true })),
    ...season.cards.map((c) => ({ id: c.id, label: c.label, points: 'No points', card: c.id })),
    ...ui.state.buttons.map((b) => ({ id: b.id, label: b.label, points: `${b.points >= 0 ? '+' : ''}${b.points}` })),
  ];

  const scored = (counts) => {
    const { auto, teleop } = matchPoints(counts, ui.state.buttons);
    return auto + teleop;
  };

  const tally = (b, sheet) => (b.once ? `
    <button type="button" class="tally" data-id="${esc(b.id)}" data-once role="checkbox" aria-checked="${Boolean(sheet.counts[period][b.id])}">
      <span>${esc(b.label)}<span class="small">${esc(b.points)}</span></span><span class="box"></span>
    </button>` : `
    <button type="button" class="tally${b.foul ? ' foul' : ''}${b.card ? ` card-${b.card}` : ''}" data-id="${esc(b.id)}">
      <span>${esc(b.label)}<span class="small">${esc(b.points)}</span></span><strong>${sheet.counts[period][b.id] ?? 0}</strong>
    </button>`);

  function render() {
    saveDraft();
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
          ${buttons.map((b, at) => {
            if (!b.group) return tally(b, sheet);
            // A group is drawn once, where its first button would be.
            if (buttons.findIndex((other) => other.group === b.group) !== at) return '';
            const members = buttons.filter((other) => other.group === b.group);
            const taps = members.reduce((sum, m) => sum + (sheet.counts[period][m.id] ?? 0), 0);
            return `
              <details class="group" data-group="${esc(b.group)}" ${sheet.open.includes(b.group) ? 'open' : ''}>
                <summary><span>${esc(b.group)}</span><strong>${taps}</strong></summary>
                ${members.map((m) => tally(m, sheet)).join('')}
              </details>`;
          }).join('')}
          <button type="button" class="secondary undo" ${sheet.taps.length ? '' : 'disabled'}>Undo</button>
          <textarea class="notes" rows="2" maxlength="2000" placeholder="Notes">${esc(sheet.notes)}</textarea>
        </section>`).join('')}
      </div>
      <div class="row actions">
        <button id="save-match">Save</button>
        <button id="custom-button" class="secondary">Custom buttons</button>
        <button id="cancel" class="secondary">Cancel</button>
      </div>`;
    ui.page.querySelector('.segmented').onclick = (e) => {
      const button = e.target.closest('[data-period]');
      if (button) { period = button.dataset.period; render(); }
    };
    ui.page.querySelector('.counter').onclick = (e) => {
      const sheet = sheets[e.target.closest('[data-sheet]')?.dataset.sheet];
      const tally = e.target.closest('.tally');
      if (tally?.dataset.once != null) {
        const { id } = tally.dataset;
        if (sheet.counts[period][id]) delete sheet.counts[period][id];
        else sheet.counts[period][id] = 1;
        render();
      } else if (tally) {
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
    // Folding a group is remembered for that team while the match is scouted. Toggle events don't bubble, hence capture.
    ui.page.querySelector('.counter').addEventListener('toggle', (e) => {
      const sheet = sheets[e.target.closest('[data-sheet]').dataset.sheet];
      sheet.open = sheet.open.filter((group) => group !== e.target.dataset.group);
      if (e.target.open) sheet.open.push(e.target.dataset.group);
      saveDraft();
    }, true);
    ui.page.querySelector('.counter').oninput = (e) => {
      sheets[e.target.closest('[data-sheet]').dataset.sheet].notes = e.target.value;
      saveDraft();
    };
    ui.page.querySelector('#custom-button').onclick = () => openButtonDialog(render);
    ui.page.querySelector('#cancel').onclick = () => {
      const scouted = sheets.some((sheet) => sheet.notes || Object.keys(PERIODS).some((p) => Object.keys(sheet.counts[p]).length));
      if (scouted) confirmDiscard(match, close);
      else close();
    };
    ui.page.querySelector('#save-match').onclick = () => {
      for (const sheet of sheets) {
        ui.fb.saveMatch({
          season: season.id, event: match.event, match: match.match, team: sheet.team, alliance: sheet.alliance,
          counts: sheet.counts, points: matchPoints(sheet.counts, ui.state.buttons), notes: sheet.notes.trim(),
        }, ui.showError);
      }
      close();
    };
  }
  render();
}

function confirmDiscard(match, discard) {
  ui.dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>Discard match ${match.match}?</h2>
      <p class="muted">What you tapped for this match won’t be saved.</p>
      <div class="row">
        <button class="secondary">Keep scouting</button>
        <button type="button" id="discard" class="danger">Discard</button>
      </div>
    </form>`;
  ui.dialog.querySelector('#discard').onclick = () => {
    ui.dialog.close();
    discard();
  };
  ui.dialog.showModal();
}

// The team's custom buttons, for things the season's buttons don't cover: add one, or delete one nobody needs. Points
// can be 0 for things only worth noting. Deleting a button keeps the points already saved with matches.
function openButtonDialog(onChange) {
  const render = () => {
    ui.dialog.innerHTML = `
      <form method="dialog" class="card">
        <h2>Custom buttons</h2>
        ${ui.state.buttons.length ? `<ul class="tally-list">${ui.state.buttons.map((b) => `
          <li><span>${esc(b.label)} <span class="muted small">${b.points >= 0 ? '+' : ''}${b.points}</span></span>
            <button type="button" class="danger" data-delete="${esc(b.id)}">Delete</button></li>`).join('')}
        </ul>` : ''}
        <h3>Add a button</h3>
        <label>Name <input name="label" maxlength="30" placeholder="e.g. Played defense" /></label>
        <label>Points <input name="points" type="number" min="-100" max="100" step="1" value="0" /></label>
        <p class="muted small">Everyone on your team gets these buttons.</p>
        <div class="row">
          <button type="button" id="add-button">Add</button>
          <button class="secondary">Done</button>
        </div>
      </form>`;
    const form = ui.dialog.querySelector('form');
    form.querySelector('.tally-list')?.addEventListener('click', (e) => {
      const id = e.target.closest('[data-delete]')?.dataset.delete;
      if (!id) return;
      ui.fb.deleteButton(id).catch(ui.showError);
      ui.state.buttons = ui.state.buttons.filter((b) => b.id !== id);
      render();
      onChange();
    });
    form.querySelector('#add-button').onclick = () => {
      const label = form.label.value.trim();
      const points = Number(form.points.value);
      if (!label) return form.label.focus();
      if (!Number.isInteger(points) || Math.abs(points) > 100) return form.points.reportValidity();
      // Shown straight away; the team's list catches up when the save reaches the backend.
      ui.state.buttons = [...ui.state.buttons, { id: ui.fb.saveButton({ label, points }, ui.showError), label, points }];
      render();
      onChange();
    };
  };
  render();
  ui.dialog.showModal();
}
