import { useEffect, useMemo, useState } from "react";

import {
  ovAbstract,
  ovDelete,
  ovMkdir,
  ovRead,
  ovStat,
  ovTree,
  ovWrite,
  type OvNode
} from "../api/client";
import { ContentEditor } from "../components/ContentEditor";
import { FileTree } from "../components/FileTree";

type OpenVikingPageProps = {
  setToast: (message: string) => void;
};

type ViewMode = "raw" | "markdown" | "abstract";

function asText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

function inferParentUri(selectedUri: string | null, fallback: string): string {
  if (!selectedUri) {
    return fallback;
  }
  const hasTrailingSlash = selectedUri.endsWith("/");
  if (hasTrailingSlash) {
    return selectedUri;
  }
  const index = selectedUri.lastIndexOf("/");
  if (index < 0) {
    return fallback;
  }
  return `${selectedUri.slice(0, index + 1)}`;
}

export function OpenVikingPage({ setToast }: OpenVikingPageProps) {
  const [nodes, setNodes] = useState<OvNode[]>([]);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [selectedIsDir, setSelectedIsDir] = useState(false);
  const [content, setContent] = useState("");
  const [abstractText, setAbstractText] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("raw");

  async function refreshTree() {
    const data = await ovTree("viking://", 3);
    setNodes(data.result ?? []);
  }

  useEffect(() => {
    refreshTree().catch((error: unknown) => setToast(String(error)));
  }, []);

  async function loadNode(uri: string) {
    setSelectedUri(uri);
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
  }

  const subtitle = useMemo(() => {
    if (!selectedUri) {
      return "Select an OpenViking entry";
    }
    return selectedIsDir ? `${selectedUri} (directory)` : selectedUri;
  }, [selectedUri, selectedIsDir]);

  return (
    <div className="page split-2">
      <div className="card">
        <div className="card-header">
          <strong>OpenViking</strong>
          <div className="toolbar">
            <button
              onClick={async () => {
                const name = window.prompt("New directory name");
                if (!name) return;
                const parent = inferParentUri(selectedUri, "viking://user/default/memories/");
                await ovMkdir(`${parent}${name}`);
                await refreshTree();
                setToast("Directory created");
              }}
            >
              +Dir
            </button>
            <button
              onClick={async () => {
                const name = window.prompt("New file name");
                if (!name) return;
                const parent = inferParentUri(selectedUri, "viking://user/default/memories/");
                await ovWrite(`${parent}${name}`, "", "create");
                await refreshTree();
                setToast("File created");
              }}
            >
              +File
            </button>
          </div>
        </div>
        <div className="card-content">
          <FileTree
            nodes={nodes}
            selectedUri={selectedUri}
            onSelect={(uri) => {
              loadNode(uri).catch((error: unknown) => setToast(String(error)));
            }}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div>Content</div>
            <div className="muted">{subtitle}</div>
          </div>
          <div className="toolbar">
            <button onClick={() => setViewMode("raw")} className={viewMode === "raw" ? "primary" : ""}>
              Raw
            </button>
            <button
              onClick={() => setViewMode("markdown")}
              className={viewMode === "markdown" ? "primary" : ""}
            >
              Markdown
            </button>
            <button
              onClick={() => setViewMode("abstract")}
              className={viewMode === "abstract" ? "primary" : ""}
            >
              Abstract
            </button>
          </div>
        </div>
        <div className="card-content">
          {viewMode === "abstract" ? (
            <textarea readOnly value={abstractText} />
          ) : (
            <ContentEditor
              title="OpenViking Editor"
              subtitle={subtitle}
              value={content}
              onChange={setContent}
              onSave={async () => {
                if (!selectedUri || selectedIsDir) return;
                await ovWrite(selectedUri, content, "replace");
                setToast("Saved");
              }}
              onDelete={
                selectedUri
                  ? async () => {
                      if (!selectedUri) return;
                      await ovDelete(selectedUri, true);
                      setSelectedUri(null);
                      setContent("");
                      setAbstractText("");
                      await refreshTree();
                      setToast("Deleted");
                    }
                  : undefined
              }
              disableDelete={!selectedUri}
              extraActions={selectedIsDir ? <span className="badge">Directory</span> : null}
            />
          )}
          {viewMode === "markdown" ? (
            <div className="card-content">
              <pre>{content}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
