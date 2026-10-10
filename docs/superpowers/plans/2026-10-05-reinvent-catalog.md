# re:Invent 2026 Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static website that displays AWS re:Invent 2026 catalog sessions, with ability to sort/filter by location, day, and time, powered automatically by the public catalog API (`https://catalog.awsevents.com/api/sessions`).

**Architecture:** Pure data logic (filter/sort/search) separated into `lib/sessions.js` and covered with unit tests (Node test runner). The frontend (`index.html` + `app.js` + `styles.css`) consumes `data/sessions.json` and uses functions from `lib/sessions.js`. An independent script (`fetch-catalog.js`) uses `fetch` to call the public API directly, paginates through all results (using `from` parameter), normalizes the data, and writes `data/sessions.json`. GitHub Actions runs this script daily (no credentials needed) and auto-commits changes to `data/sessions.json` if there are new sessions or changes.

**Tech Stack:** Node.js, Playwright, HTML/CSS/JS vanilla (no frameworks or build tools), Node built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-10-05-reinvent-catalog-design.md`

## Global Constraints

- The final site must be completely static: no backend, no build tools, hostable on GitHub Pages.
- The catalog API is public at `https://catalog.awsevents.com/api/sessions` and does not require credentials or login.
- The fetching script must paginate through all results using the `from` parameter (0, 50, 100, 150...) until there are no more new sessions.
- Data must be deduplicated by `id` before being written to `data/sessions.json`.
- GitHub Actions auto-commits and pushes changes to `data/sessions.json` only if changes are detected (no empty commits).
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

### Task 1: Project Scaffolding

**Files:**

- Create: `package.json`
- Create: `data/sessions.json`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**

- Produces: `data/sessions.json` with an array of 3 example sessions that follow the schema from the Global Constraints section. These example sessions are consumed by Task 3 (frontend) for manual validation.

- [ ] **Step 1: Create `package.json`**

```json
{
    "name": "reinvent-catalog",
    "version": "1.0.0",
    "private": true,
    "description": "Sitio estático con el catálogo de sesiones de AWS re:Invent 2026, filtrable por lugar, día y hora.",
    "scripts": {
        "test": "node --test test/",
        "fetch": "node fetch-catalog.js"
    }
}
```

**Nota:** We don't need devDependencies because:

- Node.js 18+ has `fetch` built-in
- Node.js 20+ has `node --test` built-in
- We don't use frameworks or build tools

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` and `package-lock.json` are created without errors (package.json has no devDependencies, it's a vanilla project).

- [ ] **Step 3: Verify Node.js 18+ is available**

Run: `node --version`
Expected: v18.0.0 or higher (we need `fetch` built-in and `node --test`).

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
```

- [ ] **Step 5: Create `data/sessions.json` with example data**

```json
[
    {
        "id": "SVS301",
        "title": "Deep dive into serverless architectures",
        "description": "Example session to validate frontend before real scraping.",
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
        "title": "Introduction to foundational models",
        "description": "Example session to validate filters by day and location.",
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
        "title": "Fundamentals of cloud networking",
        "description": "Example session to validate free-text search.",
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

- [ ] **Step 6: Create initial `README.md`**

```markdown
# Catálogo re:Invent 2026

Static site that displays AWS re:Invent 2026 catalog sessions,
allowing sorting and filtering by location, day, and time.

## Requisitos

- Node.js 18+

## Instalación

