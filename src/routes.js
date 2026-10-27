// The Routes tab: the team's routes, the editor, the player that runs routes together, and sharing by QR code.
import QRCode from 'qrcode';
import season from './seasons/2027.js';
import { fieldSvg, robotSvg, pathSvg, turnHandleSvg, fieldPoint, tileName } from './field.js';
import {
  DEFAULT_ROBOT, MAX_STEPS, ACTION_SECONDS, timeline, poseAt, routePoints, startProblem, hiveCrossing, collisions, encodeRoute,
} from './route.js';
import { scanCode } from './scanner.js';
import { esc, confirmDialog, icon, ICON_PLAY } from './ui.js';
import { wireNumpads } from './numpad.js';

const PERIODS = { auto: 'Auto', teleop: 'Teleop' };
const ALLIANCES = { red: 'Red', blue: 'Blue' };
const seconds = (s) => `${s.toFixed(1)} s`;
const round = (n) => Math.round(n * 2) / 2;
const clamp = (n, size) => Math.min(size, Math.max(0, n));

// Set by the app (main.js): where pages and dialogs go, the backend, the team's routes and how to show errors.
let ui;
export const startRoutes = (context) => { ui = context; };

const routeLink = (route) => `${location.origin}${location.pathname}#route=${encodeRoute(route)}`;

// The route as stored, without the id the app adds when reading it.
const routeData = ({ id, ...route }) => route;

function summary(route) {
  const { duration } = timeline(route);
  return `${PERIODS[route.phase]} · ${routePoints(route, season)} points · ${seconds(duration)}`;
}

// ---------- list ----------

// What's typed in the search, kept while the list is redrawn for teammates' changes.
let routeQuery = '';

export function renderRouteList() {
  ui.page.innerHTML = `
    <div class="toolbar">
      <input id="route-search" type="search" placeholder="Search routes…" aria-label="Search routes" value="${esc(routeQuery)}" />
      <button id="play-routes" class="secondary with-icon">${ICON_PLAY}<span>Play</span></button>
      <button id="new-route" class="fab">+ New route</button>
    </div>
    <div id="route-list"></div>`;
  ui.page.querySelector('#new-route').onclick = () => openEditor(newRoute());
  ui.page.querySelector('#play-routes').onclick = () => openPlayer([]);
  ui.page.querySelector('#route-search').oninput = (e) => {
    routeQuery = e.target.value.trim().toLowerCase();
    showRouteList();
  };
  ui.page.querySelector('#route-list').onclick = (e) => {
    const card = e.target.closest('[data-id]');
    if (card) openEditor(structuredClone(ui.state.routes.find((r) => r.id === card.dataset.id)));
  };
  showRouteList();
}

// Redraws the list, also for teammates' changes (main.js), leaving the search as it is: the routes whose name or team
// number has the search in it, by name.
export function showRouteList() {
  const routes = ui.state.routes.filter((r) => `${r.name} ${r.team ?? ''}`.toLowerCase().includes(routeQuery))
    .sort((a, b) => a.name.localeCompare(b.name));
  ui.page.querySelector('#route-list').innerHTML = routes.length ? `
    <ul class="route-list">${routes.map((r) => `
      <li><button class="route-card" data-id="${esc(r.id)}">
        <span class="chip ${esc(r.alliance)}">${esc(r.team || ALLIANCES[r.alliance])}</span>
        <span><strong>${esc(r.name)}</strong><span class="muted small">${esc(summary(r))}${r.shared ? ' · Shared with you' : ''}</span></span>
      </button></li>`).join('')}
    </ul>`
    : `<div class="card empty"><p class="muted">${routeQuery ? 'No routes found.' : 'No routes yet.'}</p></div>`;
}

// Opens one of the team's saved routes in the editor.
export const openRoute = (id) => openEditor(structuredClone(ui.state.routes.find((r) => r.id === id)));

export function scanRoute() {
  scanCode(ui.dialog, 'Scan a route', 'Point the camera at another team’s route QR code.').then((text) => {
    if (!text) return;
    const data = new URLSearchParams(text.split('#')[1]).get('route');
    if (!data) throw new Error('That QR code isn’t a route.');
    location.hash = `route=${data}`;
  }).catch(ui.showError);
}

