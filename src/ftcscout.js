// Extra info about a team from FTCScout (ftcscout.org): its name, home and this season's OPR. Scouting never depends
// on it; team numbers are always typed. Each team is asked once per page load.
import season from './seasons/2027.js';

const API = 'https://api.ftcscout.org/rest/v1';
const cache = new Map();

async function get(path) {
  const response = await fetch(`${API}${path}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`FTCScout answered ${response.status}`);
  return response.json();
}

// { team, stats }: team is null when FTCScout doesn't know the number, stats null when the team hasn't played this
// season yet. Rejects when FTCScout can't be reached.
export function teamInfo(number) {
  if (!cache.has(number)) {
    const info = Promise.all([get(`/teams/${number}`), get(`/teams/${number}/quick-stats?season=${season.ftcscoutSeason}`)])
      .then(([team, stats]) => ({ team, stats }));
    // A failed lookup is tried again next time instead of being remembered.
    info.catch(() => cache.delete(number));
    cache.set(number, info);
  }
  return cache.get(number);
}

export const homeOf = (team) => [team.city, team.state, team.country].filter(Boolean).join(', ');
