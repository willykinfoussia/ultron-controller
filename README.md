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
- `ULTRON_SYSTEM_DISK_PATH` (defaut: `/`)
- `ULTRON_SYSTEM_CACHE_TTL_SEC` (defaut: `1.5`)
- `ULTRON_SYSTEM_DEFAULT_PROCESS_LIMIT` (defaut: `20`)
- `ULTRON_SYSTEM_MAX_PROCESS_LIMIT` (defaut: `100`)
- `ULTRON_STORAGE_SCAN_TIMEOUT_SEC` (defaut: `8.0`)
- `ULTRON_STORAGE_MAX_DEPTH` (defaut: `4`)
- `ULTRON_STORAGE_MAX_ENTRIES` (defaut: `200000`)
- `ULTRON_STORAGE_DEFAULT_LIMIT` (defaut: `10`)
- `ULTRON_STORAGE_MAX_LIMIT` (defaut: `50`)
- `ULTRON_STORAGE_CACHE_TTL_SEC` (defaut: `45.0`)
- `ULTRON_STORAGE_FOLLOW_SYMLINKS` (defaut: `false`)
- `ULTRON_STORAGE_EXCLUDE_SYSTEM_PATHS` (defaut: `true`)
- `ULTRON_STORAGE_MAX_PATH_LENGTH` (defaut: `2048`)

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
- `deploy/deploy_frontend_and_restart.sh`

Usage sur le serveur:

```bash
cd /home/opc/ultron-controller
chmod +x deploy/deploy_frontend_and_restart.sh
./deploy/deploy_frontend_and_restart.sh
```

Optionnel (service custom):

```bash
SERVICE_NAME=ultron-controller ./deploy/deploy_frontend_and_restart.sh
```

## API principale

- `GET /api/health`
- `GET /api/ov/*` et `POST/DELETE /api/ov/*`
- `GET/POST/DELETE /api/hermes/file/{name}`
- `GET/POST /api/hermes/pinned/{name}`
- `GET /api/sessions` et `GET /api/sessions/{session_id}`
- `POST /api/search/openviking`
- `POST /api/search/sessions`
- `GET /api/system/cpu`
- `GET /api/system/memory`
- `GET /api/system/disk`
- `GET /api/system/processes?limit=20&sort=cpu|memory`
- `GET /api/storage/scan?path=/home&depth=4&limit=10`
- `GET /api/storage/top-folders?path=/home&depth=4&limit=10`
- `GET /api/storage/top-files?path=/home&depth=4&limit=10`

## System Resource Manager

Le module `System` dans l'UI ajoute:
- monitoring CPU/RAM/Disque avec refresh auto (5s par defaut)
- top processes (CPU/RAM) triables
- analyse stockage (top dossiers/fichiers) avec scan securise

Le scanner stockage est protege contre les scans trop couteux:
- limites de profondeur / nombre d'entrees
- timeout hard-stop
- exclusions des chemins systeme critiques (par defaut)
- cache TTL pour eviter les recalculs constants
