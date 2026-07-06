"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { fetchAddressByCep, formatCep, normalizeCep } from "@/lib/cep";

type Props = {
  label: string;
  address: string;
  placeholder?: string;
  onAddressChange: (value: string) => void;
};

export function AddressWithCepField({
  label,
  address,
  placeholder,
  onAddressChange,
}: Props) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const lookupCep = async () => {
    setLoading(true);
    setCepError(null);
    try {
      const result = await fetchAddressByCep(cep);
      onAddressChange(result.formatted);
      setCep(result.cep);
    } catch (err) {
      setCepError(err instanceof Error ? err.message : "Erro ao consultar CEP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <label className="block space-y-2 sm:col-span-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <span className="text-xs text-slate-500">CEP (opcional — preenche o endereço)</span>
          <input
            className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={cep}
            onChange={(e) => setCep(formatCep(e.target.value))}
            placeholder="00000-000"
            maxLength={9}
            inputMode="numeric"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || normalizeCep(cep).length !== 8}
          onClick={() => void lookupCep()}
        >
          {loading ? "Consultando..." : "Consultar CEP"}
        </Button>
      </div>
      {cepError && <p className="text-xs text-red-600">{cepError}</p>}
    </label>
  );
}
