"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Loading } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { useCompany } from "@/lib/company-context";
import { nextCode } from "@/lib/codes";
import { glassField, glassFilterPanel } from "@/lib/liquid-glass-styles";
import {
  CAR_WASH_SERVICE_NAMES,
  PARKING_SERVICE_NAMES,
  PATIO_BILLING_UNITS,
  PATIO_MODALITIES,
  type PatioPriceRow,
  type PatioVehicleType,
} from "@/lib/patio";
import { listPatioPrices, listPatioVehicleTypes, seedPatioDefaults } from "@/lib/patio-api";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

export default function ParametrosPatioPage() {
  const { companyId } = useCompany();
  const supabase = useMemo(() => createClient(), []);
  const [types, setTypes] = useState<PatioVehicleType[]>([]);
  const [prices, setPrices] = useState<PatioPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [typeForm, setTypeForm] = useState({
    name: "",
    usage_category: "Estacionamento/Lava Rápido",
    description: "",
  });

  const [priceForm, setPriceForm] = useState<{
    modality: string;
    vehicle_type_id: string;
    service_name: string;
    price: string;
    billing_unit: string;
    valid_from: string;
  }>({
    modality: "Estacionamento",
    vehicle_type_id: "",
    service_name: PARKING_SERVICE_NAMES.diaria,
    price: "",
    billing_unit: "Diária",
    valid_from: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    await seedPatioDefaults(supabase, companyId);
    const [t, p] = await Promise.all([
      listPatioVehicleTypes(supabase, companyId),
      listPatioPrices(supabase, companyId),
    ]);
    if (t.error || p.error) setError(t.error ?? p.error);
    setTypes(t.rows);
    setPrices(p.rows);
    if (!priceForm.vehicle_type_id && t.rows[0]) {
      setPriceForm((f) => ({ ...f, vehicle_type_id: t.rows[0].id }));
    }
    setLoading(false);
  }, [companyId, supabase, priceForm.vehicle_type_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const serviceOptions = useMemo(() => {
    if (priceForm.modality === "Estacionamento") {
      return [
        PARKING_SERVICE_NAMES.diaria,
        PARKING_SERVICE_NAMES.mensal,
      ].map((s) => ({ value: s, label: s }));
    }
    return CAR_WASH_SERVICE_NAMES.map((s) => ({ value: s, label: s }));
  }, [priceForm.modality]);

  const saveType = async () => {
    if (!companyId || !typeForm.name.trim()) {
      setError("Informe o nome do porte.");
      return;
    }
    setSaving(true);
    setError(null);
    const code = await nextCode("patio_vehicle_types", companyId, "TV");
    const { error: insertError } = await supabase.from("patio_vehicle_types").insert({
      company_id: companyId,
      code,
      name: typeForm.name.trim(),
      usage_category: typeForm.usage_category,
      description: typeForm.description || null,
      is_active: true,
      sort_order: types.length + 1,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setMsg("Porte cadastrado.");
    setTypeForm({ name: "", usage_category: "Estacionamento/Lava Rápido", description: "" });
    await load();
  };

  const savePrice = async () => {
    if (!companyId) return;
    if (!priceForm.vehicle_type_id || !priceForm.service_name || priceForm.price === "") {
      setError("Preencha porte, serviço e valor.");
      return;
    }
    setSaving(true);
    setError(null);
    const code = await nextCode("patio_price_tables", companyId, "PR");
    const { error: insertError } = await supabase.from("patio_price_tables").insert({
      company_id: companyId,
      code,
      modality: priceForm.modality,
      vehicle_type_id: priceForm.vehicle_type_id,
      service_name: priceForm.service_name,
      price: Number(priceForm.price),
      billing_unit: priceForm.billing_unit,
      valid_from: priceForm.valid_from,
      status: "Ativo",
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setMsg("Preço cadastrado (nova vigência).");
    setPriceForm((f) => ({ ...f, price: "" }));
    await load();
  };

  const deactivatePrice = async (id: string) => {
    if (!confirm("Inativar este preço? Cadastre um novo para nova vigência.")) return;
    const { error: updError } = await supabase
      .from("patio_price_tables")
      .update({ status: "Inativo" })
      .eq("id", id);
    if (updError) setError(updError.message);
    else await load();
  };

  if (!companyId) return <Loading />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Parâmetros do pátio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Portes de veículo e tabela de preços (diária, mensal e lava) — base da planilha Tabela_Precos_Vigencia.
        </p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="info">{msg}</Alert> : null}
      {loading ? <Loading /> : null}

      <section className={`space-y-4 ${glassFilterPanel()}`}>
        <h2 className="text-sm font-semibold text-slate-900">Portes / tipos de veículo</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Nome do porte</span>
            <input
              className={glassField(true)}
              value={typeForm.name}
              placeholder="Ex.: Carro Pequeno"
              onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <GlassSelect
            label="Uso"
            value={typeForm.usage_category}
            onChange={(next) => setTypeForm((f) => ({ ...f, usage_category: next }))}
            options={[
              { value: "Estacionamento/Lava Rápido", label: "Estacionamento e Lava" },
              { value: "Estacionamento", label: "Só Estacionamento" },
              { value: "Lava Rápido", label: "Só Lava-rápido" },
            ]}
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Descrição</span>
            <input
              className={glassField(false)}
              value={typeForm.description}
              onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
        <Button type="button" disabled={saving} onClick={() => void saveType()}>
          + Porte
        </Button>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Código</th>
                <th className="px-2 py-2">Porte</th>
                <th className="px-2 py-2">Uso</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{t.code}</td>
                  <td className="px-2 py-2 font-medium">{t.name}</td>
                  <td className="px-2 py-2 text-slate-600">{t.usage_category}</td>
                  <td className="px-2 py-2">
                    <Badge variant={t.is_active ? "success" : "default"}>
                      {t.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`space-y-4 ${glassFilterPanel()}`}>
        <h2 className="text-sm font-semibold text-slate-900">Tabela de preços (vigência)</h2>
        <p className="text-xs text-slate-500">
          Inclua mensalidade de estacionamento e lava (pequeno/médio/grande). Ao mudar valor, cadastre
          um novo preço — não edite o antigo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <GlassSelect
            label="Modalidade"
            required
            value={priceForm.modality}
            onChange={(next) =>
              setPriceForm((f) => ({
                ...f,
                modality: next,
                service_name:
                  next === "Estacionamento"
                    ? PARKING_SERVICE_NAMES.diaria
                    : CAR_WASH_SERVICE_NAMES[0],
                billing_unit: next === "Estacionamento" ? "Diária" : "Serviço",
              }))
            }
            options={PATIO_MODALITIES.map((m) => ({ value: m, label: m }))}
          />
          <GlassSelect
            label="Porte"
            required
            value={priceForm.vehicle_type_id}
            onChange={(next) => setPriceForm((f) => ({ ...f, vehicle_type_id: next }))}
            options={types.map((t) => ({ value: t.id, label: t.name }))}
          />
          <GlassSelect
            label="Serviço"
            required
            value={priceForm.service_name}
            onChange={(next) =>
              setPriceForm((f) => ({
                ...f,
                service_name: next,
                billing_unit:
                  next === PARKING_SERVICE_NAMES.mensal
                    ? "Mensal"
                    : next === PARKING_SERVICE_NAMES.diaria
                      ? "Diária"
                      : "Serviço",
              }))
            }
            options={serviceOptions}
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Valor (R$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={glassField(true)}
              value={priceForm.price}
              onChange={(e) => setPriceForm((f) => ({ ...f, price: e.target.value }))}
            />
          </label>
          <GlassSelect
            label="Unidade"
            value={priceForm.billing_unit}
            onChange={(next) => setPriceForm((f) => ({ ...f, billing_unit: next }))}
            options={PATIO_BILLING_UNITS.map((u) => ({ value: u, label: u }))}
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Vigência a partir de</span>
            <input
              type="date"
              className={glassField(true)}
              value={priceForm.valid_from}
              onChange={(e) => setPriceForm((f) => ({ ...f, valid_from: e.target.value }))}
            />
          </label>
        </div>
        <Button type="button" disabled={saving} onClick={() => void savePrice()}>
          + Novo preço (vigência)
        </Button>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Cód.</th>
                <th className="px-2 py-2">Modalidade</th>
                <th className="px-2 py-2">Porte</th>
                <th className="px-2 py-2">Serviço</th>
                <th className="px-2 py-2">Valor</th>
                <th className="px-2 py-2">Unidade</th>
                <th className="px-2 py-2">Desde</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{p.code}</td>
                  <td className="px-2 py-2">{p.modality}</td>
                  <td className="px-2 py-2">{p.vehicle_type_name ?? "—"}</td>
                  <td className="px-2 py-2">{p.service_name}</td>
                  <td className="px-2 py-2 font-medium">{formatCurrency(Number(p.price))}</td>
                  <td className="px-2 py-2">{p.billing_unit}</td>
                  <td className="px-2 py-2">{p.valid_from}</td>
                  <td className="px-2 py-2">
                    <Badge variant={p.status === "Ativo" ? "success" : "default"}>{p.status}</Badge>
                  </td>
                  <td className="px-2 py-2">
                    {p.status === "Ativo" ? (
                      <Button type="button" variant="ghost" onClick={() => void deactivatePrice(p.id)}>
                        Inativar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
