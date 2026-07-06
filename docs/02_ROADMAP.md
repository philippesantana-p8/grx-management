# GRX Management — Roadmap

Versão: 1.0  
Data: 02/07/2026

---

## Fase 0 — Modelagem ✅

- [x] Análise funcional da planilha Excel V3
- [x] Regras de negócio documentadas
- [x] Modelagem planilhas → entidades
- [x] Modelagem do banco de dados
- [x] Arquitetura definida
- [x] Especificação de telas, dashboards e API

---

## Fase 1 — Fundação (Sprint 1–2) ✅

**Objetivo:** infraestrutura + cadastros mestres

- [x] Setup Supabase (projeto, auth, RLS)
- [x] Aplicar schema SQL (`database/001_schema_grx.sql`)
- [x] Setup Next.js frontend
- [x] Autenticação (login/logout)
- [x] Layout base (sidebar, header, multiempresa)
- [x] CRUD: Empresa, Sócios, Veículos
- [x] CRUD: Contas DRE
- [x] CRUD: Motoristas (com alerta de duplicidade)
- [x] CRUD: Clientes e Fornecedores
- [x] Seed: importar 81 contas DRE da planilha

**Entrega:** cadastros funcionais, sem lançamentos ainda.

---

## Fase 2 — Financeiro Core (Sprint 3–4)

**Objetivo:** substituir aba "Controle financeiro"

- [ ] CRUD: Lançamentos financeiros
- [ ] Seleção obrigatória de cadastros (sem digitação livre)
- [ ] Van operacional vs Rateio societário (dois campos distintos)
- [ ] Classificação automática via Conta DRE
- [ ] Listagem com filtros (data, tipo, veículo, motorista, conta)
- [ ] CRUD: Fluxo de caixa (projeções)
- [ ] Conciliação: projetado → realizado
- [ ] Importação: 1.930 lançamentos históricos da planilha

**Entrega:** módulo financeiro operacional com dados migrados.

---

## Fase 3 — Societário e Frota (Sprint 5)

**Objetivo:** participação societária + gestão de frota

- [ ] CRUD: Participação por veículo (com validação 100%)
- [ ] CRUD: Agenda de vencimentos (seguro, IPVA, CRLV)
- [ ] CRUD: Histórico de veículos
- [ ] Alertas de vencimento (Normal/Atenção/Crítico/Vencido)
- [ ] Completar participação de SUY3I05, Luca, Sérgio

**Entrega:** gestão societária e compliance de frota.

---

## Fase 4 — Dashboards (Sprint 6)

**Objetivo:** substituir abas analíticas da planilha

- [ ] Dashboard Executivo (receita, despesa, resultado, margem)
- [ ] Dashboard por Veículo (ranking, margem)
- [ ] Dashboard de Participação Societária
- [ ] Dashboard de Motoristas
- [ ] Relatório mensal (resultado + saldo acumulado)
- [ ] Filtro por período em todos os dashboards
- [ ] Perfil sócio: acesso read-only aos dashboards

**Entrega:** visão gerencial completa para transporte.

---

## Fase 5 — Estacionamento e Lava-rápido (Sprint 7–8)

**Objetivo:** operacionalizar módulo V3

- [ ] CRUD: Tipos de veículos
- [ ] CRUD: Tabela de preços com vigência
- [ ] CRUD: Controle de estacionamento (entrada/saída)
- [ ] Cálculo automático: diárias × preço vigente
- [ ] CRUD: Controle de lava-rápido
- [ ] Cálculo automático: preço por serviço vigente
- [ ] Dashboard Estacionamento/Lava-rápido
- [ ] Status: abertos, finalizados, cancelados

**Entrega:** módulo estacionamento/lava-rápido operacional.

---

## Fase 6 — Qualidade e Entrega (Sprint 9)

**Objetivo:** validação e go-live

- [ ] Testes de regras de negócio (RN-001 a RN-143)
- [ ] Testes de importação e integridade de dados
- [ ] Validação com usuário GRX (Rafa)
- [ ] Documentação de usuário
- [ ] Deploy produção (Vercel + Supabase)
- [ ] Treinamento operacional

**Entrega:** sistema em produção substituindo a planilha.

---

## Priorização resumida

| Prioridade | Módulo | Justificativa |
|------------|--------|---------------|
| P0 | Cadastros + Financeiro | 90% do uso diário atual |
| P0 | Participação societária | Diferencial do negócio GRX |
| P1 | Dashboards | Decisão gerencial |
| P1 | Vencimentos/Alertas | Risco operacional (multas, seguro) |
| P2 | Estacionamento/Lava-rápido | Novo negócio, ainda em implantação |
| P2 | Histórico de veículos | Complementar |

---

## Estimativa

| Fase | Duração estimada |
|------|------------------|
| Fase 1 | 2 sprints |
| Fase 2 | 2 sprints |
| Fase 3 | 1 sprint |
| Fase 4 | 1 sprint |
| Fase 5 | 2 sprints |
| Fase 6 | 1 sprint |
| **Total** | **~9 sprints** |

---

## Histórico de versões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 02/07/2026 | PSCS | Roadmap inicial |
