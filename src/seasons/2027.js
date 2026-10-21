// BIOBUZZ, the 2026-2027 FTC season, from Competition Manual TU05.
export default {
  id: '2027',
  name: 'BIOBUZZ',
  // Seconds (section 10.4). Robots don't move in the transition.
  periods: { auto: 30, transition: 8, teleop: 120 },
  // Table 10-2. null: can't be scored in that period. Cell, flower and garden count what's there when the match ends.
  // once: done or not in each period, so Scout shows a checkbox instead of a counter. group: shown together in a section
  // Scout can fold away.
  actions: [
    { id: 'leave', label: 'Leave', points: { auto: 3, teleop: null }, once: true },
    { id: 'park', label: 'Park', points: { auto: 5, teleop: 5 }, once: true },
    { id: 'hiveTip', label: 'Hive tip', points: { auto: 20, teleop: 20 } },
    { id: 'cell', label: 'Pollen/nectar in cell', points: { auto: null, teleop: 2 }, endCount: true, group: 'Pollen and nectar' },
    { id: 'nectarBonus', label: 'Bottom nectar bonus', points: { auto: null, teleop: 5 }, group: 'Pollen and nectar' },
    { id: 'flower', label: 'Pollen/nectar in flower', points: { auto: null, teleop: 2 }, endCount: true, group: 'Pollen and nectar' },
    { id: 'garden', label: 'Pollen/nectar in garden', points: { auto: null, teleop: 1 }, endCount: true, group: 'Pollen and nectar' },
  ],
  // Table 10-4. Foul points go to the opponent's score.
  fouls: [
    { id: 'minor', label: 'Minor foul', points: 5 },
    { id: 'major', label: 'Major foul', points: 20 },
  ],
  cards: [
    { id: 'yellow', label: 'Yellow card' },
    { id: 'red', label: 'Red card' },
  ],
  // Inches from the bottom-left corner seen from the audience (see route.js). Read off Figures 9-2 and 10-2, so
  // within a few inches.
  field: {
    size: 144,
    tile: 24,
    // G304: each alliance starts on its own half, touching the wall.
    sides: { red: { x: 0, width: 72 }, blue: { x: 72, width: 72 } },
    loadingZones: { red: { x: 0, y: 97, width: 11, height: 23 }, blue: { x: 133, y: 24, width: 11, height: 23 } },
    gardens: { red: { x: 0, y: 0, width: 23, height: 3 }, blue: { x: 121, y: 141, width: 23, height: 3 } },
    flowers: [{ x: 48, y: 144, r: 4 }, { x: 144, y: 96, r: 4 }, { x: 0, y: 48, r: 4 }, { x: 96, y: 0, r: 4 }],
    hives: { red: { x: 50, y: 50, width: 20, height: 44 }, blue: { x: 74, y: 50, width: 20, height: 44 } },
    // Where a new route's robot starts: a legal spot on each alliance's wall.
    starts: { red: { x: 9, y: 72, h: 0 }, blue: { x: 135, y: 72, h: 180 } },
  },
};
