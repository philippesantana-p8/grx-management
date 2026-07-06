# GRX Management — Documentação das Tabelas (V1)

Versão: 1.1  
Data: 02/07/2026  
Status: Aprovado  
Migrations: `supabase/migrations/001_schema.sql`, `002_auth_rls.sql`, `003_seed_chart_of_accounts.sql`, `004_vehicle_ownership.sql`

---

## Visão geral

| Domínio | Tabelas |
|---------|---------|
| Núcleo e autenticação | `companies`, `branches`, `profiles`, `company_members` |
| Cadastros | `partners`, `vehicles`, `vehicle_ownership`, `chart_of_accounts`, `drivers`, `clients`, `suppliers` |
| Financeiro | `financial_transactions`, `cash_flow_entries` |
| Operacional | `parking_entries`, `service_orders` |
| Frota | `vehicle_events` |
| Arquivos | `attachments` |

**Total: 17 tabelas** + 2 views analíticas.

**Adiado para V2:** `vehicle_types`, `price_tables`, tabela dedicada de vencimentos.

---

## 1. companies

### Objetivo
Representa cada empresa cliente do sistema (multiempresa). Raiz de isolamento de dados.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `name` | text | Razão social |
| `trade_name` | text | Nome fantasia |
| `document` | text | CNPJ |
| `status` | text | Ativo / Inativo |
| `created_at`, `updated_at` | timestamptz | Auditoria |

### Relacionamentos
- 1:N com todas as tabelas operacionais via `company_id`
- 1:N com `branches`, `company_members`

### Regras de negócio
- RN-001: Todo dado operacional pertence a uma empresa.
- Empresa inativa não recebe novos lançamentos (validação na aplicação).

---

## 2. branches

### Objetivo
Unidades operacionais da empresa (sede, pátio, lava-rápido, filial). Preparada para crescimento; **uso opcional na V1**.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `code` | text | Código interno (ex.: BR001) |
| `name` | text | Nome da unidade |
| `address`, `city`, `phone` | text | Dados de contato (opcionais) |
| `is_default` | boolean | Filial padrão da empresa |
| `status` | text | Ativo / Inativo |

### Relacionamentos
- N:1 com `companies`
- 1:N opcional com `vehicles`, `parking_entries`, `service_orders`, `financial_transactions`

### Regras de negócio
- Apenas uma filial pode ser `is_default = true` por empresa.
- FKs para `branch_id` são nullable — empresa com uma unidade pode ignorar filiais na V1.

---

## 3. profiles

### Objetivo
Perfil complementar do usuário autenticado (Supabase Auth).

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK = FK → auth.users |
| `full_name` | text | Nome exibido |
| `email` | text | E-mail |

### Relacionamentos
- 1:1 com `auth.users`
- 1:N com `company_members`

### Regras de negócio
- Criado automaticamente no registro do usuário (trigger `on_auth_user_created`).

---

## 4. company_members

### Objetivo
Vincula usuários às empresas e define o papel de acesso.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `user_id` | uuid | FK → auth.users |
| `role` | text | admin, financeiro, operacional, socio |

### Relacionamentos
- N:1 com `companies` e `auth.users`

### Regras de negócio
- Um usuário pode pertencer a uma ou mais empresas.
- RLS filtra dados pela empresa do membro logado.

---

## 5. partners

### Objetivo
Cadastro de sócios, parceiros e a entidade corporativa GRX. Base do rateio societário.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `code` | text | Ex.: SOC001 |
| `name` | text | Nome do sócio |
| `partner_type` | text | Socio, Parceira, Empresa |
| `use_in_allocation` | boolean | Participa do rateio |
| `status` | text | Ativo / Inativo |
| `deleted_at` | timestamptz | Soft delete |

### Relacionamentos
- N:1 com `companies`
- 1:N com `vehicle_ownership`
- 1:N opcional como responsável operacional em `vehicles`

### Regras de negócio
- RN-044: Tipo "Empresa" representa operação corporativa GRX (não sócio individual).
- Nome único por empresa.
- Soft delete preserva histórico.

---

## 6. vehicles

