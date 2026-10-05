# Catálogo re:Invent 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un sitio web estático que muestre las sesiones del catálogo de AWS re:Invent 2026, con capacidad de ordenar/filtrar por lugar, día y hora, alimentado por un script de scraping semi-manual (Playwright) que el usuario corre localmente.

**Architecture:** Lógica de datos pura (filtrar/ordenar/buscar) separada en `lib/sessions.js` y cubierta con tests unitarios (Node test runner). El frontend (`index.html` + `app.js` + `styles.css`) consume `data/sessions.json` y usa las funciones de `lib/sessions.js`. Un script independiente (`scrape.js`) usa Playwright para abrir el catálogo, esperar login manual del usuario, expandir la lista completa con clics en "Show More", y escribir `data/sessions.json`.

**Tech Stack:** Node.js, Playwright, HTML/CSS/JS vanilla (sin frameworks ni build tools), Node built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-10-05-reinvent-catalog-design.md`

## Global Constraints

- El sitio final debe ser completamente estático: sin backend, sin build tools, alojable en GitHub Pages.
- No se automatiza el login (MFA); el usuario inicia sesión manualmente en la ventana de Playwright.
- El script de scraping debe hacer clic en "Show More" repetidamente hasta que el botón desaparezca o no se carguen sesiones nuevas.
- Los datos deben deduplicarse por `id` antes de escribirse en `data/sessions.json`.
- Esquema de sesión (campos pueden quedar vacíos si no están disponibles):
  ```json
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "day": "string",
    "startTime": "string",
    "endTime": "string",
    "location": "string",
    "track": "string",
    "level": "string",
    "speakers": ["string"]
  }
  ```

---

### Task 1: Scaffolding del proyecto

**Files:**
- Create: `package.json`
- Create: `data/sessions.json`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Produces: `data/sessions.json` con un array de 3 sesiones de ejemplo que siguen el esquema de la sección Global Constraints. Estas sesiones de ejemplo son consumidas por el Task 3 (frontend) para validación manual.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "reinvent-catalog",
  "version": "1.0.0",
  "private": true,
  "description": "Sitio estático con el catálogo de sesiones de AWS re:Invent 2026, filtrable por lugar, día y hora.",
  "scripts": {
    "test": "node --test test/",
    "scrape": "node scrape.js"
  },
  "devDependencies": {
    "playwright": "^1.47.0"
  }
}
```

- [ ] **Step 2: Instalar dependencias**

Run: `npm install`
Expected: se crea `node_modules/` y `package-lock.json` sin errores.

- [ ] **Step 3: Instalar navegador de Playwright**

Run: `npx playwright install chromium`
Expected: descarga exitosa del binario de Chromium.

- [ ] **Step 4: Crear `.gitignore`**

```
node_modules/
```

- [ ] **Step 5: Crear `data/sessions.json` con datos de ejemplo**

```json
[
  {
    "id": "SVS301",
    "title": "Deep dive en arquitecturas serverless",
    "description": "Sesión de ejemplo para validar el frontend antes del scraping real.",
    "day": "Monday, Nov 30",
    "startTime": "10:00 AM",
    "endTime": "11:00 AM",
    "location": "Venetian, Level 2, Murano 3205",
    "track": "Serverless",
    "level": "300 - Advanced",
    "speakers": ["Jane Doe"]
  },
  {
    "id": "AIM205",
    "title": "Introducción a modelos fundacionales",
    "description": "Sesión de ejemplo para validar filtros por día y lugar.",
    "day": "Tuesday, Dec 1",
    "startTime": "2:00 PM",
    "endTime": "3:00 PM",
    "location": "Wynn, Level 1, Lafite 1",
    "track": "AI/ML",
    "level": "200 - Intermediate",
    "speakers": ["John Smith", "Alice Lee"]
  },
  {
    "id": "NET101",
    "title": "Fundamentos de networking en la nube",
    "description": "Sesión de ejemplo para validar la búsqueda de texto libre.",
    "day": "Monday, Nov 30",
    "startTime": "1:00 PM",
    "endTime": "2:00 PM",
    "location": "Venetian, Level 2, Murano 3205",
    "track": "Networking",
    "level": "100 - Beginner",
    "speakers": []
  }
]
```

