"use client";

import {
  ChevronRight,
  Code2,
  Copy,
  FileCode2,
  Folder,
  PanelLeft,
  RefreshCw,
  Save,
  Search,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type UIEvent, use, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Alert, Badge, LoadingState } from "../../components/ui/display";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/form";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import type { ThemeDraftSummary, ThemeInstallationSummary, WebsiteSummary } from "./types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

export function ThemeCodeEditorPage({
  params,
}: {
  params: Promise<{ id: string; themeId: string }>;
}) {
  const { id: websiteId, themeId } = use(params);
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [theme, setTheme] = useState<ThemeInstallationSummary | null>(null);
  const [draft, setDraft] = useState<ThemeDraftSummary | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const lineNumberRef = useRef<HTMLDivElement | null>(null);

  const paths = useMemo(() => Object.keys(draft?.files ?? {}).sort(), [draft]);
  const filteredPaths = useMemo(() => {
    const normalized = fileSearch.trim().toLowerCase();
    return paths.filter((path) => !normalized || path.toLowerCase().includes(normalized));
  }, [fileSearch, paths]);

  const fileTree = useMemo(() => buildFileTree(filteredPaths), [filteredPaths]);

  function toggleFolder(path: string) {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, tenantResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
        ]);
        setMe(meResponse);
        setTenants(tenantResponse);
        if (!meResponse.activeTenant) {
          router.push("/login");
          return;
        }

        const [websiteResponse, themesResponse, draftResponse] = await Promise.all([
          apiRequest<WebsiteSummary>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}`),
          apiRequest<ThemeInstallationSummary[]>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}/themes`),
          apiRequest<ThemeDraftSummary>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}/themes/${themeId}/draft`),
        ]);
        const themeResponse = themesResponse.find((item) => item.id === themeId) ?? null;
        const firstPath = Object.keys(draftResponse.files).sort()[0] ?? "";
        setWebsite(websiteResponse);
        setTheme(themeResponse);
        setDraft(draftResponse);
        setCollapsedFolders(new Set(collectFolderPaths(Object.keys(draftResponse.files))));
        setSelectedFilePath(firstPath);
        setFileContent(firstPath ? draftResponse.files[firstPath] ?? "" : "");
        setOpenFiles(firstPath ? [firstPath] : []);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Theme editor failed to load");
      }
    }

    void load();
  }, [router, themeId, websiteId]);

  function selectFile(path: string) {
    if (unsaved && !window.confirm("Discard unsaved file changes?")) {
      return;
    }
    setSelectedFilePath(path);
    setFileContent(draft?.files[path] ?? "");
    setOpenFiles((current) => (current.includes(path) ? current : [...current, path].slice(-6)));
    setUnsaved(false);
  }

  function closeFile(path: string) {
    const nextOpenFiles = openFiles.filter((file) => file !== path);
    setOpenFiles(nextOpenFiles);
    if (path === selectedFilePath) {
      const nextPath = nextOpenFiles[nextOpenFiles.length - 1] ?? paths[0] ?? "";
      setSelectedFilePath(nextPath);
      setFileContent(nextPath ? draft?.files[nextPath] ?? "" : "");
      setUnsaved(false);
    }
  }

  async function saveFile() {
    if (!me?.activeTenant || !draft || !selectedFilePath) return;
    setSaving(true);
    setError(null);
    try {
      const nextDraft = await apiRequest<ThemeDraftSummary>(
        `/tenants/${me.activeTenant.id}/websites/${websiteId}/themes/${themeId}/files`,
        {
          method: "PATCH",
          body: JSON.stringify({
            path: selectedFilePath,
            content: fileContent,
            expectedRevision: draft.revision,
          }),
        },
      );
      setDraft(nextDraft);
      setUnsaved(false);
      toast.success("Saved to draft");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "File save failed");
    } finally {
      setSaving(false);
    }
  }

  function syncEditorScroll(event: UIEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
    if (lineNumberRef.current) {
      lineNumberRef.current.scrollTop = target.scrollTop;
    }
  }

  if (!me || !website || !draft) {
    return <LoadingState label="Loading theme code editor" />;
  }

  return (
    <main className="grid h-svh grid-rows-[48px_minmax(0,1fr)_28px] overflow-hidden bg-[#0f1117] text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-800 bg-[#181b22] px-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Code2 className="size-4 text-sky-300" />
          <span>{theme?.name ?? "Theme code"}</span>
        </div>
        <ChevronRight className="size-4 text-slate-500" />
        <Link className="text-sm text-slate-300 hover:text-white" href={`/websites/${websiteId}/themes`}>
          {website.name}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone={theme?.status === "PUBLISHED" ? "success" : "warning"}>{theme?.status.toLowerCase() ?? "draft"}</Badge>
          <Button type="button" size="sm" variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Reload
          </Button>
          <Button type="button" size="sm" disabled={!unsaved || saving} onClick={() => void saveFile()}>
            <Save className="size-4" />
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </header>

      <section className="grid min-h-0 grid-cols-[48px_280px_minmax(0,1fr)] overflow-hidden xl:grid-cols-[48px_300px_minmax(0,1fr)_360px]">
        <aside className="grid content-start justify-items-center gap-3 border-r border-slate-800 bg-[#151820] py-3">
          <button className="grid size-9 place-items-center rounded-md bg-slate-800 text-sky-300" type="button" aria-label="Explorer">
            <PanelLeft className="size-5" />
          </button>
          <button className="grid size-9 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white" type="button" aria-label="Search">
            <Search className="size-5" />
          </button>
          <button className="grid size-9 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white" type="button" aria-label="Split">
            <SplitSquareHorizontal className="size-5" />
          </button>
        </aside>

        <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-r border-slate-800 bg-[#11151d]">
          <div className="border-b border-slate-800 p-3">
            <p className="text-xs font-bold uppercase text-slate-400">Explorer</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                className="h-9 border-slate-700 bg-[#0d1117] pl-9 text-slate-100 placeholder:text-slate-500"
                value={fileSearch}
                onChange={(event) => setFileSearch(event.target.value)}
                placeholder="Search files"
                type="search"
              />
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-2 pb-10">
            {fileTree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                depth={0}
                collapsedFolders={collapsedFolders}
                selectedFilePath={selectedFilePath}
                onToggleFolder={toggleFolder}
                onSelectFile={selectFile}
              />
            ))}
          </div>
        </aside>

        <section className="grid min-w-0 grid-rows-[40px_minmax(0,1fr)] bg-[#0d1117]">
          <div className="flex min-w-0 overflow-x-auto border-b border-slate-800 bg-[#11151d]">
            {openFiles.map((path) => (
              <button
                key={path}
                type="button"
                className={`flex min-w-48 items-center justify-between gap-3 border-r border-slate-800 px-3 text-sm ${
                  path === selectedFilePath ? "bg-[#0d1117] text-white" : "bg-[#151820] text-slate-400"
                }`}
                onClick={() => selectFile(path)}
              >
                <span className="truncate">{path}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded p-0.5 hover:bg-slate-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeFile(path);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      closeFile(path);
                    }
                  }}
                >
                  <X className="size-3" />
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-h-0 overflow-hidden">
            <div ref={lineNumberRef} className="absolute inset-y-0 left-0 w-14 overflow-hidden border-r border-slate-800 bg-[#0b0f14] py-4 text-right font-mono text-sm leading-6 text-slate-600">
              {fileContent.split("\n").map((_, index) => (
                <div key={`line-${index}`} className="pr-3">{index + 1}</div>
              ))}
            </div>
            <pre ref={highlightRef} className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words py-4 pl-20 pr-5 font-mono text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
              <code dangerouslySetInnerHTML={{ __html: highlightCode(fileContent) }} />
            </pre>
            <textarea
              className="absolute inset-0 h-full w-full resize-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words bg-transparent py-4 pl-20 pr-5 font-mono text-sm leading-6 text-transparent caret-white outline-none selection:bg-sky-500/35 [overflow-wrap:anywhere]"
              spellCheck={false}
              wrap="soft"
              value={fileContent}
              onScroll={syncEditorScroll}
              onChange={(event) => {
                setFileContent(event.target.value);
                setUnsaved(true);
              }}
            />
          </div>
        </section>

        <aside className="hidden min-h-0 border-l border-slate-800 bg-[#11151d] p-4 xl:block">
          <p className="text-xs font-bold uppercase text-slate-400">Theme draft</p>
          <div className="mt-3 grid gap-3">
            <InfoRow label="Revision" value={String(draft.revision)} />
            <InfoRow label="Selected" value={selectedFilePath || "None"} />
            <InfoRow label="Files" value={String(paths.length)} />
            <InfoRow label="Open tabs" value={String(openFiles.length)} />
          </div>
          {error ? <div className="mt-4"><Alert tone="danger">{error}</Alert></div> : null}
          <div className="mt-5 rounded-lg border border-slate-800 bg-[#0d1117] p-3">
            <p className="text-sm font-semibold text-slate-100">Draft-only editing</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Saving changes updates this theme draft. Visitors only see a published version.
            </p>
          </div>
          <Button
            type="button"
            className="mt-4 w-full"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(selectedFilePath).then(() => toast.success("Path copied"))}
          >
            <Copy className="size-4" />
            Copy path
          </Button>
        </aside>
      </section>

      <footer className="flex items-center gap-4 border-t border-slate-800 bg-sky-700 px-3 text-xs text-white">
        <span>{me.user.email}</span>
        <span>{tenants.find((tenant) => tenant.id === me.activeTenant?.id)?.name ?? "Workspace"}</span>
        <span className="ml-auto">{unsaved ? "Unsaved changes" : "Draft clean"}</span>
        <span>{selectedFilePath}</span>
      </footer>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0d1117] p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

type FileTreeEntry =
  | { type: "folder"; name: string; path: string; children: FileTreeEntry[] }
  | { type: "file"; name: string; path: string };

/** Every ancestor directory of every path — used to seed collapsedFolders so the tree opens collapsed by default. */
function collectFolderPaths(paths: string[]): string[] {
  const folders = new Set<string>();
  for (const path of paths) {
    const parts = path.split("/");
    let current = "";
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i] ?? "";
      current = current ? `${current}/${part}` : part;
      folders.add(current);
    }
  }
  return [...folders];
}

/**
 * Mirrors the uploaded theme's real folder structure exactly (sections/Header/, sections/Header/variants/,
 * sections/Footer/, ...) rather than bucketing every file under just its top-level directory — a theme with
 * subfolders per section otherwise dumps hundreds of files into one flat "sections" list with no way to tell
 * which section, or which of header/footer/variants, any given file belongs to.
 */
function buildFileTree(paths: string[]): FileTreeEntry[] {
  const root: FileTreeEntry[] = [];
  for (const path of paths) {
    const parts = path.split("/");
    let siblings = root;
    let builtPath = "";
    parts.forEach((part, index) => {
      builtPath = builtPath ? `${builtPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      if (isFile) {
        siblings.push({ type: "file", name: part, path: builtPath });
        return;
      }
      let folder = siblings.find((entry): entry is Extract<FileTreeEntry, { type: "folder" }> => entry.type === "folder" && entry.name === part);
      if (!folder) {
        folder = { type: "folder", name: part, path: builtPath, children: [] };
        siblings.push(folder);
      }
      siblings = folder.children;
    });
  }
  sortFileTree(root);
  return root;
}

