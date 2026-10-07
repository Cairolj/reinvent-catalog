const STORAGE_KEY = 'reinvent-session-overrides';

export function loadOverrides(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveOverrides(overrides, storage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function setOverride(overrides, id, { day, startTime, endTime }) {
  return { ...overrides, [id]: { day, startTime, endTime } };
}

export function clearOverride(overrides, id) {
  const { [id]: _removed, ...rest } = overrides;
  return rest;
}

/**
 * Merges a manually-entered day/time override onto a session, for
 * sessions the scraped catalog has no fixed schedule for (e.g. self-paced
 * "Tabletop Experience" sessions). Returns a new object; the original
 * session and the overrides map are never mutated.
 */
export function applyOverride(session, overrides) {
  const override = overrides[session.id];
  if (!override) return session;
  return { ...session, day: override.day, startTime: override.startTime, endTime: override.endTime };
}

/**
 * Converts a 24-hour "HH:MM" string (as produced by <input type="time">)
 * into the "H:MM AM/PM" format used throughout the rest of the app's data
 * (matching the format scraped from the AWS catalog).
 */
export function formatTime12h(time24h) {
  if (!time24h) return '';
  const [hourStr, minuteStr] = time24h.split(':');
  const hour24 = parseInt(hourStr, 10);
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minuteStr} ${period}`;
}

/**
 * Converts a "H:MM AM/PM" string back into 24-hour "HH:MM" format, for
 * pre-filling an <input type="time"> when editing an existing override.
 */
export function parseTime12hTo24h(time12h) {
  if (!time12h) return '';
  const match = time12h.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '';
  let hour = parseInt(match[1], 10) % 12;
  const minute = match[2];
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}