\`\`\`bash
npm install
\`\`\`

## Ver el sitio localmente

Open `index.html` directly in your browser, or serve the folder with
any static server, for example:

\`\`\`bash
npx serve .
\`\`\`

## Actualizar los datos del catálogo (localmente)

To get fresh catalog data:

\`\`\`bash
npm run fetch
\`\`\`

This will call the public catalog API, download all sessions,
and update `data/sessions.json`. **Note:** GitHub Actions runs this
command automatically every day (see Task 5).

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

### Task 2: Pure data functions (`lib/sessions.js`)

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
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
    filterSessions,
    searchSessions,
    sortSessions,
} = require("../lib/sessions.js");

const sessions = [
    {
        id: "1",
        title: "Zeta talk",
        description: "about zebras",
        day: "Monday",
        startTime: "10:00 AM",
        location: "Venetian",
        speakers: ["Ana"],
    },
    {
        id: "2",
        title: "Alpha talk",
        description: "about ants",
        day: "Tuesday",
        startTime: "9:00 AM",
        location: "Wynn",
        speakers: ["Bob"],
    },
    {
        id: "3",
        title: "Beta talk",
        description: "about bees",
        day: "Monday",
        startTime: "1:00 PM",
        location: "Wynn",
        speakers: [],
    },
];

test("filterSessions returns all sessions when no filters given", () => {
    const result = filterSessions(sessions, {});
    assert.equal(result.length, 3);
});

test("filterSessions filters by location", () => {
    const result = filterSessions(sessions, { location: "Wynn" });
    assert.deepEqual(
        result.map((s) => s.id),
        ["2", "3"],
    );
});

test("filterSessions filters by day", () => {
    const result = filterSessions(sessions, { day: "Monday" });
    assert.deepEqual(
        result.map((s) => s.id),
        ["1", "3"],
    );
});

test("filterSessions filters by location and day combined", () => {
    const result = filterSessions(sessions, {
        location: "Wynn",
        day: "Monday",
    });
    assert.deepEqual(
        result.map((s) => s.id),
        ["3"],
    );
});

test("searchSessions matches title case-insensitively", () => {
    const result = searchSessions(sessions, "ALPHA");
    assert.deepEqual(
        result.map((s) => s.id),
        ["2"],
    );
});

test("searchSessions matches description", () => {
    const result = searchSessions(sessions, "zebras");
    assert.deepEqual(
        result.map((s) => s.id),
        ["1"],
    );
});

test("searchSessions matches speaker name", () => {
    const result = searchSessions(sessions, "bob");
    assert.deepEqual(
        result.map((s) => s.id),
        ["2"],
    );
});

test("searchSessions returns all sessions for empty query", () => {
    const result = searchSessions(sessions, "");
    assert.equal(result.length, 3);
});

test("sortSessions sorts by title ascending", () => {
    const result = sortSessions(sessions, "title", "asc");
    assert.deepEqual(
        result.map((s) => s.id),
        ["2", "3", "1"],
    );
});

test("sortSessions sorts by location descending", () => {
    const result = sortSessions(sessions, "location", "desc");
    assert.deepEqual(
        result.map((s) => s.id),
        ["2", "3", "1"],
    );
});

test("sortSessions does not mutate the original array", () => {
    const copy = [...sessions];
    sortSessions(sessions, "title", "asc");
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
            session.title || "",
            session.description || "",
            ...(session.speakers || []),
        ]
            .join(" ")
            .toLowerCase();
        return haystack.includes(needle);
    });
}

function sortSessions(sessions, field, direction = "asc") {
    const sorted = [...sessions].sort((a, b) => {
        const valueA = String(a[field] || "").toLowerCase();
        const valueB = String(b[field] || "").toLowerCase();
        if (valueA < valueB) return direction === "asc" ? -1 : 1;
        if (valueA > valueB) return direction === "asc" ? 1 : -1;
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
                <input
                    type="text"
                    id="search-input"
                    placeholder="Buscar por título, descripción o ponente..."
                />
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
            <p id="empty-message" hidden>
                No se encontraron sesiones con esos filtros.
            </p>
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

th,
td {
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
import {
    filterSessions,
    searchSessions,
    sortSessions,
} from "./lib/sessions.js";

const state = {
    sessions: [],
    query: "",
    location: "",
    day: "",
    sortField: "day",
    sortDirection: "asc",
};

async function loadSessions() {
    const response = await fetch("data/sessions.json");
    state.sessions = await response.json();
}

function populateFilterOptions() {
    const locations = [
        ...new Set(state.sessions.map((s) => s.location).filter(Boolean)),
    ].sort();
    const days = [
        ...new Set(state.sessions.map((s) => s.day).filter(Boolean)),
    ].sort();

    const locationSelect = document.getElementById("location-filter");
    locations.forEach((loc) => {
        const option = document.createElement("option");
        option.value = loc;
        option.textContent = loc;
        locationSelect.appendChild(option);
    });

    const daySelect = document.getElementById("day-filter");
    days.forEach((day) => {
        const option = document.createElement("option");
        option.value = day;
        option.textContent = day;
        daySelect.appendChild(option);
    });
}

function render() {
    let result = filterSessions(state.sessions, {
        location: state.location,
        day: state.day,
    });
    result = searchSessions(result, state.query);
    result = sortSessions(result, state.sortField, state.sortDirection);

    const tbody = document.getElementById("sessions-tbody");
    const emptyMessage = document.getElementById("empty-message");
    tbody.innerHTML = "";

    if (result.length === 0) {
        emptyMessage.hidden = false;
    } else {
        emptyMessage.hidden = true;
        result.forEach((session) => {
            const row = document.createElement("tr");
            row.innerHTML = `
        <td>${session.title || ""}</td>
        <td>${session.location || ""}</td>
        <td>${session.day || ""}</td>
        <td>${session.startTime || ""}</td>
        <td>${session.track || ""}</td>
        <td>${session.level || ""}</td>
        <td>${(session.speakers || []).join(", ")}</td>
      `;
            tbody.appendChild(row);
        });
    }

    document.querySelectorAll("th[data-field]").forEach((th) => {
        th.classList.remove("sorted-asc", "sorted-desc");
        if (th.dataset.field === state.sortField) {
            th.classList.add(
                state.sortDirection === "asc" ? "sorted-asc" : "sorted-desc",
            );
        }
    });
}

function wireEvents() {
    document.getElementById("search-input").addEventListener("input", (e) => {
        state.query = e.target.value;
        render();
    });

    document
        .getElementById("location-filter")
        .addEventListener("change", (e) => {
            state.location = e.target.value;
            render();
        });

    document.getElementById("day-filter").addEventListener("change", (e) => {
        state.day = e.target.value;
        render();
    });

    document.querySelectorAll("th[data-field]").forEach((th) => {
        th.addEventListener("click", () => {
            const field = th.dataset.field;
            if (state.sortField === field) {
                state.sortDirection =
                    state.sortDirection === "asc" ? "desc" : "asc";
            } else {
                state.sortField = field;
                state.sortDirection = "asc";
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
if (typeof module !== "undefined" && module.exports) {
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
            session.title || "",
            session.description || "",
            ...(session.speakers || []),
        ]
            .join(" ")
            .toLowerCase();
        return haystack.includes(needle);
    });
}

export function sortSessions(sessions, field, direction = "asc") {
    const sorted = [...sessions].sort((a, b) => {
        const valueA = String(a[field] || "").toLowerCase();
        const valueB = String(b[field] || "").toLowerCase();
        if (valueA < valueB) return direction === "asc" ? -1 : 1;
        if (valueA > valueB) return direction === "asc" ? 1 : -1;
        return 0;
    });
    return sorted;
}
```

