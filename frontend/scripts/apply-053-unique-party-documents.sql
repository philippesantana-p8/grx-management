-- Unicidade de CNPJ/CPF (só dígitos) por empresa em clientes, fornecedores e motoristas.
-- Sócios já têm uq_partners_company_cpf (migration 034).
-- Mantém o registro mais antigo e soft-delete das duplicatas ativas.

-- Clientes
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, regexp_replace(coalesce(document, ''), '\D', '', 'g')
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.clients
  WHERE deleted_at IS NULL
    AND document IS NOT NULL
    AND btrim(document) <> ''
    AND regexp_replace(document, '\D', '', 'g') <> ''
)
UPDATE public.clients c
SET
  deleted_at = NOW(),
  status = 'Inativo',
  notes = trim(both E'\n' from coalesce(c.notes, '') || E'\n[sistema] Soft-delete: CNPJ/CPF duplicado (053).'),
  updated_at = NOW()
FROM ranked r
WHERE c.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_company_document_digits
  ON public.clients (company_id, (regexp_replace(document, '\D', '', 'g')))
  WHERE deleted_at IS NULL
    AND document IS NOT NULL
    AND btrim(document) <> ''
    AND regexp_replace(document, '\D', '', 'g') <> '';

-- Fornecedores
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, regexp_replace(coalesce(document, ''), '\D', '', 'g')
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.suppliers
  WHERE deleted_at IS NULL
    AND document IS NOT NULL
    AND btrim(document) <> ''
    AND regexp_replace(document, '\D', '', 'g') <> ''
)
UPDATE public.suppliers s
SET
  deleted_at = NOW(),
  status = 'Inativo',
  notes = trim(both E'\n' from coalesce(s.notes, '') || E'\n[sistema] Soft-delete: CNPJ/CPF duplicado (053).'),
  updated_at = NOW()
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_document_digits
  ON public.suppliers (company_id, (regexp_replace(document, '\D', '', 'g')))
  WHERE deleted_at IS NULL
    AND document IS NOT NULL
    AND btrim(document) <> ''
    AND regexp_replace(document, '\D', '', 'g') <> '';

-- Motoristas
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, regexp_replace(coalesce(document, ''), '\D', '', 'g')
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.drivers
  WHERE deleted_at IS NULL
    AND document IS NOT NULL
    AND btrim(document) <> ''
    AND regexp_replace(document, '\D', '', 'g') <> ''
)
UPDATE public.drivers d
SET
  deleted_at = NOW(),
  status = 'Inativo',
  notes = trim(both E'\n' from coalesce(d.notes, '') || E'\n[sistema] Soft-delete: CNPJ/CPF duplicado (053).'),
  updated_at = NOW()
FROM ranked r
WHERE d.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_drivers_company_document_digits
  ON public.drivers (company_id, (regexp_replace(document, '\D', '', 'g')))
  WHERE deleted_at IS NULL
    AND document IS NOT NULL
    AND btrim(document) <> ''
    AND regexp_replace(document, '\D', '', 'g') <> '';
