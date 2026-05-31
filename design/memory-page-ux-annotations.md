# Hermes Memory Page — UX Design Annotations

**Task:** t_99df6575 — Design modern UI mockups for Hermes Memory page
**Date:** 2026-05-31
**Author:** Frontend Engineer (OWL)
**Parent audit:** t_fcee93dc — UI/UX audit of Hermes Memory page

---

## 1. Design Principles Applied

### 1.1 Visual Hierarchy
- Clear separation between navigation (sidebar), tabs (bar), file browser
  (left panel), and editor (right panel) using distinct surfaces
- Each panel has its own card boundary with subtle shadows, reducing cognitive load
- Section labels use uppercase, tracked, 11px labels for consistent grouping

### 1.2 Information Density
- File list items redesigned to show name + metadata inline (vs stacked)
- Added file size badge on the right, removing the need to open the file
- Modified timestamp replaces raw "present/missing" with relative time
  ("Modified 2h ago") for better context
- Memory count badge on agent profiles gives instant overview

### 1.3 Progressive Disclosure
- Search bars are secondary (subtly styled), not competing with primary actions
- Agent tree uses expand/collapse to avoid overwhelming the user with all
  files at once
- Markdown preview is opt-in via toggle, not shown by default
- Unsaved changes banner only appears when there are actual changes

### 1.4 Accessibility
- Focus-visible rings use the primary accent color at 3px offset
- Interactive elements have minimum 32px touch targets
- Color is never the only indicator — status dots paired with text labels,
  active states use border-left accent + background
- Sections have proper ARIA labels and landmarks

### 1.5 Responsive Design
- Split layout stacks vertically below 768px (existing behavior preserved)
- Sidebar collapses to icon-only at narrow viewports
- Search inputs and buttons remain usable at all widths

---

## 2. Key Design Decisions

### 2.1 [NEW] Search/Filter Bar
**Location:** Top of each file list panel
**Decision:** Inline search with clear button, filtering the list below in real-time
**Rationale:** One of the key gaps identified in the audit. Users with many
memory files need a fast way to find specific entries.

### 2.2 [NEW] Markdown Preview Toggle (R4 from audit)
**Location:** Editor panel toolbar, between Edit and Preview
**Decision:** Three-mode toggle: Edit / Split / Preview with instant switch
**Rationale:** The audit identified "no markdown preview" as the top
recommendation (R4).

### 2.3 [NEW] Tab Badges with Counts
**Location:** Tab bar, adjacent to tab label
**Decision:** Small, rounded badges showing file/agent counts
**Rationale:** Gives users an immediate overview of content without clicking.

### 2.4 [NEW] Editor Footer Status Bar
**Location:** Bottom of the editor card
**Decision:** Shows word/line count, save status with color-coded indicator.
**Rationale:** Professional IDE-like experience. Shows save state.

### 2.5 [NEW] Unsaved Changes Banner
**Location:** Between card header and editor content
**Decision:** Animated banner with save/discard actions.
**Rationale:** Prevents accidental data loss.

### 2.6 [NEW] Breadcrumb Navigation
**Location:** Above the split panel area
**Decision:** Clickable breadcrumb path showing current location in hierarchy.
**Rationale:** Orients users in the navigation tree.

### 2.7 [NEW] File Tree Component
**Location:** Left panel file list
**Decision:** Tree structure with chevrons, icons, badges, status dots.
**Rationale:** Clearer hierarchy than flat list. Status dots communicate
file health at a glance.

### 2.8 [NEW] Delete Impact Warning
**Location:** Delete confirmation dialog
**Decision:** Context-aware warning message based on file type.
**Rationale:** Prevents accidental deletion of important files.

---

## 3. State Matrix

| State | Files Tab | Agents Tab |
|-------|-----------|------------|
| Loading | Skeleton list | Skeleton list |
| Empty | Empty state icon + text | Empty state icon + text |
| Error | Error message + retry | Error message + retry |
| Data loaded | File tree with pinned/memories | Agent tree with expand |
| File selected | Editor with breadcrumbs | Editor with breadcrumbs |
| Unsaved changes | Banner + dirty indicator | Banner + dirty indicator |
| Saving | Spinner + "Saving…" | Spinner + "Saving…" |
| Preview mode | Markdown rendered | Markdown rendered |

---

## 4. Component Inventory

| Component | Type | Status |
|-----------|------|--------|
| SearchBar | New | Implemented |
| MarkdownPreviewToggle | New | Implemented |
| EditorFooter | New | Implemented |
| UnsavedBanner | New | Implemented |
| BreadcrumbPath | New | Implemented |
| TabBarWithBadges | New | Implemented |
| FileTreeItem | New | Implemented |
| MemoryPage | Modified | Implemented |

---

## 5. Implementation Priority

### P1 — Must Have
- Search/filter bar
- Markdown preview toggle (R4)
- Unsaved changes dirty state + banner
- Editor footer with stats

### P2 — Should Have
- Tab badges with counts
- Breadcrumb navigation
- File tree with status dots
- Delete impact warning

### P3 — Nice to Have
- Split editor/preview mode
- Keyboard shortcuts (/ for search)
- Animated transitions