function newRoute() {
  return {
    name: '', season: season.id, phase: 'auto', alliance: 'red', team: ui.state.connection.teamNumber ?? null,
    robot: { ...(ui.state.robot ?? DEFAULT_ROBOT) }, start: { ...season.field.starts.red }, steps: [], shared: false,
  };
}

// ---------- editor ----------

const ICON_UNDO = icon('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>');
const ICON_SHARE = icon('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2M20 14v6h-4M17 19h-1"/>');
// The four ways the field's walls face, as headings (0 is toward the blue side, 90 away from the audience).
const FACINGS = [{ h: 90, arrow: '↑', name: 'up' }, { h: 0, arrow: '→', name: 'right' }, { h: -90, arrow: '↓', name: 'down' }, { h: 180, arrow: '←', name: 'left' }];
const ARROWS = { 90: '↑', 0: '→', '-90': '↓', 180: '←' };
const WAIT_STEP = 0.5;
const MAX_WAIT = 30;
// What undo puts back. The name and team number are typed, so the browser's own undo covers them.
const shape = ({ alliance, phase, robot, start, steps }) => JSON.stringify({ alliance, phase, robot, start, steps });
// Headings stay above -180 and up to 180, in 15° turns when dragged.
const normal = (h) => 180 - ((((180 - h) % 360) + 360) % 360);
const facingText = (h) => `${ARROWS[normal(h)] ?? ''} ${Math.round(normal(h))}°`.trim();

