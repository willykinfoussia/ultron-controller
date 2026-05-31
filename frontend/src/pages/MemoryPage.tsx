import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  deleteMemoryFile,
  listMemoryFiles,
  listPinnedFiles,
  readMemoryFile,
  readPinnedFile,
  writeMemoryFile,
  writePinnedFile,
  listAgentProfiles,
  readAgentSoul,
  writeAgentSoul,
  listAgentMemories,
  readAgentMemory,
  writeAgentMemory,
  deleteAgentMemory,
  type MemoryFile,
  type AgentProfile,
  type AgentMemoryFile,
} from "../api/client";
import { BreadcrumbPath } from "../components/BreadcrumbPath";
import { ContentEditor } from "../components/ContentEditor";
import { Dialog, type DialogConfig } from "../components/Dialog";
import { EditorFooter } from "../components/EditorFooter";
import { FileTreeItem } from "../components/FileTreeItem";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { MarkdownPreviewToggle } from "../components/MarkdownPreviewToggle";
import { SearchBar } from "../components/SearchBar";
import { SkeletonList } from "../components/Skeleton";
import { TabBarWithBadges } from "../components/TabBarWithBadges";
import { UnsavedBanner } from "../components/UnsavedBanner";
import type { ToastKind } from "../components/Toast";

type MemoryPageProps = {
  setToast: (message: string, kind?: ToastKind) => void;
};

type MemorySelectedFile = { name: string; kind: "memory" | "pinned" };

type AgentSelectedFile =
  | { name: string; kind: "soul"; profile: string }
  | { name: string; kind: "memory"; profile: string };

type Tab = "files" | "agents";
type EditorMode = "edit" | "preview" | "split";

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

