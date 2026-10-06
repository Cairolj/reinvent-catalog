const MONTH_NUMBERS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseDayToMonthDay(dayStr) {
  const match = dayStr.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return null;
  const month = MONTH_NUMBERS[match[1].slice(0, 3).toLowerCase()];
  if (!month) return null;
  return { month, day: parseInt(match[2], 10) };
}

function parseTimeToHM(timeStr) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10) % 12;
  const minute = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return { hour, minute };
}

function formatIcsDateTime(year, month, day, hour, minute) {
  return `${year}${pad2(month)}${pad2(day)}T${pad2(hour)}${pad2(minute)}00`;
}

export function escapeIcsText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Folds a single logical ICS line into multiple physical lines no longer
// than 75 octets, as required by RFC 5545. Continuation lines start with a
// single space, which readers must strip when unfolding.
export function foldIcsLine(line) {
  if (line.length <= 75) return line;
  const chunks = [];
  let remaining = line;
  let first = true;
  while (remaining.length > 0) {
    const size = first ? 75 : 74;
    chunks.push(remaining.slice(0, size));
    remaining = remaining.slice(size);
    first = false;
  }
  return chunks.join('\r\n ');
}

function isSchedulable(session) {
  return Boolean(session.day) && Boolean(session.startTime) && parseDayToMonthDay(session.day) && parseTimeToHM(session.startTime);
}

/**
 * Builds an RFC 5545 iCalendar (.ics) document from a list of sessions.
 * Only sessions with a parseable day and start time are included; sessions
 * without a scheduled day/time (e.g. self-paced "Tabletop Experience"
 * sessions) are silently skipped since they have no calendar slot.
 *
 * Times are anchored to the given `year` (the event's actual year isn't
 * present in the scraped data) and expressed in the America/Los_Angeles
 * timezone, matching the "PST" times shown throughout the catalog.
 */
export function buildIcsCalendar(sessions, { year, calendarName = 'My re:Invent Schedule' } = {}) {
  const scheduled = sessions.filter(isSchedulable);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//reinvent-catalog//My Schedule//EN',
    'CALSCALE:GREGORIAN',
    foldIcsLine(`X-WR-CALNAME:${escapeIcsText(calendarName)}`),
    'BEGIN:VTIMEZONE',
    'TZID:America/Los_Angeles',
    'BEGIN:STANDARD',
    'DTSTART:19701101T020000',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0800',
    'TZNAME:PST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  scheduled.forEach((session) => {
    const { month, day } = parseDayToMonthDay(session.day);
    const start = parseTimeToHM(session.startTime);
    const end = session.endTime ? parseTimeToHM(session.endTime) || start : start;

    const dtstart = formatIcsDateTime(year, month, day, start.hour, start.minute);
    const dtend = formatIcsDateTime(year, month, day, end.hour, end.minute);
    const summary = `${session.title || ''}${session.sessionCode ? ` (${session.sessionCode})` : ''}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${session.id}@reinvent-catalog`);
    lines.push(`DTSTART;TZID=America/Los_Angeles:${dtstart}`);
    lines.push(`DTEND;TZID=America/Los_Angeles:${dtend}`);
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(summary)}`));
    if (session.location) lines.push(foldIcsLine(`LOCATION:${escapeIcsText(session.location)}`));
    if (session.description) lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(session.description)}`));
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
