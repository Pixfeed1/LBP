# LBP v2 — Outil de signature électronique

Outil interne pour Les Bons Plombiers permettant l'envoi automatique de documents pour signature aux clients.

## Stack
- Frontend : Next.js 15 (App Router) + Tailwind + shadcn/ui
- Backend : FastAPI (Python)
- DB : PostgreSQL 16
- Cache : Redis 7
- Déploiement : Docker Compose

## Structure
- `frontend/` — Application Next.js
- `backend/` — API FastAPI
- `data/` — Volumes persistants (ignoré par Git)
- `logs/` — Logs (ignoré par Git)
- `nginx/` — Configs nginx
- `scripts/` — Scripts utilitaires

## Setup
Voir `.env.example` pour les variables d'environnement requises.

## Déploiement (à venir)
- Frontend : https://lesbonsplombiers.pixfeed.net
- API : https://api-lesbonsplombiers.pixfeed.net
