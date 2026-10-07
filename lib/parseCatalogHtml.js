import * as cheerio from 'cheerio';

function textOf($el) {
  return $el.text().replace(/\s+/g, ' ').trim();
}

function badgeTexts($, card, badgeClass) {
  return card
    .find(`.badges > .badge.${badgeClass}`)
    .map((_, el) => textOf($(el)))
    .get();
}

function parseTitleAndCode(rawTitle) {
  const match = rawTitle.match(/^(.*)\(([A-Z]{2,5}\d{2,4}(?:-R\d*)?)\)\s*$/);
  if (match) {
    return { title: match[1].trim(), sessionCode: match[2].trim() };
  }
  return { title: rawTitle.trim(), sessionCode: '' };
}

function parseSpeakers($, card) {
  return card
    .find('[data-test="speakers-component"] [data-test^="participant-info-"]')
    .map((_, el) => {
      const $p = $(el);
      const name = textOf($p.find('.mdBtnR-text').first());
      const fullText = textOf($p);
      // fullText looks like "Robert Albach , Principal Product Manager, AWS"
      const titleCompany = fullText
        .replace(name, '')
        .replace(/^\s*,\s*/, '')
        .trim();
      return { name, title: titleCompany };
    })
    .get();
}

function parseDayTimeLocation($, card) {
  const $timeLine = card.find('[data-test="session-time-line"]').first();
  const day = textOf($timeLine.find('.session-date'));
  const timeRange = textOf($timeLine.find('.session-time'));
  const location = textOf($timeLine.find('.session-location'));

  let startTime = '';
  let endTime = '';
  let timezone = '';
  const timeMatch = timeRange.match(/^(.*?)\s*-\s*(.*?)\s+([A-Z]{2,4})$/);
  if (timeMatch) {
    startTime = timeMatch[1].trim();
    endTime = timeMatch[2].trim();
    timezone = timeMatch[3].trim();
  }

  return { day, startTime, endTime, timezone, location };
}

function parseAvailability($, card) {
  // Sessions marked "Walk up only" (badge + attribute block) have no
  // advance reservation; seating is first-come, first-served at the room.
  const isWalkUpOnly = card.find('.badges > .badge.rf-walk-up-only-session').length > 0;

  // The capacity indicator (e.g. "Few seats left") is a point-in-time
  // snapshot from when the catalog HTML was saved/scraped, not a live
  // value - it reflects availability at that moment, not right now.
  const seatsStatus = textOf(card.find('[data-test="testId"].capacity-indicator').first());

  return { isWalkUpOnly, seatsStatus };
}

export function parseCatalogHtml(html) {
  const $ = cheerio.load(html);
  const sessions = [];

  $('li.catalog-result.session-result').each((_, el) => {
    const card = $(el);
    const id = card.attr('data-session-id') || '';

    const rawTitle = textOf(card.find('.catalog-result-title-text .title-text').first());
    const { title, sessionCode } = parseTitleAndCode(rawTitle);

    const type = badgeTexts($, card, 'rf-type')[0] || '';
    const level = badgeTexts($, card, 'rf-level')[0] || '';
    const venue = badgeTexts($, card, 'rf-venue')[0] || '';
    const features = badgeTexts($, card, 'rf-features');
    const topics = badgeTexts($, card, 'rf-topic');
    const areaOfInterest = badgeTexts($, card, 'rf-area-of-interest');
    const services = badgeTexts($, card, 'rf-services');
    const tags = badgeTexts($, card, 'rf-session-appendices');

    const description = textOf(card.find('[data-test="abstract-component"] .description').first());
    const speakers = parseSpeakers($, card);
    const { day, startTime, endTime, timezone, location } = parseDayTimeLocation($, card);
    const { isWalkUpOnly, seatsStatus } = parseAvailability($, card);

    sessions.push({
      id,
      sessionCode,
      title,
      type,
      level,
      description,
      features,
      topics,
      areaOfInterest,
      services,
      tags,
      venue,
      day,
      startTime,
      endTime,
      timezone,
      location,
      speakers,
      isWalkUpOnly,
      seatsStatus,
    });
  });

  return sessions;
}

export function deduplicateById(sessions) {
  const seen = new Map();
  for (const session of sessions) {
    seen.set(session.id, session);
  }
  return Array.from(seen.values());
}
