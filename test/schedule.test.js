import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSelectedIds,
  saveSelectedIds,
  toggleSelection,
  detectConflicts,
  getConflictingWithSelectionIds,
  layoutOverlappingSessions,
} from '../lib/schedule.js';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    _map: map,
  };
}

test('loadSelectedIds returns an empty array when nothing is stored', () => {
  const storage = createFakeStorage();
  assert.deepEqual(loadSelectedIds(storage), []);
});

test('loadSelectedIds returns an empty array for corrupted JSON', () => {
  const storage = createFakeStorage();
  storage.setItem('reinvent-selected-sessions', 'not valid json{');
  assert.deepEqual(loadSelectedIds(storage), []);
});

test('loadSelectedIds returns an empty array when stored value is not an array', () => {
  const storage = createFakeStorage();
  storage.setItem('reinvent-selected-sessions', JSON.stringify({ not: 'an array' }));
  assert.deepEqual(loadSelectedIds(storage), []);
});

test('saveSelectedIds persists the array as JSON under the expected key', () => {
  const storage = createFakeStorage();
  saveSelectedIds(['a', 'b'], storage);
  assert.equal(storage._map.get('reinvent-selected-sessions'), JSON.stringify(['a', 'b']));
});

test('loadSelectedIds reads back what saveSelectedIds wrote', () => {
  const storage = createFakeStorage();
  saveSelectedIds(['x', 'y', 'z'], storage);
  assert.deepEqual(loadSelectedIds(storage), ['x', 'y', 'z']);
});

test('toggleSelection adds an id that is not present', () => {
  const result = toggleSelection(['a', 'b'], 'c');
  assert.deepEqual(result, ['a', 'b', 'c']);
});

test('toggleSelection removes an id that is present', () => {
  const result = toggleSelection(['a', 'b', 'c'], 'b');
  assert.deepEqual(result, ['a', 'c']);
});

test('toggleSelection does not mutate the original array', () => {
  const original = ['a', 'b'];
  const copy = [...original];
  toggleSelection(original, 'c');
  assert.deepEqual(original, copy);
});

test('detectConflicts returns an empty set when no sessions overlap', () => {
  const sessions = [
    { id: '1', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '10:00 AM' },
    { id: '2', day: 'Monday, Nov 30', startTime: '10:00 AM', endTime: '11:00 AM' },
  ];
  const conflicts = detectConflicts(sessions);
  assert.equal(conflicts.size, 0);
});

test('detectConflicts flags sessions whose time ranges overlap on the same day', () => {
  const sessions = [
    { id: '1', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '10:30 AM' },
    { id: '2', day: 'Monday, Nov 30', startTime: '10:00 AM', endTime: '11:00 AM' },
  ];
  const conflicts = detectConflicts(sessions);
  assert.deepEqual([...conflicts].sort(), ['1', '2']);
});

test('detectConflicts does not flag sessions on different days even with the same time', () => {
  const sessions = [
    { id: '1', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '10:00 AM' },
    { id: '2', day: 'Tuesday, Dec 1', startTime: '9:00 AM', endTime: '10:00 AM' },
  ];
  const conflicts = detectConflicts(sessions);
  assert.equal(conflicts.size, 0);
});

test('detectConflicts treats sessions missing day or time as unscheduled and ignores them', () => {
  const sessions = [
    { id: '1', day: '', startTime: '', endTime: '' },
    { id: '2', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '10:00 AM' },
  ];
  const conflicts = detectConflicts(sessions);
  assert.equal(conflicts.size, 0);
});

test('detectConflicts flags all mutually overlapping sessions in a group of three', () => {
  const sessions = [
    { id: '1', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '11:00 AM' },
    { id: '2', day: 'Monday, Nov 30', startTime: '9:30 AM', endTime: '10:00 AM' },
    { id: '3', day: 'Monday, Nov 30', startTime: '2:00 PM', endTime: '3:00 PM' },
  ];
  const conflicts = detectConflicts(sessions);
  assert.deepEqual([...conflicts].sort(), ['1', '2']);
});

