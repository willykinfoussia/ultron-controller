# Ultron Controller

Ultron Controller est une interface unifiee pour piloter la memoire Hermes et OpenViking:
- navigation OpenViking (arborescence + lecture/edition/suppression)
- gestion des fichiers Hermes (`~/.hermes/memories/`)
- acces a `SOUL.md` (`~/.hermes/SOUL.md`)
- lecture des sessions Hermes depuis SQLite (`~/.hermes/state.db`)
- recherche OpenViking + recherche FTS sur les sessions

## Architecture

### Backend
- `backend/app/core`: configuration et schemas Pydantic
- `backend/app/services`: logique metier (OpenViking, fichiers Hermes, SQLite sessions)
- `backend/app/api`: endpoints FastAPI
- `backend/app/main.py`: composition de l'application, CORS, service du frontend build

### Frontend
- `frontend/src/api`: client HTTP type
- `frontend/src/components`: composants reutilisables
- `frontend/src/pages`: pages OpenViking, Memory, Sessions, Search

## Prerequis

- Python 3.11+
- `uv` installe (https://docs.astral.sh/uv/)
- Node.js 20+
- Hermes avec dossier `~/.hermes/` present
- OpenViking accessible (par defaut `http://127.0.0.1:1933`)

## Variables d'environnement (optionnelles)

Toutes les variables backend utilisent le prefixe `ULTRON_`:
- `ULTRON_OPENVIKING_ENDPOINT`
- `ULTRON_OPENVIKING_API_KEY`
- `ULTRON_HERMES_HOME`
- `ULTRON_MEMORIES_DIR_NAME` (defaut: `memories`)
- `ULTRON_STATE_DB_NAME` (defaut: `state.db`)

## Developpement

### 1) Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Alternative (si tu preferes rester sur `requirements.txt`):

```bash
cd backend
uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend Vite proxy les requetes `/api` vers `http://127.0.0.1:8000`.

## Build production

```bash
cd frontend
npm run build
```

Le backend servira ensuite automatiquement `frontend/dist`.

## Service systemd (backend)

Un exemple a jour est fourni dans:
- `deploy/systemd/ultron-controller.service`

Installation sur serveur Linux:

```bash
sudo cp deploy/systemd/ultron-controller.service /etc/systemd/system/ultron-controller.service
sudo systemctl daemon-reload
sudo systemctl enable ultron-controller
sudo systemctl restart ultron-controller
sudo systemctl status ultron-controller
```

Logs:

```bash
journalctl -u ultron-controller -f
```

## Script de deploiement rapide (git pull + frontend build + restart service)

Script fourni:
- `deploy/scripts/deploy_frontend_and_restart.sh`

Usage sur le serveur:

```bash
cd /home/opc/ultron-controller
chmod +x deploy/scripts/deploy_frontend_and_restart.sh
./deploy/scripts/deploy_frontend_and_restart.sh
```

Optionnel (service custom):

```bash
SERVICE_NAME=ultron-controller ./deploy/scripts/deploy_frontend_and_restart.sh
```

## API principale

- `GET /api/health`
- `GET /api/ov/*` et `POST/DELETE /api/ov/*`
- `GET/POST/DELETE /api/hermes/file/{name}`
- `GET/POST /api/hermes/pinned/{name}`
- `GET /api/sessions` et `GET /api/sessions/{session_id}`
- `POST /api/search/openviking`
- `POST /api/search/sessions`
