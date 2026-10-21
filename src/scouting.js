// The Scout tab: the matches the team has scouted, and the tap counters for scouting 1 to 4 teams in a match.
// Each team's result is its own doc, so scouts watching the same match never overwrite each other.
import season from './seasons/2027.js';
import { esc, confirmDialog } from './ui.js';
import { openPitForm } from './pits.js';
import { wireNumpads } from './numpad.js';
import { teamInfo } from './ftcscout.js';

const PERIODS = { auto: 'Auto', teleop: 'Teleop' };
const SLOTS = [['red', 'Red 1'], ['red', 'Red 2'], ['blue', 'Blue 1'], ['blue', 'Blue 2']];
// Which alliance this device's scout watches. Usually two scouts split a match, one per alliance; saved on this device.
const SIDES = { both: 'Both', red: 'Red', blue: 'Blue' };
const SIDE_KEY = 'ftc-scout-side';
// The match being scouted, kept on this device until it's saved or discarded, so a reload or a locked phone loses nothing.
const DRAFT_KEY = 'ftc-scout-draft';
const BUTTON_PERIODS = { both: 'Auto and teleop', auto: 'Auto only', teleop: 'Teleop only' };

// Set by the app (main.js): where pages and dialogs go, the backend, the team's data and how to show errors.
let ui;
export const startScouting = (context) => { ui = context; };

// Shows a team's name from FTCScout in `el` when FTCScout knows it. Scouting never waits for or depends on it.
const showTeamName = (el, number) => teamInfo(number).then((info) => {
  if (el.isConnected && info.team) el.textContent = info.team.name;
}, () => {});

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

// Event names are typed, so they match whatever their case and spacing.
export const eventKey = (event) => event.trim().toLowerCase().replace(/\s+/g, ' ');

// The team's records grouped by match, newest match first: [{ event, match, records }].
function matchGroups() {
  const groups = new Map();
  for (const record of ui.state.matches) {
    const key = `${eventKey(record.event)}|${record.match}`;
    if (!groups.has(key)) groups.set(key, { event: record.event, match: record.match, records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()].sort((a, b) => b.match - a.match);
}

// Opening the tab goes straight back to a match still being scouted.
export function renderScoutList() {
  const draft = loadDraft();
  if (draft) return openCounter(draft.match, draft.sheets, draft.period);
  const groups = matchGroups();
  ui.page.innerHTML = `
    <div class="row"><h1>Scout</h1>
      <div class="row"><button id="pit-scout" class="secondary">Pit scout</button><button id="new-match">Match scout</button></div>
    </div>
    <p class="muted">${esc(season.name)}</p>
    ${groups.length ? `<div id="match-list" class="page">${groups.map((g) => `
      <section class="match-group">
        <h2>Match ${g.match}${g.event ? ` <span class="muted small">${esc(g.event)}</span>` : ''}</h2>
        <ul class="route-list">${g.records.sort((a, b) => a.team - b.team).map((m) => `
          <li><button class="route-card" data-id="${esc(m.id)}">
            <span class="chip ${esc(m.alliance)}">${m.team}</span>
            <span><strong>${esc(pointsText(m.points))}</strong><span class="muted small">by ${esc(scoutName(m))}</span></span>
          </button></li>`).join('')}
        </ul>
      </section>`).join('')}</div>`
    : '<div class="card empty"><p class="muted">No matches scouted yet.</p></div>'}`;
  ui.page.querySelector('#new-match').onclick = () => openSetup();
  ui.page.querySelector('#pit-scout').onclick = () => openPitForm(null, renderScoutList);
  ui.page.querySelector('#match-list')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (card) openMatchDialog([ui.state.matches.find((m) => m.id === card.dataset.id)]);
  });
}

export const isOnce = (id) => Boolean(season.actions.find((a) => a.id === id)?.once);

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
          .map(([id, taps]) => `<li><span>${PERIODS[period]} · ${esc(labelOf(id, ui.state.buttons))}</span><strong>${isOnce(id) ? 'Yes' : taps}</strong></li>`));
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
    const record = records.find((r) => r.id === id);
    confirmDialog(ui.dialog, {
      title: `Delete ${scoutName(record)}’s record of ${team} in match ${match}?`, text: 'This can’t be undone.', action: 'Delete',
    }, () => ui.fb.deleteMatch(id).catch(ui.showError));
  };
  ui.dialog.showModal();
}

// ---------- setup ----------