2. Reemplaza el contenido de `lib/sessions.js` (CommonJS, usado por los tests) para que quede exactamente igual pero con `module.exports` al final (tal como se escribió en el Task 2, sin cambios).

3. En `app.js`, cambia la línea de import a:

```js
import {
    filterSessions,
    searchSessions,
    sortSessions,
} from "./lib/sessions.mjs";
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

### Task 4: Script para obtener datos (`fetch-catalog.js`)

**Files:**

- Create: `fetch-catalog.js`

**Interfaces:**

- Consumes: ninguno (la API del catálogo es pública).
- Produces: `data/sessions.json` actualizado, con el mismo esquema usado en Task 1/2/3.

- [ ] **Step 1: Escribir `fetch-catalog.js`**

```js
const fs = require("fs");
const path = require("path");

const API_URL = "https://catalog.awsevents.com/api/sessions";
const OUTPUT_PATH = path.join(__dirname, "data", "sessions.json");
const BATCH_SIZE = 50; // Parámetro 'from' en la API

async function fetchSessionsBatch(from = 0) {
    const params = new URLSearchParams({
        type: "session",
        browserTimezone: "America/Costa_Rica",
        catalogDisplay: "list",
        from: from.toString(),
    });

    const url = `${API_URL}?${params.toString()}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching batch from=${from}:`, error.message);
        throw error;
    }
}

function normalizeSession(rawSession) {
    // Normaliza el formato de la API a nuestro esquema esperado.
    // Ajusta este mapeo según la estructura real de respuesta de la API.
    return {
        id: rawSession.id || rawSession.sessionId || "",
        title: rawSession.title || "",
        description: rawSession.description || rawSession.abstract || "",
        day: rawSession.day || rawSession.date || "",
        startTime: rawSession.startTime || rawSession.start || "",
        endTime: rawSession.endTime || rawSession.end || "",
        location: rawSession.location || rawSession.venue || "",
        track: rawSession.track || rawSession.category || "",
        level: rawSession.level || rawSession.sessionLevel || "",
        speakers: Array.isArray(rawSession.speakers) ? rawSession.speakers : [],
    };
}

