// BIOBUZZ, the 2026-2027 FTC season, from Competition Manual TU05.
export default {
  id: '2027',
  name: 'BIOBUZZ',
  // Seconds (section 10.4). Robots don't move in the transition.
  periods: { auto: 30, transition: 8, teleop: 120 },
  // Table 10-2. null: can't be scored in that period. Cell, flower and garden count what's there when the match ends.
  actions: [
    { id: 'leave', label: 'Leave', points: { auto: 3, teleop: null } },
    { id: 'park', label: 'Park', points: { auto: 5, teleop: 5 } },
    { id: 'hiveTip', label: 'Hive tip', points: { auto: 20, teleop: 20 } },
    { id: 'cell', label: 'Pollen/nectar in cell', points: { auto: null, teleop: 2 }, endCount: true },
    { id: 'nectarBonus', label: 'Bottom nectar bonus', points: { auto: null, teleop: 5 } },
    { id: 'flower', label: 'Pollen/nectar in flower', points: { auto: null, teleop: 2 }, endCount: true },
    { id: 'garden', label: 'Pollen/nectar in garden', points: { auto: null, teleop: 1 }, endCount: true },
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
};
