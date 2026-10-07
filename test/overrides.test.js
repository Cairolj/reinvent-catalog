import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadOverrides,
  saveOverrides,
  setOverride,
  clearOverride,
  applyOverride,
  formatTime12h,
  parseTime12hTo24h,
} from '../lib/overrides.js';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    _map: map,
  };
}

test('loadOverrides returns an empty object when nothing is stored', () => {
  const storage = createFakeStorage();
  assert.deepEqual(loadOverrides(storage), {});
});

test('loadOverrides returns an empty object for corrupted JSON', () => {
  const storage = createFakeStorage();
  storage.setItem('reinvent-session-overrides', 'not valid json{');
  assert.deepEqual(loadOverrides(storage), {});
});

test('saveOverrides persists and loadOverrides reads it back', () => {
  const storage = createFakeStorage();
  const overrides = { abc123: { day: 'Monday, Nov 30', startTime: '2:00 PM', endTime: '3:00 PM' } };
  saveOverrides(overrides, storage);
  assert.deepEqual(loadOverrides(storage), overrides);
});

test('setOverride adds a new override without mutating the original object', () => {
  const original = {};
  const result = setOverride(original, 'abc123', { day: 'Monday, Nov 30', startTime: '2:00 PM', endTime: '3:00 PM' });
  assert.deepEqual(original, {});
  assert.deepEqual(result, { abc123: { day: 'Monday, Nov 30', startTime: '2:00 PM', endTime: '3:00 PM' } });
});

test('setOverride overwrites an existing override for the same id', () => {
  const original = { abc123: { day: 'Monday, Nov 30', startTime: '2:00 PM', endTime: '3:00 PM' } };
  const result = setOverride(original, 'abc123', { day: 'Tuesday, Dec 1', startTime: '9:00 AM', endTime: '10:00 AM' });
  assert.deepEqual(result, { abc123: { day: 'Tuesday, Dec 1', startTime: '9:00 AM', endTime: '10:00 AM' } });
});

test('clearOverride removes an override without mutating the original object', () => {
  const original = { abc123: { day: 'Monday, Nov 30', startTime: '2:00 PM' }, def456: { day: 'Tuesday, Dec 1', startTime: '9:00 AM' } };
  const result = clearOverride(original, 'abc123');
  assert.deepEqual(original, { abc123: { day: 'Monday, Nov 30', startTime: '2:00 PM' }, def456: { day: 'Tuesday, Dec 1', startTime: '9:00 AM' } });
  assert.deepEqual(result, { def456: { day: 'Tuesday, Dec 1', startTime: '9:00 AM' } });
});

test('applyOverride returns the session unchanged when no override exists for its id', () => {
  const session = { id: 'abc123', day: '', startTime: '', endTime: '' };
  const result = applyOverride(session, {});
  assert.deepEqual(result, session);
});

test('applyOverride merges day/startTime/endTime from the override, leaving other fields intact', () => {
  const session = { id: 'abc123', title: 'Tabletop', day: '', startTime: '', endTime: '', venue: '' };
  const overrides = { abc123: { day: 'Monday, Nov 30', startTime: '2:00 PM', endTime: '3:00 PM' } };
  const result = applyOverride(session, overrides);
  assert.deepEqual(result, { id: 'abc123', title: 'Tabletop', day: 'Monday, Nov 30', startTime: '2:00 PM', endTime: '3:00 PM', venue: '' });
});

test('applyOverride does not mutate the original session object', () => {
  const session = { id: 'abc123', day: '', startTime: '' };
  const copy = { ...session };
  applyOverride(session, { abc123: { day: 'Monday, Nov 30', startTime: '2:00 PM', endTime: '3:00 PM' } });
  assert.deepEqual(session, copy);
});

test('formatTime12h converts a 24-hour HH:MM string to "H:MM AM/PM"', () => {
  assert.equal(formatTime12h('09:00'), '9:00 AM');
  assert.equal(formatTime12h('14:30'), '2:30 PM');
  assert.equal(formatTime12h('00:00'), '12:00 AM');
  assert.equal(formatTime12h('12:00'), '12:00 PM');
  assert.equal(formatTime12h('23:45'), '11:45 PM');
});

test('formatTime12h returns an empty string for empty input', () => {
  assert.equal(formatTime12h(''), '');
});

test('parseTime12hTo24h converts "H:MM AM/PM" back to 24-hour "HH:MM"', () => {
  assert.equal(parseTime12hTo24h('9:00 AM'), '09:00');
  assert.equal(parseTime12hTo24h('2:30 PM'), '14:30');
  assert.equal(parseTime12hTo24h('12:00 AM'), '00:00');
  assert.equal(parseTime12hTo24h('12:00 PM'), '12:00');
  assert.equal(parseTime12hTo24h('11:45 PM'), '23:45');
});

test('parseTime12hTo24h returns an empty string for empty or unparseable input', () => {
  assert.equal(parseTime12hTo24h(''), '');
  assert.equal(parseTime12hTo24h('garbage'), '');
});

test('formatTime12h and parseTime12hTo24h round-trip for every hour of the day', () => {
  for (let h = 0; h < 24; h += 1) {
    const h24 = `${String(h).padStart(2, '0')}:15`;
    assert.equal(parseTime12hTo24h(formatTime12h(h24)), h24);
  }
});
