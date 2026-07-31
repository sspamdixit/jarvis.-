# EchoPulse — Voice Assistant Command Center

A full-stack Alexa-style voice assistant with a cyberpunk dark-mode dashboard, local intent routing, Gemini AI fallback, and PostgreSQL persistence.

## Project Structure

```
artifacts/
  echopulse/        # React + Vite frontend (preview at /)
  api-server/       # Express backend (port from $PORT, API at /api)
lib/
  db/               # Drizzle ORM schema + migrations (PostgreSQL)
  api-spec/         # OpenAPI spec + orval codegen config
  api-client-react/ # Auto-generated React Query hooks
  api-zod/          # Auto-generated Zod schemas
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS v4, Space Mono / Geist Mono fonts |
| Backend | Express, Fastify-style pino logging, esbuild bundler |
| AI | Google Gemini (`@google/genai` v1.3.0) via `GEMINI_API_KEY` |
| Database | Replit PostgreSQL via Drizzle ORM |
| Type safety | OpenAPI → orval codegen (React Query hooks + Zod schemas) |

## Running the App

Both workflows start automatically:
- **`artifacts/echopulse: web`** — Vite dev server for the frontend
- **`artifacts/api-server: API Server`** — Express API server

To restart manually:
```bash
pnpm --filter @workspace/echopulse run dev
pnpm --filter @workspace/api-server run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/command` | Process voice command (local router → Gemini fallback) |
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |
| GET | `/api/command-logs` | Recent command history |
| GET | `/api/preferences` | Learned user preferences |
| GET | `/api/stats` | Aggregate stats (local/gemini counts, tasks) |

## Database Schema

Three tables managed by Drizzle ORM:
- `tasks` — id, text, completed, createdAt, updatedAt
- `command_logs` — id, query, source, reply, matchedPattern, action, createdAt
- `preferences` — id, category, platform, count, updatedAt

To push schema changes:
```bash
pnpm --filter @workspace/db run db:push
```

## Environment Secrets

| Secret | Purpose |
|--------|---------|
| `GEMINI_API_KEY` | Google Gemini AI fallback |
| `SESSION_SECRET` | Express session signing |

## Intent Router

`artifacts/api-server/src/lib/intentRouter.ts` handles commands locally (zero API cost) via regex patterns:
- Greetings, time, date
- Task management (add/list/complete/delete)
- Volume control
- Music platform detection (preference learning)
- Jokes, weather stubs

Unrecognized queries fall through to Gemini with user preferences injected into the system prompt.

## User Preferences

- Keep cyberpunk theme — dark mode is always-on (`dark` class on `<html>`)
- CSS variable order matters: `:root` must come before `.dark` in `index.css` so the dark overrides win
