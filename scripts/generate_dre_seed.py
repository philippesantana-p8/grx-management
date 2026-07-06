# -*- coding: utf-8 -*-
"""Gera supabase/seed_dre_accounts.sql a partir da planilha Excel."""
import pandas as pd
from pathlib import Path

EXCEL = Path(r"d:\OneDrive\Área de Trabalho\Financeiro_Rafa_GRX_V3_Estacionamento_LavaRapido.xlsx")
OUT = Path(__file__).resolve().parents[1] / "supabase" / "seed_dre_accounts.sql"

df = pd.read_excel(EXCEL, sheet_name="Contas DRE e Classificações")
rows = []
for _, r in df.iterrows():
    name = str(r.iloc[0]).strip()
    if name in ("Conta DRE", "nan", ""):
        continue
    cls = str(r.iloc[1]).strip().replace("'", "''")
    typ = str(r.iloc[2]).strip().replace("'", "''")
    name = name.replace("'", "''")
    rows.append(f"  ('{name}', '{cls}', '{typ}')")

lines = [
    "-- Seed: Contas DRE da planilha GRX V3",
    "-- Executar após criar a empresa (substituir COMPANY_ID)",
    "",
    "-- Uso:",
    "--   1. Crie a empresa GRX no sistema",
    "--   2. Substitua :company_id pelo UUID da empresa",
    "--   3. Execute este script no SQL Editor do Supabase",
    "",
    "INSERT INTO dre_accounts (company_id, name, classification, transaction_type, status)",
    "SELECT :company_id, v.name, v.classification, v.transaction_type, 'Ativo'",
    "FROM (VALUES",
    ",\n".join(rows),
    ") AS v(name, classification, transaction_type)",
    "ON CONFLICT (company_id, name) DO NOTHING;",
    "",
]

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Gerado: {OUT} ({len(rows)} contas)")
