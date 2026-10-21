// The Teams tab: every team the team has scouted, and a page per team with its averages, matches, notes and routes.
import { esc } from './ui.js';
import { labelOf, matchPoints, pointsText, openMatchDialog } from './scouting.js';
import { pitOf, openPitForm } from './pits.js';
import { wireNumpads } from './numpad.js';
import season from './seasons/2027.js';

const PERIODS = { auto: 'Auto', teleop: 'Teleop' };
const average = (list, value) => list.reduce((sum, item) => sum + value(item), 0) / list.length;
const oneDecimal = (n) => String(Math.round(n * 10) / 10);

// Set by the app (main.js): where pages and dialogs go, the backend, the team's data and how to show errors.
let ui;
export const startTeams = (context) => { ui = context; };

// A team's matches, one each even when several scouts watched the team in the same match: their counts and points
// are averaged, so a match never counts twice. `records` keeps each scout's own record.
function matchesOf(team) {
  const byMatch = new Map();
  for (const record of ui.state.matches.filter((m) => m.team === team)) {
    const key = `${record.event}|${record.match}`;
    byMatch.set(key, [...(byMatch.get(key) ?? []), record]);
  }
  return [...byMatch.values()].map(combine).sort((a, b) => a.match - b.match);
}

function combine(records) {
  const counts = { auto: {}, teleop: {} };
  for (const record of records) {
    for (const period of Object.keys(PERIODS)) {
      for (const [id, taps] of Object.entries(record.counts[period])) counts[period][id] = (counts[period][id] ?? 0) + taps / records.length;
    }
  }
  const points = Object.fromEntries(['auto', 'teleop', 'fouls'].map((part) => [part, Number(oneDecimal(average(records, (r) => r.points[part])))]));
  return { ...records[0], counts, points, notes: records.map((r) => r.notes).filter(Boolean).join(' / '), records };
}

function averages(matches) {
  return {
    auto: average(matches, (m) => m.points.auto),
    teleop: average(matches, (m) => m.points.teleop),
    fouls: average(matches, (m) => m.points.fouls),
  };
}

// What a team claimed in the pits is worth, scored the same way as a match.
const claimedPoints = (pit) => {
  const { auto, teleop } = matchPoints(pit.claims, []);
  return auto + teleop;
};

const averageText = ({ auto, teleop, fouls }) =>
  `${oneDecimal(auto + teleop)} points (auto ${oneDecimal(auto)}, teleop ${oneDecimal(teleop)})${fouls ? ` · gives ${oneDecimal(fouls)} in fouls` : ''}`;

// ---------- list ----------

// Every team with match or pit scouting. Best average first, so the strongest teams are at the top when picking
// alliance partners.
export function renderTeamList() {
  const numbers = new Set([...ui.state.matches, ...ui.state.pits].map((item) => item.team));
  const teams = [...numbers].map((team) => {
    const matches = matchesOf(team);
    const avg = matches.length ? averages(matches) : null;
    return { team, matches: matches.length, avg, total: avg ? avg.auto + avg.teleop : -1, pit: pitOf(team) };
  }).sort((a, b) => b.total - a.total);
  ui.page.innerHTML = `
    <div class="row"><h1>Teams</h1>
      <form id="find-team" class="row">
        <input name="team" required data-numpad="Team number" maxlength="6" pattern="[1-9][0-9]{0,5}" placeholder="Team number" aria-label="Team number" />
        <button>Open</button>
      </form>
    </div>
    ${teams.length ? `
      <ul class="route-list">${teams.map((t) => `
        <li><button class="route-card" data-team="${t.team}">
          <span class="chip">${t.team}</span>
          <span><strong>${t.avg ? esc(averageText(t.avg)) : 'No matches scouted'}</strong><span class="muted small">${[
            t.matches && `${t.matches} ${t.matches === 1 ? 'match' : 'matches'} scouted`,
            t.pit && `claims ${claimedPoints(t.pit)} points in the pits`,
          ].filter(Boolean).join(' · ')}</span></span>
        </button></li>`).join('')}
      </ul>`
    : '<div class="card empty"><p class="muted">Teams you scout show up here.</p></div>'}`;
  wireNumpads(ui.page);
  ui.page.querySelector('#find-team').onsubmit = (e) => {
    e.preventDefault();
    renderTeam(Number(e.target.team.value));
  };
  ui.page.querySelector('.route-list')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-team]');
    if (card) renderTeam(Number(card.dataset.team));
  });
}

