// The Routes tab: the team's routes, the editor, the player that runs routes together, and sharing by QR code.
import QRCode from 'qrcode';
import season from './seasons/2027.js';
import { fieldSvg, robotSvg, pathSvg, fieldPoint } from './field.js';
import {
  DEFAULT_ROBOT, MAX_STEPS, ACTION_SECONDS, timeline, poseAt, routePoints, startProblem, hiveCrossing, collisions, encodeRoute,
} from './route.js';
import { scanCode } from './scanner.js';
import { esc, confirmDialog } from './ui.js';
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

export function renderRouteList() {
  const routes = [...ui.state.routes].sort((a, b) => a.name.localeCompare(b.name));
  ui.page.innerHTML = `
    <div class="row"><h1>Routes</h1>
      <div class="row">
        <button id="scan-route" class="secondary">Scan</button>
        <button id="new-route">New route</button>
      </div>
    </div>
    ${routes.length ? `
      <ul class="route-list">${routes.map((r) => `
        <li><button class="route-card" data-id="${esc(r.id)}">
          <span class="chip ${esc(r.alliance)}">${esc(r.team || ALLIANCES[r.alliance])}</span>
          <span><strong>${esc(r.name)}</strong><span class="muted small">${esc(summary(r))}${r.shared ? ' · Shared with you' : ''}</span></span>
        </button></li>`).join('')}
      </ul>
      <button id="play-routes" class="secondary">Play routes together</button>`
    : '<div class="card empty"><p class="muted">No routes yet.</p></div>'}`;
  ui.page.querySelector('#new-route').onclick = () => openEditor(newRoute());
  ui.page.querySelector('#scan-route').onclick = scanRoute;
  ui.page.querySelector('#play-routes')?.addEventListener('click', () => openPlayer([]));
  ui.page.querySelector('.route-list')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (card) openEditor(structuredClone(ui.state.routes.find((r) => r.id === card.dataset.id)));
  });
}

// Opens one of the team's saved routes in the editor.
export const openRoute = (id) => openEditor(structuredClone(ui.state.routes.find((r) => r.id === id)));

function scanRoute() {
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
    robot: { ...DEFAULT_ROBOT }, start: { ...season.field.starts.red }, steps: [], shared: false,
  };
}

// ---------- editor ----------

