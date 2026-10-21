// The Teams tab: every team the team has scouted, and a page per team with its averages, matches, notes and routes.
import { esc } from './ui.js';
import { labelOf, pointsText, openMatchDialog } from './scouting.js';

const PERIODS = { auto: 'Auto', teleop: 'Teleop' };
const average = (list, value) => list.reduce((sum, item) => sum + value(item), 0) / list.length;
const oneDecimal = (n) => String(Math.round(n * 10) / 10);

// Set by the app (main.js): where pages and dialogs go, the backend, the team's data and how to show errors.
let ui;
export const startTeams = (context) => { ui = context; };

const matchesOf = (team) => ui.state.matches.filter((m) => m.team === team).sort((a, b) => a.match - b.match);

function averages(matches) {
  return {
    auto: average(matches, (m) => m.points.auto),
    teleop: average(matches, (m) => m.points.teleop),
    fouls: average(matches, (m) => m.points.fouls),
  };
}

const averageText = ({ auto, teleop, fouls }) =>
  `${oneDecimal(auto + teleop)} points (auto ${oneDecimal(auto)}, teleop ${oneDecimal(teleop)})${fouls ? ` · gives ${oneDecimal(fouls)} in fouls` : ''}`;

// ---------- list ----------

// Best average first, so the strongest teams are at the top when picking alliance partners.
export function renderTeamList() {
  const teams = [...new Set(ui.state.matches.map((m) => m.team))].map((team) => {
    const matches = matchesOf(team);
    const avg = averages(matches);
    return { team, matches: matches.length, avg, total: avg.auto + avg.teleop };
  }).sort((a, b) => b.total - a.total);
  ui.page.innerHTML = `
    <div class="row"><h1>Teams</h1>
      <form id="find-team" class="row">
        <input name="team" required inputmode="numeric" pattern="[1-9][0-9]{0,5}" placeholder="Team number" aria-label="Team number" />
        <button>Open</button>
      </form>
    </div>
    ${teams.length ? `
      <ul class="route-list">${teams.map((t) => `
        <li><button class="route-card" data-team="${t.team}">
          <span class="chip">${t.team}</span>
          <span><strong>${esc(averageText(t.avg))}</strong><span class="muted small">${t.matches} ${t.matches === 1 ? 'match' : 'matches'} scouted</span></span>
        </button></li>`).join('')}
      </ul>`
    : '<div class="card empty"><p class="muted">Teams you scout show up here.</p></div>'}`;
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
  ui.page.innerHTML = `
    <div class="row"><h1>Team ${team}</h1><button id="back" class="secondary">Back</button></div>
    ${matches.length ? `
      <section class="card">
        <h2>Averages</h2>
        <p>${esc(averageText(averages(matches)))}</p>
        <ul class="tally-list">${tapAverages(matches)}</ul>
      </section>
      <section class="card">
        <h2>Matches</h2>
        <ul class="route-list">${matches.map((m) => `
          <li><button class="route-card" data-id="${esc(m.id)}">
            <span class="chip ${esc(m.alliance)}">${m.match}</span>
            <span><strong>${esc(pointsText(m.points))}</strong>${m.notes ? `<span class="muted small">${esc(m.notes)}</span>` : ''}</span>
          </button></li>`).join('')}
        </ul>
      </section>`
    : '<div class="card empty"><p class="muted">Not scouted yet.</p></div>'}
    ${routes.length ? `
      <section class="card">
        <h2>Routes</h2>
        <ul class="tally-list">${routes.map((r) => `<li><span>${esc(r.name)}</span><span class="muted">${PERIODS[r.phase]}</span></li>`).join('')}</ul>
      </section>` : ''}`;
  ui.page.querySelector('#back').onclick = renderTeamList;
  ui.page.querySelector('.route-list')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (card) openMatchDialog(ui.state.matches.find((m) => m.id === card.dataset.id));
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