- [ ] **Step 6: Crear `README.md` inicial**

```markdown
# Catálogo re:Invent 2026

Sitio estático que muestra las sesiones del catálogo de AWS re:Invent 2026,
permitiendo ordenar y filtrar por lugar, día y hora.

## Requisitos

- Node.js 18+

## Instalación

\`\`\`bash
npm install
npx playwright install chromium
\`\`\`

## Ver el sitio localmente

Abre `index.html` directamente en el navegador, o sirve la carpeta con
cualquier servidor estático, por ejemplo:

\`\`\`bash
npx serve .
\`\`\`

## Actualizar los datos del catálogo

Ver instrucciones detalladas en la sección "Actualizar los datos" más abajo
(se completa en una tarea posterior de este plan).

## Ejecutar tests

\`\`\`bash
npm test
\`\`\`
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore data/sessions.json README.md
git commit -m "chore: scaffold project with sample data"
```

---

### Task 2: Funciones puras de datos (`lib/sessions.js`)

**Files:**
- Create: `lib/sessions.js`
- Test: `test/sessions.test.js`

**Interfaces:**
- Consumes: ninguno (funciones puras sobre arrays de objetos de sesión, esquema de Global Constraints).
- Produces:
  - `filterSessions(sessions, { location, day })` → `Array` — filtra por `location` exacto y/o `day` exacto; si un filtro es `''`, `null` o `undefined`, no se aplica.
  - `searchSessions(sessions, query)` → `Array` — filtra por coincidencia case-insensitive de `query` en `title`, `description` o cualquier elemento de `speakers`; si `query` es `''`, devuelve todas las sesiones.
  - `sortSessions(sessions, field, direction)` → `Array` — devuelve una **copia ordenada** (no muta el array original); `field` es una de `'location' | 'day' | 'startTime' | 'title'`; `direction` es `'asc' | 'desc'`; comparación case-insensitive para strings.
  - Estas tres funciones son consumidas por `app.js` en el Task 3.

- [ ] **Step 1: Escribir tests que fallan**

Crear `test/sessions.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { filterSessions, searchSessions, sortSessions } = require('../lib/sessions.js');

const sessions = [
  { id: '1', title: 'Zeta talk', description: 'about zebras', day: 'Monday', startTime: '10:00 AM', location: 'Venetian', speakers: ['Ana'] },
  { id: '2', title: 'Alpha talk', description: 'about ants', day: 'Tuesday', startTime: '9:00 AM', location: 'Wynn', speakers: ['Bob'] },
  { id: '3', title: 'Beta talk', description: 'about bees', day: 'Monday', startTime: '1:00 PM', location: 'Wynn', speakers: [] },
];

test('filterSessions returns all sessions when no filters given', () => {
  const result = filterSessions(sessions, {});
  assert.equal(result.length, 3);
});

test('filterSessions filters by location', () => {
  const result = filterSessions(sessions, { location: 'Wynn' });
  assert.deepEqual(result.map(s => s.id), ['2', '3']);
});

test('filterSessions filters by day', () => {
  const result = filterSessions(sessions, { day: 'Monday' });
  assert.deepEqual(result.map(s => s.id), ['1', '3']);
});

test('filterSessions filters by location and day combined', () => {
  const result = filterSessions(sessions, { location: 'Wynn', day: 'Monday' });
  assert.deepEqual(result.map(s => s.id), ['3']);
});

test('searchSessions matches title case-insensitively', () => {
  const result = searchSessions(sessions, 'ALPHA');
  assert.deepEqual(result.map(s => s.id), ['2']);
});

test('searchSessions matches description', () => {
  const result = searchSessions(sessions, 'zebras');
  assert.deepEqual(result.map(s => s.id), ['1']);
});

test('searchSessions matches speaker name', () => {
  const result = searchSessions(sessions, 'bob');
  assert.deepEqual(result.map(s => s.id), ['2']);
});

test('searchSessions returns all sessions for empty query', () => {
  const result = searchSessions(sessions, '');
  assert.equal(result.length, 3);
});

test('sortSessions sorts by title ascending', () => {
  const result = sortSessions(sessions, 'title', 'asc');
  assert.deepEqual(result.map(s => s.id), ['2', '3', '1']);
});

test('sortSessions sorts by location descending', () => {
  const result = sortSessions(sessions, 'location', 'desc');
  assert.deepEqual(result.map(s => s.id), ['2', '3', '1']);
});

test('sortSessions does not mutate the original array', () => {
  const copy = [...sessions];
  sortSessions(sessions, 'title', 'asc');
  assert.deepEqual(sessions, copy);
});
```

