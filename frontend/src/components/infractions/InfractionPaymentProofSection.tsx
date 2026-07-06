"use client";

import { useRef, useState } from "react";
import { AttachmentGallery } from "@/components/drivers/AttachmentGallery";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { uploadEntityAttachment } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";

type Props = {
  companyId: string;
  infractionId: string | null;
  paymentProofStatus: string;
  onStatusChange: (patch: Record<string, unknown>) => void;
};

export function InfractionPaymentProofSection({
  companyId,
  infractionId,
  paymentProofStatus,
  onStatusChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleUpload = async (file: File) => {
    if (!infractionId) return;
    setUploading(true);
    setError(null);

    const { error: uploadError } = await uploadEntityAttachment({
      companyId,
      entityType: "traffic_infraction",
      entityId: infractionId,
      file,
      description: "Comprovante de pagamento da multa",
    });

    if (uploadError) {
      setError(uploadError);
      setUploading(false);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { error: updateError } = await supabase
      .from("traffic_infractions")
      .update({
        payment_proof_status: "Apresentado",
        payment_proof_received_at: today,
      })
      .eq("id", infractionId);

    if (updateError) {
      setError(updateError.message);
    } else {
      onStatusChange({
        payment_proof_status: "Apresentado",
        payment_proof_received_at: today,
      });
      setRefreshKey((k) => k + 1);
    }

    setUploading(false);
  };

  const markValidated = async () => {
    if (!infractionId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { error: updateError } = await supabase
      .from("traffic_infractions")
      .update({
        payment_proof_status: "Validado",
        payment_validated_at: today,
      })
      .eq("id", infractionId);

    if (updateError) setError(updateError.message);
    else {
      onStatusChange({
        payment_proof_status: "Validado",
        payment_validated_at: today,
      });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-medium text-slate-800">Comprovante de pagamento</p>
        <p className="text-xs text-slate-500">
          Anexe o comprovante apresentado pelo motorista para registrar a baixa no sistema.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!infractionId ? (
        <p className="text-sm text-amber-700">
          Salve a infração primeiro para anexar o comprovante de pagamento.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Enviando..." : "Anexar comprovante"}
            </Button>
            {paymentProofStatus === "Apresentado" && (
              <Button type="button" onClick={() => void markValidated()}>
                Validar comprovante
              </Button>
            )}
          </div>

          <AttachmentGallery
            companyId={companyId}
            entityType="traffic_infraction"
            entityId={infractionId}
            refreshKey={refreshKey}
            title="Comprovantes anexados"
            hint="PDF ou imagem do pagamento da multa."
          />
        </>
      )}
    </div>
  );
}
