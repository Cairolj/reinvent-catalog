import { filterSessions, searchSessions, sortSessions, compareDays, roomDetail, speakerNames } from './lib/sessions.js';
import { loadSelectedIds, saveSelectedIds, toggleSelection, getConflictingWithSelectionIds } from './lib/schedule.js';
import { loadColumnWidths, saveColumnWidths, setColumnWidth } from './lib/columnWidths.js';
import { escapeHtml, openModal, wireModalGlobalEvents } from './modal.js';

const state = {
  sessions: [],
  query: '',
  venue: '',
  day: '',
  sortField: 'day',
  sortDirection: 'asc',
  selectedIds: [],
  hideConflicts: false,
};

async function loadSessions() {
  const response = await fetch('data/sessions.json');
  state.sessions = await response.json();
}

function populateFilterOptions() {
  const venues = [...new Set(state.sessions.map((s) => s.venue).filter(Boolean))].sort();
  const days = [...new Set(state.sessions.map((s) => s.day).filter(Boolean))].sort(compareDays);

  const venueSelect = document.getElementById('venue-filter');
  venues.forEach((venue) => {
    const option = document.createElement('option');
    option.value = venue;
    option.textContent = venue;
    venueSelect.appendChild(option);
  });

  const daySelect = document.getElementById('day-filter');
  days.forEach((day) => {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = day;
    daySelect.appendChild(option);
  });
}

function toggleSessionSelection(sessionId) {
  state.selectedIds = toggleSelection(state.selectedIds, sessionId);
  saveSelectedIds(state.selectedIds, window.localStorage);
  render();
}

function openSessionModal(session) {
  openModal(session, {
    isSelected: state.selectedIds.includes(session.id),
    onToggle: () => {
      toggleSessionSelection(session.id);
      openSessionModal(session);
    },
  });
}

function render() {
  let result = filterSessions(state.sessions, { venue: state.venue, day: state.day });
  result = searchSessions(result, state.query);
  result = sortSessions(result, state.sortField, state.sortDirection);

  const tbody = document.getElementById('sessions-tbody');
  const emptyMessage = document.getElementById('empty-message');
  const resultCount = document.getElementById('result-count');
  tbody.innerHTML = '';
  resultCount.textContent = `${result.length} session(s)`;

  const conflictingIds = getConflictingWithSelectionIds(state.sessions, state.selectedIds);

  if (state.hideConflicts) {
    result = result.filter((session) => !conflictingIds.has(session.id) || state.selectedIds.includes(session.id));
  }

  if (result.length === 0) {
    emptyMessage.hidden = false;
  } else {
    emptyMessage.hidden = true;
    result.forEach((session) => {
      const row = document.createElement('tr');
      row.classList.add('session-row');
      if (conflictingIds.has(session.id)) row.classList.add('session-row-conflict');
      row.tabIndex = 0;
      const timeRange = session.startTime
        ? `${session.startTime}${session.endTime ? ` - ${session.endTime}` : ''}`
        : '';
      const isSelected = state.selectedIds.includes(session.id);
      const hasConflict = conflictingIds.has(session.id);
      if (hasConflict) {
        row.title = 'Overlaps in time with a session already in My Schedule';
      }
      row.innerHTML = `
        <td class="select-column">
          <input type="checkbox" class="select-checkbox" aria-label="Add to My Schedule" ${isSelected ? 'checked' : ''} />
          ${hasConflict ? '<span class="conflict-icon" title="Time conflict with My Schedule">&#9888;</span>' : ''}
        </td>
        <td>${escapeHtml(session.title)}${session.sessionCode ? ` <small>(${escapeHtml(session.sessionCode)})</small>` : ''}</td>
        <td>${escapeHtml(session.venue)}</td>
        <td>${escapeHtml(roomDetail(session))}</td>
        <td>${escapeHtml(session.day)}</td>
        <td>${escapeHtml(timeRange)}</td>
        <td>${escapeHtml(session.level) || '—'}</td>
        <td>${escapeHtml(session.type) || '—'}</td>
        <td>${escapeHtml((session.topics || []).join(', '))}</td>
        <td>${escapeHtml(speakerNames(session))}</td>
      `;
      row.querySelector('.select-checkbox').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSessionSelection(session.id);
      });
      row.addEventListener('click', () => openSessionModal(session));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openSessionModal(session);
        }
      });
      tbody.appendChild(row);
    });
  }

  document.querySelectorAll('th[data-field]').forEach((th) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.field === state.sortField) {
      th.classList.add(state.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

function columnKeyFor(th, index) {
  return th.dataset.field || `col-${index}`;
}

function applyStoredColumnWidths() {
  const widths = loadColumnWidths(window.localStorage);
  const headers = document.querySelectorAll('#sessions-table thead th');
  headers.forEach((th, index) => {
    const key = columnKeyFor(th, index);
    if (widths[key]) {
      th.style.width = `${widths[key]}px`;
    }
  });
}

function wireColumnResize() {
  const table = document.getElementById('sessions-table');
  const headers = table.querySelectorAll('thead th');

  headers.forEach((th, index) => {
    const resizer = document.createElement('span');
    resizer.className = 'col-resizer';
    th.appendChild(resizer);

    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      th.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('col-resizing');

      const key = columnKeyFor(th, index);
      const widths = setColumnWidth(loadColumnWidths(window.localStorage), key, th.getBoundingClientRect().width);
      saveColumnWidths(widths, window.localStorage);
    };

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startWidth = th.getBoundingClientRect().width;
      document.body.classList.add('col-resizing');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

function wireEvents() {
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.query = e.target.value;
    render();
  });

  document.getElementById('venue-filter').addEventListener('change', (e) => {
    state.venue = e.target.value;
    render();
  });

  document.getElementById('day-filter').addEventListener('change', (e) => {
    state.day = e.target.value;
    render();
  });

  document.getElementById('hide-conflicts-filter').addEventListener('change', (e) => {
    state.hideConflicts = e.target.checked;
    render();
  });

  document.querySelectorAll('th[data-field]').forEach((th) => {
    th.addEventListener('click', (e) => {
      if (e.target.classList.contains('col-resizer')) return;
      const field = th.dataset.field;
      if (state.sortField === field) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = field;
        state.sortDirection = 'asc';
      }
      render();
    });
  });

  wireModalGlobalEvents();
}

async function init() {
  state.selectedIds = loadSelectedIds(window.localStorage);
  await loadSessions();
  populateFilterOptions();
  wireEvents();
  wireColumnResize();
  applyStoredColumnWidths();
  render();
}

init();
