"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAttachmentSignedUrl,
  listEntityAttachments,
  uploadEntityAttachment,
} from "@/lib/attachments";
import { glassIconBtn } from "@/lib/liquid-glass-styles";

type Props = {
  companyId: string;
  documentId: string;
  canUpload?: boolean;
  refreshKey?: number;
  onUploaded?: () => void;
};

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

/** Ícone de clipe para anexar/abrir a digitalização do documento. */
export function ComplianceDocumentClip({
  companyId,
  documentId,
  canUpload = true,
  refreshKey = 0,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [count, setCount] = useState(0);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { attachments } = await listEntityAttachments({
      companyId,
      entityType: "compliance_document",
      entityId: documentId,
    });
    setCount(attachments.length);
    const last = attachments[0];
    if (last) {
      setLatestUrl(await getAttachmentSignedUrl(last.storage_path));
    } else {
      setLatestUrl(null);
    }
  }, [companyId, documentId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const openLatest = async () => {
    if (!latestUrl) return;
    setOpening(true);
    window.open(latestUrl, "_blank", "noopener,noreferrer");
    setOpening(false);
  };

  return (
    <div className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/jpg"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || !canUpload) return;
          setUploading(true);
          const { error } = await uploadEntityAttachment({
            companyId,
            entityType: "compliance_document",
            entityId: documentId,
            file,
            description: "Documento / licença",
          });
          setUploading(false);
          if (error) {
            window.alert(error);
            return;
          }
          await refresh();
          onUploaded?.();
        }}
      />
      {canUpload ? (
        <button
          type="button"
          title={
            uploading
              ? "Enviando…"
              : count > 0
                ? `Anexar outra digitalização (${count} arquivo(s))`
                : "Anexar digitalização (PDF/JPG/PNG)"
          }
          aria-label="Anexar digitalização do documento"
          disabled={uploading}
          className={glassIconBtn()}
          onClick={() => inputRef.current?.click()}
        >
          <PaperclipIcon className="h-4 w-4" />
          {count > 0 ? (
            <span className="ml-0.5 text-[10px] font-semibold tabular-nums">{count}</span>
          ) : null}
        </button>
      ) : count > 0 ? (
        <button
          type="button"
          title="Abrir digitalização"
          aria-label="Abrir digitalização"
          disabled={opening || !latestUrl}
          className={glassIconBtn()}
          onClick={() => void openLatest()}
        >
          <PaperclipIcon className="h-4 w-4" />
          <span className="ml-0.5 text-[10px] font-semibold tabular-nums">{count}</span>
        </button>
      ) : (
        <span className="text-xs text-slate-400" title="Sem anexo">
          —
        </span>
      )}
    </div>
  );
}
