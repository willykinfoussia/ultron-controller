# Ultron Controller

Ultron Controller est une interface unifiee pour piloter la memoire Hermes et OpenViking:
- navigation OpenViking (arborescence + lecture/edition/suppression)
- gestion des fichiers Hermes (`~/.hermes/memories/`)
- acces a `SOUL.md` (`~/.hermes/SOUL.md`)
- lecture des sessions Hermes depuis SQLite (`~/.hermes/state.db`)
- recherche OpenViking + recherche FTS sur les sessions
- **onglet Hermes** : communication complete avec l'API Server Hermes (chat live, runs, sessions, jobs, discovery)
- **onglet Telegram** : envoi de messages et pieces jointes a votre bot Telegram via MTProto (Hermes repond via le gateway deja configure)

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
- Pour l'onglet **Hermes** : Hermes API Server actif (`hermes gateway`) avec les variables suivantes dans `~/.hermes/.env` :

```
API_SERVER_ENABLED=true
API_SERVER_KEY=hermes-ultron-api-server
```

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

Variables pour l'onglet **Hermes** (API Server) :
- `ULTRON_HERMES_API_BASE_URL` (defaut: `http://127.0.0.1:8642`) — URL de l'API Server Hermes
- `ULTRON_HERMES_API_KEY` (defaut: `hermes-ultron-api-server`) — Bearer token (doit correspondre a `API_SERVER_KEY` dans `~/.hermes/.env`)
- `ULTRON_HERMES_API_TIMEOUT_SEC` (defaut: `120`) — timeout en secondes pour les appels a l'API Hermes

Variables pour l'onglet **Telegram** (MTProto — aucun appel Hermes API) :
- `ULTRON_TELEGRAM_API_ID` — API ID depuis [my.telegram.org](https://my.telegram.org)
- `ULTRON_TELEGRAM_API_HASH` — API hash associe
- `ULTRON_TELEGRAM_SESSION_STRING` — session Telethon (StringSession), generee une fois
- `ULTRON_TELEGRAM_BOT_USERNAME` — username du bot sans `@` (ex. `my_hermes_bot`)
- `ULTRON_TELEGRAM_MAX_FILE_SIZE_MB` (defaut: `25`) — taille max des pieces jointes (envoi et validation backend)

Generation de la session (one-shot, terminal) :

```bash
export ULTRON_TELEGRAM_API_ID=12345678
export ULTRON_TELEGRAM_API_HASH=your_api_hash
python scripts/telegram_session_setup.py
```

Copier la sortie dans un fichier secrets serveur (ex. `/etc/ultron-controller/secrets.env`) :

```bash
ULTRON_TELEGRAM_API_ID=12345678
ULTRON_TELEGRAM_API_HASH=abcdef...
ULTRON_TELEGRAM_SESSION_STRING=1AgA...
ULTRON_TELEGRAM_BOT_USERNAME=my_hermes_bot
```

Puis dans systemd : `EnvironmentFile=/etc/ultron-controller/secrets.env`

**Securite** : la session string donne un acces complet a votre compte Telegram. Ne pas exposer Ultron sur Internet sans reverse proxy authentifie. Le backend demarre sans Telegram si les secrets sont absents (les autres modules restent disponibles).

**Prerequis** : `hermes gateway` avec le bot Telegram deja configure ; le compte lie a la session string doit etre autorise (`TELEGRAM_ALLOWED_USERS`).

**Pieces jointes** : l'onglet Telegram accepte l'envoi d'un fichier par message (texte optionnel comme legende). Types autorises : images (png, jpg, gif, webp), PDF, Office (doc/x, xls/x, ppt/x), texte (txt, csv), archives (zip), audio (mp3, ogg, wav, m4a), video (mp4, webm). Les medias recus du bot s'affichent dans l'historique ; telechargement via le bouton Download ou `GET /api/telegram/messages/{id}/media`. Limite Ultron : 25 Mo par defaut (`ULTRON_TELEGRAM_MAX_FILE_SIZE_MB`) ; Telegram peut rejeter des fichiers plus gros cote bot (~20 Mo).

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

## Versioning centralise

La version est pilotee par **deux fichiers uniques** :
- backend : `backend/VERSION`
- frontend : `frontend/VERSION`

Pour propager ces versions partout (backend `pyproject.toml`, frontend `package.json` et `package-lock.json`) :

```bash
python scripts/sync_versions.py
```

Notes :
- L'API backend (`/api/version` et `/api/health`) lit directement `backend/VERSION`.
- Le script de deploiement `deploy/deploy_frontend_and_restart.sh` lance automatiquement `python scripts/sync_versions.py`.

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

### API Hermes (proxy vers l'API Server Hermes, prefixe `/api/hermes_api`)

**Health & discovery**
- `GET /api/hermes_api/health` et `GET /api/hermes_api/health/detailed`
- `GET /api/hermes_api/v1/models`
- `GET /api/hermes_api/v1/capabilities`
- `GET /api/hermes_api/v1/skills`
- `GET /api/hermes_api/v1/toolsets`

**Chat & Responses**
- `POST /api/hermes_api/v1/chat/completions` (stream ou JSON, compatible OpenAI)
- `POST /api/hermes_api/v1/responses` (Responses API, `previous_response_id`, `conversation`)
- `GET /api/hermes_api/v1/responses/{id}`
- `DELETE /api/hermes_api/v1/responses/{id}`

**Runs**
- `POST /api/hermes_api/v1/runs`
- `GET /api/hermes_api/v1/runs/{run_id}`
- `GET /api/hermes_api/v1/runs/{run_id}/events` (SSE)
- `POST /api/hermes_api/v1/runs/{run_id}/stop`

**Jobs**
- `GET/POST /api/hermes_api/jobs`
- `GET/PATCH/DELETE /api/hermes_api/jobs/{job_id}`
- `POST /api/hermes_api/jobs/{job_id}/pause|resume|run`

**Sessions live Hermes**
- `GET/POST /api/hermes_api/sessions`
- `GET/PATCH/DELETE /api/hermes_api/sessions/{id}`
- `GET /api/hermes_api/sessions/{id}/messages`
- `POST /api/hermes_api/sessions/{id}/fork`
- `POST /api/hermes_api/sessions/{id}/chat`
- `POST /api/hermes_api/sessions/{id}/chat/stream` (SSE)

### API Telegram (MTProto user client, prefixe `/api/telegram`)

Ultron n'appelle pas Hermes pour cet onglet. Les messages partent vers le bot via votre compte Telegram ; Hermes repond dans l'app via le gateway deja configure.

- `GET /api/telegram/status` — configuration, connectivite, `@bot`, `max_file_size_mb`
- `GET /api/telegram/messages?limit=50` — historique du dialog avec le bot (texte + metadonnees media)
- `GET /api/telegram/messages/{message_id}/media` — telecharge la piece jointe d'un message recu
- `POST /api/telegram/send` — texte seul : `{ "text": "..." }` (JSON) ; texte et/ou fichier : `multipart/form-data` avec champs `text` (optionnel) et `file` (optionnel, un seul fichier)

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