function deduplicateById(sessions) {
    const seen = new Map();
    for (const session of sessions) {
        if (session.id) {
            seen.set(session.id, session);
        }
    }
    return Array.from(seen.values());
}

async function main() {
    console.log("Iniciando descarga del catálogo desde la API pública...");

    const allSessions = [];
    let from = 0;
    let previousBatchSize = 0;

    try {
        while (true) {
            console.log(`Descargando sesiones desde offset ${from}...`);
            const response = await fetchSessionsBatch(from);

            // Asume que la API devuelve un array 'sessions' o un array directo.
            const batch = Array.isArray(response)
                ? response
                : response.sessions || [];

            if (batch.length === 0) {
                console.log("No hay más sesiones. Descarga completada.");
                break;
            }

            console.log(
                `Se descargaron ${batch.length} sesiones en este lote.`,
            );

            // Normaliza cada sesión al esquema esperado
            const normalizedBatch = batch.map(normalizeSession);
            allSessions.push(...normalizedBatch);

            // Si el lote es más pequeño que el esperado, probablemente es el último
            if (batch.length < BATCH_SIZE) {
                console.log("Último lote incompleto. Descarga finalizada.");
                break;
            }

            previousBatchSize = batch.length;
            from += BATCH_SIZE;

            // Pequeña pausa entre requests para evitar sobrecargar la API
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Deduplica por ID
        const sessions = deduplicateById(allSessions);

        // Guarda el resultado
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sessions, null, 2));
        console.log(
            `✓ Se descargaron y guardaron ${sessions.length} sesiones en ${OUTPUT_PATH}`,
        );
    } catch (error) {
        console.error("✗ Error durante la descarga:", error.message);
        process.exit(1);
    }
}

main();
```

**Nota para quien ejecute esta tarea:**

- La función `normalizeSession` mapea los campos de la API real a nuestro esquema. Necesita **ajustarse según la estructura real** de la respuesta de `https://catalog.awsevents.com/api/sessions`.
- Ejecuta primero el script y revisa la salida JSON para ver qué estructura devuelve la API.
- Actualiza los nombres de campos en `normalizeSession` según lo observado.

- [ ] **Step 2: Validar manualmente el script**

Run: `node fetch-catalog.js`

Expected:

- El script hace requests a la API pública.
- Se imprime el progreso en consola (descargando lotes, contando sesiones).
- Se imprime cuántas sesiones se descargaron.
- `data/sessions.json` contiene un array de sesiones con el esquema esperado.

Si la estructura de datos no coincide, ajustar `normalizeSession` en `fetch-catalog.js` y repetir.

- [ ] **Step 3: Commit**

```bash
git add fetch-catalog.js
git commit -m "feat: add script to fetch sessions from public API"
```

---

### Task 5: GitHub Actions para descargas automatizadas

**Files:**

- Create: `.github/workflows/scrape-catalog.yml`
- Modify: `README.md` (secci\u00f3n sobre GitHub Actions)

**Interfaces:**

- Consumes: GitHub Secrets `REINVENT_EMAIL` y `REINVENT_PASSWORD` (credenciales de AWS).
- Produces: commits autom\u00e1ticos en `data/sessions.json` cuando hay cambios.

- [ ] **Step 1: Crear directorio `.github/workflows`**

Run: `mkdir -p .github/workflows`
Expected: directorio creado.

- [ ] **Step 2: Crear archivo `.github/workflows/scrape-catalog.yml`**

````yaml
name: Scrape re:Invent Catalog

on:
  schedule:
    # Ejecuta diariamente a las 2 AM UTC (ajusta seg\u00fan necesidad)
    - cron: '0 2 * * *'
  workflow_dispatch:  # Permite ejecutar manualmente desde GitHub UI

jobs:
  scrape:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Chromium browser
        run: npx playwright install chromium

      - name: Run scraper
        env:
          REINVENT_EMAIL: ${{ secrets.REINVENT_EMAIL }}\n          REINVENT_PASSWORD: ${{ secrets.REINVENT_PASSWORD }}\n        run: node scrape.js

      - name: Check for changes
        id: changes
        run: |
          if git diff --quiet data/sessions.json; then\n            echo \"changed=false\" >> $GITHUB_OUTPUT\n          else\n            echo \"changed=true\" >> $GITHUB_OUTPUT\n          fi

      - name: Commit and push changes
        if: steps.changes.outputs.changed == 'true'
        run: |\n          git config user.name \"GitHub Actions\"\n          git config user.email \"actions@github.com\"\n          git add data/sessions.json\n          git commit -m \"data: update catalog sessions from scraper\"\n          git push
