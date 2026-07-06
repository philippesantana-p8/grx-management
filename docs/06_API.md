# GRX Management — API (Contratos Lógicos)

Versão: 1.0  
Data: 02/07/2026

Contratos lógicos da API REST. Implementação via Next.js API Routes + Supabase.

**Base URL:** `/api/v1`  
**Autenticação:** Bearer token (Supabase JWT)  
**Header obrigatório:** `X-Company-Id` (empresa ativa do usuário)

---

## 1. Cadastros

### Sócios
```
GET    /partners              # Listar (filtro: status)
POST   /partners              # Criar
GET    /partners/:id          # Detalhe
PUT    /partners/:id          # Atualizar
DELETE /partners/:id          # Soft delete
```

### Veículos
```
GET    /vehicles              # Listar (filtro: status, plate)
POST   /vehicles              # Criar (valida placa única)
GET    /vehicles/:id          # Detalhe + totais financeiros
PUT    /vehicles/:id          # Atualizar
DELETE /vehicles/:id          # Soft delete
GET    /vehicles/:id/financial-summary  # Receita, despesa, resultado
```

### Participação Societária
```
GET    /vehicles/:id/ownership       # Listar participações do veículo
POST   /vehicles/:id/ownership       # Adicionar sócio (valida soma ≤ 100%)
PUT    /ownership/:id                # Atualizar percentual
DELETE /ownership/:id                # Encerrar participação
GET    /ownership/validate/:vehicleId # Verificar se soma = 100%
```

### Motoristas
```
GET    /drivers               # Listar (filtro: status, search)
POST   /drivers               # Criar (alerta duplicidade)
GET    /drivers/:id
PUT    /drivers/:id
DELETE /drivers/:id
GET    /drivers/similar?name= # Busca nomes similares
```

### Clientes / Fornecedores
```
GET|POST|PUT|DELETE  /clients
GET|POST|PUT|DELETE  /suppliers
```

### Contas DRE
```
GET    /dre-accounts          # Listar (filtro: status, type)
POST   /dre-accounts
PUT    /dre-accounts/:id
```

### Tipos de Veículo
```
GET|POST|PUT|DELETE  /vehicle-types
```

---

## 2. Financeiro

### Lançamentos
```
GET    /financial-transactions          # Listar (filtros: date_from, date_to, type, vehicle, driver, dre_account)
POST   /financial-transactions          # Criar (auto-preenche classification/type via DRE)
GET    /financial-transactions/:id
PUT    /financial-transactions/:id
DELETE /financial-transactions/:id
POST   /financial-transactions/import   # Importação em lote (CSV/planilha)
```

**POST body exemplo:**
```json
{
  "transaction_date": "2026-01-15",
  "amount": 800.00,
  "dre_account_id": "uuid",
  "client_id": "uuid",
  "service_date": "2025-12-12",
  "driver_id": "uuid",
  "operational_vehicle_id": "uuid",
  "allocation_vehicle_id": "uuid",
  "description": "Transfer Morumbi x Mairiporã"
}
```

**Response:** inclui `classification` e `transaction_type` derivados.

### Fluxo de Caixa
```
GET    /cash-flow-entries               # Listar (filtro: status, date_from, date_to)
POST   /cash-flow-entries
PUT    /cash-flow-entries/:id
POST   /cash-flow-entries/:id/reconcile # Marca como realizado + cria financial_transaction
```

---

## 3. Estacionamento e Lava-rápido

### Preços
```
GET    /price-tables                    # Listar (filtro: modality, status)
POST   /price-tables                    # Criar nova vigência
GET    /price-tables/active             # ?modality=&vehicle_type_id=&service=&date=
PUT    /price-tables/:id                # Apenas status/notas (não alterar valor)
```

### Estacionamento
```
GET    /parking-movements               # Listar (filtro: status, date)
POST   /parking-movements               # Registrar entrada
PUT    /parking-movements/:id           # Registrar saída / alterar status
GET    /parking-movements/:id           # Detalhe com cálculos
```

**PUT checkout:** informa `exit_date`, `exit_time` → API calcula `daily_count`, `daily_rate`, `total_amount`.

### Lava-rápido
```
GET    /car-wash-services
POST   /car-wash-services
PUT    /car-wash-services/:id
GET    /car-wash-services/:id
```

---

## 4. Frota

### Vencimentos
```
GET    /document-due-dates              # Listar (filtro: alert_status, vehicle_id)
POST   /document-due-dates
PUT    /document-due-dates/:id
GET    /document-due-dates/alerts       # Próximos 30 dias
```

### Histórico
```
GET    /vehicle-events?vehicle_id=
POST   /vehicle-events
PUT    /vehicle-events/:id
```

---

## 5. Dashboards (read-only)

```
GET /dashboard/executive?period_from=&period_to=&include_projections=
GET /dashboard/vehicles?period_from=&period_to=
GET /dashboard/partners?period_from=&period_to=
GET /dashboard/drivers?period_from=&period_to=
GET /dashboard/parking-wash?period_from=&period_to=
GET /reports/monthly?year=
GET /reports/by-allocation?period_from=&period_to=
```

**Response executive exemplo:**
```json
{
  "kpis": {
    "total_revenue": 508701.24,
    "total_expense": 119516.07,
    "total_result": 389185.17,
    "average_margin": 0.765
  },
  "vehicles": [...],
  "partners": [...],
  "alerts": [...]
}
```

---

## 6. Utilitários

```
GET /lookup/dre-accounts
GET /lookup/vehicles
GET /lookup/partners
GET /lookup/drivers?search=
GET /lookup/clients?search=
GET /lookup/suppliers?search=
GET /lookup/vehicle-types
GET /lookup/price-services?modality=
```

---

## 7. Códigos de resposta

| Código | Situação |
|--------|----------|
| 200 | Sucesso |
| 201 | Criado |
| 400 | Validação (ex.: participação > 100%) |
| 401 | Não autenticado |
| 403 | Sem permissão para empresa/módulo |
| 404 | Recurso não encontrado |
| 409 | Conflito (placa duplicada, preço vigente existente) |

---

## 8. Regras implementadas na API

| Endpoint | Regra |
|----------|-------|
| POST /financial-transactions | RN-010, RN-011, RN-024 |
| POST /vehicles/:id/ownership | RN-041 (trigger DB) |
| PUT /parking-movements/:id | RN-082, RN-083, RN-084 |
| POST /car-wash-services | RN-092 |
| POST /price-tables | RN-101 (nunca update de valor) |
| POST /drivers | RN-141 (retorna warning se similar) |
| POST /cash-flow-entries/:id/reconcile | RN-033 |

---

## Histórico de versões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 02/07/2026 | PSCS | Contratos API iniciais |