function sortFileTree(entries: FileTreeEntry[]) {
  entries.sort((first, second) => {
    if (first.type !== second.type) return first.type === "folder" ? -1 : 1;
    return first.name.localeCompare(second.name);
  });
  for (const entry of entries) if (entry.type === "folder") sortFileTree(entry.children);
}

function FileTreeNode({
  node,
  depth,
  collapsedFolders,
  selectedFilePath,
  onToggleFolder,
  onSelectFile,
}: {
  node: FileTreeEntry;
  depth: number;
  collapsedFolders: Set<string>;
  selectedFilePath: string;
  onToggleFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
}) {
  const indent = 12 + depth * 14;

  if (node.type === "file") {
    return (
      <button
        type="button"
        style={{ paddingLeft: indent }}
        className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-3 text-left text-sm ${
          node.path === selectedFilePath ? "bg-sky-500/15 text-sky-100" : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
        }`}
        onClick={() => onSelectFile(node.path)}
      >
        <FileCode2 className="size-4 shrink-0 text-amber-300" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  const isOpen = !collapsedFolders.has(node.path);
  return (
    <div>
      <button
        type="button"
        style={{ paddingLeft: indent - 4 }}
        className="flex w-full items-center gap-1.5 rounded-md py-1 pr-3 text-left text-[13px] font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
        onClick={() => onToggleFolder(node.path)}
      >
        <ChevronRight className={`size-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        <Folder className="size-4 shrink-0 text-sky-400" />
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen
        ? node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              collapsedFolders={collapsedFolders}
              selectedFilePath={selectedFilePath}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
            />
          ))
        : null}
    </div>
  );
}

function highlightCode(value: string) {
  return escapeHtml(value)
    .replace(/\b(export|const|function|return|import|from|type|interface|as|if|else|new|class)\b/g, "<span class=\"text-fuchsia-300\">$1</span>")
    .replace(/(&quot;.*?&quot;|'.*?'|`.*?`)/g, "<span class=\"text-emerald-300\">$1</span>")
    .replace(/\b(true|false|null|undefined)\b/g, "<span class=\"text-amber-300\">$1</span>")
    .replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, "<span class=\"text-sky-300\">$1</span>")
    .replace(/(\/\/.*)$/gm, "<span class=\"text-slate-500\">$1</span>");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
