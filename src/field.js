// The season's field and robots as SVG, seen from above with the audience at the bottom.
// Field inches have y going up (see route.js); the SVG's y goes down, so every y is flipped here.
import { corners } from './route.js';

const COLUMNS = 'ABCDEF';
const flip = (size, y) => size - y;
const points = (size, list) => list.map((p) => `${p.x},${flip(size, p.y)}`).join(' ');
const rect = (size, { x, y, width, height }, className) =>
  `<rect class="${className}" x="${x}" y="${flip(size, y + height)}" width="${width}" height="${height}" />`;

// A hive basket in a box: five sides, its point at the top or the bottom, with the inner rim drawn as a chevron.
function basketSvg(size, { x, y, width, height }, point, className) {
  const up = point === 'up';
  const tip = up ? y + height : y;
  const base = up ? y : y + height;
  const shoulder = up ? y + height * 0.7 : y + height * 0.3;
  const rim = up ? y + height * 0.35 : y + height * 0.65;
  const outline = [{ x, y: base }, { x: x + width, y: base }, { x: x + width, y: shoulder }, { x: x + width / 2, y: tip }, { x, y: shoulder }];
  const chevron = [{ x, y: rim }, { x: x + width / 2, y: rim + (tip - shoulder) }, { x: x + width, y: rim }];
  return `<g class="${className}"><polygon points="${points(size, outline)}" /><polyline points="${points(size, chevron)}" /></g>`;
}

// A hive: its two baskets with a gap between them, held by a frame post on the outer side.
function hiveSvg(size, hive, alliance) {
  const gap = 10;
  const basket = (hive.height - gap) / 2;
  const post = alliance === 'red' ? hive.x - 1 : hive.x + hive.width + 1;
  return `
    <line class="hive-frame" x1="${post}" y1="${flip(size, hive.y)}" x2="${post}" y2="${flip(size, hive.y + hive.height)}" />
    ${basketSvg(size, { ...hive, height: basket }, hive.point, `hive ${alliance}`)}
    ${basketSvg(size, { ...hive, y: hive.y + basket + gap, height: basket }, hive.point, `hive ${alliance}`)}`;
}

// The yellow beams between the two hives, across the gaps between their baskets.
function beamsSvg(size, { red, blue }) {
  const from = red.x + red.width / 2;
  const to = blue.x + blue.width / 2;
  const middle = (Math.max(red.y, blue.y) + Math.min(red.y + red.height, blue.y + blue.height)) / 2;
  return [middle - 3.5, middle + 1.5].map((y) =>
    `<rect class="beam" x="${from}" y="${flip(size, y + 2)}" width="${to - from}" height="2" />`).join('');
}

// The field with its foam tiles (columns A to F, rows 1 to 6 as in the manual), zones and elements, the alliance areas
// outside the side walls, and `content` drawn on top.
export function fieldSvg(season, content) {
  const { size, tile, loadingZones, gardens, flowers, hives, allianceAreas } = season.field;
  const tiles = [];
  for (let col = 0; col < size / tile; col++) {
    for (let row = 0; row < size / tile; row++) {
      tiles.push(`<rect x="${col * tile + 0.3}" y="${row * tile + 0.3}" width="${tile - 0.6}" height="${tile - 0.6}" rx="0.6" />`);
    }
  }
  const labels = [];
  for (let i = 0; i < size / tile; i++) {
    labels.push(`<text x="${i * tile + tile / 2}" y="${size + 7}">${COLUMNS[i]}</text>`);
    labels.push(`<text x="-10" y="${flip(size, i * tile + tile / 2) + 1.5}">${i + 1}</text>`);
  }
  const area = (side, x) => rect(size, { x, y: allianceAreas[side].y, width: 4, height: allianceAreas[side].height }, `alliance-area ${side}`);
  return `
    <svg class="field" viewBox="-14 -3 ${size + 21} ${size + 13}" role="img" aria-label="${season.name} field">
      ${area('red', -5.5)}${area('blue', size + 1.5)}
      <rect class="floor" x="0" y="0" width="${size}" height="${size}" />
      <g class="tiles">${tiles.join('')}</g>
      <line class="middle" x1="${size / 2}" y1="0" x2="${size / 2}" y2="${size}" />
      ${rect(size, loadingZones.red, 'zone red')}${rect(size, loadingZones.blue, 'zone blue')}
      ${rect(size, gardens.red, 'garden red')}${rect(size, gardens.blue, 'garden blue')}
      ${beamsSvg(size, hives)}${hiveSvg(size, hives.red, 'red')}${hiveSvg(size, hives.blue, 'blue')}
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

// The tile a point is on, as the manual names it: column letter and row number, like C3.
export const tileName = (season, { x, y }) => {
  const { size, tile } = season.field;
  const index = (n) => Math.min(size / tile - 1, Math.floor(n / tile));
  return `${COLUMNS[index(x)]}${index(y) + 1}`;
};

// The round handle in front of a robot that turns it when dragged.
export function turnHandleSvg(season, pose, robot) {
  const rad = (pose.h * Math.PI) / 180;
  const reach = robot.length / 2 + 7;
  const x = pose.x + Math.cos(rad) * reach;
  const y = flip(season.field.size, pose.y + Math.sin(rad) * reach);
  return `
    <g class="turn-handle" data-turn>
      <line x1="${pose.x}" y1="${flip(season.field.size, pose.y)}" x2="${x}" y2="${y}" />
      <circle class="hit" cx="${x}" cy="${y}" r="7" />
      <circle cx="${x}" cy="${y}" r="3" />
    </g>`;
}

// The route's path: a line through its start and steps, with a numbered dot on each step. Each dot has a wider
// invisible ring so a finger can grab it.
export function pathSvg(season, route, className, selected = -1) {
  const { size } = season.field;
  const dots = route.steps.map((s, i) => `
    <g class="dot${i === selected ? ' selected' : ''}" data-step="${i}">
      <circle class="hit" cx="${s.x}" cy="${flip(size, s.y)}" r="6.5" />
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
