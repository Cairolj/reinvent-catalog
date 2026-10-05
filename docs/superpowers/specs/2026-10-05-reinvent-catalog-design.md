# Diseño: Catálogo de sesiones re:Invent 2026

## Objetivo

Construir un sitio web estático que recopile la información del catálogo
de sesiones de AWS re:Invent 2026
(https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog)
y permita ordenar/filtrar las sesiones por lugar, día y hora.

## Contexto y restricciones

- El catálogo es una SPA: el contenido se carga vía API/JS, no HTML estático.
- El catálogo requiere login con cuenta AWS, y esa cuenta tiene MFA habilitado.
  Por lo tanto, la extracción de datos **no puede automatizarse completamente
  sin intervención humana** (no hay forma de resolver MFA sin un humano).
- Se opta por un flujo **semi-manual**: el usuario ejecuta un script de
  scraping localmente cuando quiere refrescar los datos, inicia sesión
  manualmente (resolviendo MFA), y el script extrae y guarda los datos.
  No se usan GitHub Actions ni se almacenan credenciales en ningún lado.
- El sitio final es completamente estático (HTML/CSS/JS vanilla, sin
  backend, sin build tools) para poder alojarse en GitHub Pages o abrirse
  localmente.

## Componentes

### 1. Script de scraping (`scrape.js`)

- Node.js + Playwright (modo `headless: false` para permitir login manual).
- Flujo:
  1. Abre un navegador Chromium visible.
  2. Navega a la URL del catálogo.
  3. Espera a que el usuario inicie sesión manualmente (incluyendo MFA) y
     llegue a la página del catálogo cargado. Se le pide al usuario que
     presione Enter en la consola cuando el catálogo esté visible.
  4. El catálogo pagina sus resultados con un botón **"Show More"** al
     final de la lista. El script hace clic en ese botón repetidamente
     (esperando a que carguen nuevos elementos entre cada clic) hasta que
     el botón ya no esté presente o ya no aparezcan sesiones nuevas,
     asegurando que se cargue la lista completa antes de extraer datos.
  5. Intercepta las respuestas de red (XHR/fetch) que contienen los datos
     de las sesiones del catálogo, o si no es posible, extrae los datos
     del DOM ya renderizado (incluyendo todo lo cargado tras los clics en
     "Show More").
  6. Normaliza los datos a una lista de objetos de sesión (ver esquema
     abajo), eliminando duplicados por `id`.
  7. Escribe el resultado en `data/sessions.json`.
- Documentado con instrucciones claras de uso en el README.

### 2. Esquema de datos de sesión

Cada sesión en `sessions.json` tendrá (cuando el dato esté disponible):

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "day": "string (ej. 'Monday, Nov 30')",
  "startTime": "string (ej. '10:00 AM')",
  "endTime": "string",
  "location": "string (ej. 'Venetian, Level 2, Murano 3205')",
  "track": "string (categoría/track)",
  "level": "string (ej. '200 - Intermediate')",
  "speakers": ["string"]
}
```

Si algún campo no está disponible en el scraping real, se deja como
cadena vacía o se omite, sin romper el resto del pipeline.

### 3. Frontend estático

- `index.html`: estructura base, tabla/lista de sesiones, controles de
  filtro y orden.
- `styles.css`: estilos simples y legibles.
- `app.js`:
  - Carga `data/sessions.json` vía `fetch`.
  - Renderiza las sesiones en una tabla.
  - Permite ordenar haciendo clic en encabezados de columna (lugar, día,
    hora).
  - Provee selectores desplegables para filtrar por lugar y por día.
  - Provee un campo de búsqueda de texto libre que filtra por
    título/descripción/ponentes.
  - Combina filtros y orden de forma reactiva (sin recargar la página).

### 4. Flujo de actualización de datos

1. El usuario corre `node scrape.js` localmente cuando quiere datos frescos.
2. Inicia sesión manualmente en la ventana del navegador que se abre.
3. El script genera/actualiza `data/sessions.json`.
4. El usuario hace commit y push de los cambios.
5. Si el sitio está en GitHub Pages, se actualiza automáticamente al hacer
   push a la rama configurada.

## Estructura de archivos

```
reinvent/
├── scrape.js
├── package.json
├── data/
│   └── sessions.json       (generado, con datos de ejemplo iniciales)
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Testing / validación

- No hay tests automatizados del scraper (depende de un sitio externo con
  login manual); se valida manualmente revisando que `sessions.json` tenga
  sentido tras cada ejecución.
- El frontend se valida manualmente en el navegador usando datos de
  ejemplo (placeholder) antes de tener el JSON real, verificando que el
  orden y los filtros funcionen correctamente.

## Fuera de alcance

- Automatización completa sin intervención humana (bloqueado por MFA).
- Backend/servidor propio.
- Autenticación o almacenamiento de credenciales.
