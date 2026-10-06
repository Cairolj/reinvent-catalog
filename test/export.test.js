import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcsCalendar, escapeIcsText, foldIcsLine } from '../lib/export.js';

test('buildIcsCalendar wraps output in VCALENDAR/VTIMEZONE boilerplate', () => {
  const ics = buildIcsCalendar([], { year: 2026 });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /VERSION:2\.0\r\n/);
  assert.match(ics, /BEGIN:VTIMEZONE\r\nTZID:America\/Los_Angeles/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test('buildIcsCalendar converts a morning session to the correct 24-hour DTSTART/DTEND', () => {
  const sessions = [
    { id: 'abc123', title: 'Intro to Agents', sessionCode: 'AIM101', day: 'Monday, Nov 30', startTime: '9:00 AM', endTime: '10:00 AM', venue: 'Venetian', location: 'Venetian | Murano 3205', description: 'A great talk.' },
  ];
  const ics = buildIcsCalendar(sessions, { year: 2026 });
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20261130T090000/);
  assert.match(ics, /DTEND;TZID=America\/Los_Angeles:20261130T100000/);
  assert.match(ics, /UID:abc123@reinvent-catalog/);
  assert.match(ics, /SUMMARY:Intro to Agents \(AIM101\)/);
});

test('buildIcsCalendar converts a PM session to 24-hour time correctly', () => {
  const sessions = [
    { id: '1', title: 'Afternoon talk', day: 'Tuesday, Dec 1', startTime: '2:30 PM', endTime: '3:30 PM' },
  ];
  const ics = buildIcsCalendar(sessions, { year: 2026 });
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20261201T143000/);
  assert.match(ics, /DTEND;TZID=America\/Los_Angeles:20261201T153000/);
});

test('buildIcsCalendar converts 12:00 PM (noon) to hour 12, not 24', () => {
  const sessions = [{ id: '1', title: 'Lunch talk', day: 'Monday, Nov 30', startTime: '12:00 PM', endTime: '1:00 PM' }];
  const ics = buildIcsCalendar(sessions, { year: 2026 });
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20261130T120000/);
});

test('buildIcsCalendar converts 12:00 AM (midnight) to hour 0', () => {
  const sessions = [{ id: '1', title: 'Midnight talk', day: 'Monday, Nov 30', startTime: '12:00 AM', endTime: '1:00 AM' }];
  const ics = buildIcsCalendar(sessions, { year: 2026 });
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20261130T000000/);
});

test('buildIcsCalendar skips sessions without a day or start time', () => {
  const sessions = [
    { id: '1', title: 'Scheduled', day: 'Monday, Nov 30', startTime: '9:00 AM' },
    { id: '2', title: 'Unscheduled tabletop', day: '', startTime: '' },
  ];
  const ics = buildIcsCalendar(sessions, { year: 2026 });
  const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
  assert.equal(eventCount, 1);
  assert.doesNotMatch(ics, /Unscheduled tabletop/);
});

test('buildIcsCalendar uses the start time as the end time when endTime is missing', () => {
  const sessions = [{ id: '1', title: 'No end time', day: 'Monday, Nov 30', startTime: '9:00 AM' }];
  const ics = buildIcsCalendar(sessions, { year: 2026 });
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20261130T090000/);
  assert.match(ics, /DTEND;TZID=America\/Los_Angeles:20261130T090000/);
});

test('escapeIcsText escapes commas, semicolons, backslashes and newlines per RFC 5545', () => {
  assert.equal(escapeIcsText('Hello, world; test\\done\nline2'), 'Hello\\, world\\; test\\\\done\\nline2');
});

test('foldIcsLine leaves short lines untouched', () => {
  const line = 'SUMMARY:Short title';
  assert.equal(foldIcsLine(line), line);
});

test('foldIcsLine wraps lines longer than 75 characters with a leading space continuation', () => {
  const longLine = `SUMMARY:${'x'.repeat(100)}`;
  const folded = foldIcsLine(longLine);
  const physicalLines = folded.split('\r\n');
  assert.ok(physicalLines.length > 1);
  physicalLines.slice(1).forEach((l) => assert.ok(l.startsWith(' ')));
  physicalLines.forEach((l) => assert.ok(l.length <= 75));
});

test('buildIcsCalendar includes LOCATION and DESCRIPTION when present', () => {
  const sessions = [{
    id: '1',
    title: 'Full talk',
    day: 'Monday, Nov 30',
    startTime: '9:00 AM',
    endTime: '10:00 AM',
    location: 'Venetian | Level 2 | Murano 3205',
    description: 'Learn about zero trust.',
  }];
  const ics = buildIcsCalendar(sessions, { year: 2026 });
  assert.match(ics, /LOCATION:Venetian \| Level 2 \| Murano 3205/);
  assert.match(ics, /DESCRIPTION:Learn about zero trust\./);
});
