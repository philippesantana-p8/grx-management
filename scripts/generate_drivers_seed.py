# -*- coding: utf-8 -*-
"""Gera frontend/src/lib/drivers-seed.ts a partir da planilha Excel."""
import json
from pathlib import Path

import pandas as pd

EXCEL = Path(r"d:\OneDrive\Área de Trabalho\Financeiro_Rafa_GRX_V3_Estacionamento_LavaRapido.xlsx")
OUT = Path(__file__).resolve().parents[1] / "frontend" / "src" / "lib" / "drivers-seed.ts"

DRIVER_TYPES = {"Motorista", "Empregado", "Agregado", "Terceiro", "Prestador"}


def parse_bool(value) -> bool:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return True
    text = str(value).strip().lower()
    return text in ("sim", "s", "yes", "true", "1")


def parse_text(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text if text and text.lower() != "nan" else None


def parse_driver_type(value) -> str:
    text = parse_text(value) or "Motorista"
    return text if text in DRIVER_TYPES else "Motorista"


def parse_status(value) -> str:
    text = parse_text(value) or "Ativo"
    return text if text in ("Ativo", "Inativo", "Pendente", "Encerrado") else "Ativo"


df = pd.read_excel(EXCEL, sheet_name="Cadastro_Motoristas", header=2)
rows = []

for _, r in df.iterrows():
    code = r.get("Código Motorista")
    name = r.get("Nome Motorista")
    if code is None or name is None:
        continue
    if isinstance(code, float) and pd.isna(code):
        continue
    if isinstance(name, float) and pd.isna(name):
        continue

    code = str(code).strip()
    name = str(name).strip()
    if not code or not name:
        continue

    rows.append(
        {
            "code": code,
            "name": name,
            "driver_type": parse_driver_type(r.get("Tipo")),
            "status": parse_status(r.get("Status")),
            "phone": parse_text(r.get("Telefone")),
            "document": parse_text(r.get("CPF/CNPJ")),
            "active_for_operations": parse_bool(r.get("Usar em Operação?")),
            "notes": parse_text(r.get("Observações")),
        }
    )

lines = [
    "export type DriverSeedRow = {",
    "  code: string;",
    "  name: string;",
    "  driver_type: string;",
    "  status: string;",
    "  phone: string | null;",
    "  document: string | null;",
    "  active_for_operations: boolean;",
    "  notes: string | null;",
    "};",
    "",
    "/** Motoristas da aba Cadastro_Motoristas (planilha GRX V3) */",
    "export const DRIVERS_SEED: DriverSeedRow[] = "
    + json.dumps(rows, ensure_ascii=False, indent=2)
    + ";",
    "",
]

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Gerado: {OUT} ({len(rows)} motoristas)")
