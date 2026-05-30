import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import {
  deleteMemoryFile,
  listMemoryFiles,
  listPinnedFiles,
  readMemoryFile,
  readPinnedFile,
  writeMemoryFile,
  writePinnedFile,
  type MemoryFile,
} from "../api/client";
import { ContentEditor } from "../components/ContentEditor";
import { Dialog, type DialogConfig } from "../components/Dialog";
import { SkeletonList } from "../components/Skeleton";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";

type MemoryPageProps = {
  setToast: (message: string, kind?: ToastKind) => void;
};

type SelectedFile = { name: string; kind: "memory" | "pinned" };

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

export function MemoryPage({ setToast }: MemoryPageProps) {
  const prefersReduced = useReducedMotion();

  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<MemoryFile[]>([]);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  async function refresh() {
    const [memories, pinned] = await Promise.all([listMemoryFiles(), listPinnedFiles()]);
    setMemoryFiles(memories.files);
    setPinnedFiles(pinned.files);
  }

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((err: unknown) => setToast(String(err), "error"))
      .finally(() => setLoading(false));
  }, []);

  async function loadFile(file: SelectedFile) {
    setSelected(file);
    try {
      const result =
        file.kind === "memory"
          ? await readMemoryFile(file.name)
          : await readPinnedFile(file.name);
      setContent(result.content || "");
    } catch (err: unknown) {
      setToast(String(err), "error");
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      if (selected.kind === "memory") {
        await writeMemoryFile(selected.name, content);
      } else {
        await writePinnedFile(selected.name, content);
      }
      await refresh();
      setToast("Saved", "success");
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!selected) return;
    setDialog({
      title: `Delete "${selected.name}"?`,
      description: "This will permanently delete the memory file. This action cannot be undone.",
      confirmLabel: "Delete",
      confirmDanger: true,
      onCancel: () => setDialog(null),
      onConfirm: async () => {
        setDialog(null);
        try {
          await deleteMemoryFile(selected.name);
          setSelected(null);
          setContent("");
          await refresh();
          setToast("Deleted", "success");
        } catch (err: unknown) {
          setToast(String(err), "error");
        }
      },
    });
  }

  function openNewFileDialog() {
    setDialog({
      title: "New memory file",
      placeholder: "example.md",
      confirmLabel: "Create",
      onCancel: () => setDialog(null),
      onConfirm: async (name) => {
        setDialog(null);
        try {
          await writeMemoryFile(name, `# ${name}\n\n`);
          await refresh();
          setToast("Memory file created", "success");
        } catch (err: unknown) {
          setToast(String(err), "error");
        }
      },
    });
  }

  const motionProps = prefersReduced ? {} : FADE;
  const motionT     = prefersReduced ? { duration: 0 } : { duration: 0.18 };

  return (
    <>
      <div className="page split-2">
        {/* ── Left panel ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Hermes Memory</span>
            <button onClick={openNewFileDialog} aria-label="New memory file">+ New</button>
          </div>

          <div className="card-body" style={{ paddingTop: 0 }}>
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
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
                          selected?.name === file.name && selected?.kind === "pinned";
                        return (
                          <motion.button
                            key={file.name}
                            aria-current={isActive ? "true" : undefined}
                            className={`list-item ${isActive ? "active" : ""}`}
                            onClick={() =>
                              loadFile({ name: file.name, kind: "pinned" }).catch((e) =>
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
                          selected?.name === file.name && selected?.kind === "memory";
                        return (
                          <motion.button
                            key={file.name}
                            aria-current={isActive ? "true" : undefined}
                            className={`list-item ${isActive ? "active" : ""}`}
                            onClick={() =>
                              loadFile({ name: file.name, kind: "memory" }).catch((e) =>
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
          {selected ? (
            <motion.div key={selected.name} {...motionProps} transition={motionT}>
              <ContentEditor
                title="Memory Editor"
                subtitle={`${selected.kind}: ${selected.name}`}
                value={content}
                onChange={setContent}
                onSave={handleSave}
                onDelete={selected.kind === "memory" ? handleDelete : undefined}
                disableDelete={selected.kind !== "memory"}
                saving={saving}
              />
            </motion.div>
          ) : (
            <motion.div key="empty" {...motionProps} transition={motionT}>
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

      <Dialog config={dialog} />
    </>
  );
}
