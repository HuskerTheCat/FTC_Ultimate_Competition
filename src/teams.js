// The Teams tab: every team the team has scouted, and a page per team with its averages, matches, notes and routes.
import { esc } from './ui.js';
import { labelOf, matchPoints, pointsText, openMatchDialog, isOnce } from './scouting.js';
import { eventKey, eventPickerHtml, wireEventPicker, fillEventPicker, inChosenEvent } from './events.js';
import { openRoute } from './routes.js';
import { pitOf, openPitForm } from './pits.js';
import { wireNumpads } from './numpad.js';
import season from './seasons/2027.js';
import { teamInfo, homeOf } from './ftcscout.js';

const PERIODS = { auto: 'Auto', teleop: 'Teleop' };
const average = (list, value) => list.reduce((sum, item) => sum + value(item), 0) / list.length;
const oneDecimal = (n) => String(Math.round(n * 10) / 10);

// Set by the app (main.js): where pages and dialogs go, the backend, the team's data and how to show errors.
let ui;
export const startTeams = (context) => { ui = context; };

// A team's matches at the chosen event, one each even when several scouts watched the team in the same match: their
// counts and points are averaged, so a match never counts twice. `records` keeps each scout's own record.
function matchesOf(team) {
  const byMatch = new Map();
  for (const record of ui.state.matches.filter((m) => m.team === team && inChosenEvent(m, ui.state.matches))) {
    const key = `${eventKey(record.event)}|${record.match}`;
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
// What's typed in the search, kept while the list is redrawn for teammates' changes.
let teamQuery = '';

export function renderTeamList() {
  ui.page.innerHTML = `
    ${eventPickerHtml()}
    <form id="find-team" class="toolbar">
      <input id="team-search" name="team" type="search" data-numpad="Team number" maxlength="6" placeholder="Search teams…" aria-label="Search teams" value="${esc(teamQuery)}" />
      <button type="button" id="new-pit" class="fab">+ Pit scout</button>
    </form>
    <div id="team-list"></div>`;
  wireEventPicker(ui.page, showTeamList);
  wireNumpads(ui.page);
  ui.page.querySelector('#team-search').oninput = (e) => {
    teamQuery = e.target.value.trim();
    showTeamList();
  };
  // Enter opens the team typed, even one nobody has scouted yet.
  ui.page.querySelector('#find-team').onsubmit = (e) => {
    e.preventDefault();
    if (/^[1-9][0-9]{0,5}$/.test(teamQuery)) renderTeam(Number(teamQuery));
  };
  ui.page.querySelector('#new-pit').onclick = () => openPitForm(null, renderTeamList);
  ui.page.querySelector('#team-list').onclick = (e) => {
    const card = e.target.closest('[data-team]');
    if (card) renderTeam(Number(card.dataset.team));
  };
  showTeamList();
}

// Redraws the list, also for teammates' changes (main.js), leaving the search as it is.
export function showTeamList() {
  fillEventPicker(ui.page, ui.state.matches);
  const numbers = new Set([...ui.state.matches.filter((m) => inChosenEvent(m, ui.state.matches)), ...ui.state.pits].map((item) => item.team));
  const teams = [...numbers].filter((team) => String(team).includes(teamQuery)).map((team) => {
    const matches = matchesOf(team);
    const avg = matches.length ? averages(matches) : null;
    return { team, matches: matches.length, avg, total: avg ? avg.auto + avg.teleop : -1, pit: pitOf(team) };
  }).sort((a, b) => b.total - a.total);
  const typed = /^[1-9][0-9]{0,5}$/.test(teamQuery) && !numbers.has(Number(teamQuery));
  ui.page.querySelector('#team-list').innerHTML = `${teams.length ? `
    <ul class="route-list">${teams.map((t) => `
      <li><button class="route-card" data-team="${t.team}">
        <span class="chip">${t.team}</span>
        <span><strong>${t.avg ? esc(averageText(t.avg)) : 'No matches scouted'}</strong><span class="muted small">${[
          t.matches && `${t.matches} ${t.matches === 1 ? 'match' : 'matches'} scouted`,
          t.pit && `claims ${claimedPoints(t.pit)} points in the pits`,
        ].filter(Boolean).join(' · ')}</span></span>
      </button></li>`).join('')}
    </ul>` : ''}
    ${typed ? `<ul class="route-list"><li><button class="route-card" data-team="${teamQuery}">
      <span class="chip">${teamQuery}</span><span><strong>Open team ${teamQuery}</strong><span class="muted small">Not scouted yet</span></span>
    </button></li></ul>` : ''}
    ${!teams.length && !typed ? '<div class="card empty"><p class="muted">Teams you scout show up here.</p></div>' : ''}`;
}

// ---------- team page ----------

export function renderTeam(team) {
  const matches = matchesOf(team);
  const routes = ui.state.routes.filter((r) => r.team === team);
  const pit = pitOf(team);
  scrollTo(0, 0);
  // FTCScout's numbers come after the team's own scouting, which is what a scout opens the page for.
  const info = `<section class="card" id="ftcscout" data-team="${team}"><h2>FTCScout</h2><p class="muted">Looking up team ${team}…</p></section>`;
  ui.page.innerHTML = `
    <div class="row"><h1>Team ${team}</h1>
      <div class="row"><button id="pit-scout" class="secondary">Pit scout</button><button id="back" class="secondary">Back</button></div>
    </div>
    ${eventPickerHtml()}
    ${pit ? comparison(pit, matches) : ''}
    ${matches.length ? `
      ${rankingHelp(matches)}
      <section class="card">
        <h2>Averages</h2>
        <p>${esc(averageText(averages(matches)))}</p>
        <ul class="tally-list">${tapAverages(matches)}</ul>
      </section>
      ${info}
      <section class="card">
        <h2>Matches</h2>
        <ul class="route-list">${matches.map((m, i) => `
          <li><button class="route-card" data-match="${i}">
            <span class="chip ${esc(m.alliance)}">${m.match}</span>
            <span><strong>${esc(pointsText(m.points))}</strong>${m.records.length > 1 ? `<span class="muted small">Average of ${m.records.length} scouts</span>` : ''}${m.notes ? `<span class="muted small">${esc(m.notes)}</span>` : ''}</span>
          </button></li>`).join('')}
        </ul>
      </section>`
    : `<div class="card empty"><p class="muted">No matches scouted yet.</p></div>${info}`}
    ${routes.length ? `
      <section class="card">
        <h2>Routes</h2>
        <ul class="route-list">${routes.map((r) => `
          <li><button class="route-card" data-route="${esc(r.id)}">
            <span class="chip ${esc(r.alliance)}">${PERIODS[r.phase]}</span><span><strong>${esc(r.name)}</strong></span>
          </button></li>`).join('')}</ul>
      </section>` : ''}`;
  wireEventPicker(ui.page, () => renderTeam(team));
  fillEventPicker(ui.page, ui.state.matches);
  showTeamInfo(team);
  ui.page.querySelector('#back').onclick = renderTeamList;
  ui.page.querySelector('#pit-scout').onclick = () => openPitForm(team, () => renderTeam(team));
  for (const list of ui.page.querySelectorAll('.route-list')) {
    list.addEventListener('click', (e) => {
      const match = e.target.closest('[data-match]');
      const route = e.target.closest('[data-route]');
      if (match) openMatchDialog(matches[match.dataset.match].records);
      if (route) {
        ui.showTab('routes');
        openRoute(route.dataset.route);
      }
    });
  }
}

// FTCScout's name, home and this season's OPR for the team, filled in when it answers if the page is still open.
async function showTeamInfo(team) {
  let html;
  try {
    const { team: info, stats } = await teamInfo(team);
    const opr = (part, label) => `<li><span>${label}</span><strong>${oneDecimal(stats[part].value)} <span class="muted small">#${stats[part].rank}</span></strong></li>`;
    html = !info ? `<p class="muted">FTCScout doesn’t know team ${team}.</p>` : `
      <p><strong>${esc(info.name)}</strong><br /><span class="muted small">${esc(homeOf(info))}${info.rookieYear ? ` · rookie year ${info.rookieYear}` : ''}</span></p>
      ${stats ? `
        <ul class="tally-list">${opr('tot', 'OPR')}${opr('auto', 'Auto OPR')}${opr('dc', 'Teleop OPR')}${opr('eg', 'Endgame OPR')}</ul>
        <p class="muted small">Best this season, with world rank.</p>`
      : '<p class="muted small">No events this season yet.</p>'}
      <a class="small" href="https://ftcscout.org/teams/${team}" target="_blank" rel="noopener">Open on FTCScout</a>`;
  } catch {
    html = '<p class="muted">FTCScout can’t be reached right now. Scouting works without it.</p>';
  }
  const card = ui.page.querySelector(`#ftcscout[data-team="${team}"]`);
  if (card) card.innerHTML = `<h2>FTCScout</h2>${html}`;
}

// What the team adds per match toward each ranking point, which its alliance as a whole has to reach.
function rankingHelp(matches) {
  const part = (rp, m) => Object.keys(PERIODS).reduce((sum, period) => sum + rp.actions.reduce((total, id) => {
    const taps = m.counts[period][id] ?? 0;
    return total + (rp.measure === 'points' ? taps * (season.actions.find((a) => a.id === id).points[period] ?? 0) : taps);
  }, 0), 0);
  return `
    <section class="card">
      <h2>Toward ranking points</h2>
      <table class="compare">
        <thead><tr><th></th><th>Per match</th><th>Alliance needs</th></tr></thead>
        <tbody>${season.rankingPoints.map((rp) => `
          <tr><th>${esc(rp.label)} <span class="muted small">${esc(rp.unit)}</span></th>
            <td>${oneDecimal(average(matches, (m) => part(rp, m)))}</td><td>${rp.threshold}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

// Things done once a period (leave, park) read as how often; everything else as how many per match.
const perMatch = (id, value) => (isOnce(id) ? `${Math.round(value * 100)}%` : oneDecimal(value));

// How many times per match the team did each thing, by period, in the season's order.
function tapAverages(matches) {
  const order = [...season.actions, ...season.fouls, ...season.cards, ...ui.state.buttons].map((b) => b.id);
  const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
  return Object.keys(PERIODS).flatMap((period) => {
    const ids = [...new Set(matches.flatMap((m) => Object.keys(m.counts[period])))].sort((a, b) => rank(a) - rank(b));
    return ids.map((id) => `
      <li><span>${PERIODS[period]} · ${esc(labelOf(id, ui.state.buttons))}</span>
        <strong>${perMatch(id, average(matches, (m) => m.counts[period][id] ?? 0))}</strong></li>`);
  }).join('');
}

// The pit claims beside what match scouting saw: per match for everything the team claimed or did, and in points.
// A number below the claim is marked, so oversold robots stand out.
function comparison(pit, matches) {
  const scored = matches.length ? averages(matches) : null;
  const actual = (period, id) => (matches.length ? average(matches, (m) => m.counts[period][id] ?? 0) : null);
  // Things done once a period (leave, park) read as Yes or No in the pits and how often in matches.
  const cell = (claim, value, id) => `<td class="${value != null && value < claim ? 'short' : ''}">${value == null ? '–' : id ? perMatch(id, value) : oneDecimal(value)}</td>`;
  const rows = Object.keys(PERIODS).flatMap((period) => season.actions
    .filter((a) => a.points[period] != null && (pit.claims[period][a.id] || actual(period, a.id)))
    .map((a) => {
      const claim = pit.claims[period][a.id] ?? 0;
      return `<tr><th>${PERIODS[period]} · ${esc(a.label)}</th><td>${a.once ? (claim ? 'Yes' : 'No') : claim}</td>${cell(claim, actual(period, a.id), a.id)}</tr>`;
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
