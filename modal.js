import { roomDetail } from './lib/sessions.js';

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

function modalContent(session, isSelected) {
  const timeRange = session.startTime
    ? `${session.startTime}${session.endTime ? ` - ${session.endTime}` : ''}${session.timezone ? ` ${session.timezone}` : ''}`
    : '';
  const topBadges = [session.type, session.level, ...(session.features || []), ...(session.tags || [])];

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
 * @param {object} session - The session to display.
 * @param {object} options
 * @param {boolean} options.isSelected - Whether the session is currently in "My Schedule".
 * @param {() => void} options.onToggle - Called when the user clicks the add/remove button.
 */
export function openModal(session, { isSelected, onToggle }) {
  const overlay = document.getElementById('session-modal');
  const body = document.getElementById('modal-body');
  body.innerHTML = modalContent(session, isSelected);
  overlay.hidden = false;
  document.body.classList.add('modal-open');

  body.querySelector('.modal-schedule-toggle').addEventListener('click', onToggle);
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
