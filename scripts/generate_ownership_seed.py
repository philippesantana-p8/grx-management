# -*- coding: utf-8 -*-
"""Gera frontend/src/lib/ownership-seed.ts a partir da planilha Excel."""
import json
import re
from pathlib import Path

import pandas as pd

EXCEL = Path(r"d:\OneDrive\Área de Trabalho\Financeiro_Rafa_GRX_V3_Estacionamento_LavaRapido.xlsx")
OUT = Path(__file__).resolve().parents[1] / "frontend" / "src" / "lib" / "ownership-seed.ts"


def normalize_plate(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(value)).upper()


def parse_bool(value) -> bool:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return False
    text = str(value).strip().lower()
    return text in ("sim", "s", "yes", "true", "1")


def parse_percent(value) -> float:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0.0
    pct = float(value)
    return round(pct * 100, 2) if pct <= 1 else round(pct, 2)


def parse_status(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "Ativo"
    text = str(value).strip()
    return text if text else "Ativo"


def partner_type(name: str, tipo: str) -> str:
    if "GRX" in name or "Empresa" in tipo:
        return "Empresa"
    if "Parceira" in tipo:
        return "Parceira"
    return "Socio"


def read_partners() -> list[dict]:
    df = pd.read_excel(EXCEL, sheet_name="Cadastro_Socios", header=2)
    rows = []
    for _, r in df.iterrows():
        code = r.get("Código Sócio")
        name = r.get("Nome Sócio")
        if code is None or name is None:
            continue
        if isinstance(code, float) and pd.isna(code):
            continue
        if isinstance(name, float) and pd.isna(name):
            continue
        rows.append(
            {
                "code": str(code).strip(),
                "name": str(name).strip(),
                "partner_type": partner_type(str(name), str(r.get("Tipo", "Socio"))),
            }
        )
    return rows


def read_vehicles() -> list[dict]:
    df = pd.read_excel(EXCEL, sheet_name="Cadastro_Veiculos", header=2)
    rows = []
    for _, r in df.iterrows():
        code = r.get("Código Veículo")
        plate = r.get("Van / Placa")
        if code is None or plate is None:
            continue
        if isinstance(code, float) and pd.isna(code):
            continue
        if isinstance(plate, float) and pd.isna(plate):
            continue
        rows.append(
            {
                "code": str(code).strip(),
                "plate": normalize_plate(plate),
                "vehicle_category": "Van",
                "status": "Ativo",
            }
        )
    return rows


def read_ownership() -> list[dict]:
    df = pd.read_excel(EXCEL, sheet_name="Participacao_Veiculo", header=2)
    rows = []
    pct_col = "Percentual"
    op_col = "Responsável Operacional?"
    for col in df.columns:
        if "Percentual" in str(col):
            pct_col = col
        if "Respons" in str(col) and "Operacional" in str(col):
            op_col = col

    for _, r in df.iterrows():
        plate = r.get("Van / Placa")
        partner = r.get("Sócio")
        if plate is None or partner is None:
            continue
        if isinstance(plate, float) and pd.isna(plate):
            continue
        if isinstance(partner, float) and pd.isna(partner):
            continue

        plate = normalize_plate(plate)
        partner = str(partner).strip()
        if not plate or not partner:
            continue

        rows.append(
            {
                "plate": plate,
                "partner": partner,
                "ownership_percentage": parse_percent(r.get(pct_col)),
                "operational": parse_bool(r.get(op_col)),
                "status": parse_status(r.get("Status")),
                "effective_date": "2026-01-01",
            }
        )
    return rows


partners = read_partners()
vehicles = read_vehicles()
ownership = read_ownership()

lines = [
    "export type PartnerSeedRow = {",
    "  code: string;",
    "  name: string;",
    "  partner_type: string;",
    "};",
    "",
    "export type VehicleSeedRow = {",
    "  code: string;",
    "  plate: string;",
    "  vehicle_category: string;",
    "  status: string;",
    "};",
    "",
    "export type OwnershipSeedRow = {",
    "  plate: string;",
    "  partner: string;",
    "  ownership_percentage: number;",
    "  operational: boolean;",
    "  status: string;",
    "  effective_date: string;",
    "};",
    "",
    "/** Sócios da aba Cadastro_Socios (planilha GRX V3) */",
    "export const PARTNER_SEED: PartnerSeedRow[] = "
    + json.dumps(partners, ensure_ascii=False, indent=2)
    + ";",
    "",
    "/** Veículos da aba Cadastro_Veiculos (planilha GRX V3) */",
    "export const VEHICLE_SEED: VehicleSeedRow[] = "
    + json.dumps(vehicles, ensure_ascii=False, indent=2)
    + ";",
    "",
    "/** Participações da aba Participacao_Veiculo (planilha GRX V3) */",
    "export const OWNERSHIP_SEED: OwnershipSeedRow[] = "
    + json.dumps(ownership, ensure_ascii=False, indent=2)
    + ";",
    "",
]

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines), encoding="utf-8")
print(
    f"Gerado: {OUT} "
    f"({len(partners)} sócios, {len(vehicles)} veículos, {len(ownership)} participações)"
)