### Objetivo
Cadastro oficial da frota por placa. Inclui vencimentos de documentos na V1 (sem tabela separada).

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `branch_id` | uuid | FK → branches (opcional) |
| `code` | text | Ex.: VEI001 |
| `plate` | text | Placa normalizada (única) |
| `model`, `year` | text/int | Dados do veículo |
| `vehicle_category` | text | Van, Onibus, Caminhao, etc. |
| `operational_partner_id` | uuid | FK → partners (responsável) |
| `insurance_due_date` | date | Vencimento seguro |
| `ipva_due_date` | date | Vencimento IPVA |
| `licensing_due_date` | date | Licenciamento |
| `tachograph_due_date` | date | Tacógrafo |
| `crlv_due_date` | date | CRLV |
| `compliance_notes` | text | Observações de documentos |
| `status` | text | Ativo / Inativo |
| `deleted_at` | timestamptz | Soft delete |

### Relacionamentos
- N:1 com `companies`, `branches` (opc.), `partners` (responsável)
- 1:N com `vehicle_ownership`, `financial_transactions`, `vehicle_events`, `attachments`

### Regras de negócio
- RN-050: Placa única por empresa, armazenada normalizada (sem espaços, maiúsculas).
- RN-053: Alertas de vencimento derivados das colunas de data (≤ 30 dias = atenção).
- Totais financeiros são calculados via views, não armazenados.

---

## 7. vehicle_ownership

### Objetivo
Define participação societária percentual de cada sócio em cada veículo. O percentual pertence ao veículo — um sócio pode participar de vários veículos com percentuais distintos.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `vehicle_id` | uuid | FK → vehicles |
| `partner_id` | uuid | FK → partners |
| `ownership_percentage` | numeric(5,2) | 0,01 a 100,00 (ex.: 60,00 = 60%) |
| `effective_date` | date | Início da vigência |
| `end_date` | date | Fim da vigência (opcional) |
| `status` | text | Ativo / Inativo / Encerrado |
| `created_at`, `updated_at` | timestamptz | Auditoria |

### Relacionamentos
- N:1 com `vehicles`, `partners`, `companies`
- Modelo N:N entre veículos e sócios via esta tabela

### Regras de negócio
- RN-041: Soma dos percentuais ativos por veículo deve ser ≤ 100% (trigger).
- RN-042: Responsável operacional permanece em `vehicles.operational_partner_id`.
- RN-043: Participações encerradas não entram no cálculo societário.

---

## 8. chart_of_accounts

### Objetivo
Plano de contas gerencial (ex-Contas DRE). Classifica lançamentos financeiros.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `name` | text | Nome da conta |
| `classification` | text | Receitas, Operacional, RH, etc. |
| `transaction_type` | text | Receita, Despesa, Outros |
| `status` | text | Ativo / Inativo |

### Relacionamentos
- N:1 com `companies`
- 1:N com `financial_transactions`, `cash_flow_entries`

### Regras de negócio
- RN-010: Conta obrigatória em todo lançamento.
- RN-011: Classificação e tipo derivam da conta — não editáveis no lançamento.
- RN-012: Contas inativas não aceitam novos lançamentos; histórico preservado.
- Seed inicial: 81 contas da planilha GRX V3 (`003_seed_chart_of_accounts.sql`).

---

## 9. drivers

### Objetivo
Cadastro único de motoristas, agregados e prestadores operacionais.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `code` | text | Ex.: MOT001 |
| `name` | text | Nome |
| `name_normalized` | text | Nome sem acento (busca duplicidade) |
| `driver_type` | text | Motorista, Agregado, Terceiro, etc. |
| `phone`, `document` | text | Contato e CPF/CNPJ |
| `cnh_number` | text | Número da CNH |
| `cnh_expiry_date` | date | Vencimento da CNH |
| `cnh_categories` | text[] | Categorias habilitadas (A, B, C, D, E, AB, AC, AD, AE) |
| `active_for_operations` | boolean | Disponível para lançamentos |
| `deleted_at` | timestamptz | Soft delete |

### Relacionamentos
- N:1 com `companies`
- 1:N com `financial_transactions`, `vehicle_events`

### Regras de negócio
- RN-060: Cadastro único — alerta para nomes similares na aplicação.
- `name_normalized` preenchido automaticamente (trigger).

---

## 10. clients