// `route` is a copy, so nothing changes until Save. `selected` is -1 for the start, or a step's index. `saved` is the
// route as last saved, so leaving with unsaved changes can ask first.
function openEditor(route, saved = JSON.stringify(routeData(route))) {
  let selected = route.steps.length - 1;
  let dragging = false;
  scrollTo(0, 0);
  ui.page.innerHTML = `
    <div class="row"><button id="back" class="link">‹ Routes</button></div>
    <input id="route-name" maxlength="100" placeholder="Route name, e.g. Left side 3 tips" value="${esc(route.name)}" aria-label="Route name" />
    <div class="row editor-options">
      <div class="segmented" role="group" aria-label="Alliance">${Object.entries(ALLIANCES).map(([id, label]) =>
        `<button type="button" data-alliance="${id}" class="${id}">${label}</button>`).join('')}</div>
      <div class="segmented" role="group" aria-label="Period">${Object.entries(PERIODS).map(([id, label]) =>
        `<button type="button" data-phase="${id}">${label}</button>`).join('')}</div>
      <input id="route-team" data-numpad="Team number" pattern="[0-9]*" maxlength="6" placeholder="Team #" value="${esc(route.team ?? '')}" aria-label="Team number" />
      <button id="robot" class="secondary">Robot</button>
    </div>
    <div id="field" class="field-wrap"></div>
    <p id="route-info" class="muted small"></p>
    <p id="route-problem" class="error" hidden></p>
    <div id="selection" class="card"></div>
    <div class="row">
      <button id="save">Save</button>
      <button id="play" class="secondary">Play</button>
      <button id="share" class="secondary">Share</button>
      ${route.id ? '<button id="delete" class="danger">Delete</button>' : ''}
    </div>`;

  const fieldBox = ui.page.querySelector('#field');
  const poseOf = (i) => (i < 0 ? route.start : route.steps[i]);

  function draw() {
    const pose = poseOf(selected);
    fieldBox.innerHTML = fieldSvg(season, `
      ${pathSvg(season, route, route.alliance, selected)}
      ${robotSvg(season, route.start, route.robot, `${route.alliance} start${selected < 0 ? ' selected' : ''}`, esc(route.team ?? ''))}
      ${selected >= 0 ? robotSvg(season, pose, route.robot, `${route.alliance} ghost`) : ''}`);
    const { duration } = timeline(route);
    const limit = season.periods[route.phase];
    ui.page.querySelector('#route-info').textContent =
      `${route.steps.length} steps · ${routePoints(route, season)} points · ${seconds(duration)} of ${limit} s. Tap the field to add a step, drag to move.`;
    const problem = routeProblem(route, duration);
    const box = ui.page.querySelector('#route-problem');
    box.hidden = !problem;
    box.textContent = problem ?? '';
  }

  function drawSelection() {
    const pose = poseOf(selected);
    const step = selected >= 0 ? route.steps[selected] : null;
    const actions = season.actions.filter((a) => a.points[route.phase] !== null);
    ui.page.querySelector('#selection').innerHTML = `
      <h2>${step ? `Step ${selected + 1}` : 'Start'}</h2>
      <label>Facing <output id="heading-value">${Math.round(pose.h)}°</output>
        <input id="heading" type="range" min="-180" max="180" step="5" value="${Math.round(pose.h)}" />
      </label>
      ${step ? `
        <label>Action
          <select id="action">
            <option value="">None</option>
            ${actions.map((a) => `<option value="${a.id}" ${a.id === step.action ? 'selected' : ''}>${esc(a.label)} (${a.points[route.phase]})</option>`).join('')}
          </select>
        </label>
        <label>Extra wait (seconds)<input id="wait" type="number" min="0" max="30" step="0.5" value="${step.wait}" /></label>
        <div class="row">
          <button type="button" id="prev-step" class="secondary" ${selected === 0 ? 'disabled' : ''}>‹</button>
          <button type="button" id="next-step" class="secondary" ${selected === route.steps.length - 1 ? 'disabled' : ''}>›</button>
          <button type="button" id="delete-step" class="danger">Delete step</button>
        </div>` : '<p class="muted small">Drag the robot to where it starts the match.</p>'}`;
    const heading = ui.page.querySelector('#heading');
    heading.oninput = () => {
      pose.h = Number(heading.value);
      ui.page.querySelector('#heading-value').textContent = `${pose.h}°`;
      draw();
    };
    if (!step) return;
    ui.page.querySelector('#action').onchange = (e) => { step.action = e.target.value || null; draw(); };
    ui.page.querySelector('#wait').oninput = (e) => { step.wait = Math.max(0, Number(e.target.value) || 0); draw(); };
    ui.page.querySelector('#prev-step').onclick = () => select(selected - 1);
    ui.page.querySelector('#next-step').onclick = () => select(selected + 1);
    ui.page.querySelector('#delete-step').onclick = () => {
      route.steps.splice(selected, 1);
      select(selected - 1);
    };
  }

  function select(i) {
    selected = i;
    draw();
    drawSelection();
  }

  function moveTo(point) {
    const pose = poseOf(selected);
    pose.x = round(clamp(point.x, season.field.size));
    pose.y = round(clamp(point.y, season.field.size));
    draw();
  }

  // Tapping the start robot or a step's dot picks it up; tapping anywhere else on the field adds a step there,
  // facing the way the robot already faces. Either way, dragging moves it.
  fieldBox.onpointerdown = (e) => {
    const svg = fieldBox.querySelector('svg');
    const dot = e.target.closest('[data-step]');
    if (dot) select(Number(dot.dataset.step));
    else if (e.target.closest('.robot.start')) select(-1);
    else {
      if (route.steps.length >= MAX_STEPS) return ui.showError(new Error(`A route can have up to ${MAX_STEPS} steps.`));
      const point = fieldPoint(svg, e, season);
      const last = route.steps.at(-1) ?? route.start;
      route.steps.push({ x: round(point.x), y: round(point.y), h: last.h, action: null, wait: 0 });
      select(route.steps.length - 1);
    }
    dragging = true;
    fieldBox.setPointerCapture(e.pointerId);
  };
  fieldBox.onpointermove = (e) => {
    if (dragging) moveTo(fieldPoint(fieldBox.querySelector('svg'), e, season));
  };
  fieldBox.onpointerup = () => { dragging = false; };
  fieldBox.onpointercancel = fieldBox.onpointerup;

  const options = ui.page.querySelector('.editor-options');
  const markOptions = () => {
    options.querySelectorAll('[data-alliance]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.alliance === route.alliance)));
    options.querySelectorAll('[data-phase]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phase === route.phase)));
  };
  options.onclick = (e) => {
    const { alliance, phase } = e.target.dataset;
    // A new alliance moves an untouched start to that alliance's wall.
    if (alliance && alliance !== route.alliance) {
      route.alliance = alliance;
      if (!route.steps.length) route.start = { ...season.field.starts[alliance] };
    }
    if (phase) {
      route.phase = phase;
      // Actions that can't score in the new period are taken off their steps.
      for (const step of route.steps) {
        if (season.actions.find((a) => a.id === step.action)?.points[phase] === null) step.action = null;
      }
    }
    markOptions();
    draw();
    drawSelection();
  };
  ui.page.querySelector('#route-name').oninput = (e) => { route.name = e.target.value; };
  wireNumpads(ui.page);
  ui.page.querySelector('#route-team').oninput = (e) => {
    route.team = Number(e.target.value) || null;
    draw();
  };
  ui.page.querySelector('#robot').onclick = () => openRobotDialog(route, draw);
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

  markOptions();
  draw();
  drawSelection();
}

// The first thing wrong with the route, or null.
function routeProblem(route, duration) {
  const hive = hiveCrossing(route, season);
  if (route.phase === 'auto' && startProblem(route, season)) return startProblem(route, season);
  if (hive) return `Step ${hive.step} drives through the ${ALLIANCES[hive.alliance].toLowerCase()} hive.`;
  if (route.phase === 'auto') {
    const problem = startProblem(route, season);
    if (problem) return problem;
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
      <div class="row">
        <button value="save">Done</button>
        <button value="cancel" formnovalidate class="secondary">Cancel</button>
      </div>
    </form>`;
  const form = ui.dialog.querySelector('form');
  form.onsubmit = (e) => {
    if (e.submitter.value !== 'save') return;
    for (const key of ['width', 'length', 'speed', 'turnSpeed']) route.robot[key] = Number(form[key].value);
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
    <div class="row"><h1>Play routes</h1>${extra.length ? `<span class="muted">${PERIODS[phase]}</span>` : `
      <div class="segmented" role="group" aria-label="Period">${Object.entries(PERIODS).map(([id, label]) =>
        `<button type="button" data-phase="${id}" aria-pressed="${id === phase}">${label}</button>`).join('')}</div>`}</div>
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
    </div>` : `<p class="muted">No saved ${PERIODS[phase].toLowerCase()} routes yet.</p>`}`;

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