- [ ] **Step 2: Ejecutar tests y verificar que fallan**

Run: `node --test test/`
Expected: FALLA porque `../lib/sessions.js` no existe (`Cannot find module`).

- [ ] **Step 3: Implementar `lib/sessions.js`**

```js
function filterSessions(sessions, { location, day } = {}) {
  return sessions.filter((session) => {
    if (location && session.location !== location) return false;
    if (day && session.day !== day) return false;
    return true;
  });
}

function searchSessions(sessions, query) {
  if (!query) return sessions;
  const needle = query.toLowerCase();
  return sessions.filter((session) => {
    const haystack = [
      session.title || '',
      session.description || '',
      ...(session.speakers || []),
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

function sortSessions(sessions, field, direction = 'asc') {
  const sorted = [...sessions].sort((a, b) => {
    const valueA = String(a[field] || '').toLowerCase();
    const valueB = String(b[field] || '').toLowerCase();
    if (valueA < valueB) return direction === 'asc' ? -1 : 1;
    if (valueA > valueB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

module.exports = { filterSessions, searchSessions, sortSessions };
```

- [ ] **Step 4: Ejecutar tests y verificar que pasan**

Run: `node --test test/`
Expected: PASS — 10 tests pasando, 0 fallando.

- [ ] **Step 5: Commit**

```bash
git add lib/sessions.js test/sessions.test.js
git commit -m "feat: add pure filter/search/sort functions for sessions"
```

---

### Task 3: Frontend estático (`index.html`, `styles.css`, `app.js`)

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`

**Interfaces:**
- Consumes: `filterSessions`, `searchSessions`, `sortSessions` de `lib/sessions.js` (Task 2); `data/sessions.json` (Task 1).
- Produces: una página renderizada en el navegador; no expone funciones a otras tareas (es la capa final de UI).

- [ ] **Step 1: Crear `index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Catálogo re:Invent 2026</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header>
    <h1>Catálogo de sesiones — re:Invent 2026</h1>
    <div class="controls">
      <input type="text" id="search-input" placeholder="Buscar por título, descripción o ponente..." />
      <select id="location-filter">
        <option value="">Todos los lugares</option>
      </select>
      <select id="day-filter">
        <option value="">Todos los días</option>
      </select>
    </div>
  </header>

  <main>
    <table id="sessions-table">
      <thead>
        <tr>
          <th data-field="title">Título</th>
          <th data-field="location">Lugar</th>
          <th data-field="day">Día</th>
          <th data-field="startTime">Hora</th>
          <th>Track</th>
          <th>Nivel</th>
          <th>Ponentes</th>
        </tr>
      </thead>
      <tbody id="sessions-tbody"></tbody>
    </table>
    <p id="empty-message" hidden>No se encontraron sesiones con esos filtros.</p>
  </main>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear `styles.css`**