```\n\n- [ ] **Step 3: Configurar GitHub Secrets**\n\nEn el repositorio GitHub (Settings > Secrets and variables > Actions):\n1. Crear secret `REINVENT_EMAIL` con tu correo de AWS.\n2. Crear secret `REINVENT_PASSWORD` con tu contrase\u00f1a de AWS.\n\n**Importante:** \n- MFA debe estar **desactivado** en la cuenta de AWS usada, de lo contrario el login automatizado fallar\u00e1.\n- Los secrets NO se muestran en los logs de GitHub Actions por seguridad.\n- Solo t\u00fa puedes modificar estos secrets.\n\n- [ ] **Step 4: Validar que el workflow funciona**\n\nDesde GitHub.com:\n1. Ve a Actions > \"Scrape re:Invent Catalog\"\n2. Haz clic en \"Run workflow\" > \"Run workflow\" para ejecutar manualmente.\n3. Revisa los logs para asegurar que todo funciona.\n4. Verifica que `data/sessions.json` se actualiz\u00f3 y se hizo commit.\n\nO bien, espera al siguiente horario programado (2 AM UTC del d\u00eda siguiente).\n\n- [ ] **Step 5: Actualizar `README.md` con informaci\u00f3n de GitHub Actions**\n\nA\u00f1ade una nueva secci\u00f3n en el README:\n\n```markdown\n## Actualizaci\u00f3n autom\u00e1tica de datos (GitHub Actions)\n\nEste repositorio est\u00e1 configurado para ejecutar el scraper autom\u00e1ticamente cada d\u00eda a las 2 AM UTC. Los datos se actualizan y se hacen commit autom\u00e1ticamente si hay cambios.\n\n**C\u00f3mo funciona:**\n- GitHub Actions ejecuta `node scrape.js` diariamente usando credenciales almacenadas en Secrets.\n- Si se detectan cambios en `data/sessions.json`, se hace auto-commit.\n- Si el sitio est\u00e1 publicado en GitHub Pages, se actualiza autom\u00e1ticamente al hacer push.\n\n**Para ejecutar manualmente:**\n1. Ve a GitHub.com > Actions > \"Scrape re:Invent Catalog\"\n2. Haz clic en \"Run workflow\"\n3. Los logs mostrar\u00e1n el progreso de la ejecuci\u00f3n.\n\n**Para deshabilitar las actualizaciones autom\u00e1ticas:**\nEdita `.github/workflows/scrape-catalog.yml` y comenta o elimina la secci\u00f3n `schedule`.\n```\n\n- [ ] **Step 6: Commit**\n\n```bash\ngit add .github/workflows/scrape-catalog.yml README.md\ngit commit -m \"chore: add GitHub Actions workflow for automatic catalog scraping\"\ngit push\n```\n\nAl hacer push, GitHub detectar\u00e1 el archivo workflow y lo activar\u00e1 autom\u00e1ticamente.\n\n- [ ] **Step 7: Verificar en GitHub**\n\nDespu\u00e9s de hacer push:\n1. Ve al repositorio en GitHub.com\n2. Haz clic en la pesta\u00f1a \"Actions\"\n3. Deber\u00e1s ver el workflow \"Scrape re:Invent Catalog\" listado.\n4. Puedes hacer clic en \"Run workflow\" para probar manualmente.\n\n---

## Self-Review Notes

- Cobertura del spec: scaffolding (Task 1), esquema de datos (Tasks 1-2), lógica de filtro/orden/búsqueda (Task 2), frontend (Task 3), scraper con login manual y "Show More" (Task 4), documentación de actualización (Task 4) — todas las secciones del spec están cubiertas.
- Sin placeholders de tipo TBD/TODO; el único punto marcado explícitamente como "ajustar según DOM real" es inherente a la naturaleza del scraping de un sitio externo (documentado en el spec como riesgo aceptado, no automatizable de antemano).
- Consistencia de nombres: `filterSessions`, `searchSessions`, `sortSessions` se usan de forma idéntica en Task 2 (CommonJS para tests) y Task 3 (ESM para navegador).
````
