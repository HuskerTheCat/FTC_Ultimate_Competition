// The app switcher's cube: draws any FTC Ultimate cube and turns one into another. Copied from Inventory's src/cube.js.
// Inventory, Competition and Design: a white top, sides in the app's color, its glyph on the right face.
// The suite: one face per app, Inventory's box on the top, Competition's crosshair on the left and Design's set square on the right.
const FACES = {
  top: 'M256.0 89.2 L369.5 154.7 L256.0 220.2 L142.5 154.7 Z',
  left: 'M111.5 208.4 L225.0 273.9 L225.0 404.9 L111.5 339.4 Z',
  right: 'M287.0 273.9 L400.5 208.4 L400.5 339.4 L287.0 404.9 Z',
};
const line = (d, color) => `<path class="glyph" d="${d}" fill="none" stroke="${color}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>`;
const dot = (d, color) => `<path class="glyph" d="${d}" fill="${color}"/>`;
const GLYPHS = {
  boxTop: line('M181.1 163.9 L271.9 111.5 L290.1 121.9 L199.3 174.3 Z M206.1 170.4 L260.5 201.9 L337.7 157.3 L283.2 125.9 M246.9 165.2 L274.2 149.5 L290.1 158.6 L262.8 174.3 Z', '#1a2a6c'),
  boxRight: line('M298.3 298.8 L389.1 246.4 L389.1 267.4 L298.3 319.8 Z M305.2 315.8 L305.2 378.7 L382.3 334.2 L382.3 271.3 M330.1 319.8 L357.4 304.0 L357.4 322.4 L330.1 338.1 Z', '#1a2a6c'),
  crosshairLeft: line('M200.0 325.0 L199.9 328.5 L199.4 331.8 L198.7 334.9 L197.6 337.7 L196.3 340.2 L194.7 342.3 L192.8 344.1 L190.7 345.6 L188.4 346.7 L185.9 347.4 L183.2 347.7 L180.4 347.6 L177.5 347.1 L174.4 346.3 L171.4 345.0 L168.2 343.4 L165.1 341.4 L162.0 339.1 L159.0 336.5 L156.1 333.6 L153.3 330.4 L150.6 327.0 L148.1 323.4 L145.8 319.7 L143.7 315.8 L141.8 311.8 L140.2 307.8 L138.9 303.8 L137.8 299.8 L137.1 295.9 L136.6 292.0 L136.5 288.3 L136.6 284.8 L137.1 281.5 L137.8 278.5 L138.9 275.7 L140.2 273.2 L141.8 271.0 L143.7 269.2 L145.8 267.8 L148.1 266.7 L150.6 266.0 L153.3 265.7 L156.1 265.8 L159.0 266.2 L162.0 267.1 L165.1 268.4 L168.2 270.0 L171.4 272.0 L174.4 274.3 L177.5 276.9 L180.4 279.8 L183.2 283.0 L185.9 286.4 L188.4 290.0 L190.7 293.7 L192.8 297.6 L194.7 301.6 L196.3 305.6 L197.6 309.6 L198.7 313.6 L199.4 317.5 L199.9 321.3 Z M168.2 251.6 L168.2 270.0 M168.2 343.4 L168.2 361.7 M120.6 279.2 L136.5 288.3 M200.0 325.0 L215.9 334.2', '#7c3a06') + dot('M175.1 310.6 L175.0 311.4 L174.9 312.1 L174.8 312.7 L174.5 313.3 L174.3 313.9 L173.9 314.3 L173.5 314.7 L173.1 315.0 L172.6 315.3 L172.0 315.4 L171.5 315.5 L170.9 315.5 L170.2 315.4 L169.6 315.2 L168.9 314.9 L168.2 314.5 L167.6 314.1 L166.9 313.6 L166.3 313.1 L165.6 312.4 L165.0 311.8 L164.5 311.0 L163.9 310.3 L163.4 309.5 L163.0 308.6 L162.6 307.8 L162.2 306.9 L162.0 306.1 L161.7 305.2 L161.6 304.4 L161.5 303.5 L161.4 302.8 L161.5 302.0 L161.6 301.3 L161.7 300.6 L162.0 300.0 L162.2 299.5 L162.6 299.0 L163.0 298.7 L163.4 298.3 L163.9 298.1 L164.5 298.0 L165.0 297.9 L165.6 297.9 L166.3 298.0 L166.9 298.2 L167.6 298.5 L168.2 298.8 L168.9 299.2 L169.6 299.7 L170.2 300.3 L170.9 300.9 L171.5 301.6 L172.0 302.3 L172.6 303.1 L173.1 303.9 L173.5 304.7 L173.9 305.6 L174.3 306.4 L174.5 307.3 L174.8 308.2 L174.9 309.0 L175.0 309.8 Z', '#7c3a06'),
  crosshairRight: line('M375.5 288.3 L375.4 292.0 L374.9 295.8 L374.2 299.8 L373.1 303.8 L371.8 307.8 L370.2 311.8 L368.3 315.8 L366.2 319.6 L363.9 323.4 L361.4 327.0 L358.7 330.4 L355.9 333.5 L353.0 336.5 L349.9 339.1 L346.9 341.4 L343.7 343.4 L340.6 345.0 L337.5 346.2 L334.5 347.1 L331.6 347.6 L328.8 347.7 L326.1 347.4 L323.6 346.7 L321.3 345.6 L319.2 344.1 L317.3 342.3 L315.7 340.1 L314.4 337.7 L313.3 334.9 L312.6 331.8 L312.1 328.5 L312.0 325.0 L312.1 321.3 L312.6 317.5 L313.3 313.6 L314.4 309.6 L315.7 305.5 L317.3 301.5 L319.2 297.6 L321.3 293.7 L323.6 289.9 L326.1 286.3 L328.8 283.0 L331.6 279.8 L334.5 276.9 L337.5 274.3 L340.6 271.9 L343.7 270.0 L346.9 268.3 L349.9 267.1 L353.0 266.2 L355.9 265.7 L358.7 265.7 L361.4 266.0 L363.9 266.7 L366.2 267.7 L368.3 269.2 L370.2 271.0 L371.8 273.2 L373.1 275.7 L374.2 278.5 L374.9 281.5 L375.4 284.8 Z M343.7 251.6 L343.7 270.0 M343.7 343.4 L343.7 361.7 M296.1 334.2 L312.0 325.0 M375.5 288.3 L391.4 279.1', '#7c3a06') + dot('M350.6 302.7 L350.5 303.5 L350.4 304.3 L350.3 305.2 L350.0 306.0 L349.8 306.9 L349.4 307.8 L349.0 308.6 L348.6 309.4 L348.1 310.2 L347.5 311.0 L347.0 311.7 L346.4 312.4 L345.7 313.0 L345.1 313.6 L344.4 314.1 L343.7 314.5 L343.1 314.9 L342.4 315.1 L341.8 315.3 L341.1 315.4 L340.5 315.5 L340.0 315.4 L339.4 315.2 L338.9 315.0 L338.5 314.7 L338.1 314.3 L337.7 313.8 L337.5 313.3 L337.2 312.7 L337.1 312.1 L337.0 311.3 L336.9 310.6 L337.0 309.8 L337.1 309.0 L337.2 308.1 L337.5 307.3 L337.7 306.4 L338.1 305.6 L338.5 304.7 L338.9 303.9 L339.4 303.1 L340.0 302.3 L340.5 301.6 L341.1 300.9 L341.8 300.3 L342.4 299.7 L343.1 299.2 L343.7 298.8 L344.4 298.5 L345.1 298.2 L345.7 298.0 L346.4 297.9 L347.0 297.9 L347.5 297.9 L348.1 298.1 L348.6 298.3 L349.0 298.6 L349.4 299.0 L349.8 299.5 L350.0 300.0 L350.3 300.6 L350.4 301.3 L350.5 302.0 Z', '#7c3a06'),
  setSquareRight: line('M307.4 374.8 L307.4 280.5 L389.1 327.6 Z M330.1 346.0 L330.1 321.1 L351.7 333.5 Z M307.4 302.7 L314.2 298.8 M307.4 314.5 L317.6 308.6 M307.4 326.3 L314.2 322.4 M307.4 338.1 L317.6 332.2 M307.4 349.9 L314.2 346.0 M307.4 361.7 L317.6 355.8', '#0b4f31'),
};
// Each face's color and the glyph on it.
const CUBES = {
  inventory: { top: ['#eef1f8'], left: ['#5aa9ff'], right: ['#2f5bd6', GLYPHS.boxRight] },
  competition: { top: ['#eef1f8'], left: ['#ffa53d'], right: ['#e07415', GLYPHS.crosshairRight] },
  design: { top: ['#eef1f8'], left: ['#45d08f'], right: ['#1c9a60', GLYPHS.setSquareRight] },
  suite: { top: ['#5aa9ff', GLYPHS.boxTop], left: ['#ffa53d', GLYPHS.crosshairLeft], right: ['#1c9a60', GLYPHS.setSquareRight] },
};

