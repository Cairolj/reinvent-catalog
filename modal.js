import { roomDetail, seatsLabel } from './lib/sessions.js';
import { parseTime12hTo24h, formatTime12h } from './lib/overrides.js';

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

export function renderBadgeList(values) {
  return (values || [])
    .filter(Boolean)
    .map((value) => `<span class="badge">${escapeHtml(value)}</span>`)
    .join('');
}

function renderModalSpeakers(speakers) {
  if (!speakers || speakers.length === 0) return '<p class="modal-empty">No speakers listed.</p>';
  const items = speakers
    .map((speaker) => {
      const name = escapeHtml(typeof speaker === 'string' ? speaker : speaker?.name || '');
      const title = escapeHtml(typeof speaker === 'string' ? '' : speaker?.title || '');
      return `<li><strong>${name}</strong>${title ? `, ${title}` : ''}</li>`;
    })
    .join('');
  return `<ul class="modal-speakers">${items}</ul>`;
}

function renderOverrideForm(session, scheduleOverride) {
  if (!scheduleOverride?.isUnscheduledOriginally) return '';

  const { availableDays, hasOverride } = scheduleOverride;
  const dayOptions = availableDays
    .map((day) => `<option value="${escapeHtml(day)}" ${day === session.day ? 'selected' : ''}>${escapeHtml(day)}</option>`)
    .join('');
  const startValue = parseTime12hTo24h(session.startTime);
  const endValue = parseTime12hTo24h(session.endTime);

  return `
    <div class="modal-section modal-override-form">
      <p class="meta-label">${hasOverride ? 'Your time for this session (editable):' : 'This session has no fixed time. Set one yourself:'}</p>
      <div class="override-fields">
        <select id="override-day">
          <option value="">Choose a day</option>
          ${dayOptions}
        </select>
        <input type="time" id="override-start" value="${escapeHtml(startValue)}" aria-label="Start time" />
        <input type="time" id="override-end" value="${escapeHtml(endValue)}" aria-label="End time" />
        <button type="button" class="override-save-btn">Save time</button>
        ${hasOverride ? '<button type="button" class="override-clear-btn">Clear</button>' : ''}
      </div>
    </div>
  `;
}

function modalContent(session, isSelected, scheduleOverride) {
  const timeRange = session.startTime
    ? `${session.startTime}${session.endTime ? ` - ${session.endTime}` : ''}${session.timezone ? ` ${session.timezone}` : ''}`
    : '';
  const topBadges = [session.type, session.level, ...(session.features || []), ...(session.tags || [])];
  const seats = seatsLabel(session);

  return `
    <div class="modal-badges">${renderBadgeList(topBadges)}</div>
    <h2 id="modal-title" class="modal-session-title">
      ${escapeHtml(session.title)}
      ${session.sessionCode ? `<span class="session-code">(${escapeHtml(session.sessionCode)})</span>` : ''}
    </h2>
    <p class="modal-schedule">
      <strong>${escapeHtml(session.day) || 'No scheduled day'}</strong>${timeRange ? ` &middot; ${escapeHtml(timeRange)}` : ''}
    </p>
    <p class="modal-location">${escapeHtml(session.venue)}${roomDetail(session) ? ` | ${escapeHtml(roomDetail(session))}` : ''}</p>
    ${seats ? `<p class="modal-seats"><span class="seats-badge${session.isWalkUpOnly ? ' seats-badge-walkup' : ' seats-badge-limited'}">${escapeHtml(seats)}</span></p>` : ''}
    ${renderOverrideForm(session, scheduleOverride)}
    ${session.description ? `<p class="modal-description">${escapeHtml(session.description)}</p>` : ''}
    ${session.topics?.length ? `<div class="modal-section"><span class="meta-label">Topic:</span> ${renderBadgeList(session.topics)}</div>` : ''}
    ${session.areaOfInterest?.length ? `<div class="modal-section"><span class="meta-label">Area of interest:</span> ${renderBadgeList(session.areaOfInterest)}</div>` : ''}
    ${session.services?.length ? `<div class="modal-section"><span class="meta-label">Services:</span> ${renderBadgeList(session.services)}</div>` : ''}
    <div class="modal-section">
      <span class="meta-label">Speakers:</span>
      ${renderModalSpeakers(session.speakers)}
    </div>
    <button type="button" class="modal-schedule-toggle">
      ${isSelected ? 'Remove from My Schedule' : 'Add to My Schedule'}
    </button>
  `;
}

/**
 * Opens the shared session detail modal.
 * @param {object} session - The session to display (with any override already applied).
 * @param {object} options
 * @param {boolean} options.isSelected - Whether the session is currently in "My Schedule".
 * @param {() => void} options.onToggle - Called when the user clicks the add/remove button.
 * @param {object} [options.scheduleOverride] - Only needed for sessions the
 *   scraped catalog has no day/time for.
 * @param {string[]} options.scheduleOverride.availableDays - Day strings to offer in the picker.
 * @param {boolean} options.scheduleOverride.hasOverride - Whether a manual time is already saved.
 * @param {boolean} options.scheduleOverride.isUnscheduledOriginally - Whether to show the form at all.
 * @param {(day: string, startTime: string, endTime: string) => void} options.scheduleOverride.onSave
 * @param {() => void} options.scheduleOverride.onClear
 */
export function openModal(session, { isSelected, onToggle, scheduleOverride }) {
  const overlay = document.getElementById('session-modal');
  const body = document.getElementById('modal-body');
  body.innerHTML = modalContent(session, isSelected, scheduleOverride);
  overlay.hidden = false;
  document.body.classList.add('modal-open');

  body.querySelector('.modal-schedule-toggle').addEventListener('click', onToggle);

  const saveBtn = body.querySelector('.override-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const day = body.querySelector('#override-day').value;
      const startTime24h = body.querySelector('#override-start').value;
      const endTime24h = body.querySelector('#override-end').value;
      if (!day || !startTime24h) {
        window.alert('Please choose a day and a start time.');
        return;
      }
      scheduleOverride.onSave(day, formatTime12h(startTime24h), formatTime12h(endTime24h));
    });
  }

  const clearBtn = body.querySelector('.override-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => scheduleOverride.onClear());
  }
}

export function closeModal() {
  const overlay = document.getElementById('session-modal');
  overlay.hidden = true;
  document.body.classList.remove('modal-open');
}

export function wireModalGlobalEvents() {
  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.getElementById('session-modal').addEventListener('click', (e) => {
    if (e.target.id === 'session-modal') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}
