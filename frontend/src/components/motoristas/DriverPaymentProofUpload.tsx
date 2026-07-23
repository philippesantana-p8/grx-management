"use client";

import { useRef, useState } from "react";
import {
  DRIVER_PAYMENT_PROOF_DESCRIPTION,
  uploadDriverPaymentProof,
} from "@/lib/driver-payments-api";
import { glassAction, glassIconBtn } from "@/lib/liquid-glass-styles";
import { getAttachmentSignedUrl, listEntityAttachments } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";

type Props = {
  companyId: string;
  orderId: string;
  orderCode: string;
  proofCount: number;
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

export function DriverPaymentProofUpload({
  companyId,
  orderId,
  orderCode,
  proofCount,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const { error } = await uploadDriverPaymentProof({
      companyId,
      orderId,
      file,
    });
    setUploading(false);

    if (error) {
      window.alert(error);
      return;
    }

    onUploaded?.();
  };

  const handleViewLatest = async () => {
    setOpening(true);
    const supabase = createClient();
    const { attachments, error } = await listEntityAttachments({
      companyId,
      entityType: "service_order",
      entityId: orderId,
    });
    setOpening(false);

    if (error) {
      window.alert(error);
      return;
    }

    const proof = attachments.find((item) => item.description === DRIVER_PAYMENT_PROOF_DESCRIPTION);
    if (!proof) {
      window.alert("Nenhum comprovante encontrado para esta OS.");
      return;
    }

    const url = await getAttachmentSignedUrl(proof.storage_path);
    if (!url) {
      window.alert("Não foi possível abrir o comprovante.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        aria-label={`Anexar comprovante OS ${orderCode}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        title="Anexar comprovante de pagamento"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={glassIconBtn()}
      >
        <PaperclipIcon className="h-4 w-4" />
      </button>
      {proofCount > 0 ? (
        <button
          type="button"
          disabled={opening}
          onClick={() => void handleViewLatest()}
          className={glassAction("brand", true)}
        >
          {opening ? "Abrindo…" : `${proofCount} anexo${proofCount === 1 ? "" : "s"}`}
        </button>
      ) : (
        <span className="text-xs text-slate-400">{uploading ? "Enviando…" : "Sem anexo"}</span>
      )}
    </div>
  );
}
