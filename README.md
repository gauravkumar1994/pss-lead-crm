# PSS Lead CRM

Industry-grade Lead CRM for **marble / sales teams** — Leads, Follow-ups, Pipeline, Bulk WhatsApp, Single WhatsApp with photo, Team assignment, Call reports.

## Live demo (after deploy)

- Web: `https://YOUR-WEB-URL/login`
- API health: `https://YOUR-API-URL/health`

Default login (change after deploy): `admin` / `admin123`

## Deploy in 10 minutes

See **[DEPLOY-ABHI-KARO.txt](./DEPLOY-ABHI-KARO.txt)** — GitHub + Render Blueprint (free).

Stack:
- **Web:** Render or Vercel (Next.js 15)
- **API:** Render (Node + Fastify)
- **DB:** PostgreSQL (Render managed)

## Local development

1. Install Node.js 20+
2. `docker compose up -d` (PostgreSQL)
3. Copy `apps/api/.env.example` → `apps/api/.env`
4. `npm install`
5. `npm run db:deploy -w apps/api && npm run db:seed -w apps/api`
6. `npm run dev` → http://localhost:3000

Or use `START-APP.bat` on Windows (update `.env` for PostgreSQL).

## Features

- Dashboard, Leads, Follow-ups, Pipeline (kanban)
- Bulk WhatsApp campaigns (max 50)
- Single WhatsApp + photo from PC
- Multi-user: Admin / Manager / User
- Lead assignment
- UltraMsg, AtozSender, Evolution API

## License

Proprietary — for sale by Pinnacle Software Solutions / owner.
