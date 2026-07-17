"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Alert, Loading } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useCompany } from "@/lib/company-context";
import {
  adoptDefaultCompanyLogo,
  DEFAULT_COMPANY_LOGO_SRC,
  getCompanyLogoUrl,
  removeCompanyLogo,
  uploadCompanyLogo,
  validateCompanyLogoFile,
} from "@/lib/company-logo";
import { createClient } from "@/lib/supabase/client";

export default function EmpresaConfigPage() {
  const { company, companyId, loading: companyLoading, refresh } = useCompany();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [document, setDocument] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    setName(company.name ?? "");
    setTradeName(company.trade_name ?? "");
    setDocument(company.document ?? "");
    setLogoPath(company.logo_storage_path ?? null);
  }, [company]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const url = await getCompanyLogoUrl(logoPath);
      if (!cancelled) setLogoUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [logoPath]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase
      .from("companies")
      .update({
        name: name.trim(),
        trade_name: tradeName.trim() || null,
        document: document.trim() || null,
      })
      .eq("id", companyId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Dados da empresa salvos.");
    await refresh();
  };

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !companyId) return;

    const validation = validateCompanyLogoFile(file);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);
    const { path, error: uploadError } = await uploadCompanyLogo({
      companyId,
      file,
      previousPath: logoPath,
    });
    setUploading(false);

    if (uploadError || !path) {
      setError(uploadError ?? "Falha ao enviar o logo.");
      return;
    }

    setLogoPath(path);
    setMessage("Logo atualizado. Será usado no voucher, proposta e e-mails.");
    await refresh();
  };

  const handleRemoveLogo = async () => {
    if (!companyId || !logoPath) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    const removeError = await removeCompanyLogo({ companyId, storagePath: logoPath });
    setUploading(false);
    if (removeError) {
      setError(removeError);
      return;
    }
    setLogoPath(null);
    setLogoUrl(null);
    setMessage("Logo removido. Documentos voltam ao logo padrão até novo envio.");
    await refresh();
  };

  const handleAdoptVoucherLogo = async () => {
    if (!companyId) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    const { path, error: adoptError } = await adoptDefaultCompanyLogo({
      companyId,
      previousPath: logoPath,
    });
    setUploading(false);
    if (adoptError || !path) {
      setError(adoptError ?? "Falha ao gravar o logo do voucher.");
      return;
    }
    setLogoPath(path);
    setMessage("Logo do voucher (GRX) gravado na empresa. Já vale para voucher e proposta.");
    await refresh();
  };

  const previewSrc = logoUrl || DEFAULT_COMPANY_LOGO_SRC;

  if (companyLoading) {
    return <Loading />;
  }

  if (!companyId) {
    return <Alert variant="error">Empresa não encontrada. Conclua o cadastro em /setup.</Alert>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <div className="border-b border-slate-100 px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">Empresa</h1>
          <p className="mt-1 text-sm text-slate-500">
            Nome e logo do cliente (ex.: GRX). Aparecem no header, voucher do motorista e proposta.
          </p>
        </div>
        <CardHeader
          title="Dados cadastrais"
          description="Razão social, nome fantasia e CNPJ"
        />
        <CardBody>
          <form onSubmit={handleSave} className="space-y-4">
            {error ? <Alert variant="error">{error}</Alert> : null}
            {message ? <Alert variant="info">{message}</Alert> : null}
            <Input
              label="Razão social"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Nome fantasia (exibido no header e documentos)"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
            />
            <Input
              label="CNPJ"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar dados"}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Logo da empresa"
          description="O logo atual do voucher (GRX) já aparece abaixo. Você pode gravá-lo na empresa ou enviar outro arquivo."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-28 w-44 items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt="Logo da empresa"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="flex flex-col gap-2">
              {!logoPath ? (
                <Button
                  type="button"
                  disabled={uploading}
                  onClick={() => void handleAdoptVoucherLogo()}
                >
                  {uploading ? "Gravando..." : "Usar logo do voucher (GRX)"}
                </Button>
              ) : null}
              <label className="liquid-glass-btn liquid-glass-btn--secondary inline-flex cursor-pointer items-center justify-center px-4 py-2 text-sm font-semibold">
                {uploading ? "Enviando..." : "Enviar outro logo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleLogoChange}
                />
              </label>
              {logoPath ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={uploading}
                  onClick={() => void handleRemoveLogo()}
                >
                  Remover logo
                </Button>
              ) : (
                <p className="text-xs text-slate-500">
                  Pré-visualização = logo atual do voucher. Clique em gravar para registrar na empresa.
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">JPG, PNG ou WEBP · máx. 5 MB · bucket company-attachments</p>
        </CardBody>
      </Card>
    </div>
  );
}