### Objetivo
Clientes que geram receita. Substitui digitação livre no controle financeiro.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `code` | text | Ex.: CLI001 |
| `name` | text | Nome / razão social |
| `document` | text | CPF/CNPJ |
| `contact_name`, `phone`, `city` | text | Contato |
| `status` | text | Ativo / Inativo |
| `deleted_at` | timestamptz | Soft delete |

### Relacionamentos
- N:1 com `companies`
- 1:N com `financial_transactions`, `cash_flow_entries`

### Regras de negócio
- RN-070: Receitas devem referenciar cliente cadastrado.

---

## 11. suppliers

### Objetivo
Fornecedores de despesas (postos, oficinas, seguradoras, etc.).

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `code` | text | Ex.: FOR001 |
| `name` | text | Nome |
| `category` | text | Combustivel, Manutencao, Seguro, etc. |
| `document`, `contact_name`, `phone`, `city` | text | Dados cadastrais |
| `status` | text | Ativo / Inativo |
| `deleted_at` | timestamptz | Soft delete |

### Relacionamentos
- N:1 com `companies`
- 1:N com `financial_transactions`, `cash_flow_entries`, `vehicle_events`

### Regras de negócio
- RN-071: Despesas devem referenciar fornecedor cadastrado.

---

## 12. financial_transactions

### Objetivo
Lançamentos financeiros **realizados** (receitas e despesas efetivas). Coração do módulo financeiro.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `branch_id` | uuid | FK → branches (opcional) |
| `transaction_date` | date | Data do lançamento |
| `amount` | numeric(12,2) | Valor (sempre positivo) |
| `chart_of_account_id` | uuid | FK → chart_of_accounts |
| `classification` | text | Derivado da conta |
| `transaction_type` | text | Receita / Despesa |
| `client_id` | uuid | FK → clients (receitas) |
| `supplier_id` | uuid | FK → suppliers (despesas) |
| `service_date` | date | Data do serviço |
| `driver_id` | uuid | FK → drivers |
| `operational_vehicle_id` | uuid | Van que rodou |
| `allocation_vehicle_id` | uuid | Veículo do rateio societário |
| `description` | text | Detalhamento livre |
| `created_by`, `updated_by` | uuid | Auditoria |

### Relacionamentos
- N:1 com `companies`, `chart_of_accounts`, `vehicles` (×2), `drivers`, `clients`, `suppliers`, `branches` (opc.)
- 1:N com `attachments`
- 1:1 opcional com `cash_flow_entries` (conciliação)

### Regras de negócio
- RN-021: Valor sempre positivo; tipo define natureza.
- RN-024: `operational_vehicle_id` ≠ `allocation_vehicle_id` (conceitos distintos).
- RN-011: `classification` e `transaction_type` copiados da conta no insert/update (trigger).

---

## 13. cash_flow_entries

### Objetivo
Projeções e compromissos financeiros futuros (fluxo de caixa).

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `due_date` | date | Data prevista |
| `amount` | numeric(12,2) | Valor |
| `chart_of_account_id` | uuid | FK → chart_of_accounts |
| `classification`, `transaction_type` | text | Derivados da conta |
| `client_id`, `supplier_id` | uuid | Parte envolvida |
| `vehicle_id` | uuid | FK → vehicles |
| `status` | text | Projetado, Realizado, Cancelado |
| `realized_transaction_id` | uuid | FK → financial_transactions |

### Relacionamentos
- N:1 com entidades financeiras e operacionais
- Conciliação 1:1 opcional com `financial_transactions`

### Regras de negócio
- RN-032: Totais por veículo = realizado + projetado (status Projetado).
- RN-033: Ao realizar, vincular `realized_transaction_id` para evitar duplicidade.

---

## 14. parking_entries

### Objetivo
Controle de entrada e saída de veículos no estacionamento.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `branch_id` | uuid | FK → branches (opcional) |
| `code` | text | Ex.: EST001 |
| `plate`, `brand`, `model`, `year` | text/int | Veículo |
| `vehicle_type` | text | Tipo informado manualmente (V1) |
| `client_name`, `phone` | text | Cliente |
| `entry_date`, `entry_time` | date/time | Entrada |
| `exit_date`, `exit_time` | date/time | Saída |
| `daily_count` | integer | Diárias calculadas |
| `daily_rate`, `total_amount` | numeric | Valores (manual na V1) |
| `status` | text | Aberto, Finalizado, Cancelado |

