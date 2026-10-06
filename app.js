import { filterSessions, searchSessions, sortSessions, compareDays, roomDetail, speakerNames } from './lib/sessions.js';
import { loadSelectedIds, saveSelectedIds, toggleSelection, getConflictingWithSelectionIds } from './lib/schedule.js';
import { loadColumnWidths, saveColumnWidths, setColumnWidth } from './lib/columnWidths.js';
import { escapeHtml, openModal, wireModalGlobalEvents } from './modal.js';

const UNSCHEDULED_DAY = '__unscheduled__';

const state = {
  sessions: [],
  sessionsById: new Map(),
  query: '',
  venue: '',
  day: '',
  sortField: 'startTime',
  sortDirection: 'asc',
  selectedIds: [],
  hideConflicts: false,
  conflictingIds: new Set(),
};

function recomputeConflicts() {
  state.conflictingIds = getConflictingWithSelectionIds(state.sessions, state.selectedIds);
}

async function loadSessions() {
  const response = await fetch('data/sessions.json');
  state.sessions = await response.json();
  state.sessionsById = new Map(state.sessions.map((s) => [s.id, s]));
}

function populateVenueOptions() {
  const venues = [...new Set(state.sessions.map((s) => s.venue).filter(Boolean))].sort();
  const venueSelect = document.getElementById('venue-filter');
  venues.forEach((venue) => {
    const option = document.createElement('option');
    option.value = venue;
    option.textContent = venue;
    venueSelect.appendChild(option);
  });
}

function renderDayTabs(days, hasUnscheduled) {
  const container = document.getElementById('day-tabs');
  container.innerHTML = '';

  const addTab = (value, label, extraClass = '') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `day-tab ${extraClass}`.trim();
    button.textContent = label;
    button.dataset.day = value;
    if (value === state.day) button.classList.add('day-tab-active');
    button.addEventListener('click', () => {
      state.day = value;
      container.querySelectorAll('.day-tab').forEach((btn) => {
        btn.classList.toggle('day-tab-active', btn.dataset.day === value);
      });
      render();
    });
    container.appendChild(button);
  };

  days.forEach((day) => addTab(day, day));

  // Sessions without a day/venue (e.g. self-paced "Tabletop Experience"
  // gamified-learning sessions) have no slot in any day tab. Without this,
  // switching from the old "All days" dropdown to per-day tabs made them
  // permanently invisible in the catalog. Give them their own tab instead.
  if (hasUnscheduled) {
    addTab(UNSCHEDULED_DAY, 'Unscheduled', 'day-tab-unscheduled');
  }
}

