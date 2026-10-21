// Each scouted match's score for both alliances, from the Scout tab's records: an alliance scouted as a whole
// (scoutAlliances) or its robots scouted one by one (scoutMatches). An alliance scouted as a whole is used when there
// is one, since it saw everything; otherwise its robots' points are added up (one average per robot when several scouts
// watched it).
import { eventKey } from './events.js';

const PARTS = ['auto', 'teleop', 'fouls'];
const averagePoints = (records) => Object.fromEntries(PARTS.map((part) =>
  [part, Math.round(records.reduce((sum, r) => sum + r.points[part], 0) / records.length * 10) / 10]));

// One alliance's side of a match: { points: { auto, teleop, fouls }, teams, from: 'alliance' | 'robots' }, or null
// when nobody scouted it. `fouls` are points the alliance gave the other one.
function side(alliance, robots, alliances) {
  const whole = alliances.filter((a) => a.alliance === alliance);
  if (whole.length) return { points: averagePoints(whole), teams: [...new Set(whole.flatMap((a) => a.teams))], from: 'alliance' };
  const mine = robots.filter((r) => r.alliance === alliance);
  if (!mine.length) return null;
  const teams = [...new Set(mine.map((r) => r.team))];
  const perTeam = teams.map((team) => averagePoints(mine.filter((r) => r.team === team)));
  const points = Object.fromEntries(PARTS.map((part) => [part, Math.round(perTeam.reduce((sum, p) => sum + p[part], 0) * 10) / 10]));
  return { points, teams, from: 'robots' };
}

// An alliance's match score: its own auto and teleop points plus the fouls the other alliance gave it.
export const sideScore = (mine, theirs) => Math.round((mine.points.auto + mine.points.teleop + (theirs?.points.fouls ?? 0)) * 10) / 10;

// Every match with records, newest first: [{ key, event, match, red, blue, records }]. `records` are all the match's
// records, robots and alliances, for the details.
export function scoredMatches(robots, alliances) {
  const byMatch = new Map();
  for (const record of [...robots, ...alliances]) {
    const key = `${eventKey(record.event)}|${record.match}`;
    if (!byMatch.has(key)) byMatch.set(key, { key, event: record.event, match: record.match, records: [] });
    byMatch.get(key).records.push(record);
  }
  return [...byMatch.values()].map((m) => {
    const robotRecords = m.records.filter((r) => !r.teams);
    const allianceRecords = m.records.filter((r) => r.teams);
    return { ...m, red: side('red', robotRecords, allianceRecords), blue: side('blue', robotRecords, allianceRecords) };
  }).sort((a, b) => b.match - a.match);
}
