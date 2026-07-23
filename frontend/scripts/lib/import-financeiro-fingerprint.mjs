/** Fingerprint estável para dedupe de import financeiro teste. */

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePlate(plate) {
  return String(plate ?? "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

export function looksLikePlate(value) {
  const p = normalizePlate(value);
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p) || /^[A-Z]{3}\d{4}$/.test(p);
}

export function parseImportDesc(description) {
  const d = String(description || "");
  const party = (d.match(/Parte:\s*([^·]+)/i) || [])[1]?.trim() || "";
  const service = (d.match(/Serviço:\s*(\d{4}-\d{2}-\d{2})/i) || [])[1] || "";
  const cot = (d.match(/COT:\s*([^·]+)/i) || [])[1]?.trim() || "";
  const rateio = (d.match(/Rateio:\s*([^·]+)/i) || [])[1]?.trim() || "";
  const fonte = (d.match(/Fonte:\s*([^·]+)/i) || [])[1]?.trim() || "GRX";
  const core = d
    .replace(/\[IMPORTAÇÃO TESTE\]/gi, "")
    .replace(/Fonte:\s*[^·]+/gi, "")
    .replace(/Parte:\s*[^·]+/gi, "")
    .replace(/Serviço:\s*[^·]+/gi, "")
    .replace(/COT:\s*[^·]+/gi, "")
    .replace(/Motorista:\s*[^·]+/gi, "")
    .replace(/Rateio:\s*[^·]+/gi, "")
    .replace(/GAPS:\s*[^·]+/gi, "")
    .replace(/·/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const plateFromRateio = looksLikePlate(rateio) ? normalizePlate(rateio) : "";
  return {
    party,
    service,
    cot,
    rateio,
    fonte,
    plateFromRateio,
    core: normalizeText(core).slice(0, 120),
  };
}

/**
 * Chave de unicidade (regra Rafael/PSCS):
 * - Com placa: data caixa + placa + valor + conta + parte + serviço + COT
 *   (descrição NÃO entra — varia entre GRX e planilha do sócio)
 * - Sem placa: inclui descrição livre (evita fundir despesas gerais distintas)
 */
export function importFingerprint(row, plateByVehicleId = null) {
  const p = parseImportDesc(row.description);
  const cot = normalizeText(row.legacy_number || p.cot);
  let plate = "";
  if (row.allocation_vehicle_id && plateByVehicleId?.has(row.allocation_vehicle_id)) {
    plate = plateByVehicleId.get(row.allocation_vehicle_id);
  } else if (p.plateFromRateio) {
    plate = p.plateFromRateio;
  } else if (row._plate) {
    plate = normalizePlate(row._plate);
  }

  const base = [
    row.transaction_date,
    plate || "(sem-placa)",
    Number(row.amount).toFixed(2),
    row.chart_of_account_id || "",
    normalizeText(p.party),
    p.service,
    cot,
  ];

  if (!plate) {
    base.push(p.core);
  }
  return base.join("|");
}

/** Fingerprint a partir dos campos do Excel (antes do insert). */
export function fingerprintFromParts({
  cashDate,
  amount,
  accountId,
  party,
  serviceDate,
  cot,
  desc,
  plate,
}) {
  const plateN = looksLikePlate(plate) ? normalizePlate(plate) : "";
  const base = [
    cashDate,
    plateN || "(sem-placa)",
    Number(amount).toFixed(2),
    accountId || "",
    normalizeText(party),
    serviceDate || "",
    normalizeText(cot),
  ];
  if (!plateN) {
    base.push(normalizeText(desc || "[SEM DADO: descrição]").slice(0, 120));
  }
  return base.join("|");
}
