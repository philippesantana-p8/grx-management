# GRX Management — Arquitetura do Projeto

Versão: 1.0  
Data: 02/07/2026  
Status: Aprovado para desenvolvimento

---

## 1. Visão geral

O GRX Management é um sistema web de gestão financeira-operacional para empresas de transporte executivo com vans, incluindo gestão societária, estacionamento e lava-rápido.

**Objetivo:** substituir a planilha Excel V3 por um sistema mais simples, confiável e escalável.

---

## 2. Stack tecnológica (Framework PSCS)

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + componentes reutilizáveis PSCS |
| Backend / API | Next.js API Routes + Supabase Client |
| Banco de dados | PostgreSQL (Supabase) |
| Autenticação | Supabase Auth |
| Hospedagem | Vercel (frontend) + Supabase (backend/DB) |
| IDE / IA | Cursor |

---

## 3. Módulos funcionais

```
GRX Management
├── Core
│   ├── Autenticação e multiempresa
│   ├── Cadastros mestres
│   └── Configurações (DRE, tipos, preços)
├── Financeiro
│   ├── Lançamentos (realizado)
│   ├── Fluxo de caixa (projetado)
│   └── Conciliação
├── Frota
│   ├── Veículos e participação societária
│   ├── Motoristas
│   ├── Vencimentos e alertas
│   └── Histórico de eventos
├── Estacionamento
│   ├── Movimentos (entrada/saída)
│   └── Cobrança automática por vigência
├── Lava-rápido
│   ├── Serviços
│   └── Cobrança automática por vigência
└── Dashboards
    ├── Executivo (sócios)
    ├── Frota (veículos)
    ├── Participação societária
    ├── Motoristas
    └── Estacionamento/Lava-rápido
```

---

## 4. Arquitetura em camadas

```
┌─────────────────────────────────────────────┐
│              FRONTEND (Next.js)             │
│  Pages / Components / Hooks / Forms         │
└──────────────────┬──────────────────────────┘
                   │ REST / Supabase Client
┌──────────────────▼──────────────────────────┐
│           API LAYER (Next.js Routes)        │
│  Validação / Regras de negócio / Autorização│
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│          SUPABASE (PostgreSQL + Auth)       │
│  Tabelas / Views / Triggers / RLS           │
└─────────────────────────────────────────────┘
```

---

## 5. Multiempresa

- Tabela `companies` como raiz
- Todas as tabelas operacionais possuem `company_id`
- **Row Level Security (RLS)** no Supabase filtra por empresa do usuário logado
- Usuário pode pertencer a uma ou mais empresas (futuro)

---

## 6. Regras de negócio na arquitetura

| Regra | Onde implementar |
|-------|------------------|
| Classificação via DRE | API: ao salvar lançamento, buscar conta DRE e preencher classification/type |
| Participação = 100% | Trigger PostgreSQL (já no schema) |
| Cálculo de diárias estacionamento | API + função SQL |
| Preço vigente | Função SQL `get_active_price(modality, type, service, date)` |
| Totais por veículo | View `vw_vehicle_financial_totals` |
| Atribuição societária | View `vw_ownership_base` |
| Alertas de vencimento | Job/cron ou query na view com filtro de dias |

---

## 7. Segurança

- Autenticação via Supabase Auth (email/senha)
- RLS em todas as tabelas por `company_id`
- Perfis de acesso:
  - **Admin:** todos os módulos + configurações
  - **Financeiro:** lançamentos, fluxo de caixa, relatórios
  - **Operacional:** estacionamento, lava-rápido, frota
  - **Sócio (read-only):** dashboards executivo e participação

---

## 8. Integrações futuras (fora do escopo V1)

- Emissão de NFSe
- Integração bancária / OFX
- WhatsApp para alertas de vencimento
- App mobile para operador de estacionamento

---

## 9. Estrutura de pastas do projeto

```
grx-management/
├── docs/                  # Documentação (este conjunto)
├── database/              # Scripts SQL
├── supabase/              # Migrations Supabase
├── frontend/              # Next.js app
│   ├── app/               # App Router pages
│   ├── components/        # UI components
│   ├── lib/               # Supabase client, utils
│   └── types/             # TypeScript types
├── excel/                 # Planilha origem + scripts importação
└── tests/                 # Testes automatizados
```

---

## 10. Decisões arquiteturais

| Decisão | Justificativa |
|---------|---------------|
| Supabase | Framework PSCS padrão; RLS nativo; auth integrado |
| Views para dashboards | Evita duplicar lógica de cálculo; performance |
| Triggers para participação | Integridade garantida no banco |
| Cadastros antes de lançamentos | Resolve problema #1 da planilha (dados livres) |
| Preços com vigência | Preserva histórico; regra RN-101 |
| Separação Van/Rateio | Dois FKs distintos em financial_transactions |

---

## Histórico de versões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 02/07/2026 | PSCS | Arquitetura inicial |
