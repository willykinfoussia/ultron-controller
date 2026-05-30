import { useEffect, useState } from "react";

import {
  deleteMemoryFile,
  listMemoryFiles,
  listPinnedFiles,
  readMemoryFile,
  readPinnedFile,
  writeMemoryFile,
  writePinnedFile,
  type MemoryFile
} from "../api/client";
import { ContentEditor } from "../components/ContentEditor";

type MemoryPageProps = {
  setToast: (message: string) => void;
};

type SelectedFile = {
  name: string;
  kind: "memory" | "pinned";
};

export function MemoryPage({ setToast }: MemoryPageProps) {
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<MemoryFile[]>([]);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [content, setContent] = useState("");

  async function refresh() {
    const [memories, pinned] = await Promise.all([listMemoryFiles(), listPinnedFiles()]);
    setMemoryFiles(memories.files);
    setPinnedFiles(pinned.files);
  }

  useEffect(() => {
    refresh().catch((error: unknown) => setToast(String(error)));
  }, []);

  async function loadFile(file: SelectedFile) {
    setSelected(file);
    if (file.kind === "memory") {
      const result = await readMemoryFile(file.name);
      setContent(result.content || "");
      return;
    }
    const result = await readPinnedFile(file.name);
    setContent(result.content || "");
  }

  return (
    <div className="page split-2">
      <div className="card">
        <div className="card-header">
          <strong>Hermes Memory</strong>
          <button
            onClick={async () => {
              const name = window.prompt("New memory file name (example.md)");
              if (!name) return;
              await writeMemoryFile(name, `# ${name}\n\n`);
              await refresh();
              setToast("Memory file created");
            }}
          >
            +New
          </button>
        </div>
        <div className="card-content">
          <p className="muted">Pinned files</p>
          <div className="list">
            {pinnedFiles.map((file) => (
              <div
                key={file.name}
                className={`list-item ${
                  selected?.name === file.name && selected?.kind === "pinned" ? "active" : ""
                }`}
                onClick={() => loadFile({ name: file.name, kind: "pinned" }).catch((e) => setToast(String(e)))}
              >
                <div>{file.name}</div>
                <div className="muted">{file.exists ? "present" : "missing"}</div>
              </div>
            ))}
          </div>
          <p className="muted">Memories</p>
          <div className="list">
            {memoryFiles.map((file) => (
              <div
                key={file.name}
                className={`list-item ${
                  selected?.name === file.name && selected?.kind === "memory" ? "active" : ""
                }`}
                onClick={() => loadFile({ name: file.name, kind: "memory" }).catch((e) => setToast(String(e)))}
              >
                <div>{file.name}</div>
                <div className="muted">{file.size} B</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ContentEditor
        title="Memory Editor"
        subtitle={selected ? `${selected.kind}: ${selected.name}` : "Select file"}
        value={content}
        onChange={setContent}
        onSave={async () => {
          if (!selected) return;
          if (selected.kind === "memory") {
            await writeMemoryFile(selected.name, content);
          } else {
            await writePinnedFile(selected.name, content);
          }
          await refresh();
          setToast("Saved");
        }}
        onDelete={
          selected?.kind === "memory"
            ? async () => {
                if (!selected) return;
                await deleteMemoryFile(selected.name);
                setSelected(null);
                setContent("");
                await refresh();
                setToast("Deleted");
              }
            : undefined
        }
        disableDelete={selected?.kind !== "memory"}
      />
    </div>
  );
}
