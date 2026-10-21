// Pit scouting: what a team says its robot can do, asked in the pits. One record per team (the latest interview), kept
// by team number, so the team's page can set the claims beside what match scouting saw.
import season from './seasons/2027.js';
import { esc } from './ui.js';
import { wireNumpads } from './numpad.js';

const PERIODS = { auto: 'Auto', teleop: 'Teleop' };
const DRIVETRAINS = ['Mecanum', 'Tank', 'Swerve', 'Other'];

// Set by the app (main.js): where pages and dialogs go, the backend, the team's data and how to show errors.
let ui;
export const startPits = (context) => { ui = context; };

export const pitOf = (team) => ui.state.pits.find((p) => p.team === team);

// The form for one team; typing a team number that was pit scouted before fills in its last answers. `back` reopens
// the page the form was opened from.
export function openPitForm(team, back) {
  scrollTo(0, 0);
  ui.page.innerHTML = `
    <div class="row"><h1>Pit scout</h1></div>
    <form id="pit" class="page">
      <section class="card">
        <label>Team number <input name="team" required data-numpad="Team number" maxlength="6" pattern="[1-9][0-9]{0,5}" value="${team ?? ''}" /></label>
        <p id="pit-before" class="muted small" hidden></p>
        <label>Drivetrain <select name="drivetrain"><option value="">Not asked</option>${DRIVETRAINS.map((d) => `<option>${d}</option>`).join('')}</select></label>
      </section>
      ${Object.entries(PERIODS).map(([period, label]) => `
        <section class="card">
          <h2>${label}: how many per match?</h2>
          <ul class="tally-list">${season.actions.filter((a) => a.points[period] != null).map((a) => `
            <li><span>${esc(a.label)}</span><input class="claim" ${a.once ? 'type="checkbox"' : `data-numpad="${PERIODS[period]} · ${esc(a.label)}" maxlength="2" placeholder="0"`} name="${period}.${a.id}" aria-label="${PERIODS[period]} ${esc(a.label)}" /></li>`).join('')}
          </ul>
        </section>`).join('')}
      <section class="card"><textarea class="notes" name="notes" rows="3" maxlength="2000" placeholder="Notes: strategy, strengths, problems"></textarea></section>
      <div class="row actions">
        <button>Save</button>
        <button type="button" id="cancel" class="secondary">Cancel</button>
      </div>
    </form>`;
  const form = ui.page.querySelector('#pit');

  // Answers filled in from an earlier interview are cleared again if the number changes to a team without one.
  let filled = false;
  const fill = () => {
    const pit = pitOf(Number(form.team.value));
    const before = ui.page.querySelector('#pit-before');
    before.hidden = !pit;
    if (!pit && !filled) return;
    filled = Boolean(pit);
    const by = pit && ui.state.members.find((m) => m.uid === pit.by);
    before.textContent = `Pit scouted before${by ? ` by ${by.name || by.email}` : ''}. Saving replaces it.`;
    form.drivetrain.value = pit?.drivetrain ?? '';
    form.notes.value = pit?.notes ?? '';
    for (const input of form.querySelectorAll('.claim')) {
      const [period, id] = input.name.split('.');
      if (input.type === 'checkbox') input.checked = Boolean(pit?.claims[period][id]);
      else input.value = pit?.claims[period][id] ?? '';
    }
  };
  wireNumpads(form);
  form.team.oninput = fill;
  fill();

  ui.page.querySelector('#cancel').onclick = () => back();
  form.onsubmit = (e) => {
    e.preventDefault();
    const claims = { auto: {}, teleop: {} };
    for (const input of form.querySelectorAll('.claim')) {
      const [period, id] = input.name.split('.');
      const claim = input.type === 'checkbox' ? Number(input.checked) : Number(input.value);
      if (claim) claims[period][id] = claim;
    }
    const pit = { season: season.id, team: Number(form.team.value), claims, drivetrain: form.drivetrain.value, notes: form.notes.value.trim() };
    ui.fb.savePit(pit, ui.showError);
    // Shown straight away; the team's list catches up when the save reaches the backend.
    ui.state.pits = [...ui.state.pits.filter((p) => p.team !== pit.team), { ...pit, by: ui.state.user.uid }];
    back();
  };
}
