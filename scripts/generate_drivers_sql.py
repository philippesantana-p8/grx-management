# -*- coding: utf-8 -*-
"""Gera supabase/migrations/006_seed_drivers.sql a partir da planilha Excel."""
import json
import re
import unicodedata
from pathlib import Path

import pandas as pd

EXCEL = Path(r"d:\OneDrive\Área de Trabalho\Financeiro_Rafa_GRX_V3_Estacionamento_LavaRapido.xlsx")
OUT = Path(__file__).resolve().parents[1] / "supabase" / "migrations" / "006_seed_drivers.sql"

DRIVER_TYPES = {"Motorista", "Empregado", "Agregado", "Terceiro", "Prestador"}


def normalize_text(value: str) -> str:
    return (
        unicodedata.normalize("NFD", value)
        .encode("ascii", "ignore")
        .decode()
        .lower()
        .strip()
    )


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    matrix = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        matrix[i][0] = i
    for j in range(len(b) + 1):
        matrix[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            matrix[i][j] = min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    return matrix[len(a)][len(b)]


def parse_bool(value) -> bool:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return True
    return str(value).strip().lower() in ("sim", "s", "yes", "true", "1")


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


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


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

value_rows = []
for row in rows:
    name_normalized = normalize_text(row["name"])
    value_rows.append(
        "("
        + ", ".join(
            [
                sql_literal(row["code"]),
                sql_literal(row["name"]),
                sql_literal(name_normalized),
                sql_literal(row["driver_type"]),
                sql_literal(row["status"]),
                sql_literal(row["phone"]),
                sql_literal(row["document"]),
                "TRUE" if row["active_for_operations"] else "FALSE",
                sql_literal(row["notes"]),
            ]
        )
        + ")"
    )

lines = [
    "-- GRX Management — Seed motoristas da planilha GRX V3",
    "-- Migration: 006_seed_drivers.sql",
    "-- Origem: aba Cadastro_Motoristas (todos os códigos únicos, upsert por company_id+code)",
    "",
    "CREATE OR REPLACE FUNCTION public.seed_drivers(p_company_id UUID)",
    "RETURNS INTEGER",
    "LANGUAGE plpgsql",
    "SECURITY DEFINER",
    "SET search_path = public",
    "AS $$",
    "DECLARE",
    "    v_count INTEGER := 0;",
    "BEGIN",
    "    INSERT INTO public.drivers (",
    "        company_id, code, name, name_normalized, driver_type, status,",
    "        phone, document, cnh_number, cnh_expiry_date, active_for_operations, notes",
    "    )",
    "    SELECT",
    "        p_company_id,",
    "        v.code, v.name, v.name_normalized, v.driver_type, v.status,",
    "        v.phone, v.document, NULL, NULL, v.active_for_operations, v.notes",
    "    FROM (VALUES",
    "        " + ",\n        ".join(value_rows),
    "    ) AS v(code, name, name_normalized, driver_type, status, phone, document, active_for_operations, notes)",
    "    ON CONFLICT (company_id, code) DO UPDATE SET",
    "        name = EXCLUDED.name,",
    "        name_normalized = EXCLUDED.name_normalized,",
    "        driver_type = EXCLUDED.driver_type,",
    "        status = EXCLUDED.status,",
    "        phone = EXCLUDED.phone,",
    "        document = EXCLUDED.document,",
    "        active_for_operations = EXCLUDED.active_for_operations,",
    "        notes = EXCLUDED.notes,",
    "        updated_at = NOW();",
    "",
    "    GET DIAGNOSTICS v_count = ROW_COUNT;",
    "    RETURN v_count;",
    "END;",
    "$$;",
    "",
    "COMMENT ON FUNCTION public.seed_drivers(UUID) IS",
    "    'Importa motoristas da planilha Cadastro_Motoristas para a empresa informada.';",
    "",
    "GRANT EXECUTE ON FUNCTION public.seed_drivers(UUID) TO authenticated;",
    "GRANT EXECUTE ON FUNCTION public.seed_drivers(UUID) TO service_role;",
    "",
]

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Gerado: {OUT} ({len(rows)} motoristas)")
