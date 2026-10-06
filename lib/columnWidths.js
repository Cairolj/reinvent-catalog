const STORAGE_KEY = 'reinvent-column-widths';

export function loadColumnWidths(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveColumnWidths(widths, storage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(widths));
}

export function setColumnWidth(widths, columnKey, widthPx) {
  return { ...widths, [columnKey]: widthPx };
}