test('getConflictingWithSelectionIds flags a non-selected session that overlaps a selected one', () => {
  const allSessions = [
    { id: '1', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '10:00 AM' }, // selected
    { id: '2', day: 'Monday, Nov 30', startTime: '9:30 AM', endTime: '10:30 AM' }, // not selected, overlaps 1
    { id: '3', day: 'Monday, Nov 30', startTime: '2:00 PM', endTime: '3:00 PM' }, // not selected, no overlap
  ];
  const conflicts = getConflictingWithSelectionIds(allSessions, ['1']);
  assert.deepEqual([...conflicts].sort(), ['1', '2']);
});

test('getConflictingWithSelectionIds flags two selected sessions that overlap each other', () => {
  const allSessions = [
    { id: '1', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '10:00 AM' },
    { id: '2', day: 'Monday, Nov 30', startTime: '9:30 AM', endTime: '10:30 AM' },
  ];
  const conflicts = getConflictingWithSelectionIds(allSessions, ['1', '2']);
  assert.deepEqual([...conflicts].sort(), ['1', '2']);
});

test('getConflictingWithSelectionIds returns an empty set when nothing is selected', () => {
  const allSessions = [
    { id: '1', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '10:00 AM' },
    { id: '2', day: 'Monday, Nov 30', startTime: '9:30 AM', endTime: '10:30 AM' },
  ];
  const conflicts = getConflictingWithSelectionIds(allSessions, []);
  assert.equal(conflicts.size, 0);
});

test('getConflictingWithSelectionIds ignores sessions on different days', () => {
  const allSessions = [
    { id: '1', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '10:00 AM' },
    { id: '2', day: 'Tuesday, Dec 1', startTime: '9:00 AM', endTime: '10:00 AM' },
  ];
  const conflicts = getConflictingWithSelectionIds(allSessions, ['1']);
  assert.equal(conflicts.size, 0);
});

test('layoutOverlappingSessions puts all non-overlapping sessions in a single column', () => {
  const sessions = [
    { id: '1', startTime: '9:00 AM', endTime: '10:00 AM' },
    { id: '2', startTime: '10:00 AM', endTime: '11:00 AM' },
    { id: '3', startTime: '11:00 AM', endTime: '12:00 PM' },
  ];
  const layout = layoutOverlappingSessions(sessions);
  layout.forEach((item) => {
    assert.equal(item.columnIndex, 0);
    assert.equal(item.totalColumns, 1);
  });
});

test('layoutOverlappingSessions places two overlapping sessions in separate columns', () => {
  const sessions = [
    { id: '1', startTime: '9:00 AM', endTime: '10:30 AM' },
    { id: '2', startTime: '10:00 AM', endTime: '11:00 AM' },
  ];
  const layout = layoutOverlappingSessions(sessions);
  const byId = Object.fromEntries(layout.map((item) => [item.id, item]));
  assert.notEqual(byId['1'].columnIndex, byId['2'].columnIndex);
  assert.equal(byId['1'].totalColumns, 2);
  assert.equal(byId['2'].totalColumns, 2);
});

test('layoutOverlappingSessions reuses a column once its previous occupant has ended', () => {
  const sessions = [
    { id: '1', startTime: '9:00 AM', endTime: '10:00 AM' },
    { id: '2', startTime: '9:00 AM', endTime: '10:00 AM' }, // overlaps 1, needs its own column
    { id: '3', startTime: '10:00 AM', endTime: '11:00 AM' }, // starts after 1 ends, can reuse its column
  ];
  const layout = layoutOverlappingSessions(sessions);
  const byId = Object.fromEntries(layout.map((item) => [item.id, item]));
  assert.equal(byId['1'].totalColumns, 2);
  assert.equal(byId['3'].columnIndex, byId['1'].columnIndex);
});

test('layoutOverlappingSessions places three mutually overlapping sessions in three columns', () => {
  const sessions = [
    { id: '1', startTime: '9:00 AM', endTime: '11:00 AM' },
    { id: '2', startTime: '9:30 AM', endTime: '10:30 AM' },
    { id: '3', startTime: '9:45 AM', endTime: '10:15 AM' },
  ];
  const layout = layoutOverlappingSessions(sessions);
  const columnIndexes = new Set(layout.map((item) => item.columnIndex));
  assert.equal(columnIndexes.size, 3);
  layout.forEach((item) => assert.equal(item.totalColumns, 3));
});
