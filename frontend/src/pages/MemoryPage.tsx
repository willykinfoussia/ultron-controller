import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

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
import { ContentEditor } from "../components/ContentEditor";
import { Dialog, type DialogConfig } from "../components/Dialog";
import { SkeletonList } from "../components/Skeleton";
import type { ToastKind } from "../components/Toast";

type MemoryPageProps = {
  setToast: (message: string, kind?: ToastKind) => void;
};

type MemorySelectedFile = { name: string; kind: "memory" | "pinned" };

type AgentSelectedFile =
  | { name: string; kind: "soul"; profile: string }
  | { name: string; kind: "memory"; profile: string };

type Tab = "files" | "agents";

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

export function MemoryPage({ setToast }: MemoryPageProps) {
  const prefersReduced = useReducedMotion();

  // ── Tabs ──────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("files");

  // ── Memory/Pinned state (existing) ────────────────────────
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<MemoryFile[]>([]);
  const [memSelected, setMemSelected] = useState<MemorySelectedFile | null>(null);
  const [memContent, setMemContent] = useState("");
  const [memLoading, setMemLoading] = useState(true);
  const [memSaving, setMemSaving] = useState(false);
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  // ── Agents state ──────────────────────────────────────────
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [agentSelected, setAgentSelected] = useState<AgentSelectedFile | null>(null);
  const [agentMemoryFilesMap, setAgentMemoryFilesMap] = useState<Record<string, AgentMemoryFile[]>>({});
  const [agentContent, setAgentContent] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSaving, setAgentSaving] = useState(false);
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());

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
    setMemSelected(file);
    setAgentSelected(null);
    try {
      const result =
        file.kind === "memory"
          ? await readMemoryFile(file.name)
          : await readPinnedFile(file.name);
      setMemContent(result.content || "");
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
    setAgentSelected({ name: "SOUL.md", kind: "soul", profile });
    setMemSelected(null);
    setAgentLoading(true);
    try {
      const result = await readAgentSoul(profile);
      setAgentContent(result.content || "");
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setAgentLoading(false);
    }
  }

  async function loadAgentMemFile(profile: string, filename: string) {
    setAgentSelected({ name: filename, kind: "memory", profile });
    setMemSelected(null);
    setAgentLoading(true);
    try {
      const result = await readAgentMemory(profile, filename);
      setAgentContent(result.content || "");
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
        // refresh memory file list for this profile
        if (expandedProfiles.has(agentSelected.profile)) {
          const result = await listAgentMemories(agentSelected.profile);
          setAgentMemoryFilesMap((prev) => ({ ...prev, [agentSelected.profile]: result.files }));
        }
      }
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

  async function handleExpandProfile(name: string, hasSoul: boolean) {
    if (expandedProfiles.has(name)) return;
    try {
      const result = await listAgentMemories(name);
      setAgentMemoryFilesMap((prev) => ({ ...prev, [name]: result.files }));
    } catch (err: unknown) {
      setToast(String(err), "error");
    }
  }

  const motionProps = prefersReduced ? {} : FADE;
  const motionT     = prefersReduced ? { duration: 0 } : { duration: 0.18 };

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      <div className="page">

        {/* ── Tab bar ── */}
        <div className="tab-bar" style={{ padding: "0 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 0 }}>
          <button
            className={`tab-btn ${tab === "files" ? "active" : ""}`}
            onClick={() => setTab("files")}
            style={{
              padding: "10px 18px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: tab === "files" ? 600 : 400,
              color: tab === "files" ? "var(--accent)" : "var(--text-2)",
              borderBottom: tab === "files" ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            Memory Files
          </button>
          <button
            className={`tab-btn ${tab === "agents" ? "active" : ""}`}
            onClick={() => setTab("agents")}
            style={{
              padding: "10px 18px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: tab === "agents" ? 600 : 400,
              color: tab === "agents" ? "var(--accent)" : "var(--text-2)",
              borderBottom: tab === "agents" ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            Agents
          </button>
        </div>

        {/* ── TAB: Memory Files ── */}
        {tab === "files" && (
          <div className="split-2">
            {/* ── Left panel ── */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Hermes Memory</span>
                <button onClick={openNewMemFileDialog} aria-label="New memory file">+ New</button>
              </div>

              <div className="card-body" style={{ paddingTop: 0 }}>
                <AnimatePresence mode="wait" initial={false}>
                  {memLoading ? (
                    <motion.div key="skel" {...motionProps} transition={motionT}>
                      <SkeletonList count={6} />
                    </motion.div>
                  ) : (
                    <motion.div key="lists" {...motionProps} transition={motionT}>
                      <p className="section-label">Pinned files</p>
                      {pinnedFiles.length === 0 ? (
                        <div className="empty-state" style={{ padding: "12px 0" }}>
                          <span className="empty-state-desc">No pinned files</span>
                        </div>
                      ) : (
                        <div className="list" style={{ maxHeight: 180 }}>
                          {pinnedFiles.map((file, i) => {
                            const isActive =
                              memSelected?.name === file.name && memSelected?.kind === "pinned";
                            return (
                              <motion.button
                                key={file.name}
                                aria-current={isActive ? "true" : undefined}
                                className={`list-item ${isActive ? "active" : ""}`}
                                onClick={() =>
                                  loadMemFile({ name: file.name, kind: "pinned" }).catch((e) =>
                                    setToast(String(e), "error")
                                  )
                                }
                                initial={prefersReduced ? {} : { opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03, duration: 0.18 }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 13 }}>📌</span>
                                  <span className="list-item-name">{file.name}</span>
                                </div>
                                <span className={`list-item-meta ${file.exists ? "" : "text-danger"}`}>
                                  {file.exists ? "present" : "missing"}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      )}

                      <p className="section-label" style={{ marginTop: 12 }}>Memories</p>
                      {memoryFiles.length === 0 ? (
                        <div className="empty-state" style={{ padding: "12px 0" }}>
                          <span className="empty-state-icon">🧠</span>
                          <span className="empty-state-desc">No memory files yet</span>
                        </div>
                      ) : (
                        <div className="list" style={{ maxHeight: "calc(100vh - 380px)" }}>
                          {memoryFiles.map((file, i) => {
                            const isActive =
                              memSelected?.name === file.name && memSelected?.kind === "memory";
                            return (
                              <motion.button
                                key={file.name}
                                aria-current={isActive ? "true" : undefined}
                                className={`list-item ${isActive ? "active" : ""}`}
                                onClick={() =>
                                  loadMemFile({ name: file.name, kind: "memory" }).catch((e) =>
                                    setToast(String(e), "error")
                                  )
                                }
                                initial={prefersReduced ? {} : { opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03, duration: 0.18 }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 13 }}>📝</span>
                                  <span className="list-item-name">{file.name}</span>
                                </div>
                                <span className="list-item-meta">
                                  {(file.size / 1024).toFixed(1)} KB
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Right panel: editor ── */}
            <AnimatePresence mode="wait" initial={false}>
              {memSelected ? (
                <motion.div key={`mem-${memSelected.kind}-${memSelected.name}`} {...motionProps} transition={motionT}>
                  <ContentEditor
                    title="Memory Editor"
                    subtitle={`${memSelected.kind}: ${memSelected.name}`}
                    value={memContent}
                    onChange={setMemContent}
                    onSave={handleMemSave}
                    onDelete={memSelected.kind === "memory" ? handleMemDelete : undefined}
                    disableDelete={memSelected.kind !== "memory"}
                    saving={memSaving}
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
                <button onClick={() => loadProfiles()} aria-label="Refresh profiles" title="Refresh">↻</button>
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
                      <div className="list">
                        {profiles.map((profile, i) => {
                          const isExpanded = expandedProfiles.has(profile.name);
                          const isActiveProfile =
                            agentSelected?.profile === profile.name;
                          return (
                            <div key={profile.name}>
                              {/* Profile row */}
                              <motion.div
                                className={`list-item ${isActiveProfile ? "active" : ""}`}
                                style={{ cursor: "pointer", fontWeight: 500 }}
                                onClick={() => {
                                  toggleProfile(profile.name);
                                  if (!isExpanded) {
                                    handleExpandProfile(profile.name, profile.has_soul);
                                  }
                                }}
                                initial={prefersReduced ? {} : { opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03, duration: 0.18 }}
                                whileHover={{ x: 2 }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 13 }}>{isExpanded ? "📂" : "📁"}</span>
                                  <span className="list-item-name">{profile.name}</span>
                                  {profile.role && (
                                    <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 4 }}>
                                      {profile.role}
                                    </span>
                                  )}
                                </div>
                                <span className="list-item-meta">
                                  {profile.memories_count} mem
                                </span>
                              </motion.div>

                              {/* Expanded: SOUL.md + memory files */}
                              {isExpanded && (
                                <div style={{ paddingLeft: 16, borderLeft: "1px solid var(--border)", marginLeft: 8 }}>
                                  {/* SOUL.md */}
                                  <motion.div
                                    className={`list-item ${isActiveProfile && agentSelected?.kind === "soul" ? "active" : ""}`}
                                    style={{ cursor: "pointer" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      loadAgentSoulFile(profile.name);
                                    }}
                                    initial={prefersReduced ? {} : { opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.15 }}
                                    whileHover={{ x: 2 }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 13 }}>📜</span>
                                      <span className="list-item-name">SOUL.md</span>
                                    </div>
                                    <span className={`list-item-meta ${profile.has_soul ? "" : "text-danger"}`}>
                                      {profile.has_soul ? "present" : "missing"}
                                    </span>
                                  </motion.div>

                                  {/* Memory files for this profile */}
                                  {(agentMemoryFilesMap[profile.name] ?? []).map((file) => {
                                    const isFileActive =
                                      isActiveProfile &&
                                      agentSelected?.kind === "memory" &&
                                      agentSelected?.name === file.name;
                                      return (
                                        <motion.div
                                          key={`${profile.name}::${file.name}`}
                                          className={`list-item ${isFileActive ? "active" : ""}`}
                                          style={{ cursor: "pointer" }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            loadAgentMemFile(profile.name, file.name);
                                          }}
                                          initial={prefersReduced ? {} : { opacity: 0, x: -4 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ duration: 0.15 }}
                                          whileHover={{ x: 2 }}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ fontSize: 13 }}>📝</span>
                                            <span className="list-item-name">{file.name}</span>
                                          </div>
                                          <span className="list-item-meta">
                                            {(file.size / 1024).toFixed(1)} KB
                                          </span>
                                        </motion.div>
                                      );
                                    })}

                                  {/* New memory file button */}
                                  <motion.div
                                    className="list-item"
                                    style={{ cursor: "pointer", fontSize: 12, color: "var(--accent)" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openNewAgentMemDialog(profile.name);
                                    }}
                                    initial={prefersReduced ? {} : { opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.15 }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 13 }}>+</span>
                                      <span>New memory file</span>
                                    </div>
                                  </motion.div>
                                </div>
                              )}
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
                <motion.div key={`agent-${agentSelected.profile}-${agentSelected.kind}-${agentSelected.name}`} {...motionProps} transition={motionT}>
                  {agentLoading ? (
                    <div className="card">
                      <div className="card-body" style={{ padding: "24px" }}>
                        <SkeletonList count={4} />
                      </div>
                    </div>
                  ) : (
                    <ContentEditor
                      title={
                        agentSelected.kind === "soul"
                          ? "SOUL.md Editor"
                          : "Memory Editor"
                      }
                      subtitle={`${agentSelected.profile}: ${agentSelected.name}`}
                      value={agentContent}
                      onChange={setAgentContent}
                      onSave={handleAgentSave}
                      onDelete={agentSelected.kind === "memory" ? handleAgentDelete : undefined}
                      disableDelete={agentSelected.kind !== "memory"}
                      saving={agentSaving}
                    />
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