```css
body {
  font-family: Arial, Helvetica, sans-serif;
  margin: 0;
  padding: 0;
  background: #f5f5f5;
  color: #1a1a1a;
}

header {
  background: #232f3e;
  color: white;
  padding: 1rem 2rem;
}

header h1 {
  margin: 0 0 1rem 0;
  font-size: 1.4rem;
}

.controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.controls input,
.controls select {
  padding: 0.5rem;
  font-size: 1rem;
  border-radius: 4px;
  border: none;
}

main {
  padding: 1.5rem 2rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

th, td {
  text-align: left;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid #ddd;
}

th {
  background: #e9ecef;
  cursor: pointer;
  user-select: none;
}

th.sorted-asc::after {
  content: " \25B2";
}

th.sorted-desc::after {
  content: " \25BC";
}

#empty-message {
  text-align: center;
  padding: 2rem;
  color: #666;
}
```

- [ ] **Step 3: Crear `app.js`**

```js
import { filterSessions, searchSessions, sortSessions } from './lib/sessions.js';

const state = {
  sessions: [],
  query: '',
  location: '',
  day: '',
  sortField: 'day',
  sortDirection: 'asc',
};

async function loadSessions() {
  const response = await fetch('data/sessions.json');
  state.sessions = await response.json();
}

function populateFilterOptions() {
  const locations = [...new Set(state.sessions.map((s) => s.location).filter(Boolean))].sort();
  const days = [...new Set(state.sessions.map((s) => s.day).filter(Boolean))].sort();

  const locationSelect = document.getElementById('location-filter');
  locations.forEach((loc) => {
    const option = document.createElement('option');
    option.value = loc;
    option.textContent = loc;
    locationSelect.appendChild(option);
  });

  const daySelect = document.getElementById('day-filter');
  days.forEach((day) => {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = day;
    daySelect.appendChild(option);
  });
}

function render() {
  let result = filterSessions(state.sessions, { location: state.location, day: state.day });
  result = searchSessions(result, state.query);
  result = sortSessions(result, state.sortField, state.sortDirection);

  const tbody = document.getElementById('sessions-tbody');
  const emptyMessage = document.getElementById('empty-message');
  tbody.innerHTML = '';

  if (result.length === 0) {
    emptyMessage.hidden = false;
  } else {
    emptyMessage.hidden = true;
    result.forEach((session) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${session.title || ''}</td>
        <td>${session.location || ''}</td>
        <td>${session.day || ''}</td>
        <td>${session.startTime || ''}</td>
        <td>${session.track || ''}</td>
        <td>${session.level || ''}</td>
        <td>${(session.speakers || []).join(', ')}</td>
      `;
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

