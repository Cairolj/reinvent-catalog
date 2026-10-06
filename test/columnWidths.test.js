import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadColumnWidths, saveColumnWidths, setColumnWidth } from '../lib/columnWidths.js';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    _map: map,
  };
}

test('loadColumnWidths returns an empty object when nothing is stored', () => {
  const storage = createFakeStorage();
  assert.deepEqual(loadColumnWidths(storage), {});
});

test('loadColumnWidths returns an empty object for corrupted JSON', () => {
  const storage = createFakeStorage();
  storage.setItem('reinvent-column-widths', 'not valid json{');
  assert.deepEqual(loadColumnWidths(storage), {});
});

test('loadColumnWidths returns an empty object when stored value is an array', () => {
  const storage = createFakeStorage();
  storage.setItem('reinvent-column-widths', JSON.stringify(['not', 'an', 'object']));
  assert.deepEqual(loadColumnWidths(storage), {});
});

test('saveColumnWidths persists the widths object as JSON', () => {
  const storage = createFakeStorage();
  saveColumnWidths({ title: 200 }, storage);
  assert.equal(storage._map.get('reinvent-column-widths'), JSON.stringify({ title: 200 }));
});

test('loadColumnWidths reads back what saveColumnWidths wrote', () => {
  const storage = createFakeStorage();
  saveColumnWidths({ title: 200, venue: 150 }, storage);
  assert.deepEqual(loadColumnWidths(storage), { title: 200, venue: 150 });
});

test('setColumnWidth adds a new column width without mutating the original object', () => {
  const original = { title: 200 };
  const result = setColumnWidth(original, 'venue', 150);
  assert.deepEqual(original, { title: 200 });
  assert.deepEqual(result, { title: 200, venue: 150 });
});

test('setColumnWidth overwrites an existing column width', () => {
  const result = setColumnWidth({ title: 200 }, 'title', 250);
  assert.deepEqual(result, { title: 250 });
});
