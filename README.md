# ut-todo-list

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Backend API (local file storage)

This project includes a tiny Node HTTP server (`server.js`) that stores data in `data.json`.
It has simple CRUD endpoints used by the frontend at `/api/courses`:

- GET /api/courses — daftar semua mata kuliah beserta todo
- POST /api/courses — tambah mata kuliah (kirim JSON penuh objek mata kuliah)
- PUT /api/courses/:id — update mata kuliah
- DELETE /api/courses/:id — hapus mata kuliah

How to run locally:

1. Install dependencies for the frontend (if not done):

```powershell
npm install
```

2. In one terminal, start the API server (Node >=20 recommended):

```powershell
node server.js
```

3. In another terminal, run the frontend dev server:

```powershell
npm run dev
```

Open the site (usually http://localhost:5173) and the frontend will talk to the API at http://localhost:3001 by default.

Notes:

- `data.json` is used for persistence; it's simple file storage for local development only.
- If you need a production-ready API, consider migrating `server.js` to Express or another framework and adding validations.