function wireEvents() {
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.query = e.target.value;
    render();
  });

  document.getElementById('location-filter').addEventListener('change', (e) => {
    state.location = e.target.value;
    render();
  });

  document.getElementById('day-filter').addEventListener('change', (e) => {
    state.day = e.target.value;
    render();
  });

  document.querySelectorAll('th[data-field]').forEach((th) => {
    th.addEventListener('click', () => {
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
}

async function init() {
  await loadSessions();
  populateFilterOptions();
  wireEvents();
  render();
}

init();
```

- [ ] **Step 4: Copiar `lib/sessions.js` para uso en navegador (módulo ES)**

`app.js` importa `./lib/sessions.js` como módulo ES (`import`/`export`), pero `lib/sessions.js` del Task 2 usa `module.exports` (CommonJS, para que `node --test` lo pueda requerir). Para evitar duplicar lógica, añade exports ES al final de `lib/sessions.js` sin romper el export CommonJS:

Edita `lib/sessions.js` (creado en Task 2) añadiendo al final del archivo, **antes** de `module.exports`:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { filterSessions, searchSessions, sortSessions };
}
```

Y cambia las declaraciones de función a exports nombrados ES al inicio del archivo no es compatible junto con CommonJS puro en Node sin configuración extra. En su lugar, simplifica: renombra el archivo consumido por el navegador a `lib/sessions.mjs` con `export` nativo, y mantén `lib/sessions.js` (CommonJS) para los tests, re-exportando desde un único cuerpo compartido.

Concretamente:

1. Renombra el contenido actual de `lib/sessions.js` a un nuevo archivo `lib/sessions.mjs`:

```js
export function filterSessions(sessions, { location, day } = {}) {
  return sessions.filter((session) => {
    if (location && session.location !== location) return false;
    if (day && session.day !== day) return false;
    return true;
  });
}

export function searchSessions(sessions, query) {
  if (!query) return sessions;
  const needle = query.toLowerCase();
  return sessions.filter((session) => {
    const haystack = [
      session.title || '',
      session.description || '',
      ...(session.speakers || []),
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

export function sortSessions(sessions, field, direction = 'asc') {
  const sorted = [...sessions].sort((a, b) => {
    const valueA = String(a[field] || '').toLowerCase();
    const valueB = String(b[field] || '').toLowerCase();
    if (valueA < valueB) return direction === 'asc' ? -1 : 1;
    if (valueA > valueB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}
```

2. Reemplaza el contenido de `lib/sessions.js` (CommonJS, usado por los tests) para que quede exactamente igual pero con `module.exports` al final (tal como se escribió en el Task 2, sin cambios).

3. En `app.js`, cambia la línea de import a:

```js
import { filterSessions, searchSessions, sortSessions } from './lib/sessions.mjs';
```

- [ ] **Step 5: Validar manualmente en el navegador**

Run: `npx serve .` (o abrir `index.html` directamente con doble clic)
Expected:
- Se muestran las 3 sesiones de ejemplo del Task 1.
- Escribir "alpha" (o el texto equivalente de una de las sesiones de ejemplo) en el buscador filtra correctamente.
- Seleccionar un lugar en el dropdown filtra solo esas sesiones.
- Seleccionar un día en el dropdown filtra solo esas sesiones.
- Hacer clic en el encabezado "Lugar" ordena las filas alfabéticamente y muestra una flecha; un segundo clic invierte el orden.

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css app.js lib/sessions.mjs lib/sessions.js
git commit -m "feat: add static frontend with filter, search and sort"
```

---

### Task 4: Script de scraping (`scrape.js`)

**Files:**
- Create: `scrape.js`
- Modify: `README.md` (sección "Actualizar los datos")

**Interfaces:**
- Consumes: ninguno de las tareas anteriores (script independiente).
- Produces: `data/sessions.json` actualizado, con el mismo esquema usado en Task 1/2/3.

- [ ] **Step 1: Escribir `scrape.js`**

```js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CATALOG_URL = 'https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog';
const OUTPUT_PATH = path.join(__dirname, 'data', 'sessions.json');

function waitForEnter(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

async function expandAllSessions(page) {
  let previousCount = -1;
  let currentCount = await page.locator('[data-testid="session-card"], .session-card, li').count();

  while (currentCount !== previousCount) {
    previousCount = currentCount;

    const showMoreButton = page.getByText('Show More', { exact: false });
    const isVisible = await showMoreButton.isVisible().catch(() => false);

    if (!isVisible) break;

    await showMoreButton.click();
    await page.waitForTimeout(1500);

    currentCount = await page.locator('[data-testid="session-card"], .session-card, li').count();
  }
}

async function extractSessions(page) {
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-testid="session-card"], .session-card')
    );

    return cards.map((card, index) => {
      const getText = (selector) => {
        const el = card.querySelector(selector);
        return el ? el.textContent.trim() : '';
      };

      return {
        id: card.getAttribute('data-session-id') || `session-${index}`,
        title: getText('[data-testid="session-title"], .session-title, h3'),
        description: getText('[data-testid="session-description"], .session-description, p'),
        day: getText('[data-testid="session-day"], .session-day'),
        startTime: getText('[data-testid="session-start-time"], .session-start-time'),
        endTime: getText('[data-testid="session-end-time"], .session-end-time'),
        location: getText('[data-testid="session-location"], .session-location'),
        track: getText('[data-testid="session-track"], .session-track'),
        level: getText('[data-testid="session-level"], .session-level'),
        speakers: Array.from(
          card.querySelectorAll('[data-testid="session-speaker"], .session-speaker')
        ).map((el) => el.textContent.trim()),
      };
    });
  });
}

