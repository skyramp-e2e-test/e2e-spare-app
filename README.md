# e2e-web-app

A small Node.js (Express) + PostgreSQL web app used as a target for end-to-end testing.

## What's inside

| Path | Description |
| --- | --- |
| `GET /` | Home page |
| `GET /login` | Login page (form posts to `POST /login`) |
| `GET /items` | Items page: lists items and lets you add new ones |
| `GET /api/items` | JSON list of items |
| `POST /api/items` | Create an item. Body: `{"name": "..."}`. Returns `201` with the created item; returns `400` if `name` is missing |
| `GET /health`, `GET /healthz` | Health checks. Both return `200` |

`docker-compose.yml` defines two services:

- `db`: PostgreSQL 16
- `app`: this Express server. It waits for `db` to be healthy before starting.

On startup the app creates its tables and seeds a test user.

## Configuration

No configuration is needed. `APP_SIGNING_SECRET` is optional: the app signs the session cookie with it if it is set, and otherwise with a random key made at start (sessions then end when the app restarts). The app never prints or logs the value.

## Start the app

Requires Docker with Compose v2.

```bash
docker compose up --build
```

To keep sessions across restarts, set `APP_SIGNING_SECRET` first, or put it in a `.env` file next to `docker-compose.yml` (see `.env.example`; `.env` is gitignored).

Then open http://localhost:3000.

To stop the app and delete the database volume:

```bash
docker compose down -v
```

### Run without Docker (optional)

With a PostgreSQL instance reachable at `DATABASE_URL`:

```bash
npm install
DATABASE_URL=postgres://app:app@localhost:5432/app \
npm start
```

### Page build

`npm run build` checks every page in `public/` with [html-validate](https://html-validate.org) (`.htmlvalidate.json`) and writes them to `dist/`. The Docker image runs it while building, so a page with an unclosed tag fails the build with the file and line, for example `public/items.html:16:4: error [close-order] Unclosed element '<div>'`. The image serves the pages from `dist/` (`PAGES_DIR=dist`); `npm start` without a build serves `public/`.

## Sign in with the test user

The app seeds this user every time it starts:

- **Email:** `test@example.com`
- **Password:** `password123`

1. Go to http://localhost:3000/login.
2. Enter the email and password above and click **Sign in**.
3. You are redirected to `/items`, which shows "Signed in as test@example.com".

If you enter wrong credentials, the login page shows "Invalid email or password."

## Quick API check

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/healthz
curl -s -X POST http://localhost:3000/api/items \
  -H 'Content-Type: application/json' -d '{"name":"First item"}'
curl -s http://localhost:3000/api/items
```