// ---------- team page ----------

export function renderTeam(team) {
  const matches = matchesOf(team);
  const routes = ui.state.routes.filter((r) => r.team === team);
  const pit = pitOf(team);
  ui.page.innerHTML = `
    <div class="row"><h1>Team ${team}</h1>
      <div class="row"><button id="pit-scout" class="secondary">Pit scout</button><button id="back" class="secondary">Back</button></div>
    </div>
    ${pit ? comparison(pit, matches) : ''}
    ${matches.length ? `
      <section class="card">
        <h2>Averages</h2>
        <p>${esc(averageText(averages(matches)))}</p>
        <ul class="tally-list">${tapAverages(matches)}</ul>
      </section>
      <section class="card">
        <h2>Matches</h2>
        <ul class="route-list">${matches.map((m, i) => `
          <li><button class="route-card" data-match="${i}">
            <span class="chip ${esc(m.alliance)}">${m.match}</span>
            <span><strong>${esc(pointsText(m.points))}</strong>${m.records.length > 1 ? `<span class="muted small">Average of ${m.records.length} scouts</span>` : ''}${m.notes ? `<span class="muted small">${esc(m.notes)}</span>` : ''}</span>
          </button></li>`).join('')}
        </ul>
      </section>`
    : `<div class="card empty"><p class="muted">No matches scouted yet.</p></div>`}
    ${routes.length ? `
      <section class="card">
        <h2>Routes</h2>
        <ul class="tally-list">${routes.map((r) => `<li><span>${esc(r.name)}</span><span class="muted">${PERIODS[r.phase]}</span></li>`).join('')}</ul>
      </section>` : ''}`;
  ui.page.querySelector('#back').onclick = renderTeamList;
  ui.page.querySelector('#pit-scout').onclick = () => openPitForm(team, () => renderTeam(team));
  ui.page.querySelector('.route-list')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-match]');
    if (card) openMatchDialog(matches[card.dataset.match].records);
  });
}

// How many times per match the team did each thing, by period.
function tapAverages(matches) {
  return Object.keys(PERIODS).flatMap((period) => {
    const ids = [...new Set(matches.flatMap((m) => Object.keys(m.counts[period])))];
    return ids.map((id) => `
      <li><span>${PERIODS[period]} · ${esc(labelOf(id, ui.state.buttons))}</span>
        <strong>${oneDecimal(average(matches, (m) => m.counts[period][id] ?? 0))}</strong></li>`);
  }).join('');
}

// The pit claims beside what match scouting saw: per match for everything the team claimed or did, and in points.
// A number below the claim is marked, so oversold robots stand out.
function comparison(pit, matches) {
  const scored = matches.length ? averages(matches) : null;
  const actual = (period, id) => (matches.length ? average(matches, (m) => m.counts[period][id] ?? 0) : null);
  // Things done once a period (leave, park) read as Yes or No in the pits and how often in matches.
  const format = (value, once) => (once ? `${Math.round(value * 100)}%` : oneDecimal(value));
  const cell = (claim, value, once) => `<td class="${value != null && value < claim ? 'short' : ''}">${value == null ? '–' : format(value, once)}</td>`;
  const rows = Object.keys(PERIODS).flatMap((period) => season.actions
    .filter((a) => a.points[period] != null && (pit.claims[period][a.id] || actual(period, a.id)))
    .map((a) => {
      const claim = pit.claims[period][a.id] ?? 0;
      return `<tr><th>${PERIODS[period]} · ${esc(a.label)}</th><td>${a.once ? (claim ? 'Yes' : 'No') : claim}</td>${cell(claim, actual(period, a.id), a.once)}</tr>`;
    }));
  const claimed = claimedPoints(pit);
  return `
    <section class="card">
      <h2>Pit claims vs matches</h2>
      <table class="compare">
        <thead><tr><th></th><th>Claimed</th><th>Scouted avg</th></tr></thead>
        <tbody>
          <tr class="total"><th>Points</th><td>${claimed}</td>${cell(claimed, scored && scored.auto + scored.teleop)}</tr>
          ${rows.join('')}
        </tbody>
      </table>
      ${pit.drivetrain ? `<p class="muted small">${esc(pit.drivetrain)} drivetrain</p>` : ''}
      ${pit.notes ? `<p>${esc(pit.notes)}</p>` : ''}
    </section>`;
}
