import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterSessions, searchSessions, sortSessions, compareDays } from '../lib/sessions.js';

const sessions = [
  { id: '1', title: 'Zeta talk', description: 'about zebras', day: 'Monday, Nov 30', startTime: '10:00 AM', venue: 'Venetian', location: 'Venetian | Level 2 | Murano 3205', type: 'Chalk talk', topics: ['Security & Identity'], speakers: [{ name: 'Ana', title: 'Engineer' }] },
  { id: '2', title: 'Alpha talk', description: 'about ants', day: 'Tuesday, Dec 1', startTime: '9:00 AM', venue: 'Wynn', location: 'Wynn | Lafite 1', type: "Builders' session", topics: ['Artificial Intelligence'], speakers: [{ name: 'Bob', title: 'Architect' }] },
  { id: '3', title: 'Beta talk', description: 'about bees', day: 'Monday, Nov 30', startTime: '1:00 PM', venue: 'Wynn', location: 'Wynn | Lafite 2', type: 'Code talk', topics: ['Networking'], speakers: [] },
  { id: '4', title: 'Friday talk', description: 'wraps up the week', day: 'Friday, Dec 4', startTime: '9:00 AM', venue: 'Wynn', location: 'Wynn | Lafite 3', type: 'Workshop', topics: ['Compute'], speakers: [] },
  { id: '5', title: 'Undated tabletop A', description: 'self-paced gamified learning', day: '', startTime: '', venue: '', location: '', type: 'Gamified learning', topics: [], speakers: [] },
  { id: '6', title: 'Undated tabletop B', description: 'self-paced gamified learning', day: '', startTime: '', venue: '', location: '', type: 'Gamified learning', topics: [], speakers: [] },
];

test('filterSessions returns all sessions when no filters given', () => {
  const result = filterSessions(sessions, {});
  assert.equal(result.length, 6);
});

test('filterSessions filters by venue', () => {
  const result = filterSessions(sessions, { venue: 'Wynn' });
  assert.deepEqual(result.map(s => s.id), ['2', '3', '4']);
});

test('filterSessions filters by day', () => {
  const result = filterSessions(sessions, { day: 'Monday, Nov 30' });
  assert.deepEqual(result.map(s => s.id), ['1', '3']);
});

test('filterSessions filters by venue and day combined', () => {
  const result = filterSessions(sessions, { venue: 'Wynn', day: 'Monday, Nov 30' });
  assert.deepEqual(result.map(s => s.id), ['3']);
});

test('searchSessions matches title case-insensitively', () => {
  const result = searchSessions(sessions, 'ALPHA');
  assert.deepEqual(result.map(s => s.id), ['2']);
});

test('searchSessions matches description', () => {
  const result = searchSessions(sessions, 'zebras');
  assert.deepEqual(result.map(s => s.id), ['1']);
});

test('searchSessions matches speaker name', () => {
  const result = searchSessions(sessions, 'bob');
  assert.deepEqual(result.map(s => s.id), ['2']);
});

test('searchSessions returns all sessions for empty query', () => {
  const result = searchSessions(sessions, '');
  assert.equal(result.length, 6);
});

test('sortSessions sorts by title ascending', () => {
  const result = sortSessions(sessions, 'title', 'asc');
  assert.deepEqual(result.map(s => s.id), ['2', '3', '4', '5', '6', '1']);
});

test('sortSessions sorts by venue descending', () => {
  const result = sortSessions(sessions, 'venue', 'desc');
  assert.deepEqual(result.map(s => s.id), ['2', '3', '4', '1', '5', '6']);
});

test('sortSessions sorts by day chronologically, not alphabetically', () => {
  // Alphabetically "Friday" < "Monday" < "Tuesday", but chronologically
  // Monday, Nov 30 comes first, then Tuesday, Dec 1, then Friday, Dec 4.
  const result = sortSessions(sessions, 'day', 'asc');
  assert.deepEqual(result.map(s => s.id), ['1', '3', '2', '4', '5', '6']);
});

test('sortSessions puts undated sessions last when sorting ascending, not first', () => {
  // Regression test: using Infinity as the missing-value sentinel made
  // Infinity - Infinity = NaN, which broke the sort comparator's contract
  // and caused undated sessions to appear first instead of last.
  const result = sortSessions(sessions, 'day', 'asc');
  const lastTwoIds = result.slice(-2).map(s => s.id).sort();
  assert.deepEqual(lastTwoIds, ['5', '6']);
  assert.notEqual(result[0].id, '5');
  assert.notEqual(result[0].id, '6');
});

test('sortSessions sorts by day descending chronologically', () => {
  // Day order reverses (Friday, Tuesday, Monday); within the Monday tie the
  // startTime tiebreaker reverses too, so 1:00 PM (3) comes before 10:00 AM (1).
  // Undated sessions (using the largest sentinel key) sort first when descending.
  const result = sortSessions(sessions, 'day', 'desc');
  assert.deepEqual(result.map(s => s.id), ['5', '6', '4', '2', '3', '1']);
});

test('sortSessions breaks day ties using startTime ascending', () => {
  // Sessions 1 and 3 are both on Monday, Nov 30: 10:00 AM then 1:00 PM.
  const result = sortSessions(sessions, 'day', 'asc');
  const mondaySessions = result.filter(s => s.day === 'Monday, Nov 30');
  assert.deepEqual(mondaySessions.map(s => s.id), ['1', '3']);
});

test('sortSessions sorts by startTime chronologically, not alphabetically', () => {
  // Alphabetically "10:00 AM" < "1:00 PM" < "9:00 AM", but chronologically
  // 9:00 AM comes before 10:00 AM comes before 1:00 PM. Undated sessions
  // (empty startTime) sort last.
  const result = sortSessions(sessions, 'startTime', 'asc');
  assert.deepEqual(result.map(s => s.id), ['2', '4', '1', '3', '5', '6']);
});

test('sortSessions sorts by room (derived from location minus venue prefix)', () => {
  const result = sortSessions(sessions, 'room', 'asc');
  assert.deepEqual(result.map(s => s.id), ['5', '6', '2', '3', '4', '1']);
});

test('sortSessions sorts by topics (joined topic list)', () => {
  const result = sortSessions(sessions, 'topics', 'asc');
  assert.deepEqual(result.map(s => s.id), ['5', '6', '2', '4', '3', '1']);
});

test('sortSessions sorts by speakers (joined speaker names)', () => {
  const result = sortSessions(sessions, 'speakers', 'asc');
  assert.deepEqual(result.map(s => s.id), ['3', '4', '5', '6', '1', '2']);
});

test('sortSessions does not mutate the original array', () => {
  const copy = [...sessions];
  sortSessions(sessions, 'title', 'asc');
  assert.deepEqual(sessions, copy);
});

test('compareDays orders day strings chronologically for use in Array.prototype.sort', () => {
  const days = ['Friday, Dec 4', 'Monday, Nov 30', 'Tuesday, Dec 1', 'Wednesday, Dec 2', 'Thursday, Dec 3'];
  const sorted = [...days].sort(compareDays);
  assert.deepEqual(sorted, [
    'Monday, Nov 30',
    'Tuesday, Dec 1',
    'Wednesday, Dec 2',
    'Thursday, Dec 3',
    'Friday, Dec 4',
  ]);
});