export function MemoryPage({ setToast }: MemoryPageProps) {
  const prefersReduced = useReducedMotion();
  const originalContentRef = useRef<string>("");

  // ── Tabs ──────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("files");

  // ── Search/filter ─────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // ── Editor mode ───────────────────────────────────────────
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");

  // ── Dirty state ───────────────────────────────────────────
  const [dirty, setDirty] = useState(false);

  // ── Memory/Pinned state (existing) ────────────────────────
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<MemoryFile[]>([]);
  const [memSelected, setMemSelected] = useState<MemorySelectedFile | null>(null);
  const [memContent, setMemContent] = useState("");
  const [memLoading, setMemLoading] = useState(true);
  const [memSaving, setMemSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  // ── Agents state ──────────────────────────────────────────
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [agentSelected, setAgentSelected] = useState<AgentSelectedFile | null>(null);
  const [agentMemoryFilesMap, setAgentMemoryFilesMap] = useState<Record<string, AgentMemoryFile[]>>({});
  const [agentContent, setAgentContent] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentLastSaved, setAgentLastSaved] = useState<Date | null>(null);
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());

  // ── Filtered files ────────────────────────────────────────
  const filteredMemoryFiles = useMemo(() => {
    if (!searchQuery.trim()) return memoryFiles;
    const q = searchQuery.toLowerCase();
    return memoryFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [memoryFiles, searchQuery]);

  const filteredPinnedFiles = useMemo(() => {
    if (!searchQuery.trim()) return pinnedFiles;
    const q = searchQuery.toLowerCase();
    return pinnedFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [pinnedFiles, searchQuery]);

  // ── Dirty state tracking ──────────────────────────────────
  const currentContent = tab === "files" ? memContent : agentContent;
  const setCurrentContent = tab === "files" ? setMemContent : setAgentContent;

  useEffect(() => {
    const original = originalContentRef.current;
    setDirty(currentContent !== original);
  }, [currentContent]);

  // ── Keyboard shortcut: Ctrl+S to save ─────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (tab === "files" && memSelected) {
          handleMemSave();
        } else if (tab === "agents" && agentSelected) {
          handleAgentSave();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ── Memory/Pinned helpers ─────────────────────────────────
  async function refreshMemoryFiles() {
    const [memories, pinned] = await Promise.all([listMemoryFiles(), listPinnedFiles()]);
    setMemoryFiles(memories.files);
    setPinnedFiles(pinned.files);
  }

  useEffect(() => {
    setMemLoading(true);
    refreshMemoryFiles()
      .catch((err: unknown) => setToast(String(err), "error"))
      .finally(() => setMemLoading(false));
  }, []);

  async function loadMemFile(file: MemorySelectedFile) {
    if (dirty) {
      setDialog({
        title: "Unsaved changes",
        description: "You have unsaved changes. Loading a different file will discard them. Continue?",
        confirmLabel: "Discard & load",
        confirmDanger: true,
        onCancel: () => setDialog(null),
        onConfirm: async () => {
          setDialog(null);
          await doLoadMemFile(file);
        },
      });
      return;
    }
    await doLoadMemFile(file);
  }

  async function doLoadMemFile(file: MemorySelectedFile) {
    setMemSelected(file);
    setAgentSelected(null);
    try {
      const result =
        file.kind === "memory"
          ? await readMemoryFile(file.name)
          : await readPinnedFile(file.name);
      const content = result.content || "";
      setMemContent(content);
      originalContentRef.current = content;
      setDirty(false);
      setLastSaved(new Date());
    } catch (err: unknown) {
      setToast(String(err), "error");
    }
  }

  async function handleMemSave() {
    if (!memSelected) return;
    setMemSaving(true);
    try {
      if (memSelected.kind === "memory") {
        await writeMemoryFile(memSelected.name, memContent);
      } else {
        await writePinnedFile(memSelected.name, memContent);
      }
      await refreshMemoryFiles();
      originalContentRef.current = memContent;
      setDirty(false);
      setLastSaved(new Date());
      setToast("Saved", "success");
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setMemSaving(false);
    }
  }

  function handleMemDelete() {
    if (!memSelected) return;
    setDialog({
      title: `Delete "${memSelected.name}"?`,
      description: "This will permanently delete the memory file. This action cannot be undone.",
      confirmLabel: "Delete",
      confirmDanger: true,
      onCancel: () => setDialog(null),
      onConfirm: async () => {
        setDialog(null);
        try {
          await deleteMemoryFile(memSelected.name);
          setMemSelected(null);
          setMemContent("");
          originalContentRef.current = "";
          setDirty(false);
          await refreshMemoryFiles();
          setToast("Deleted", "success");
        } catch (err: unknown) {
          setToast(String(err), "error");
        }
      },
    });
  }

  function openNewMemFileDialog() {
    setDialog({
      title: "New memory file",
      placeholder: "example.md",
      confirmLabel: "Create",
      onCancel: () => setDialog(null),
      onConfirm: async (name) => {
        setDialog(null);
        try {
          await writeMemoryFile(name, `# ${name}\n\n`);
          await refreshMemoryFiles();
          setToast("Memory file created", "success");
        } catch (err: unknown) {
          setToast(String(err), "error");
        }
      },
    });
  }

  function handleMemDiscard() {
    setMemContent(originalContentRef.current);
    setDirty(false);
  }

  // ── Agents helpers ────────────────────────────────────────

  const loadProfiles = useCallback(async () => {
    try {
      const result = await listAgentProfiles();
      setProfiles(result.profiles);
    } catch (err: unknown) {
      setToast(String(err), "error");
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  function toggleProfile(name: string) {
    setExpandedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  async function loadAgentSoulFile(profile: string) {
    if (dirty) {
      setDialog({
        title: "Unsaved changes",
        description: "You have unsaved changes. Loading a different file will discard them. Continue?",
        confirmLabel: "Discard & load",
        confirmDanger: true,
        onCancel: () => setDialog(null),
        onConfirm: async () => {
          setDialog(null);
          await doLoadAgentSoulFile(profile);
        },
      });
      return;
    }
    await doLoadAgentSoulFile(profile);
  }

  async function doLoadAgentSoulFile(profile: string) {
    setAgentSelected({ name: "SOUL.md", kind: "soul", profile });
    setMemSelected(null);
    setAgentLoading(true);
    try {
      const result = await readAgentSoul(profile);
      const content = result.content || "";
      setAgentContent(content);
      originalContentRef.current = content;
      setDirty(false);
      setAgentLastSaved(new Date());
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setAgentLoading(false);
    }
  }

  async function loadAgentMemFile(profile: string, filename: string) {
    if (dirty) {
      setDialog({
        title: "Unsaved changes",
        description: "You have unsaved changes. Loading a different file will discard them. Continue?",
        confirmLabel: "Discard & load",
        confirmDanger: true,
        onCancel: () => setDialog(null),
        onConfirm: async () => {
          setDialog(null);
          await doLoadAgentMemFile(profile, filename);
        },
      });
      return;
    }
    await doLoadAgentMemFile(profile, filename);
  }

  async function doLoadAgentMemFile(profile: string, filename: string) {
    setAgentSelected({ name: filename, kind: "memory", profile });
    setMemSelected(null);
    setAgentLoading(true);
    try {
      const result = await readAgentMemory(profile, filename);
      const content = result.content || "";
      setAgentContent(content);
      originalContentRef.current = content;
      setDirty(false);
      setAgentLastSaved(new Date());
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setAgentLoading(false);
    }
  }

  async function handleAgentSave() {
    if (!agentSelected) return;
    setAgentSaving(true);
    try {
      if (agentSelected.kind === "soul") {
        await writeAgentSoul(agentSelected.profile, agentContent);
      } else {
        await writeAgentMemory(agentSelected.profile, agentSelected.name, agentContent);
        if (expandedProfiles.has(agentSelected.profile)) {
          const result = await listAgentMemories(agentSelected.profile);
          setAgentMemoryFilesMap((prev) => ({ ...prev, [agentSelected.profile]: result.files }));
        }
      }
      originalContentRef.current = agentContent;
      setDirty(false);
      setAgentLastSaved(new Date());
      setToast("Saved", "success");
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setAgentSaving(false);
    }
  }

  function handleAgentDelete() {
    if (!agentSelected || agentSelected.kind !== "memory") return;
    setDialog({
      title: `Delete "${agentSelected.name}"?`,
      description: "This will permanently delete this agent memory file. This action cannot be undone.",
      confirmLabel: "Delete",
      confirmDanger: true,
      onCancel: () => setDialog(null),
      onConfirm: async () => {
        setDialog(null);
        try {
          await deleteAgentMemory(agentSelected.profile, agentSelected.name);
          setAgentSelected(null);
          setAgentContent("");
          originalContentRef.current = "";
          setDirty(false);
          const result = await listAgentMemories(agentSelected.profile);
          setAgentMemoryFilesMap((prev) => ({ ...prev, [agentSelected.profile]: result.files }));
          setToast("Deleted", "success");
        } catch (err: unknown) {
          setToast(String(err), "error");
        }
      },
    });
  }

  function openNewAgentMemDialog(profile: string) {
    setDialog({
      title: `New memory file in ${profile}`,
      placeholder: "example.md",
      confirmLabel: "Create",
      onCancel: () => setDialog(null),
      onConfirm: async (name) => {
        setDialog(null);
        try {
          await writeAgentMemory(profile, name, `# ${name}\n\n`);
          const result = await listAgentMemories(profile);
          setAgentMemoryFilesMap((prev) => ({ ...prev, [profile]: result.files }));
          setToast("Memory file created", "success");
        } catch (err: unknown) {
          setToast(String(err), "error");
        }
      },
    });
  }

  async function handleExpandProfile(name: string) {
    if (expandedProfiles.has(name)) return;
    try {
      const result = await listAgentMemories(name);
      setAgentMemoryFilesMap((prev) => ({ ...prev, [name]: result.files }));
    } catch (err: unknown) {
      setToast(String(err), "error");
    }
  }

  // ── Breadcrumb ────────────────────────────────────────────
  const breadcrumbSegments = useMemo(() => {
    const segs: Array<{ label: string; icon?: string; onClick?: () => void }> = [];
    if (tab === "files") {
      segs.push({ label: "Memory", icon: "🧠", onClick: () => { setMemSelected(null); setAgentSelected(null); } });
      if (memSelected) {
        segs.push({ label: memSelected.kind === "pinned" ? "Pinned" : "Files" });
        segs.push({ label: memSelected.name });
      }
    } else {
      segs.push({ label: "Agents", icon: "🤖", onClick: () => { setAgentSelected(null); setMemSelected(null); } });
      if (agentSelected) {
        segs.push({ label: agentSelected.profile, onClick: () => {} });
        if (agentSelected.kind === "soul") {
          segs.push({ label: "SOUL.md" });
        } else {
          segs.push({ label: agentSelected.name });
        }
      }
    }
    return segs;
  }, [tab, memSelected, agentSelected]);

  // ── Word/line count ──────────────────────────────────────
  const wordCount = useMemo(() => {
    const text = currentContent.trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [currentContent]);

  const lineCount = useMemo(() => {
    if (!currentContent) return 0;
    return currentContent.split("\n").length;
  }, [currentContent]);

  const motionProps = prefersReduced ? {} : FADE;
  const motionT = prefersReduced ? { duration: 0 } : { duration: 0.18 };

  // ── Tab configs with badges ───────────────────────────────
  const tabConfig = useMemo(() => [
    { id: "files" as const, label: "Memory Files", badge: memoryFiles.length + pinnedFiles.length },
    { id: "agents" as const, label: "Agents", badge: profiles.length },
  ], [memoryFiles.length, pinnedFiles.length, profiles.length]);

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      {/* Unsaved changes banner */}
      <UnsavedBanner
        visible={dirty}
        onSave={tab === "files" ? handleMemSave : handleAgentSave}
        onDiscard={tab === "files" ? handleMemDiscard : () => {
          setAgentContent(originalContentRef.current);
          setDirty(false);
        }}
        saving={tab === "files" ? memSaving : agentSaving}
      />

      <div className="page mem-page">
        {/* ── Tab bar ── */}
        <TabBarWithBadges
          tabs={tabConfig}
          activeTab={tab}
          onChange={(id) => {
            if (dirty) {
              setDialog({
                title: "Unsaved changes",
                description: "You have unsaved changes. Switching tabs will discard them. Continue?",
                confirmLabel: "Discard & switch",
                confirmDanger: true,
                onCancel: () => setDialog(null),
                onConfirm: () => {
                  setDialog(null);
                  setTab(id as Tab);
                  setDirty(false);
                  tab === "files" ? setMemContent(originalContentRef.current) : setAgentContent(originalContentRef.current);
                },
              });
              return;
            }
            setTab(id as Tab);
          }}
        />

        {/* ── Search + Toolbar row ── */}
        <div className="mem-toolbar">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search files…"
            resultCount={searchQuery ? filteredMemoryFiles.length + filteredPinnedFiles.length : undefined}
          />
          <div className="mem-toolbar-actions">
            {tab === "files" && (
              <button onClick={openNewMemFileDialog} aria-label="New memory file">
                + New file
              </button>
            )}
            {tab === "agents" && (
              <button onClick={() => loadProfiles()} aria-label="Refresh profiles" title="Refresh">
                ↻ Refresh
              </button>
            )}
          </div>
        </div>

        {/* ── Breadcrumb ── */}
        <BreadcrumbPath segments={breadcrumbSegments} />

        {/* ── TAB: Memory Files ── */}
        {tab === "files" && (
          <div className="split-2">
            {/* ── Left panel ── */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Hermes Memory</span>
              </div>

              <div className="card-body" style={{ paddingTop: 0 }}>
                <AnimatePresence mode="wait" initial={false}>
                  {memLoading ? (
                    <motion.div key="skel" {...motionProps} transition={motionT}>
                      <SkeletonList count={6} />
                    </motion.div>
                  ) : (
                    <motion.key="lists" {...motionProps} transition={motionT}>
                      <div className="file-tree" role="tree" aria-label="Memory files">
                        {/* Pinned files */}
                        <p className="section-label">Pinned files</p>
                        {filteredPinnedFiles.length === 0 ? (
                          <div className="empty-state" style={{ padding: "12px 0" }}>
                            <span className="empty-state-desc">
                              {searchQuery ? "No matching pinned files" : "No pinned files"}
                            </span>
                          </div>
                        ) : (
                          filteredPinnedFiles.map((file) => {
                            const isActive =
                              memSelected?.name === file.name && memSelected?.kind === "pinned";
                            return (
                              <FileTreeItem
                                key={`pinned-${file.name}`}
                                name={file.name}
                                icon="📌"
                                isActive={isActive}
                                meta={file.exists ? "present" : "missing"}
                                onClick={() =>
                                  loadMemFile({ name: file.name, kind: "pinned" }).catch((e) =>
                                    setToast(String(e), "error"),
                                  )
                                }
                              />
                            );
                          })
                        )}

                        {/* Memory files */}
                        <p className="section-label" style={{ marginTop: 12 }}>Memories</p>
                        {filteredMemoryFiles.length === 0 ? (
                          <div className="empty-state" style={{ padding: "12px 0" }}>
                            <span className="empty-state-icon">🧠</span>
                            <span className="empty-state-desc">
                              {searchQuery ? "No matching memory files" : "No memory files yet"}
                            </span>
                          </div>
                        ) : (
                          filteredMemoryFiles.map((file) => {
                            const isActive =
                              memSelected?.name === file.name && memSelected?.kind === "memory";
                            return (
                              <FileTreeItem
                                key={`mem-${file.name}`}
                                name={file.name}
                                icon="📝"
                                isActive={isActive}
                                meta={`${(file.size / 1024).toFixed(1)} KB`}
                                onClick={() =>
                                  loadMemFile({ name: file.name, kind: "memory" }).catch((e) =>
                                    setToast(String(e), "error"),
                                  )
                                }
                              />
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Right panel: editor ── */}
            <AnimatePresence mode="wait" initial={false}>
              {memSelected ? (
                <motion.div
                  key={`mem-${memSelected.kind}-${memSelected.name}`}
                  {...motionProps}
                  transition={motionT}
                  className="mem-editor-panel"
                >
                  {/* Editor header with mode toggle */}
                  <div className="mem-editor-header">
                    <div className="mem-editor-info">
                      <span className="mem-editor-title">
                        {memSelected.kind === "pinned" ? "📌" : "📝"} {memSelected.name}
                      </span>
                      <span className="mem-editor-subtitle">
                        {memSelected.kind === "pinned" ? "Pinned file" : "Memory file"}
                      </span>
                    </div>
                    <MarkdownPreviewToggle mode={editorMode} onChange={setEditorMode} />
                  </div>

                  {/* Editor body */}
                  <div className={`mem-editor-body mem-editor-body--${editorMode}`}>
                    {(editorMode === "edit" || editorMode === "split") && (
                      <div className="mem-editor-pane">
                        <textarea
                          className="editor"
                          style={{ border: "none", borderRadius: 0, outline: "none" }}
                          value={memContent}
                          onChange={(e) => setMemContent(e.target.value)}
                          spellCheck={false}
                          aria-label="File content editor"
                        />
                      </div>
                    )}
                    {(editorMode === "preview" || editorMode === "split") && (
                      <div className="mem-preview-pane">
                        <MarkdownPreview content={memContent} />
                      </div>
                    )}
                  </div>

                  {/* Editor footer */}
                  <EditorFooter
                    dirty={dirty}
                    saving={memSaving}
                    lastSaved={lastSaved}
                    onSave={handleMemSave}
                    onDiscard={handleMemDiscard}
                    wordCount={wordCount}
                    lineCount={lineCount}
                  />
                </motion.div>
              ) : (
                <motion.div key="mem-empty" {...motionProps} transition={motionT}>
                  <div className="card">
                    <div className="empty-state" style={{ minHeight: 240 }}>
                      <span className="empty-state-icon">📝</span>
                      <span className="empty-state-title">No file selected</span>
                      <span className="empty-state-desc">
                        Choose a file from the list to view and edit its content.
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── TAB: Agents ── */}
        {tab === "agents" && (
          <div className="split-2">
            {/* ── Left panel: agent tree ── */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Agent Profiles</span>
              </div>

              <div className="card-body" style={{ paddingTop: 0 }}>
                <AnimatePresence mode="wait" initial={false}>
                  {profiles.length === 0 ? (
                    <motion.div key="agents-empty" {...motionProps} transition={motionT}>
                      <div className="empty-state" style={{ padding: "24px 0" }}>
                        <span className="empty-state-icon">🤖</span>
                        <span className="empty-state-desc">No agent profiles found</span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="agents-list" {...motionProps} transition={motionT}>
                      <div className="file-tree" role="tree" aria-label="Agent profiles">
                        {profiles.map((profile) => {
                          const isExpanded = expandedProfiles.has(profile.name);
                          const isActiveProfile = agentSelected?.profile === profile.name;
                          return (
                            <div key={profile.name}>
                              <FileTreeItem
                                name={profile.name}
                                icon="📁"
                                iconOpen="📂"
                                isActive={isActiveProfile && !agentSelected?.name}
                                isDirectory
                                isOpen={isExpanded}
                                hasChildren
                                badge={profile.memories_count}
                                meta={profile.role ?? undefined}
                                onClick={() => {
                                  toggleProfile(profile.name);
                                  if (!isExpanded) {
                                    handleExpandProfile(profile.name);
                                  }
                                }}
                                onToggle={() => {
                                  toggleProfile(profile.name);
                                  if (!isExpanded) {
                                    handleExpandProfile(profile.name);
                                  }
                                }}
                              >
                                {/* SOUL.md */}
                                <FileTreeItem
                                  name="SOUL.md"
                                  icon="📜"
                                  depth={1}
                                  isActive={isActiveProfile && agentSelected?.kind === "soul"}
                                  meta={profile.has_soul ? "present" : "missing"}
                                  onClick={() => loadAgentSoulFile(profile.name)}
                                />

                                {/* Memory files */}
                                {(agentMemoryFilesMap[profile.name] ?? []).map((file) => (
                                  <FileTreeItem
                                    key={`${profile.name}::${file.name}`}
                                    name={file.name}
                                    icon="📝"
                                    depth={1}
                                    isActive={
                                      isActiveProfile &&
                                      agentSelected?.kind === "memory" &&
                                      agentSelected?.name === file.name
                                    }
                                    meta={`${(file.size / 1024).toFixed(1)} KB`}
                                    onClick={() => loadAgentMemFile(profile.name, file.name)}
                                  />
                                ))}

                                {/* New memory file */}
                                <FileTreeItem
                                  name="+ New memory file"
                                  icon="➕"
                                  depth={1}
                                  onClick={() => openNewAgentMemDialog(profile.name)}
                                />
                              </FileTreeItem>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Right panel: agent content editor ── */}
            <AnimatePresence mode="wait" initial={false}>
              {agentSelected ? (
                <motion.div
                  key={`agent-${agentSelected.profile}-${agentSelected.kind}-${agentSelected.name}`}
                  {...motionProps}
                  transition={motionT}
                  className="mem-editor-panel"
                >
                  {/* Editor header */}
                  <div className="mem-editor-header">
                    <div className="mem-editor-info">
                      <span className="mem-editor-title">
                        {agentSelected.kind === "soul" ? "📜" : "📝"} {agentSelected.name}
                      </span>
                      <span className="mem-editor-subtitle">
                        {agentSelected.profile} — {agentSelected.kind === "soul" ? "Soul" : "Memory"}
                      </span>
                    </div>
                    <MarkdownPreviewToggle mode={editorMode} onChange={setEditorMode} />
                  </div>

                  {agentLoading ? (
                    <div className="card-body" style={{ padding: "24px" }}>
                      <SkeletonList count={4} />
                    </div>
                  ) : (
                    <>
                      {/* Editor body */}
                      <div className={`mem-editor-body mem-editor-body--${editorMode}`}>
                        {(editorMode === "edit" || editorMode === "split") && (
                          <div className="mem-editor-pane">
                            <textarea
                              className="editor"
                              style={{ border: "none", borderRadius: 0, outline: "none" }}
                              value={agentContent}
                              onChange={(e) => setAgentContent(e.target.value)}
                              spellCheck={false}
                              aria-label="File content editor"
                            />
                          </div>
                        )}
                        {(editorMode === "preview" || editorMode === "split") && (
                          <div className="mem-preview-pane">
                            <MarkdownPreview content={agentContent} />
                          </div>
                        )}
                      </div>

                      {/* Editor footer */}
                      <EditorFooter
                        dirty={dirty}
                        saving={agentSaving}
                        lastSaved={agentLastSaved}
                        onSave={handleAgentSave}
                        onDiscard={() => {
                          setAgentContent(originalContentRef.current);
                          setDirty(false);
                        }}
                        wordCount={wordCount}
                        lineCount={lineCount}
                      />
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div key="agent-empty" {...motionProps} transition={motionT}>
                  <div className="card">
                    <div className="empty-state" style={{ minHeight: 240 }}>
                      <span className="empty-state-icon">🤖</span>
                      <span className="empty-state-title">No agent file selected</span>
                      <span className="empty-state-desc">
                        Expand an agent profile and select a file to view and edit its content.
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Dialog config={dialog} />
    </>
  );
}
