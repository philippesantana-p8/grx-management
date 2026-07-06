"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  deleteEntityAttachment,
  getAttachmentSignedUrl,
  listEntityAttachments,
  type Attachment,
  type AttachmentEntityType,
} from "@/lib/attachments";

type Props = {
  companyId: string;
  entityType: AttachmentEntityType;
  entityId: string | null;
  refreshKey?: number;
  pendingPreviews?: Array<{ url: string; name: string }>;
  title?: string;
  hint?: string;
};

type AttachmentView = Attachment & { signedUrl: string | null };

export function AttachmentGallery({
  companyId,
  entityType,
  entityId,
  refreshKey = 0,
  pendingPreviews = [],
  title = "Galeria de documentos",
  hint = "Imagens digitalizadas vinculadas a este registro.",
}: Props) {
  const [items, setItems] = useState<AttachmentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entityId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { attachments, error: listError } = await listEntityAttachments({
      companyId,
      entityType,
      entityId,
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
  }, [companyId, entityId, entityType]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleDelete = async (attachment: AttachmentView) => {
    if (!confirm(`Excluir o arquivo "${attachment.file_name}"?`)) return;
    const deleteError = await deleteEntityAttachment(attachment);
    if (deleteError) setError(deleteError);
    else await load();
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4">
      <div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!entityId && pendingPreviews.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-amber-700">
            {pendingPreviews.length} imagem(ns) serão enviadas à galeria ao salvar o cadastro.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pendingPreviews.map((preview) => (
              <div key={preview.url} className="space-y-1">
                <p className="text-xs font-medium text-slate-600">{preview.name}</p>
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="max-h-40 rounded-md border border-slate-200 object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {!entityId && pendingPreviews.length === 0 && (
        <p className="text-sm text-slate-500">Salve o registro para visualizar os anexos.</p>
      )}

      {entityId && loading && <p className="text-sm text-slate-500">Carregando galeria...</p>}

      {entityId && !loading && items.length === 0 && (
        <p className="text-sm text-slate-500">Nenhum documento anexado ainda.</p>
      )}

      {entityId && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
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
                {item.description && (
                  <p className="text-xs text-slate-500">{item.description}</p>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleDelete(item)}>
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