// The event and next match number follow on from `after` (the match just saved), or else from the last match scouted.
// `notice` says what was just saved.
function openSetup(after = null, notice = '') {
  const last = after ?? ui.state.matches.reduce((a, b) => (a && a.match >= b.match ? a : b), null);
  scrollTo(0, 0);
  const events = [...new Map(ui.state.matches.filter((m) => m.event).map((m) => [eventKey(m.event), m.event])).values()];
  ui.page.innerHTML = `
    <div class="row"><h1>Match scout</h1></div>
    ${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
    <form id="setup" class="card">
      <div class="row pair">
        <label>Event <input name="event" maxlength="100" list="events" autocomplete="off" value="${esc(last?.event ?? '')}" placeholder="Optional" /></label>
        <datalist id="events">${events.map((e) => `<option value="${esc(e)}"></option>`).join('')}</datalist>
        <label>Match <input name="match" required data-numpad="Match" maxlength="4" pattern="[1-9][0-9]{0,3}" value="${last ? last.match + 1 : 1}" /></label>
      </div>
      <div class="segmented" role="group" aria-label="Alliance to watch">${Object.entries(SIDES).map(([id, label]) =>
        `<button type="button" class="${id}" data-side="${id}">${label}</button>`).join('')}</div>
      <div class="row pair">${SLOTS.map(([alliance, label], i) => `
        <label data-alliance="${alliance}"><span class="chip ${alliance}">${label}</span>
          <input name="team${i}" data-numpad="${label}" maxlength="6" pattern="[1-9][0-9]{0,5}" placeholder="Team number" />
          <span class="muted small team-name" data-name="${i}"></span></label>`).join('')}
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
  ui.page.querySelector('#setup').oninput = (e) => {
    const slot = e.target.name.match(/^team(\d)$/)?.[1];
    if (slot == null) return;
    const name = ui.page.querySelector(`[data-name="${slot}"]`);
    name.textContent = '';
    if (e.target.value) showTeamName(name, Number(e.target.value));
  };
  ui.page.querySelector('#setup').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const teams = SLOTS.map(([alliance], i) => ({ alliance, team: Number(form[`team${i}`].value) })).filter((t, i) => t.team && !form.querySelectorAll('[data-alliance]')[i].hidden);
    if (!teams.length) return ui.showError(new Error('Type at least one team number.'));
    const twice = teams.find((t, i) => teams.findIndex((other) => other.team === t.team) !== i);
    if (twice) return ui.showError(new Error(`Team ${twice.team} is typed in twice.`));
    const event = form.event.value.trim();
    const number = Number(form.match.value);
    // Scouting a team again in the same match replaces this scout's earlier record, so it isn't counted twice.
    const redo = ui.state.matches.filter((m) => m.scout === ui.state.user.uid && m.match === number
      && eventKey(m.event) === eventKey(event) && teams.some((t) => t.team === m.team));
    const start = () => openCounter({ event, match: number, replaces: redo.map((m) => m.id) },
      teams.map((t) => ({ ...t, counts: { auto: {}, teleop: {} }, taps: [], notes: '', open: [] })));
    if (!redo.length) return start();
    confirmDialog(ui.dialog, {
      title: 'Scouted already',
      text: `You already scouted ${redo.map((m) => m.team).join(', ')} in match ${number}. Saving replaces it.`,
      action: 'Scout again',
    }, start);
  };
}

// ---------- counters ----------

// Takes one tap of `id` in period `p` off a team's sheet, and the latest matching tap off its Undo list.
function removeTap(sheet, p, id) {
  if (--sheet.counts[p][id] === 0) delete sheet.counts[p][id];
  const at = sheet.taps.findLastIndex((tap) => tap.period === p && tap.id === id);
  if (at >= 0) sheet.taps.splice(at, 1);
}

// One column per team with a big button for everything that scores in the current period, the fouls, the cards and
// the team's custom buttons; things done once a period (leave, park) are checkboxes. Each counter has a minus, and Undo
// takes back the team's last tap in the period shown. Nothing is saved until Save.
// `sheets` are the teams' columns: their counts, taps (for Undo), notes and open (the groups shown unfolded).
function openCounter(match, sheets, period = 'auto') {
  const saveDraft = () => localStorage.setItem(DRAFT_KEY, JSON.stringify({ project: ui.state.connection.config.projectId, match, sheets, period }));
  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);
  scrollTo(0, 0);

  const buttonsFor = () => [
    ...season.actions.filter((a) => a.points[period] != null)
      .map((a) => ({ id: a.id, label: a.label, points: `+${a.points[period]}`, once: a.once, group: a.group })),
    ...season.fouls.map((f) => ({ id: f.id, label: f.label, points: `${f.points} to them`, foul: true })),
    ...season.cards.map((c) => ({ id: c.id, label: c.label, points: 'No points', card: c.id })),
    ...ui.state.buttons.filter((b) => b.period === 'both' || b.period === period)
      .map((b) => ({ id: b.id, label: b.label, points: `${b.points >= 0 ? '+' : ''}${b.points}` })),
  ];

  const scored = (counts) => {
    const { auto, teleop } = matchPoints(counts, ui.state.buttons);
    return auto + teleop;
  };

  const tally = (b, sheet) => (b.once ? `
    <button type="button" class="tally" data-id="${esc(b.id)}" data-once role="checkbox" aria-checked="${Boolean(sheet.counts[period][b.id])}">
      <span><span>${esc(b.label)}</span><span class="small">${esc(b.points)}</span></span><span class="box"></span>
    </button>` : `
    <div class="tally-row">
      <button type="button" class="tally${b.foul ? ' foul' : ''}${b.card ? ` card-${b.card}` : ''}" data-id="${esc(b.id)}">
        <span><span>${esc(b.label)}</span><span class="small">${esc(b.points)}</span></span><strong>${sheet.counts[period][b.id] ?? 0}</strong>
      </button>
      <button type="button" class="minus secondary" data-minus="${esc(b.id)}" aria-label="One less ${esc(b.label)}" ${sheet.counts[period][b.id] ? '' : 'disabled'}>−</button>
    </div>`);

  function render() {
    saveDraft();
    const buttons = buttonsFor();
    ui.page.innerHTML = `
      <div class="counter-bar">
        <h1>Match ${match.match}</h1>
        <div class="segmented" role="group" aria-label="Period">${Object.entries(PERIODS).map(([id, label]) =>
          `<button type="button" data-period="${id}" aria-pressed="${id === period}">${label}</button>`).join('')}</div>
        <button id="save-match">Save</button>
      </div>
      <div class="counter">${sheets.map((sheet, i) => `
        <section class="card" data-sheet="${i}">
          <div class="row sheet-head"><span class="chip ${sheet.alliance}">${sheet.team}</span>
            <strong>${scored(sheet.counts)} pts</strong></div>
          <p class="muted small team-name" data-team-name="${sheet.team}"></p>
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
          <button type="button" class="secondary undo" ${sheet.taps.some((tap) => tap.period === period) ? '' : 'disabled'}>Undo</button>
          <textarea class="notes" rows="2" maxlength="2000" placeholder="Notes">${esc(sheet.notes)}</textarea>
        </section>`).join('')}
      </div>
      <div class="row actions">
        <button id="custom-button" class="secondary">Custom buttons</button>
        <button id="cancel" class="secondary">Cancel</button>
      </div>`;
    // Each column's team stays in view under the bar while scrolling.
    ui.page.style.setProperty('--bar', `${ui.page.querySelector('.counter-bar').offsetHeight}px`);
    for (const name of ui.page.querySelectorAll('[data-team-name]')) showTeamName(name, Number(name.dataset.teamName));
    ui.page.querySelector('.counter-bar .segmented').onclick = (e) => {
      const button = e.target.closest('[data-period]');
      if (button) { period = button.dataset.period; render(); }
    };
    ui.page.querySelector('.counter').onclick = (e) => {
      const sheet = sheets[e.target.closest('[data-sheet]')?.dataset.sheet];
      const tally = e.target.closest('.tally');
      const minus = e.target.closest('[data-minus]');
      if (minus) {
        removeTap(sheet, period, minus.dataset.minus);
        render();
      } else if (tally?.dataset.once != null) {
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
        removeTap(sheet, period, sheet.taps.findLast((tap) => tap.period === period).id);
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
    ui.page.querySelector('#custom-button').onclick = () => openButtonDialog(sheets, render);
    ui.page.querySelector('#cancel').onclick = () => {
      const scouted = sheets.some((sheet) => sheet.notes || Object.keys(PERIODS).some((p) => Object.keys(sheet.counts[p]).length));
      const discard = () => {
        clearDraft();
        renderScoutList();
      };
      if (!scouted) return discard();
      confirmDialog(ui.dialog, { title: `Discard match ${match.match}?`, text: 'What you tapped for this match won’t be saved.', action: 'Discard' }, discard);
    };
    ui.page.querySelector('#save-match').onclick = () => {
      // A team with nothing tapped is usually one the scout didn't get to, so it's only saved (as 0 points) when asked.
      const empty = sheets.filter((sheet) => !sheet.notes.trim() && Object.keys(PERIODS).every((p) => !Object.keys(sheet.counts[p]).length));
      if (!empty.length) return save(sheets);
      const teams = empty.map((sheet) => sheet.team).join(', ');
      if (empty.length === sheets.length) {
        return confirmDialog(ui.dialog, { title: 'Nothing tapped', text: `Save ${teams} as 0 points?`, action: 'Save' }, () => save(sheets));
      }
      ui.dialog.innerHTML = `
        <form method="dialog" class="card">
          <h2>Nothing tapped for ${esc(teams)}</h2>
          <p class="muted">Skip ${empty.length > 1 ? 'them' : 'it'}, or save as 0 points?</p>
          <div class="row">
            <button value="skip">Skip empty</button>
            <button value="all" class="secondary">Save all</button>
            <button value="back" class="secondary">Back</button>
          </div>
        </form>`;
      ui.dialog.querySelector('form').onsubmit = (e) => {
        if (e.submitter.value === 'skip') save(sheets.filter((sheet) => !empty.includes(sheet)));
        if (e.submitter.value === 'all') save(sheets);
      };
      ui.dialog.showModal();
    };
  }

  function save(saving) {
    // Replaces this scout's earlier records only of the teams saved now.
    for (const old of ui.state.matches.filter((m) => (match.replaces ?? []).includes(m.id) && saving.some((s) => s.team === m.team))) {
      ui.fb.deleteMatch(old.id).catch(ui.showError);
    }
    for (const sheet of saving) {
      ui.fb.saveMatch({
        season: season.id, event: match.event, match: match.match, team: sheet.team, alliance: sheet.alliance,
        counts: sheet.counts, points: matchPoints(sheet.counts, ui.state.buttons), notes: sheet.notes.trim(),
      }, ui.showError);
    }
    clearDraft();
    // Straight on to the next match, which is what a scout does next.
    openSetup(match, `Saved match ${match.match} (${saving.map((sheet) => sheet.team).join(', ')}).`);
  }
  render();
}

// The team's custom buttons, for things the season's buttons don't cover: add one, or delete one nobody needs. Points
// can be 0 for things only worth noting. Deleting a button keeps the points already saved with matches, and takes its
// taps off the match being scouted (`sheets`), after asking.
function openButtonDialog(sheets, onChange) {
  const render = () => {
    ui.dialog.innerHTML = `
      <form method="dialog" class="card">
        <h2>Custom buttons</h2>
        ${ui.state.buttons.length ? `<ul class="tally-list">${ui.state.buttons.map((b) => `
          <li><span>${esc(b.label)} <span class="muted small">${b.points >= 0 ? '+' : ''}${b.points} · ${BUTTON_PERIODS[b.period]}</span></span>
            <button type="button" class="danger" data-delete="${esc(b.id)}">Delete</button></li>`).join('')}
        </ul>` : ''}
        <h3>Add a button</h3>
        <label>Name <input name="label" maxlength="30" placeholder="e.g. Played defense" /></label>
        <div class="row pair">
          <label>Points <input name="points" type="number" min="-100" max="100" step="1" value="0" /></label>
          <label>When <select name="period">${Object.entries(BUTTON_PERIODS).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
        </div>
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
      const button = ui.state.buttons.find((b) => b.id === id);
      const tapped = sheets.some((sheet) => Object.keys(PERIODS).some((p) => sheet.counts[p][id]));
      confirmDialog(ui.dialog, {
        title: `Delete ${button.label}?`,
        text: `It goes for everyone on your team.${tapped ? ' Its taps in this match come off.' : ''} Saved matches keep their points.`,
        action: 'Delete',
      }, () => {
        ui.fb.deleteButton(id).catch(ui.showError);
        ui.state.buttons = ui.state.buttons.filter((b) => b.id !== id);
        for (const sheet of sheets) for (const p of Object.keys(PERIODS)) while (sheet.counts[p][id]) removeTap(sheet, p, id);
        onChange();
        openButtonDialog(sheets, onChange);
      }, () => openButtonDialog(sheets, onChange));
    });
    form.querySelector('#add-button').onclick = () => {
      const label = form.label.value.trim();
      const points = Number(form.points.value);
      if (!label) return form.label.focus();
      if (!Number.isInteger(points) || Math.abs(points) > 100) return form.points.reportValidity();
      // Shown straight away; the team's list catches up when the save reaches the backend.
      const button = { label, points, period: form.period.value };
      ui.state.buttons = [...ui.state.buttons, { id: ui.fb.saveButton(button, ui.showError), ...button }];
      render();
      onChange();
    };
  };
  render();
  ui.dialog.showModal();
}