function deduplicateById(sessions) {
  const seen = new Map();
  for (const session of sessions) {
    seen.set(session.id, session);
  }
  return Array.from(seen.values());
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(CATALOG_URL);

  await waitForEnter(
    '\nInicia sesión manualmente (incluyendo MFA) y navega hasta que el catálogo de sesiones esté visible.\nPresiona Enter aquí cuando estés listo para continuar...\n'
  );

  console.log('Expandiendo la lista completa de sesiones (clics en "Show More")...');
  await expandAllSessions(page);

  console.log('Extrayendo datos de las sesiones...');
  const rawSessions = await extractSessions(page);
  const sessions = deduplicateById(rawSessions);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sessions, null, 2));
  console.log(`Se guardaron ${sessions.length} sesiones en ${OUTPUT_PATH}`);

  await browser.close();
}

main().catch((error) => {
  console.error('Error durante el scraping:', error);
  process.exit(1);
});
```

**Nota para quien ejecute esta tarea:** los selectores CSS (`.session-card`, `[data-testid="session-title"]`, etc.) son aproximaciones razonables basadas en convenciones comunes, pero **deben ajustarse inspeccionando el DOM real** del catálogo de AWS la primera vez que se corra el script (usar las DevTools del navegador que abre Playwright, ya que corre en modo `headless: false`). Documentar en el código cualquier selector corregido.

- [ ] **Step 2: Validar manualmente el script**

Run: `npm run scrape`
Expected:
- Se abre una ventana de Chromium navegando al catálogo.
- El script espera a que el usuario presione Enter en la terminal tras iniciar sesión.
- El script hace clic en "Show More" repetidamente (visible en la ventana) hasta agotar la lista.
- Se imprime en consola cuántas sesiones se guardaron.
- `data/sessions.json` contiene el array de sesiones reales con el esquema esperado (revisar manualmente el archivo).

Si los selectores no coinciden con el DOM real, ajustar `extractSessions` y `expandAllSessions` según lo observado en las DevTools, y repetir la validación.

- [ ] **Step 3: Actualizar `README.md` con instrucciones de scraping**

Reemplaza la sección `## Actualizar los datos del catálogo` por:

```markdown
## Actualizar los datos del catálogo

1. Corre `npm run scrape`.
2. Se abrirá una ventana de Chromium en la URL del catálogo.
3. Inicia sesión manualmente con tu cuenta de AWS (resolviendo MFA si aplica).
4. Navega hasta que el catálogo de sesiones esté visible en la página.
5. Vuelve a la terminal y presiona Enter.
6. El script expandirá automáticamente toda la lista (clics en "Show More")
   y extraerá los datos.
7. Al finalizar, revisa `data/sessions.json` para confirmar que los datos
   se ven correctos.
8. Haz commit y push de `data/sessions.json` para publicar los datos
   actualizados (si el sitio está en GitHub Pages, se actualizará
   automáticamente).
```

- [ ] **Step 4: Commit**

```bash
git add scrape.js README.md
git commit -m "feat: add Playwright scraping script with manual login and Show More pagination"
```

---

## Self-Review Notes

- Cobertura del spec: scaffolding (Task 1), esquema de datos (Tasks 1-2), lógica de filtro/orden/búsqueda (Task 2), frontend (Task 3), scraper con login manual y "Show More" (Task 4), documentación de actualización (Task 4) — todas las secciones del spec están cubiertas.
- Sin placeholders de tipo TBD/TODO; el único punto marcado explícitamente como "ajustar según DOM real" es inherente a la naturaleza del scraping de un sitio externo (documentado en el spec como riesgo aceptado, no automatizable de antemano).
- Consistencia de nombres: `filterSessions`, `searchSessions`, `sortSessions` se usan de forma idéntica en Task 2 (CommonJS para tests) y Task 3 (ESM para navegador).
