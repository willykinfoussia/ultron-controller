import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useEffect, useState } from "react";

import {
  ovAbstract,
  ovDelete,
  ovMkdir,
  ovRead,
  ovStat,
  ovTree,
  ovWrite,
  type OvNode,
} from "../api/client";
import { Dialog, type DialogConfig } from "../components/Dialog";
import { FileTree } from "../components/FileTree";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { SkeletonEditor, SkeletonList } from "../components/Skeleton";
import { Spinner } from "../components/Spinner";
import type { ToastKind } from "../components/Toast";

type OpenVikingPageProps = {
  setToast: (message: string, kind?: ToastKind) => void;
};

type ViewMode = "raw" | "preview" | "abstract";

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function inferParentUri(selectedUri: string | null, fallback: string): string {
  if (!selectedUri) return fallback;
  if (selectedUri.endsWith("/")) return selectedUri;
  const index = selectedUri.lastIndexOf("/");
  return index < 0 ? fallback : `${selectedUri.slice(0, index + 1)}`;
}

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
const FADE_T = { duration: 0.18 };

export function OpenVikingPage({ setToast }: OpenVikingPageProps) {
  const prefersReduced = useReducedMotion();

  const [nodes, setNodes] = useState<OvNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [selectedIsDir, setSelectedIsDir] = useState(false);
  const [content, setContent] = useState("");
  const [abstractText, setAbstractText] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("raw");

  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  async function refreshTree() {
    const data = await ovTree("viking://", 3);
    setNodes(data.result ?? []);
  }

  useEffect(() => {
    setLoadingTree(true);
    refreshTree()
      .catch((err: unknown) => setToast(String(err), "error"))
      .finally(() => setLoadingTree(false));
  }, []);

  async function loadNode(uri: string) {
    setLoadingContent(true);
    setSelectedUri(uri);
    try {
      const stat = await ovStat(uri);
      const statResult = (stat.result ?? {}) as Record<string, unknown>;
      const isDir = Boolean(statResult.is_dir ?? statResult.isDir);
      setSelectedIsDir(isDir);
      if (isDir) {
        setContent("");
      } else {
        const read = await ovRead(uri, false);
        setContent(asText(read.result));
      }
      const abs = await ovAbstract(uri);
      setAbstractText(asText(abs.result));
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setLoadingContent(false);
    }
  }

  async function handleSave() {
    if (!selectedUri || selectedIsDir) return;
    setSaving(true);
    try {
      await ovWrite(selectedUri, content, "replace");
      setToast("Saved", "success");
    } catch (err: unknown) {
      setToast(String(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!selectedUri) return;
    const name = selectedUri.split("/").filter(Boolean).pop() ?? selectedUri;
    setDialog({
      title: "Delete entry?",
      description: `This will permanently delete "${name}". This action cannot be undone.`,
      confirmLabel: "Delete",
      confirmDanger: true,
      onCancel: () => setDialog(null),
      onConfirm: async () => {
        setDialog(null);
        try {
          await ovDelete(selectedUri, true);
          setSelectedUri(null);
          setContent("");
          setAbstractText("");
          await refreshTree();
          setToast("Deleted", "success");
        } catch (err: unknown) {
          setToast(String(err), "error");
        }
      },
    });
  }

  function openNewDirDialog() {
    const parent = inferParentUri(selectedUri, "viking://user/default/memories/");
    setDialog({
      title: "New directory",
      placeholder: "Directory name…",
      confirmLabel: "Create",
      onCancel: () => setDialog(null),
      onConfirm: async (name) => {
        setDialog(null);
        try {
          await ovMkdir(`${parent}${name}`);
          await refreshTree();
          setToast("Directory created", "success");
        } catch (err: unknown) {
          setToast(String(err), "error");
        }
      },
    });
  }

  function openNewFileDialog() {
    const parent = inferParentUri(selectedUri, "viking://user/default/memories/");
    setDialog({
      title: "New file",
      placeholder: "File name…",
      confirmLabel: "Create",
      onCancel: () => setDialog(null),
      onConfirm: async (name) => {
        setDialog(null);
        try {
          await ovWrite(`${parent}${name}`, "", "create");
          await refreshTree();
          setToast("File created", "success");
        } catch (err: unknown) {
          setToast(String(err), "error");
        }
      },
    });
  }

  const subtitle = useMemo(() => {
    if (!selectedUri) return "Select an entry";
    return selectedIsDir ? `${selectedUri} (directory)` : selectedUri;
  }, [selectedUri, selectedIsDir]);

  const motionProps = prefersReduced ? {} : FADE;
  const motionT     = prefersReduced ? { duration: 0 } : FADE_T;

  return (
    <>
      <div className="page split-2">
        {/* ── Left panel: file tree ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">OpenViking</span>
            <div className="toolbar">
              <button onClick={openNewDirDialog} aria-label="New directory">+ Dir</button>
              <button onClick={openNewFileDialog} aria-label="New file">+ File</button>
            </div>
          </div>
          <div className="card-body no-padding" style={{ padding: 8 }}>
            <AnimatePresence mode="wait" initial={false}>
              {loadingTree ? (
                <motion.div key="skel" {...motionProps} transition={motionT}>
                  <SkeletonList count={8} />
                </motion.div>
              ) : (
                <motion.div key="tree" {...motionProps} transition={motionT}>
                  <FileTree
                    nodes={nodes}
                    selectedUri={selectedUri}
                    onSelect={(uri) =>
                      loadNode(uri).catch((err: unknown) => setToast(String(err), "error"))
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Right panel: content viewer/editor ── */}
        <div className="card">
          <div className="card-header">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title">Content</div>
              <div className="card-subtitle" title={subtitle}>{subtitle}</div>
            </div>
            <div className="toolbar">
              <div className="btn-group" role="group" aria-label="View mode">
                {(["raw", "preview", "abstract"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={viewMode === mode ? "active" : ""}
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              {viewMode !== "abstract" && !selectedIsDir && selectedUri ? (
                <button
                  className="primary"
                  onClick={handleSave}
                  disabled={saving || !selectedUri}
                  aria-label="Save (Ctrl+S)"
                >
                  {saving ? <Spinner size="sm" /> : "Save"}
                </button>
              ) : null}
              {selectedUri ? (
                <button className="danger" onClick={handleDelete} aria-label="Delete entry">
                  Delete
                </button>
              ) : null}
            </div>
          </div>

          <div className="card-body no-padding">
            <AnimatePresence mode="wait" initial={false}>
              {loadingContent ? (
                <motion.div key="skel-content" {...motionProps} transition={motionT}>
                  <SkeletonEditor lines={14} />
                </motion.div>
              ) : !selectedUri ? (
                <motion.div key="empty" {...motionProps} transition={motionT}>
                  <div className="empty-state">
                    <span className="empty-state-icon">📂</span>
                    <span className="empty-state-title">Nothing selected</span>
                    <span className="empty-state-desc">Select a file or directory in the tree.</span>
                  </div>
                </motion.div>
              ) : viewMode === "abstract" ? (
                <motion.div key="abstract" {...motionProps} transition={motionT}>
                  <textarea
                    className="editor"
                    style={{ border: "none", borderRadius: 0, outline: "none" }}
                    readOnly
                    value={abstractText}
                  />
                </motion.div>
              ) : viewMode === "preview" ? (
                <motion.div key="preview" {...motionProps} transition={motionT}>
                  <MarkdownPreview content={content} />
                </motion.div>
              ) : (
                <motion.div key="raw" {...motionProps} transition={motionT}>
                  <textarea
                    className="editor"
                    style={{ border: "none", borderRadius: 0, outline: "none" }}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    spellCheck={false}
                    aria-label="File content editor"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Dialog config={dialog} />
    </>
  );
}