// `route` is a copy, so nothing changes until Save. `selected` is -1 for the start, or a step's index. `saved` is the
// route as last saved, so leaving with unsaved changes can ask first.
function openEditor(route, saved = JSON.stringify(routeData(route))) {
  let selected = route.steps.length - 1;
  // What a pointer on the field is doing: null, 'move' (the selected start or step) or 'turn' (its handle).
  let drag = null;
  const history = [];
  const remember = () => history.push(shape(route));
  scrollTo(0, 0);
  ui.page.innerHTML = `
    <div class="row editor-top">
      <button id="back" class="link">‹ Routes</button>
      <div class="row">
        <button id="undo" class="icon" aria-label="Undo" title="Undo" disabled>${ICON_UNDO}</button>
        <button id="play" class="icon" aria-label="Play" title="Play">${ICON_PLAY}</button>
        <button id="share" class="icon" aria-label="Share" title="Share">${ICON_SHARE}</button>
        <button id="save">Save</button>
      </div>
    </div>
    <div class="editor">
      <div class="editor-head">
        <input id="route-name" maxlength="100" placeholder="Route name, e.g. Left side 3 tips" value="${esc(route.name)}" aria-label="Route name" />
        <div class="row editor-options">
          <div class="segmented" role="group" aria-label="Alliance">${Object.entries(ALLIANCES).map(([id, label]) =>
            `<button type="button" data-alliance="${id}" class="${id}">${label}</button>`).join('')}</div>
          <div class="segmented" role="group" aria-label="Period">${Object.entries(PERIODS).map(([id, label]) =>
            `<button type="button" data-phase="${id}">${label}</button>`).join('')}</div>
          <input id="route-team" data-numpad="Team number" pattern="[0-9]*" maxlength="6" placeholder="Team #" value="${esc(route.team ?? '')}" aria-label="Team number" />
          <button id="robot" class="secondary robot-button"></button>
        </div>
      </div>
      <div class="editor-field">
        <div id="totals" class="totals"></div>
        <p id="route-problem" class="error" hidden></p>
        <div id="field" class="field-wrap"></div>
        <p id="hint" class="muted small"></p>
        <ul class="legend muted small">
          <li><svg class="hive" viewBox="0 0 12 12" aria-hidden="true"><polygon points="1,11 11,11 11,5 6,1 1,5" /></svg>Hive</li><li><i class="zone"></i>Loading zone</li><li><i class="garden"></i>Garden</li>
          <li><i class="flower"></i>Flower</li><li><i class="middle"></i>Middle line</li><li><i class="area"></i>Alliance area</li>
        </ul>
      </div>
      <div class="editor-side">
        <ol id="steps" class="step-list"></ol>
        ${route.id ? '<button id="delete" class="danger">Delete route</button>' : ''}
      </div>
    </div>`;

  const fieldBox = ui.page.querySelector('#field');
  const stepList = ui.page.querySelector('#steps');
  const poseOf = (i) => (i < 0 ? route.start : route.steps[i]);
  const usable = () => season.actions.filter((a) => a.points[route.phase] !== null);
  const actionOf = (step) => season.actions.find((a) => a.id === step.action);

  function drawField() {
    const pose = poseOf(selected);
    fieldBox.innerHTML = fieldSvg(season, `
      ${pathSvg(season, route, route.alliance, selected)}
      ${robotSvg(season, route.start, route.robot, `${route.alliance} start${selected < 0 ? ' selected' : ''}`, esc(route.team ?? ''))}
      ${selected >= 0 ? robotSvg(season, pose, route.robot, `${route.alliance} ghost`) : ''}
      ${turnHandleSvg(season, pose, route.robot)}`);
  }

  function drawTotals(duration) {
    const limit = season.periods[route.phase];
    ui.page.querySelector('#totals').innerHTML = `
      <div><b>${routePoints(route, season)}</b><span>points</span></div>
      <div class="time${duration > limit ? ' over' : ''}">
        <b>${seconds(duration)}</b><span>of ${limit} s ${PERIODS[route.phase].toLowerCase()}</span>
        <span class="bar"><i style="width: ${Math.min(100, (duration / limit) * 100)}%"></i></span>
      </div>
      <div><b>${route.steps.length}</b><span>steps</span></div>`;
    ui.page.querySelector('#hint').textContent = route.steps.length
      ? 'Tap the field to add a step. Drag a dot to move it, or the round handle to turn the robot.'
      : 'Drag the robot to where it starts, then tap the field to add the first step.';
    const problem = routeProblem(route, duration);
    const box = ui.page.querySelector('#route-problem');
    box.hidden = !problem;
    box.textContent = problem ?? '';
  }

  // One row per step, the selected one open with its settings.
  function drawSteps(ends) {
    const rows = [-1, ...route.steps.keys()].map((i) => {
      const pose = poseOf(i);
      const step = i >= 0 ? route.steps[i] : null;
      const action = step && actionOf(step);
      const title = !step ? 'Start' : action ? action.label : 'Drive';
      const detail = [tileName(season, pose), facingText(pose.h), step ? `done at ${seconds(ends[i])}` : ''].filter(Boolean).join(' · ');
      return `
        <li class="step-row${i === selected ? ' selected' : ''}">
          <button type="button" class="step-head" data-select="${i}" data-key="select-${i}" aria-expanded="${i === selected}">
            <span class="step-num ${route.alliance}">${step ? i + 1 : 'S'}</span>
            <span class="step-title"><strong>${esc(title)}</strong><span class="muted small">${detail}</span></span>
            ${action ? `<span class="step-points">+${action.points[route.phase]}</span>` : ''}
          </button>
          ${i === selected ? stepSettings(pose, step) : ''}
        </li>`;
    });
    stepList.innerHTML = rows.join('');
  }

  function stepSettings(pose, step) {
    return `
      <div class="step-edit">
        <div class="setting">
          <span class="setting-label">Facing <output>${facingText(pose.h)}</output></span>
          <div class="facing">
            ${FACINGS.map((f) => `<button type="button" class="secondary" data-face="${f.h}" data-key="face-${f.h}" aria-label="Face ${f.name}" aria-pressed="${normal(pose.h) === normal(f.h)}">${f.arrow}</button>`).join('')}
            <button type="button" class="secondary" data-turn-by="15" data-key="turn-left" aria-label="Turn left 15°">⟲15°</button>
            <button type="button" class="secondary" data-turn-by="-15" data-key="turn-right" aria-label="Turn right 15°">⟳15°</button>
          </div>
        </div>
        ${step ? `
          <div class="setting">
            <span class="setting-label">Action</span>
            <div class="choices">
              <button type="button" class="secondary" data-action="" data-key="action-none" aria-pressed="${!step.action}">None</button>
              ${usable().map((a) => `<button type="button" class="secondary" data-action="${a.id}" data-key="action-${a.id}" aria-pressed="${a.id === step.action}">
                ${esc(a.label)} <span>+${a.points[route.phase]}</span></button>`).join('')}
            </div>
          </div>
          <div class="setting">
            <span class="setting-label">Extra wait</span>
            <div class="stepper">
              <button type="button" class="secondary" data-wait="-1" data-key="wait-less" aria-label="Wait less" ${step.wait <= 0 ? 'disabled' : ''}>−</button>
              <output>${seconds(step.wait)}</output>
              <button type="button" class="secondary" data-wait="1" data-key="wait-more" aria-label="Wait more" ${step.wait >= MAX_WAIT ? 'disabled' : ''}>+</button>
            </div>
          </div>
          <button type="button" class="danger" data-delete-step data-key="delete-step">Delete step ${selected + 1}</button>`
        : '<p class="muted small">Drag the robot on the field to where it starts the match.</p>'}
      </div>`;
  }

  // Redraws everything that shows the route, keeping the keyboard on the button it was on.
  function draw() {
    const key = document.activeElement?.dataset.key;
    const { ends, duration } = timeline(route);
    drawField();
    drawTotals(duration);
    drawSteps(ends);
    if (key) ui.page.querySelector(`[data-key="${key}"]`)?.focus();
    ui.page.querySelector('#undo').disabled = !history.length;
    ui.page.querySelector('#robot').innerHTML = `Robot <span>${route.robot.width} × ${route.robot.length} in · ${route.robot.speed} in/s</span>`;
    options.querySelectorAll('[data-alliance]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.alliance === route.alliance)));
    options.querySelectorAll('[data-phase]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phase === route.phase)));
  }

  function select(i) {
    selected = i;
    draw();
  }

  // Tapping the start robot or a step's dot picks it up, its handle turns it; tapping anywhere else on the field adds a
  // step there, facing the way the robot already faces. Dragging moves or turns until the finger lifts.
  fieldBox.onpointerdown = (e) => {
    const svg = fieldBox.querySelector('svg');
    const dot = e.target.closest('[data-step]');
    remember();
    if (e.target.closest('[data-turn]')) drag = 'turn';
    else if (dot) {
      selected = Number(dot.dataset.step);
      drag = 'move';
    } else if (e.target.closest('.robot.start')) {
      selected = -1;
      drag = 'move';
    } else {
      if (route.steps.length >= MAX_STEPS) {
        history.pop();
        return ui.showError(new Error(`A route can have up to ${MAX_STEPS} steps.`));
      }
      const point = fieldPoint(svg, e, season);
      const last = route.steps.at(-1) ?? route.start;
      route.steps.push({ x: round(clamp(point.x, season.field.size)), y: round(clamp(point.y, season.field.size)), h: last.h, action: null, wait: 0 });
      selected = route.steps.length - 1;
      drag = 'move';
    }
    draw();
    fieldBox.setPointerCapture(e.pointerId);
  };
  fieldBox.onpointermove = (e) => {
    if (!drag) return;
    const point = fieldPoint(fieldBox.querySelector('svg'), e, season);
    const pose = poseOf(selected);
    if (drag === 'turn') {
      pose.h = normal(Math.round((Math.atan2(point.y - pose.y, point.x - pose.x) * 180) / Math.PI / 15) * 15);
    } else {
      pose.x = round(clamp(point.x, season.field.size));
      pose.y = round(clamp(point.y, season.field.size));
    }
    draw();
  };
  fieldBox.onpointerup = () => {
    // A tap that changed nothing leaves nothing to undo.
    if (history.at(-1) === shape(route)) history.pop();
    drag = null;
    draw();
  };
  fieldBox.onpointercancel = fieldBox.onpointerup;

  stepList.onclick = (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const { select: index, face, turnBy, action, wait } = button.dataset;
    if (index !== undefined) return select(Number(index));
    remember();
    const pose = poseOf(selected);
    const step = route.steps[selected];
    if (face !== undefined) pose.h = Number(face);
    if (turnBy !== undefined) pose.h = normal(pose.h + Number(turnBy));
    if (action !== undefined) step.action = action || null;
    if (wait !== undefined) step.wait = Math.min(MAX_WAIT, Math.max(0, step.wait + Number(wait) * WAIT_STEP));
    if (button.hasAttribute('data-delete-step')) {
      route.steps.splice(selected, 1);
      selected = Math.min(selected, route.steps.length - 1);
    }
    draw();
  };

  ui.page.querySelector('#undo').onclick = () => {
    Object.assign(route, JSON.parse(history.pop()));
    selected = Math.min(selected, route.steps.length - 1);
    draw();
  };

  const options = ui.page.querySelector('.editor-options');
  options.onclick = (e) => {
    const { alliance, phase } = e.target.dataset;
    if (!alliance && !phase) return;
    remember();
    // A new alliance moves an untouched start to that alliance's wall.
    if (alliance && alliance !== route.alliance) {
      route.alliance = alliance;
      if (!route.steps.length) route.start = { ...season.field.starts[alliance] };
    }
    if (phase) {
      route.phase = phase;
      // Actions that can't score in the new period are taken off their steps.
      for (const step of route.steps) {
        if (actionOf(step)?.points[phase] === null) step.action = null;
      }
    }
    if (history.at(-1) === shape(route)) history.pop();
    draw();
  };
  ui.page.querySelector('#route-name').oninput = (e) => { route.name = e.target.value; };
  wireNumpads(ui.page);
  ui.page.querySelector('#route-team').oninput = (e) => {
    route.team = Number(e.target.value) || null;
    draw();
  };
  ui.page.querySelector('#robot').onclick = () => {
    const before = shape(route);
    openRobotDialog(route, () => {
      history.push(before);
      draw();
    });
  };
  ui.page.querySelector('#back').onclick = () => {
    if (JSON.stringify(routeData(route)) === saved) return renderRouteList();
    confirmDialog(ui.dialog, { title: 'Leave without saving?', text: 'Your changes to this route will be lost.', action: 'Leave' }, renderRouteList);
  };
  ui.page.querySelector('#play').onclick = () => openPlayer([route], () => openEditor(route, saved));
  ui.page.querySelector('#share').onclick = () => openShareDialog(route);
  ui.page.querySelector('#save').onclick = () => {
    try {
      saveRoute(route);
    } catch (error) {
      ui.showError(error);
    }
  };
  ui.page.querySelector('#delete')?.addEventListener('click', () => {
    confirmDialog(ui.dialog, { title: `Delete ${route.name}?`, text: 'This deletes it for your whole team.', action: 'Delete' }, () => {
      ui.fb.deleteRoute(route.id).catch(ui.showError);
      renderRouteList();
    });
  });

  draw();
}

// The first thing wrong with the route, or null.
function routeProblem(route, duration) {
  if (route.phase === 'auto') {
    const problem = startProblem(route, season);
    if (problem) return problem;
  }
  const hive = hiveCrossing(route, season);
  if (hive) return `Step ${hive.step} drives through the ${ALLIANCES[hive.alliance].toLowerCase()} hive.`;
  if (route.phase === 'auto') {
    const side = season.field.sides[route.alliance];
    if (route.steps.some((s) => s.x < side.x || s.x > side.x + side.width)) {
      return 'This auto route crosses into the other alliance’s side, which risks a major foul (G402).';
    }
  }
  if (duration > season.periods[route.phase]) return `This route takes longer than ${PERIODS[route.phase].toLowerCase()} (${season.periods[route.phase]} s).`;
  return null;
}

// Saves the route. Saving is allowed with a warning showing (like a long teleop route), but not with a broken start,
// since an auto route that can't legally start is no use to anyone.
function saveRoute(route) {
  if (!route.name.trim()) throw new Error('Give the route a name.');
  if (route.phase === 'auto' && startProblem(route, season)) throw new Error(startProblem(route, season));
  route.name = route.name.trim();
  route.id = ui.fb.saveRoute(route.id ?? null, routeData(route), ui.showError);
  renderRouteList();
}

function openRobotDialog(route, onChange) {
  const { width, length, speed, turnSpeed } = route.robot;
  ui.dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>Robot</h2>
      <div class="row pair">
        <label>Width (in)<input name="width" type="number" min="6" max="18" step="0.5" value="${width}" /></label>
        <label>Length (in)<input name="length" type="number" min="6" max="18" step="0.5" value="${length}" /></label>
      </div>
      <div class="row pair">
        <label>Top speed (in/s)<input name="speed" type="number" min="5" max="200" value="${speed}" /></label>
        <label>Turn speed (°/s)<input name="turnSpeed" type="number" min="30" max="1000" value="${turnSpeed}" /></label>
      </div>
      <p class="muted small">Steps take as long as the robot needs to drive or turn to them at these speeds. Each action adds ${ACTION_SECONDS} s.</p>
      <label class="check"><input name="teamRobot" type="checkbox" /> Start the team’s new routes with this robot</label>
      <div class="row">
        <button value="save">Done</button>
        <button value="cancel" formnovalidate class="secondary">Cancel</button>
      </div>
    </form>`;
  const form = ui.dialog.querySelector('form');
  form.onsubmit = (e) => {
    if (e.submitter.value !== 'save') return;
    for (const key of ['width', 'length', 'speed', 'turnSpeed']) route.robot[key] = Number(form[key].value);
    if (form.teamRobot.checked) ui.fb.saveRobot({ ...route.robot }, ui.showError);
    onChange();
  };
  ui.dialog.showModal();
}

function openShareDialog(route) {
  if (route.phase === 'auto' && startProblem(route, season)) return ui.showError(new Error(startProblem(route, season)));
  const link = routeLink(route);
  ui.dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>Share ${esc(route.name || 'route')}</h2>
      <canvas id="qr"></canvas>
      <p class="muted small">Another team scans this to play your route next to theirs. It holds only this route, nothing else of your team’s.</p>
      <button type="button" id="copy-route">Copy link</button>
      <div class="row"><button value="close" class="secondary">Close</button></div>
    </form>`;
  const copy = ui.dialog.querySelector('#copy-route');
  copy.onclick = () => navigator.clipboard.writeText(link).then(() => { copy.textContent = 'Copied'; }).catch(ui.showError);
  QRCode.toCanvas(ui.dialog.querySelector('#qr'), link, { width: 260, margin: 1 }).catch(ui.showError);
  ui.dialog.showModal();
}

// ---------- player ----------

// Plays routes of one period together on one timeline, from the start of that period. `extra` routes (one being edited,
// or one from a link) are always in and set the period; otherwise Auto/Teleop picks it. The team's saved routes of that
// period can be ticked on and off. `back` returns to where the player was opened from.
export function openPlayer(extra, back = renderRouteList, onSave = null, startPhase = 'auto') {
  const phase = extra[0]?.phase ?? startPhase;
  const saved = (ui.state.routes ?? []).filter((r) => r.phase === phase && !extra.some((e) => e.id && e.id === r.id));
  const chosen = new Set();
  scrollTo(0, 0);
  let time = 0;
  let playing = false;
  let frame = null;
  let last = 0;

  ui.page.innerHTML = `
    <div class="row">${back ? '<button id="back" class="link">‹ Back</button>' : ''}${onSave ? '<button id="save-shared">Add to my routes</button>' : ''}</div>
    <div class="row"><h1>Play routes</h1>${extra.length ? '' : `
      <div class="segmented" role="group" aria-label="Period">${Object.entries(PERIODS).map(([id, label]) =>
        `<button type="button" data-phase="${id}" aria-pressed="${id === phase}">${label}</button>`).join('')}</div>`}</div>
    ${extra.map((r) => `<p class="row route-summary"><span class="chip ${esc(r.alliance)}">${esc(r.team || ALLIANCES[r.alliance])}</span>
      <strong>${esc(r.name || 'Unnamed route')}</strong><span class="muted small">${esc(summary(r))}</span></p>`).join('')}
    <div id="field" class="field-wrap"></div>
    <div class="player-controls">
      <button id="play-pause" aria-label="Play">Play</button>
      <input id="scrub" type="range" min="0" step="0.1" value="0" aria-label="Time" />
      <output id="clock">0.0 s</output>
    </div>
    <p id="hits" class="muted small"></p>
    ${saved.length ? `<div class="card">
      <h2>Routes</h2>
      ${saved.map((r) => `<label class="check"><input type="checkbox" data-id="${esc(r.id)}" />
        <span class="chip ${esc(r.alliance)}">${esc(r.team || ALLIANCES[r.alliance])}</span><span>${esc(r.name)} <span class="muted small">${esc(summary(r))}</span></span></label>`).join('')}
    </div>` : extra.length ? '' : `<p class="muted">No saved ${PERIODS[phase].toLowerCase()} routes yet.</p>`}`;

  let routes = [];
  let timed = [];
  let hits = [];
  const scrub = ui.page.querySelector('#scrub');

  function update() {
    routes = [...extra, ...saved.filter((r) => chosen.has(r.id))];
    timed = routes.map((r) => timeline(r));
    const end = Math.max(...routes.map((r) => season.periods[r.phase]), ...timed.map((t) => t.duration), 1);
    scrub.max = String(end);
    hits = collisions(routes);
    const first = hits[0];
    ui.page.querySelector('#hits').textContent = !routes.length ? 'Pick routes to play.'
      : first ? `Robots collide at ${seconds(first.time)} (${label(routes[first.a])} and ${label(routes[first.b])}).`
        : routes.length > 1 ? 'No collisions.' : '';
    draw();
  }

  const label = (r) => r.team || r.name;

  function draw() {
    // Robots overlapping now (hits are a tenth of a second apart) show in red.
    const hit = new Set(hits.filter((h) => Math.abs(h.time - time) < 0.05).flatMap((h) => [h.a, h.b]));
    ui.page.querySelector('#field').innerHTML = fieldSvg(season, routes.map((r, i) => `
      ${pathSvg(season, r, `${r.alliance} faint`)}
      ${robotSvg(season, poseAt(timed[i], r, time), r.robot, `${r.alliance}${hit.has(i) ? ' hit' : ''}`, esc(label(r)))}`).join(''));
    scrub.value = String(time);
    ui.page.querySelector('#clock').textContent = seconds(time);
  }

  function tick(now) {
    time = Math.min(Number(scrub.max), time + (now - last) / 1000);
    last = now;
    draw();
    if (time >= Number(scrub.max) || !ui.page.querySelector('#play-pause')) return stop();
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(frame);
    const button = ui.page.querySelector('#play-pause');
    if (button) button.textContent = 'Play';
  }

  ui.page.querySelector('#play-pause').onclick = (e) => {
    if (playing) return stop();
    if (time >= Number(scrub.max)) time = 0;
    playing = true;
    e.currentTarget.textContent = 'Pause';
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };
  scrub.oninput = () => {
    stop();
    time = Number(scrub.value);
    draw();
  };
  ui.page.querySelector('.card')?.addEventListener('change', (e) => {
    const { id } = e.target.dataset;
    if (e.target.checked) chosen.add(id);
    else chosen.delete(id);
    update();
  });
  ui.page.querySelector('#back')?.addEventListener('click', () => {
    stop();
    back();
  });
  ui.page.querySelector('[data-phase]')?.parentElement.addEventListener('click', (e) => {
    const button = e.target.closest('[data-phase]');
    if (!button || button.dataset.phase === phase) return;
    stop();
    openPlayer([], back, onSave, button.dataset.phase);
  });
  ui.page.querySelector('#save-shared')?.addEventListener('click', (e) => {
    e.currentTarget.disabled = true;
    onSave();
  });
  update();
}

// A route someone shared, opened from its link. Members can add it to their team's routes.
export function openSharedRoute(route, signedIn) {
  const save = () => {
    ui.fb.saveRoute(null, { ...route, shared: true }, ui.showError);
    renderRouteList();
  };
  openPlayer([route], signedIn ? renderRouteList : null, signedIn ? save : null);
}
