import { dayKey, timeKey } from './sessions.js';

const STORAGE_KEY = 'reinvent-selected-sessions';

export function loadSelectedIds(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSelectedIds(ids, storage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function toggleSelection(ids, id) {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

function isScheduled(session) {
  return Boolean(session.day) && Boolean(session.startTime);
}

function absoluteRange(session) {
  const dayOffset = dayKey(session.day) * 1440;
  const start = dayOffset + timeKey(session.startTime);
  const end = dayOffset + timeKey(session.endTime || session.startTime);
  return { start, end };
}

export function detectConflicts(sessions) {
  const scheduled = sessions
    .filter(isScheduled)
    .map((session) => ({ id: session.id, ...absoluteRange(session) }));

  const conflicts = new Set();

  for (let i = 0; i < scheduled.length; i += 1) {
    for (let j = i + 1; j < scheduled.length; j += 1) {
      const a = scheduled[i];
      const b = scheduled[j];
      const overlaps = a.start < b.end && b.start < a.end;
      if (overlaps) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }

  return conflicts;
}

/**
 * Returns the set of session ids (from allSessions) whose time range
 * overlaps with at least one currently selected session, on the same day.
 * A selected session that overlaps with another selected session is
 * included too. Used to highlight potential conflicts in the catalog
 * table before the user even opens "My Schedule".
 */
export function getConflictingWithSelectionIds(allSessions, selectedIds) {
  const idSet = new Set(selectedIds);
  const selectedRanges = allSessions
    .filter((session) => idSet.has(session.id) && isScheduled(session))
    .map((session) => ({ id: session.id, ...absoluteRange(session) }));

  const conflicts = new Set();

  allSessions.filter(isScheduled).forEach((session) => {
    const range = { id: session.id, ...absoluteRange(session) };
    selectedRanges.forEach((selected) => {
      if (selected.id === range.id) return;
      const overlaps = range.start < selected.end && selected.start < range.end;
      if (overlaps) {
        conflicts.add(range.id);
        conflicts.add(selected.id);
      }
    });
  });

  return conflicts;
}

/**
 * Lays out a list of sessions that occur on the same day so that
 * overlapping ones are placed in separate side-by-side columns instead of
 * being stacked exactly on top of each other (which would make all but
 * the topmost one unclickable). Returns an array of
 * { id, columnIndex, totalColumns } in the same order as the input.
 *
 * Uses a simple greedy "first free column" packing: events are processed
 * in start-time order, and each is placed in the first column whose
 * previous occupant has already ended by the time this one starts.
 * totalColumns is the max concurrent column count across the whole day
 * (a simplification: separate non-overlapping clusters all get the same
 * column width rather than each being sized independently).
 */
export function layoutOverlappingSessions(sessions) {
  const withRanges = sessions.map((session) => ({
    id: session.id,
    start: timeKey(session.startTime),
    end: timeKey(session.endTime || session.startTime),
  }));

  const order = [...withRanges].sort((a, b) => a.start - b.start);
  const columnEndTimes = [];
  const columnIndexById = new Map();

  order.forEach((item) => {
    let columnIndex = columnEndTimes.findIndex((endTime) => endTime <= item.start);
    if (columnIndex === -1) {
      columnIndex = columnEndTimes.length;
      columnEndTimes.push(item.end);
    } else {
      columnEndTimes[columnIndex] = item.end;
    }
    columnIndexById.set(item.id, columnIndex);
  });

  const totalColumns = columnEndTimes.length || 1;

  return sessions.map((session) => ({
    id: session.id,
    columnIndex: columnIndexById.get(session.id) ?? 0,
    totalColumns,
  }));
}
