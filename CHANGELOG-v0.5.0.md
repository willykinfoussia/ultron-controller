# Changelog

## v0.5.0 — Kanban Board UI with Drag-and-Drop

### What's New

Full Kanban board page for the Ultron Controller frontend with drag-and-drop card management across four workflow columns.

### Frontend Changes

**New files:**
- `frontend/src/pages/KanbanPage.tsx` — Kanban board page component with 4 drag-and-drop columns (Triage, Backlog, In Progress, Review)
- 393KB JS bundle, 32KB CSS bundle (gzipped: 119KB JS, 6KB CSS)

**Modified files:**
- `frontend/src/App.tsx` — Added "Kanban" tab to sidebar navigation
- `frontend/src/api/client.ts` — Added `kanbanListCards()` API function for fetching cards by status
- `frontend/src/styles.css` — Added full Kanban board design system (columns, cards, drag-over states, responsive breakpoints)

**Technical decisions:**
- Native HTML5 Drag and Drop API (no new npm dependencies)
- Responsive design: 4-col desktop → 2-col tablet → 1-col mobile
- Optimistic updates on drag-and-drop with rollback on API failure
- Existing `kanbanMoveCard(cardId, newStatus)` endpoint reused for persisting moves

### Backend Changes

- Kanban API endpoints already available (`/api/kanban/cards`, `/api/kanban/move`)
- Backend serves frontend dist from `frontend/dist/` via FastAPI StaticFiles

### Version Justification

Bumped from 0.4.0 → 0.5.0 (Feature level) per versioning policy:
- X2 (Feature) bump: major new UI feature — full Kanban board with drag-and-drop interaction
- Not just a patch or minor fix — introduces entirely new user-facing workflow

### Related Kanban Cards

- t_5f42c0c8 — Frontend implementation of Kanban board page
- t_d273190d — DevOps build and deploy

### Deployment Notes

- Build: `cd frontend && npm run build` — builds to `frontend/dist/`
- Service: `ultron-controller.service` (systemd) on port 9000
- Frontend served by backend FastAPI via StaticFiles at `/assets` and `/`
- No new npm dependencies required
