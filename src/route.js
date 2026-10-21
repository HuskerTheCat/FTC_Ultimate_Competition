// A route: where a robot starts and the steps it drives through, on the season's field.
// Positions are inches from the field's bottom-left corner seen from the audience, x to the right and y away from
// the audience. Headings are degrees, 0 facing right (toward the blue side), counterclockwise.
// Paths are straight lines; the robot turns evenly along each one. Times come from the robot's speeds, never typed.

// How long an action takes when the step doesn't add a wait. The manual gives no times, so teams add their own with wait.
export const ACTION_SECONDS = 2;
export const DEFAULT_ROBOT = { width: 18, length: 18, speed: 60, turnSpeed: 270 };
// Most steps a route can have, so a route always fits in one QR code.
export const MAX_STEPS = 40;

// The shortest turn from one heading to another, -180 to 180.
const turn = (from, to) => ((((to - from) % 360) + 540) % 360) - 180;

export const legPose = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, h: a.h + turn(a.h, b.h) * f });

// The route as timed pieces: a move to each step, then the step's action and wait standing still.
// Each piece is { from, to, start, end }, the robot standing still when from and to are the same pose.
export function timeline(route) {
  const { speed, turnSpeed } = route.robot;
  const pieces = [];
  let pose = route.start;
  let time = 0;
  for (const step of route.steps) {
    const move = Math.max(Math.hypot(step.x - pose.x, step.y - pose.y) / speed, Math.abs(turn(pose.h, step.h)) / turnSpeed);
    pieces.push({ from: pose, to: step, start: time, end: time + move });
    time += move;
    const still = (step.action ? ACTION_SECONDS : 0) + step.wait;
    if (still) pieces.push({ from: step, to: step, start: time, end: time + still });
    time += still;
    pose = step;
  }
  return { pieces, duration: time };
}

// Where the robot is at a time; it waits at the end once the route is done.
export function poseAt({ pieces }, route, time) {
  const piece = pieces.find((p) => time < p.end);
  if (!piece) return pieces.at(-1)?.to ?? route.start;
  const length = piece.end - piece.start;
  return legPose(piece.from, piece.to, length ? Math.max(0, time - piece.start) / length : 1);
}

// The points the route's actions would score in its period.
export const routePoints = (route, season) => route.steps.reduce((sum, step) =>
  sum + (season.actions.find((a) => a.id === step.action)?.points[route.phase] ?? 0), 0);

// The robot's four corners at a pose.
export function corners({ x, y, h }, { width, length }) {
  const rad = (h * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([f, s]) => ({
    x: x + (f * length * cos - s * width * sin) / 2,
    y: y + (f * length * sin + s * width * cos) / 2,
  }));
}

// Whether two convex shapes (lists of corners) overlap: they don't when some edge's direction separates them.
function overlap(a, b) {
  for (const shape of [a, b]) {
    for (let i = 0; i < shape.length; i++) {
      const p = shape[i];
      const q = shape[(i + 1) % shape.length];
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      const project = (points) => points.map((c) => c.x * nx + c.y * ny);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

const box = ({ x, y, width, height }) => [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];

// What's wrong with the route's start under the season's starting rules, or null when it's a legal start.
export function startProblem(route, season) {
  const { field } = season;
  const points = corners(route.start, route.robot);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const side = field.sides[route.alliance];
  const edge = 0.5;
  if (Math.min(...xs) < -edge || Math.max(...xs) > field.size + edge || Math.min(...ys) < -edge || Math.max(...ys) > field.size + edge) {
    return 'The robot has to be fully inside the field.';
  }
  if (Math.min(...xs) < side.x - edge || Math.max(...xs) > side.x + side.width + edge) return 'The robot has to start on its own alliance’s side.';
  if (Math.min(...xs) > edge && Math.max(...xs) < field.size - edge && Math.min(...ys) > edge && Math.max(...ys) < field.size - edge) {
    return 'The robot has to start touching the field wall.';
  }
  if (Object.values(field.loadingZones).some((zone) => overlap(points, box(zone)))) return 'The robot can’t start in a loading zone.';
  if (field.flowers.some((f) => overlap(points, box({ x: f.x - f.r, y: f.y - f.r, width: 2 * f.r, height: 2 * f.r })))) {
    return 'The robot can’t start touching a flower.';
  }
  return null;
}

// Whether the straight line from a to b passes through the box (Liang–Barsky clipping).
function crossesBox(a, b, { x, y, width, height }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let enter = 0;
  let leave = 1;
  for (const [p, q] of [[-dx, a.x - x], [dx, x + width - a.x], [-dy, a.y - y], [dy, y + height - a.y]]) {
    if (p === 0) {
      if (q < 0) return false;
    } else if (p < 0) enter = Math.max(enter, q / p);
    else leave = Math.min(leave, q / p);
  }
  return enter <= leave;
}

// The first step whose path drives the robot's centre through a hive, as { step, alliance }, or null.
export function hiveCrossing(route, season) {
  let from = route.start;
  for (const [i, step] of route.steps.entries()) {
    const alliance = Object.keys(season.field.hives).find((side) => crossesBox(from, step, season.field.hives[side]));
    if (alliance) return { step: i + 1, alliance };
    from = step;
  }
  return null;
}

// Times when robots of the routes playing together overlap, as [{ time, a, b }] with the routes' indexes, one per
// tenth of a second.
export function collisions(routes) {
  const timed = routes.map((route) => timeline(route));
  const end = Math.max(...timed.map((t) => t.duration));
  const hits = [];
  for (let time = 0; time <= end; time += 0.1) {
    const shapes = routes.map((route, i) => corners(poseAt(timed[i], route, time), route.robot));
    for (let a = 0; a < routes.length; a++) {
      for (let b = a + 1; b < routes.length; b++) {
        if (overlap(shapes[a], shapes[b])) hits.push({ time, a, b });
      }
    }
  }
  return hits;
}

// ---------- share links ----------
// A route travels as a link: <site>#route=<data>. The data is the route as a short JSON list, base64url encoded,
// so another team can open it without being on this team. The first number is the format, for future changes.

const FORMAT = 1;
const round = (n) => Math.round(n * 10) / 10;
const pose = ({ x, y, h }) => [round(x), round(y), round(h)];

export function encodeRoute(route) {
  const { width, length, speed, turnSpeed } = route.robot;
  const data = [FORMAT, route.season, route.phase, route.alliance, route.team, route.name,
    [width, length, speed, turnSpeed], pose(route.start), route.steps.map((s) => [...pose(s), s.action, s.wait])];
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeRoute(text) {
  let data;
  try {
    const bytes = Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('That route link is broken. Ask for a new QR code.');
  }
  if (data[0] !== FORMAT) throw new Error('That route was made with a newer version of the app. Update the app to open it.');
  const [, season, phase, alliance, team, name, [width, length, speed, turnSpeed], [x, y, h], steps] = data;
  return {
    season, phase, alliance, team, name,
    robot: { width, length, speed, turnSpeed },
    start: { x, y, h },
    steps: steps.map(([sx, sy, sh, action, wait]) => ({ x: sx, y: sy, h: sh, action, wait })),
  };
}

// The route in a link (…#route=DATA), taken out of the address bar. Null when the app wasn't opened from one.
export function routeFromLink() {
  const data = new URLSearchParams(location.hash.slice(1)).get('route');
  if (!data) return null;
  history.replaceState(null, '', location.pathname + location.search);
  return decodeRoute(data);
}
