export function filterSessions(sessions, { venue, day } = {}) {
  return sessions.filter((session) => {
    if (venue && session.venue !== venue) return false;
    if (day && session.day !== day) return false;
    return true;
  });
}

export function searchSessions(sessions, query) {
  if (!query) return sessions;
  const needle = query.toLowerCase();
  return sessions.filter((session) => {
    const speakerNames = (session.speakers || []).map((s) => (typeof s === 'string' ? s : s.name || ''));
    const haystack = [
      session.title || '',
      session.description || '',
      ...speakerNames,
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

const MONTH_ABBREVIATIONS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Sentinel for missing day/time values. Must be finite: using Infinity here
// would make Infinity - Infinity = NaN when comparing two missing values,
// which breaks Array.prototype.sort's ordering contract and produces
// unpredictable results (observed: undated sessions appearing first).
const MISSING_KEY = 999999;

export function dayKey(dayStr) {
  if (!dayStr) return MISSING_KEY;
  const match = dayStr.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return MISSING_KEY;
  const monthIndex = MONTH_ABBREVIATIONS.indexOf(match[1].slice(0, 3).toLowerCase());
  if (monthIndex === -1) return MISSING_KEY;
  const dayNumber = parseInt(match[2], 10);
  return monthIndex * 100 + dayNumber;
}

export function compareDays(a, b) {
  return dayKey(a) - dayKey(b);
}

export function timeKey(timeStr) {
  if (!timeStr) return MISSING_KEY;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return MISSING_KEY;
  let hours = parseInt(match[1], 10) % 12;
  const minutes = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + minutes;
}

export function roomDetail(session) {
  if (!session.location) return '';
  if (session.venue && session.location.startsWith(session.venue)) {
    return session.location.slice(session.venue.length).replace(/^\s*\|\s*/, '');
  }
  return session.location;
}

export function speakerNames(session) {
  return (session.speakers || [])
    .map((speaker) => (typeof speaker === 'string' ? speaker : speaker?.name || ''))
    .filter(Boolean)
    .join(', ');
}

const FIELD_ACCESSORS = {
  room: roomDetail,
  topics: (session) => (session.topics || []).join(', '),
  speakers: speakerNames,
};

export function sortSessions(sessions, field, direction = 'asc') {
  const multiplier = direction === 'asc' ? 1 : -1;

  const comparator = (a, b) => {
    if (field === 'day') {
      const dayDiff = dayKey(a.day) - dayKey(b.day);
      if (dayDiff !== 0) return dayDiff * multiplier;
      return (timeKey(a.startTime) - timeKey(b.startTime)) * multiplier;
    }

    if (field === 'startTime') {
      return (timeKey(a.startTime) - timeKey(b.startTime)) * multiplier;
    }

    const accessor = FIELD_ACCESSORS[field];
    const valueA = String(accessor ? accessor(a) : a[field] || '').toLowerCase();
    const valueB = String(accessor ? accessor(b) : b[field] || '').toLowerCase();
    if (valueA < valueB) return -1 * multiplier;
    if (valueA > valueB) return 1 * multiplier;
    return 0;
  };

  return [...sessions].sort(comparator);
}
