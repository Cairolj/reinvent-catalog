# Catálogo re:Invent 2026

Sitio estático que muestra las sesiones del catálogo de AWS re:Invent 2026,
permitiendo ordenar y filtrar por lugar, día y hora.

## Requisitos

- Node.js 18+

## Instalación

```bash
npm install
npx playwright install chromium
```

## Ver el sitio localmente

Abre `index.html` directamente en el navegador, o sirve la carpeta con
cualquier servidor estático, por ejemplo:

```bash
npx serve .
```

## Actualizar los datos del catálogo

Hay dos formas de obtener datos actualizados:

### Opción A: Guardar el HTML manualmente (recomendada, más simple)

1. Inicia sesión en el catálogo con tu cuenta de AWS (resolviendo MFA).
2. Haz clic en "Show More" repetidamente hasta que ya no aparezca el botón
   (carga todas las sesiones).
3. Guarda la página completa (Ctrl+S / Cmd+S) como "Página web, completa"
   en `data/html/Event catalog.html` (sobrescribe el archivo existente).
4. Corre:
   ```bash
   node parse-html.js
   ```
5. Esto regenera `data/sessions.json` con todas las sesiones.

### Opción B: Scraping automatizado con Playwright

1. Corre `npm run scrape`.
2. Se abrirá una ventana de Chromium en la URL del catálogo.
3. Inicia sesión manualmente con tu cuenta de AWS (resolviendo MFA si aplica).
4. Navega hasta que el catálogo de sesiones esté visible en la página.
5. Vuelve a la terminal y presiona Enter.
6. El script expandirá automáticamente toda la lista (clics en "Show More"),
   extraerá los datos y los guardará en `data/sessions.json`.

Con cualquiera de las dos opciones, al finalizar revisa `data/sessions.json`
y haz commit/push para publicar los datos actualizados (si el sitio está en
GitHub Pages, se actualizará automáticamente).

## Mi Agenda (My Schedule)

Desde el catálogo (`index.html`), cada fila tiene una casilla para agregar
la sesión a tu agenda personal. Los IDs seleccionados se guardan en el
`localStorage` del navegador, así que persisten entre recargas (pero son
específicos de ese navegador/dispositivo).

Haz clic en "My Schedule" en la barra superior para ir a `schedule.html`,
donde verás un calendario visual con tus sesiones organizadas por día y
hora. Las sesiones que se traslapan en horario se resaltan en rojo con una
advertencia. Las sesiones sin día/hora asignado (ej. "Tabletop Experience")
aparecen en una lista aparte debajo del calendario.

## Ejecutar tests

```bash
npm test
```
