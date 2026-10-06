import { timeKey, compareDays, roomDetail } from './lib/sessions.js';
import { loadSelectedIds, saveSelectedIds, toggleSelection, detectConflicts, layoutOverlappingSessions } from './lib/schedule.js';
import { buildIcsCalendar } from './lib/export.js';
import { escapeHtml, openModal, wireModalGlobalEvents } from './modal.js';

const PX_PER_HOUR = 80;
const EVENT_YEAR = 2026;

const state = {
  allSessions: [],
  selectedIds: [],
};

async function loadAllSessions() {
  const response = await fetch('data/sessions.json');
  state.allSessions = await response.json();
}

function selectedSessions() {
  const idSet = new Set(state.selectedIds);
  return state.allSessions.filter((session) => idSet.has(session.id));
}

function isScheduled(session) {
  return Boolean(session.day) && Boolean(session.startTime);
}

function toggleSessionSelection(sessionId) {
  state.selectedIds = toggleSelection(state.selectedIds, sessionId);
  saveSelectedIds(state.selectedIds, window.localStorage);
  render();
}

function openSessionModal(session) {
  openModal(session, {
    isSelected: true,
    onToggle: () => {
      toggleSessionSelection(session.id);
      // The session was just removed from the schedule; close the modal
      // since re-opening it would show "Add" for a session no longer shown.
      document.getElementById('session-modal').hidden = true;
      document.body.classList.remove('modal-open');
    },
  });
}

function formatHourLabel(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const period = normalized < 12 ? 'AM' : 'PM';
  const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${displayHour} ${period}`;
}

function renderTimeAxis(startHour, endHour) {
  const axis = document.createElement('div');
  axis.className = 'time-axis';
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const label = document.createElement('div');
    label.className = 'time-axis-label';
    label.style.height = `${PX_PER_HOUR}px`;
    label.textContent = formatHourLabel(hour);
    axis.appendChild(label);
  }
  return axis;
}

function renderDayColumn(day, sessions, startHour, endHour, conflicts) {
  const column = document.createElement('div');
  column.className = 'day-column';

  const header = document.createElement('div');
  header.className = 'day-column-header';
  header.textContent = day;
  column.appendChild(header);

  const body = document.createElement('div');
  body.className = 'day-column-body';
  body.style.height = `${(endHour - startHour) * PX_PER_HOUR}px`;

  const layout = layoutOverlappingSessions(sessions);
  const layoutById = new Map(layout.map((item) => [item.id, item]));
  const gapPercent = 1;

  sessions.forEach((session) => {
    const startMinutes = timeKey(session.startTime);
    const endMinutes = timeKey(session.endTime || session.startTime);
    const top = ((startMinutes - startHour * 60) / 60) * PX_PER_HOUR;
    const height = Math.max(24, ((endMinutes - startMinutes) / 60) * PX_PER_HOUR);
    const { columnIndex, totalColumns } = layoutById.get(session.id);
    const columnWidthPercent = 100 / totalColumns;
    const leftPercent = columnIndex * columnWidthPercent;

    const block = document.createElement('div');
    block.className = 'event-block';
    if (conflicts.has(session.id)) block.classList.add('event-conflict');
    block.style.top = `${top}px`;
    block.style.height = `${height}px`;
    block.style.left = `calc(${leftPercent}% + ${gapPercent}px)`;
    block.style.width = `calc(${columnWidthPercent}% - ${gapPercent * 2}px)`;
    block.innerHTML = `
      <div class="event-title">${escapeHtml(session.title)}</div>
      <div class="event-time">${escapeHtml(session.startTime)}${session.endTime ? ` - ${escapeHtml(session.endTime)}` : ''}</div>
      <div class="event-location">${escapeHtml(session.venue)}${roomDetail(session) ? ` | ${escapeHtml(roomDetail(session))}` : ''}</div>
      ${conflicts.has(session.id) ? '<div class="event-conflict-badge">&#9888; Overlaps</div>' : ''}
    `;
    block.addEventListener('click', () => openSessionModal(session));
    body.appendChild(block);
  });

  column.appendChild(body);
  return column;
}

function renderUnscheduledList(sessions) {
  const section = document.getElementById('unscheduled-section');
  const list = document.getElementById('unscheduled-list');
  list.innerHTML = '';

  if (sessions.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  sessions.forEach((session) => {
    const item = document.createElement('li');
    item.className = 'unscheduled-item';
    item.innerHTML = `
      <span class="unscheduled-title">${escapeHtml(session.title)}</span>
      <button type="button" class="unscheduled-remove" aria-label="Remove from My Schedule">Remove</button>
    `;
    item.querySelector('.unscheduled-title').addEventListener('click', () => openSessionModal(session));
    item.querySelector('.unscheduled-remove').addEventListener('click', () => toggleSessionSelection(session.id));
    list.appendChild(item);
  });
}

function downloadIcsFile() {
  const sessions = selectedSessions();
  const ics = buildIcsCalendar(sessions, { year: EVENT_YEAR });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'my-reinvent-schedule.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function render() {
  const sessions = selectedSessions();
  const emptyMessage = document.getElementById('empty-schedule-message');
  const calendar = document.getElementById('calendar');
  const exportButton = document.getElementById('export-ics-button');
  calendar.innerHTML = '';
  exportButton.hidden = sessions.filter(isScheduled).length === 0;

  if (sessions.length === 0) {
    emptyMessage.hidden = false;
    renderUnscheduledList([]);
    return;
  }

  emptyMessage.hidden = true;

  const scheduled = sessions.filter(isScheduled);
  const unscheduled = sessions.filter((s) => !isScheduled(s));
  renderUnscheduledList(unscheduled);

  if (scheduled.length === 0) return;

  const conflicts = detectConflicts(scheduled);

  const byDay = new Map();
  scheduled.forEach((session) => {
    if (!byDay.has(session.day)) byDay.set(session.day, []);
    byDay.get(session.day).push(session);
  });

  const days = [...byDay.keys()].sort(compareDays);

  const allStartMinutes = scheduled.map((s) => timeKey(s.startTime));
  const allEndMinutes = scheduled.map((s) => timeKey(s.endTime || s.startTime));
  const startHour = Math.max(0, Math.floor(Math.min(...allStartMinutes) / 60));
  const endHour = Math.min(24, Math.ceil(Math.max(...allEndMinutes) / 60));

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  grid.appendChild(renderTimeAxis(startHour, endHour));

  days.forEach((day) => {
    const daySessions = byDay.get(day).sort((a, b) => timeKey(a.startTime) - timeKey(b.startTime));
    grid.appendChild(renderDayColumn(day, daySessions, startHour, endHour, conflicts));
  });

  calendar.appendChild(grid);
}

async function init() {
  state.selectedIds = loadSelectedIds(window.localStorage);
  await loadAllSessions();
  wireModalGlobalEvents();
  document.getElementById('export-ics-button').addEventListener('click', downloadIcsFile);
  render();
}

init();