### Relacionamentos
- N:1 com `companies`, `branches` (opc.)
- 1:N com `attachments`

### Regras de negócio
- RN-082: Diárias = MAX(1, data_saída − data_entrada + 1).
- RN-085: Cancelados não entram em receita.
- V1: preço informado manualmente (sem `price_tables`).

---

## 15. service_orders

### Objetivo
Ordens de serviço operacionais. Lava-rápido na V1; extensível para outros serviços.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `branch_id` | uuid | FK → branches (opcional) |
| `code` | text | Ex.: SRV001 |
| `service_type` | text | CarWash (V1), extensível |
| `service_date` | date | Data do serviço |
| `plate`, `brand`, `model`, `year` | text/int | Veículo |
| `vehicle_type` | text | Tipo manual (V1) |
| `service_name` | text | Ex.: Lavagem Simples |
| `service_amount` | numeric(12,2) | Valor (manual V1) |
| `status` | text | Aberto, Concluido, Cancelado |
| `entry_date/time`, `exit_date/time` | date/time | Período |
| `attendant` | text | Responsável |
| `driver_id` | uuid | FK → drivers (motorista alocado) |
| `payment_method` | text | Pix, Dinheiro, etc. |

### Relacionamentos
- N:1 com `companies`, `branches` (opc.)
- 1:N com `attachments`

### Regras de negócio
- V1: `service_type = 'CarWash'` para lava-rápido.
- Valor informado manualmente até V2 (`price_tables`).
- Status Cancelado não gera receita.

---

## 16. vehicle_events

### Objetivo
Histórico operacional da frota (manutenção, multas, sinistros, revisões).

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `vehicle_id` | uuid | FK → vehicles |
| `event_date` | date | Data do evento |
| `event_type` | text | Manutencao, Multa, Sinistro, etc. |
| `odometer` | integer | KM |
| `amount` | numeric | Valor associado |
| `supplier_id`, `driver_id` | uuid | Envolvidos |
| `financial_transaction_id` | uuid | Vínculo opcional com despesa |
| `status` | text | Pendente, Concluido, etc. |

### Relacionamentos
- N:1 com `vehicles`, `suppliers`, `drivers`
- 1:N com `attachments`

### Regras de negócio
- RN-121: Evento pode gerar lançamento financeiro vinculado.
- Complementa vencimentos estáticos em `vehicles`.

---

## 17. attachments

### Objetivo
Armazenar metadados de documentos, imagens e arquivos vinculados a qualquer entidade do sistema. Arquivo físico no Supabase Storage.

### Principais campos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `company_id` | uuid | FK → companies |
| `entity_type` | text | vehicle, financial_transaction, etc. |
| `entity_id` | uuid | ID da entidade vinculada |
| `file_name` | text | Nome original |
| `storage_path` | text | Caminho no Supabase Storage |
| `mime_type` | text | Tipo MIME |
| `file_size` | bigint | Tamanho em bytes |
| `uploaded_by` | uuid | FK → auth.users |
| `description` | text | Descrição opcional |

### Relacionamentos
- Polimórfico: `entity_type` + `entity_id` referencia qualquer tabela
- N:1 com `companies`

### Regras de negócio
- Padrão polimórfico — uma tabela para todos os anexos.
- `entity_type` restrito a valores conhecidos (CHECK constraint).
- RLS por `company_id`; Storage bucket com políticas alinhadas (configuração futura).

---

## Views analíticas

| View | Objetivo |
|------|----------|
| `vw_vehicle_financial_totals` | Receita, despesa e projeção por veículo |
| `vw_ownership_base` | Resultado atribuído por sócio × veículo |

---

## Histórico de versões

| Versão | Data | Descrição |
|--------|------|-----------|
| 1.0 | 02/07/2026 | Modelagem inicial |
| 1.1 | 02/07/2026 | V1 aprovada: chart_of_accounts, branches, service_orders, attachments, vencimentos em vehicles |
| 1.2 | 06/07/2026 | Refatoração vehicle_ownership: percentual por veículo (0–100), effective_date, histórico |
| 1.3 | 06/07/2026 | drivers: campos cnh_number e cnh_expiry_date |
