# Kalo — Nutrition & Fitness Tracker

Kalo tracks meals, water, workouts, body composition, and nutrition goals.

## Architecture

- **Frontend:** Next.js 16 App Router, React 19, custom CSS.
- **Backend:** Python 3 + FastAPI for the JSON API, nutrition/workout logic, Supabase data access, and AI calls.
- **Auth and database:** Supabase Auth + PostgreSQL + Row Level Security (RLS).
- **AI:** OpenRouter, called only by the Python backend.
- **Deployment:** Next.js on Cloudflare Workers and FastAPI on a separate Cloudflare Python Worker.

The browser uses Supabase Auth to sign in and sends its access token to FastAPI
as a bearer token. FastAPI verifies the token and uses it for RLS-protected
database requests. The OpenRouter key stays on the Python server.

## Requirements

- Node.js 20.9 or later
- Python 3.13 or later and [uv](https://docs.astral.sh/uv/)
- Node.js for Wrangler and Cloudflare's local Worker runtime
- A Supabase project
- An OpenRouter API key for AI meal estimation and photo scanning (optional; the rest of the app works without it)

## Configuration

Copy `.env.example` to `.env.local` and fill in your values. In PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Next.js reads `NEXT_PUBLIC_*` values; the Python backend reads `.env.local`
for local development. In production, configure each service's environment
separately. `NEXT_PUBLIC_KALO_API_URL` is the Python API's base URL.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_KALO_API_URL=http://localhost:8000
SITE_URL=http://localhost:3000

OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=dots-studio/dots-3-note-preview:free
FRONTEND_ORIGINS=http://localhost:3000
```

`FRONTEND_ORIGINS` is a comma-separated allowlist of exact frontend origins.
For production, it is set to `https://kalo.shedbody.com` in
`wrangler-python.jsonc`. Keep the OpenRouter key only in the Python service's
environment.

## Deploy the Python API to Cloudflare

The FastAPI backend runs as its own Python Worker; it does not replace the
Next.js frontend Worker. From the repository root, run:

```powershell
uv sync
.\scripts\run-python-worker.ps1 dev
.\scripts\run-python-worker.ps1 deploy
```

The helper temporarily supplies the `wrangler.jsonc` filename required by
Pywrangler, then removes it. The checked-in Python Worker config stays separate
from the Next.js Cloudflare build config.

In the Cloudflare dashboard, open the `kalo-python-api` Worker and add these
runtime secrets under **Settings → Variables and Secrets**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY` (optional; AI meal estimates stay disabled without it)

After deployment, copy the Worker's `workers.dev` URL. In the existing Next.js
Worker, set `NEXT_PUBLIC_KALO_API_URL` to that URL under **Settings → Build →
Build variables and secrets**, then trigger a new frontend build. This value
must be present during the Next.js build because it is embedded in browser code.

The Worker also provides `https://<worker-url>/health` for a basic availability
check. Cloudflare's free Workers plan currently allows up to 100,000 requests
per day; request and CPU limits apply.

## Database setup

Run `supabase-migration.sql` in the Supabase SQL Editor. It creates the
profiles, daily logs, meals, routines, current routine, and private AI usage
tables; enables RLS; installs the new-user profile trigger; and adds the
atomic function used to enforce the daily AI request limit. The AI counter
cannot be read or changed directly by client roles.

## Run locally

Start the Python API in one terminal:

```bash
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-cpython.txt
python main.py
```

Then start Next.js in another terminal:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). FastAPI's interactive
API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs).

## Project structure

```text
app/                 Next.js pages and auth UI
components/          React dashboard tabs
lib/backend.js       Authenticated requests to FastAPI
lib/store.js         Frontend data API client
kalo/                FastAPI routes, Supabase access, AI and domain logic
main.py              Python API entrypoint
supabase-migration.sql
```

## Checks

Install the Python test dependencies and run the backend suite:

```bash
pip install -r requirements-dev.txt
python -m pytest -q
```

Check the frontend with:

```bash
npm run lint
npm run build
```

## Security notes

- Supabase RLS scopes database access to the signed-in user.
- FastAPI verifies the Supabase access token before serving `/api/*` routes.
- AI requests are capped at 30 per user per database day.
- Keep `OPENROUTER_API_KEY` on the backend; never prefix it with `NEXT_PUBLIC_`.
- Meal text and photos are sent to OpenRouter for estimates and are not stored by Kalo.

## License

Personal and educational use.