function toggleSessionSelection(sessionId) {
  state.selectedIds = toggleSelection(state.selectedIds, sessionId);
  saveSelectedIds(state.selectedIds, window.localStorage);
  recomputeConflicts();
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

function rowHtml(session) {
  const timeRange = session.startTime
    ? `${session.startTime}${session.endTime ? ` - ${session.endTime}` : ''}`
    : '';
  const isSelected = state.selectedIds.includes(session.id);
  const hasConflict = state.conflictingIds.has(session.id);

  return `
    <tr class="session-row${hasConflict ? ' session-row-conflict' : ''}" tabindex="0" data-session-id="${escapeHtml(session.id)}" ${hasConflict ? 'title="Overlaps in time with a session already in My Schedule"' : ''}>
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
    </tr>
  `;
}

function render() {
  let result;
  if (state.day === UNSCHEDULED_DAY) {
    result = filterSessions(state.sessions, { venue: state.venue });
    result = result.filter((session) => !session.day);
  } else {
    result = filterSessions(state.sessions, { venue: state.venue, day: state.day });
  }
  result = searchSessions(result, state.query);

  if (state.hideConflicts) {
    result = result.filter((session) => !state.conflictingIds.has(session.id) || state.selectedIds.includes(session.id));
  }

  result = sortSessions(result, state.sortField, state.sortDirection);

  const tbody = document.getElementById('sessions-tbody');
  const emptyMessage = document.getElementById('empty-message');
  const resultCount = document.getElementById('result-count');
  resultCount.textContent = `${result.length} session(s)`;

  if (result.length === 0) {
    emptyMessage.hidden = false;
    tbody.innerHTML = '';
  } else {
    emptyMessage.hidden = true;
    // Built as one HTML string and assigned once, instead of creating and
    // appending each <tr> individually: far fewer DOM operations for
    // large result sets. A single delegated listener on the tbody (wired
    // once in wireEvents) handles clicks for every row, so we don't attach
    // per-row listeners here (which was the main source of lag when
    // re-rendering hundreds of rows on every keystroke/selection change).
    tbody.innerHTML = result.map(rowHtml).join('');
  }

  document.querySelectorAll('#header-table th[data-field]').forEach((th) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.field === state.sortField) {
      th.classList.add(state.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

function setColumnWidthPx(field, widthPx) {
  document.querySelectorAll(`.col-${field}`).forEach((col) => {
    col.style.width = `${widthPx}px`;
  });
}

function applyStoredColumnWidths() {
  const widths = loadColumnWidths(window.localStorage);
  Object.entries(widths).forEach(([field, widthPx]) => setColumnWidthPx(field, widthPx));
}

function wireColumnResize() {
  const headers = document.querySelectorAll('#header-table thead th[data-field]:not(.select-column)');

  headers.forEach((th) => {
    const field = th.dataset.field;
    const resizer = document.createElement('span');
    resizer.className = 'col-resizer';
    th.appendChild(resizer);

    let startX = 0;
    let startWidth = 0;
    let pendingWidth = null;
    let rafId = null;

    const applyPendingWidth = () => {
      rafId = null;
      if (pendingWidth !== null) {
        setColumnWidthPx(field, pendingWidth);
      }
    };

    const onMouseMove = (e) => {
      const delta = e.clientX - startX;
      pendingWidth = Math.max(60, startWidth + delta);
      // Batch the actual style write (and the table reflow it causes) to
      // once per animation frame instead of once per mousemove event,
      // which fires far more often than the screen can repaint.
      if (rafId === null) {
        rafId = requestAnimationFrame(applyPendingWidth);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('col-resizing');
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        applyPendingWidth();
      }

      const widths = setColumnWidth(loadColumnWidths(window.localStorage), field, th.getBoundingClientRect().width);
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

function debounce(fn, delayMs) {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

function wireEvents() {
  const debouncedRender = debounce(render, 200);
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.query = e.target.value;
    debouncedRender();
  });

  document.getElementById('venue-filter').addEventListener('change', (e) => {
    state.venue = e.target.value;
    render();
  });

  document.getElementById('hide-conflicts-filter').addEventListener('change', (e) => {
    state.hideConflicts = e.target.checked;
    render();
  });

  document.querySelectorAll('#header-table th[data-field]:not(.select-column)').forEach((th) => {
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

  // Single delegated listener for the whole table body instead of three
  // listeners per row (checkbox click, row click, row keydown). With
  // ~400+ rows per day this avoids attaching thousands of listeners on
  // every render.
  const tbody = document.getElementById('sessions-tbody');
  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-session-id]');
    if (!row) return;
    const session = state.sessionsById.get(row.dataset.sessionId);
    if (!session) return;

    if (e.target.classList.contains('select-checkbox')) {
      e.stopPropagation();
      toggleSessionSelection(session.id);
      return;
    }

    openSessionModal(session);
  });

  tbody.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('tr[data-session-id]');
    if (!row) return;
    e.preventDefault();
    const session = state.sessionsById.get(row.dataset.sessionId);
    if (session) openSessionModal(session);
  });

  wireModalGlobalEvents();
}

async function init() {
  state.selectedIds = loadSelectedIds(window.localStorage);
  await loadSessions();

  const days = [...new Set(state.sessions.map((s) => s.day).filter(Boolean))].sort(compareDays);
  const hasUnscheduled = state.sessions.some((s) => !s.day);
  state.day = days[0] || (hasUnscheduled ? UNSCHEDULED_DAY : '');

  populateVenueOptions();
  renderDayTabs(days, hasUnscheduled);
  recomputeConflicts();
  wireEvents();
  wireColumnResize();
  applyStoredColumnWidths();
  render();
}

init();