const layer = (show) => `<g class="layer" data-show="${show}">${Object.entries(FACES).map(([face, d]) => {
  const [color, glyph = ''] = CUBES[show][face];
  return `<g class="${face}"><path d="${d}" fill="${color}" stroke="${color}" stroke-width="32" stroke-linejoin="round"/>${glyph}</g>`;
}).join('')}</g>`;

export const CUBE = `<svg class="app-icon cube" viewBox="0 0 512 512" aria-hidden="true">
  <defs><linearGradient id="cube-navy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f2640"/><stop offset="1" stop-color="#0e1221"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#cube-navy)"/>
  ${layer('competition')}
</svg>`;


// Turns the cube into another app's cube, or 'suite'. Resolves when it has finished turning.
// Calls in the same moment (the menu closing as an app is picked) make one turn, to the last cube asked for.
export function morphCube(cube, show) {
  cube.dataset.show = show;
  cube.turning ??= new Promise((done) => requestAnimationFrame(() => {
    cube.turning = null;
    turn(cube, cube.dataset.show).then(done);
  }));
  return cube.turning;
}

const TURN = { duration: 500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' };
// While it turns, each face slides out from the middle and back.
const SPLIT = { top: [0, -1], left: [-0.87, 0.5], right: [0.87, 0.5] };

// The cube turns a third of a turn clockwise, which puts each face where the next one was, so the new cube's right face
// sweeps down from the top. The old cube turns out of place while the new one, drawn over it, turns into place and fades in.
function turn(cube, show) {
  // A turn still running jumps to its end.
  cube.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
  const layers = cube.querySelectorAll('.layer');
  const old = layers[layers.length - 1];
  [...layers].slice(0, -1).forEach((layer) => layer.remove());
  if (old.dataset.show === show) return Promise.resolve();
  old.insertAdjacentHTML('afterend', layer(show));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    old.remove();
    return Promise.resolve();
  }
  const next = old.nextElementSibling;
  const splits = [old, next].flatMap((layer) => Object.entries(SPLIT).map(([face, [x, y]]) => layer.querySelector(`.${face}`).animate(
    [{ transform: 'none', easing: 'ease-out' }, { transform: `translate(${x * 48}px, ${y * 48}px)`, offset: 0.4, easing: 'cubic-bezier(0.3, 1.5, 0.6, 1)' }, { transform: 'none' }],
    TURN.duration,
  )));
  // The old glyphs fade out first and the new ones in last, so they don't pile up on the faces halfway through.
  const glyphs = [
    ...[...old.querySelectorAll('.glyph')].map((glyph) => glyph.animate([{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], TURN.duration)),
    ...[...next.querySelectorAll('.glyph')].map((glyph) => glyph.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], TURN.duration)),
  ];
  const moves = [
    old.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(120deg)' }], TURN),
    next.animate([{ transform: 'rotate(-120deg)', opacity: 0 }, { transform: 'rotate(0deg)', opacity: 1 }], TURN),
    ...splits,
    ...glyphs,
  ];
  return Promise.allSettled(moves.map((move) => move.finished)).then(() => old.remove());
}
