# GRX Management — Dashboards

Versão: 1.0  
Data: 02/07/2026

---

## 1. Dashboard Executivo

**Substitui:** Dashboard_Executivo_GRX, Dashboard_GRX  
**Público:** Sócios, administradores  
**Frequência:** Diária

### KPIs

| Indicador | Fórmula | Formato |
|-----------|---------|---------|
| Receita Total | SUM(receitas) | R$ |
| Despesa Total | SUM(despesas) | R$ |
| Resultado Total | Receita − Despesa | R$ |
| Margem Média | Resultado / Receita | % |

### Seções

1. **Cards KPI** — 4 cards no topo
2. **Performance por Veículo** — tabela ordenada por resultado DESC
3. **Participação Societária** — tabela por sócio com % do total
4. **Alertas de Vencimento** — lista dos próximos 30 dias
5. **Gráfico tendência** — resultado mensal (últimos 12 meses)

### Filtros
- Período: mês atual (default), mês anterior, trimestre, ano, customizado
- Incluir projeções: toggle (default off)

---

## 2. Dashboard por Veículo

**Substitui:** Dashboard_Veiculos  
**Público:** Sócios, operacional

### KPIs por placa

| Indicador | Descrição |
|-----------|-----------|
| Receita Total | Realizado + projetado |
| Despesa Total | Realizado + projetado |
| Resultado | Receita − Despesa |
| Margem | Resultado / Receita |
| Status | Ativo/Inativo |

### Visualizações
- Ranking de veículos (bar chart)
- Detalhamento por Conta DRE (top 5 despesas, top 5 receitas)
- Timeline de lançamentos recentes

### Destaque
- Veículos com margem < 25% → badge vermelho
- Veículos sem participação definida → badge alerta

---

## 3. Dashboard de Participação Societária

**Substitui:** Dashboard_Participacao  
**Público:** Sócios (principal)

### Tabela detalhada

| Coluna | Descrição |
|--------|-----------|
| Sócio | Nome |
| Veículo | Placa |
| % Participação | Percentual |
| Receita Atribuída | Receita × % |
| Despesa Atribuída | Despesa × % |
| Resultado Atribuído | Receita Attr. − Despesa Attr. |

### Consolidado por sócio

| Coluna | Descrição |
|--------|-----------|
| Sócio | Nome |
| Receita Atribuída Total | SUM |
| Despesa Atribuída Total | SUM |
| Resultado Atribuído Total | SUM |
| % do Resultado Total | Proporção |

### Visualizações
- Pie chart: distribuição do resultado entre sócios
- Bar chart: resultado por veículo × sócio

---

## 4. Dashboard de Motoristas

**Substitui:** Dashboard_Motoristas  
**Público:** Operacional, financeiro

| Coluna | Descrição |
|--------|-----------|
| Motorista | Nome |
| Receita Total | Soma receitas vinculadas |
| Despesa Total | Soma despesas vinculadas |
| Resultado | Receita − Despesa |
| Qtde Lançamentos | COUNT |

### Visualizações
- Top 10 motoristas por receita
- Top 10 por quantidade de corridas

### Nota
Motoristas aparecem como receita (geradores) e despesa (pagamentos) — filtro por tipo disponível.

---

## 5. Dashboard Estacionamento e Lava-rápido

**Substitui:** Dashboard_Estac_Lava  
**Público:** Operacional

### KPIs

| Indicador | Fonte |
|-----------|-------|
| Receita Estacionamento | SUM(parking_movements.total_amount) WHERE Finalizado |
| Receita Lava-rápido | SUM(car_wash_services.service_amount) WHERE Concluido |
| Receita Total | Soma |
| Veículos Estacionados Abertos | COUNT status=Aberto |
| Serviços Lava-rápido Abertos | COUNT status=Aberto |

### Tabelas
- Receita por Tipo de Veículo (estacionamento + lava-rápido + total)
- Status operacional (Aberto/Finalizado/Concluído/Cancelado)

### Filtros
- Período
- Modalidade (Estacionamento / Lava-rápido / Ambos)

---

## 6. Relatório Mensal

**Substitui:** Relatório (aba)

### Tabela 1 — Resultado por Mês

| Coluna | Descrição |
|--------|-----------|
| Período | Ano/Mês |
| Despesa | Total despesas |
| Receita | Total receitas |
| Resultado | Receita − Despesa |
| Saldo Acumulado | Soma corrente |

### Tabela 2 — Resultado por Rateio/Centro

| Coluna | Descrição |
|--------|-----------|
| Rateio | Veículo/Centro |
| Despesa | Total |
| Receita | Total |
| Resultado | Diferença |

### Exportação
- PDF
- Excel/CSV

---

## 7. Permissões por dashboard

| Dashboard | Admin | Financeiro | Operacional | Sócio |
|-----------|-------|------------|-------------|-------|
| Executivo | ✅ | ✅ | ❌ | ✅ (read) |
| Veículo | ✅ | ✅ | ✅ | ✅ (read) |
| Participação | ✅ | ✅ | ❌ | ✅ (read) |
| Motoristas | ✅ | ✅ | ✅ | ❌ |
| Estac/Lava | ✅ | ✅ | ✅ | ❌ |
| Relatório Mensal | ✅ | ✅ | ❌ | ✅ (read) |

---

## Histórico de versões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 02/07/2026 | PSCS | Especificação inicial de dashboards |
