"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  deleteEntityAttachment,
  getAttachmentSignedUrl,
  listEntityAttachments,
  uploadEntityAttachment,
  type Attachment,
} from "@/lib/attachments";
import {
  DRIVER_DOC_FOLDERS,
  driverDocDescription,
  resolveDriverDocFolder,
  type DriverDocFolderKey,
} from "@/lib/driver-document-folders";
import { glassIconBtn, glassTabLink, glassTabsNav } from "@/lib/liquid-glass-styles";

export type PendingDriverFolderDoc = {
  file: File;
  previewUrl: string;
  label: string;
  folder: DriverDocFolderKey;
};

type Props = {
  companyId: string;
  driverId: string | null;
  refreshKey?: number;
  pendingDocs?: PendingDriverFolderDoc[];
  onPendingDocsChange?: (docs: PendingDriverFolderDoc[]) => void;
  disabled?: boolean;
};

type AttachmentView = Attachment & { signedUrl: string | null };

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function DriverDocumentFolders({
  companyId,
  driverId,
  refreshKey = 0,
  pendingDocs = [],
  onPendingDocsChange,
  disabled = false,
}: Props) {
  const [folder, setFolder] = useState<DriverDocFolderKey>("CNH");
  const [items, setItems] = useState<AttachmentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!driverId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { attachments, error: listError } = await listEntityAttachments({
      companyId,
      entityType: "driver",
      entityId: driverId,
    });
    if (listError) {
      setError(listError);
      setItems([]);
      setLoading(false);
      return;
    }
    const withUrls = await Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        signedUrl: await getAttachmentSignedUrl(attachment.storage_path),
      }))
    );
    setItems(withUrls);
    setLoading(false);
  }, [companyId, driverId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const counts = useMemo(() => {
    const map: Record<DriverDocFolderKey | "outros", number> = {
      CNH: 0,
      "CNH-AVC": 0,
      outros: 0,
    };
    for (const item of items) {
      map[resolveDriverDocFolder(item.description)] += 1;
    }
    for (const p of pendingDocs) {
      map[p.folder] += 1;
    }
    return map;
  }, [items, pendingDocs]);

  const folderItems = useMemo(
    () => items.filter((item) => resolveDriverDocFolder(item.description) === folder),
    [items, folder]
  );

  const folderPending = useMemo(
    () => pendingDocs.filter((p) => p.folder === folder),
    [pendingDocs, folder]
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    setError(null);
    const list = Array.from(files);

    if (!driverId) {
      const next: PendingDriverFolderDoc[] = [
        ...pendingDocs,
        ...list.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
          label: file.name,
          folder,
        })),
      ];
      onPendingDocsChange?.(next);
      return;
    }

    setUploading(true);
    let ok = 0;
    for (const file of list) {
      const { error: upErr } = await uploadEntityAttachment({
        companyId,
        entityType: "driver",
        entityId: driverId,
        file,
        description: driverDocDescription(folder, file.name),
      });
      if (!upErr) ok += 1;
      else setError(upErr);
    }
    setUploading(false);
    if (ok > 0) await load();
  };

  const handleDelete = async (attachment: AttachmentView) => {
    if (!confirm(`Excluir o arquivo "${attachment.file_name}"?`)) return;
    const deleteError = await deleteEntityAttachment(attachment);
    if (deleteError) setError(deleteError);
    else await load();
  };

  const activeMeta = DRIVER_DOC_FOLDERS.find((f) => f.key === folder)!;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4">
      <div>
        <p className="text-sm font-medium text-slate-800">Documentos do motorista</p>
        <p className="text-xs text-slate-500">
          Subpastas CNH e CNH-AVC para acompanhar cada tipo de documentação.
        </p>
      </div>

      <nav className={glassTabsNav()} aria-label="Pastas de documentos do motorista">
        {DRIVER_DOC_FOLDERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFolder(f.key)}
            className={glassTabLink(folder === f.key)}
          >
            {f.label}
            <span className="ml-1 tabular-nums opacity-80">({counts[f.key]})</span>
          </button>
        ))}
        {counts.outros > 0 ? (
          <span className="self-center text-xs text-slate-500">
            +{counts.outros} outro(s) sem pasta
          </span>
        ) : null}
      </nav>

      <p className="text-xs text-slate-500">{activeMeta.hint}</p>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className={glassIconBtn()}
          title={`Anexar em ${folder}`}
          aria-label={`Anexar em ${folder}`}
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          <PaperclipIcon className="h-4 w-4" />
        </button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Enviando…" : `Adicionar em ${folder}`}
        </Button>
      </div>

      {!driverId && folderPending.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-700">
            {folderPending.length} arquivo(s) em {folder} serão enviados ao salvar o motorista.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {folderPending.map((preview) => (
              <div key={preview.previewUrl} className="space-y-1">
                <p className="text-xs font-medium text-slate-600">{preview.label}</p>
                {preview.file.type.startsWith("image/") ? (
                  <img
                    src={preview.previewUrl}
                    alt={preview.label}
                    className="max-h-40 rounded-md border border-slate-200 object-contain"
                  />
                ) : (
                  <p className="text-xs text-slate-500">PDF: {preview.file.name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!driverId && folderPending.length === 0 ? (
        <p className="text-sm text-slate-500">
          Salve o motorista ou selecione arquivos nesta pasta — o envio grava na subpasta{" "}
          {folder}.
        </p>
      ) : null}

      {driverId && loading ? (
        <p className="text-sm text-slate-500">Carregando pasta {folder}…</p>
      ) : null}

      {driverId && !loading && folderItems.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum arquivo nesta pasta ainda.</p>
      ) : null}

      {driverId && folderItems.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {folderItems.map((item) => (
            <div key={item.id} className="space-y-2 rounded-md border border-slate-200 p-2">
              {item.signedUrl && item.mime_type?.startsWith("image/") ? (
                <a href={item.signedUrl} target="_blank" rel="noreferrer">
                  <img
                    src={item.signedUrl}
                    alt={item.file_name}
                    className="h-36 w-full rounded object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-36 items-center justify-center rounded bg-slate-100 text-xs text-slate-500">
                  {item.file_name}
                </div>
              )}
              <div className="space-y-1">
                <p className="truncate text-xs font-medium text-slate-700">{item.file_name}</p>
                {item.description ? (
                  <p className="text-xs text-slate-500">{item.description}</p>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(item)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
