// The season's field and robots as SVG, seen from above with the audience at the bottom.
// Field inches have y going up (see route.js); the SVG's y goes down, so every y is flipped here.
import { corners } from './route.js';

const COLUMNS = 'ABCDEF';
const flip = (size, y) => size - y;
const points = (size, list) => list.map((p) => `${p.x},${flip(size, p.y)}`).join(' ');
const rect = (size, { x, y, width, height }, className) =>
  `<rect class="${className}" x="${x}" y="${flip(size, y + height)}" width="${width}" height="${height}" />`;

// The field with its tile grid (columns A to F, rows 1 to 6 as in the manual), zones and elements, with `content`
// drawn on top.
export function fieldSvg(season, content) {
  const { size, tile, loadingZones, gardens, flowers, hives } = season.field;
  const lines = [];
  for (let at = tile; at < size; at += tile) {
    lines.push(`<line x1="${at}" y1="0" x2="${at}" y2="${size}" />`, `<line x1="0" y1="${at}" x2="${size}" y2="${at}" />`);
  }
  const labels = [];
  for (let i = 0; i < size / tile; i++) {
    labels.push(`<text x="${i * tile + tile / 2}" y="${size + 7}">${COLUMNS[i]}</text>`);
    labels.push(`<text x="-5" y="${flip(size, i * tile + tile / 2) + 1.5}">${i + 1}</text>`);
  }
  return `
    <svg class="field" viewBox="-10 -3 ${size + 13} ${size + 13}" role="img" aria-label="${season.name} field">
      <rect class="floor" x="0" y="0" width="${size}" height="${size}" />
      <g class="grid">${lines.join('')}</g>
      <line class="middle" x1="${size / 2}" y1="0" x2="${size / 2}" y2="${size}" />
      ${rect(size, loadingZones.red, 'zone red')}${rect(size, loadingZones.blue, 'zone blue')}
      ${rect(size, gardens.red, 'garden red')}${rect(size, gardens.blue, 'garden blue')}
      ${rect(size, hives.red, 'hive red')}${rect(size, hives.blue, 'hive blue')}
      ${flowers.map((f) => `<circle class="flower" cx="${f.x}" cy="${flip(size, f.y)}" r="${f.r}" />`).join('')}
      <rect class="wall" x="0" y="0" width="${size}" height="${size}" />
      <g class="labels">${labels.join('')}</g>
      ${content}
    </svg>`;
}

// A robot at a pose: its outline, a mark on its front, and its label. `className` adds red/blue and states.
export function robotSvg(season, pose, robot, className, label = '') {
  const { size } = season.field;
  const rad = (pose.h * Math.PI) / 180;
  const front = { x: pose.x + Math.cos(rad) * robot.length / 2, y: pose.y + Math.sin(rad) * robot.length / 2 };
  return `
    <g class="robot ${className}">
      <polygon points="${points(size, corners(pose, robot))}" />
      <line x1="${pose.x}" y1="${flip(size, pose.y)}" x2="${front.x}" y2="${flip(size, front.y)}" />
      ${label ? `<text x="${pose.x}" y="${flip(size, pose.y) + 2}">${label}</text>` : ''}
    </g>`;
}

// The route's path: a line through its start and steps, with a numbered dot on each step.
export function pathSvg(season, route, className, selected = -1) {
  const { size } = season.field;
  const dots = route.steps.map((s, i) => `
    <g class="dot${i === selected ? ' selected' : ''}" data-step="${i}">
      <circle cx="${s.x}" cy="${flip(size, s.y)}" r="3.2" />
      <text x="${s.x}" y="${flip(size, s.y) + 1.2}">${i + 1}</text>
    </g>`).join('');
  return `<g class="path ${className}"><polyline points="${points(size, [route.start, ...route.steps])}" />${dots}</g>`;
}

// The field point (inches) under a pointer event on the field's SVG.
export function fieldPoint(svg, event, season) {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return { x: point.x, y: flip(season.field.size, point.y) };
}
