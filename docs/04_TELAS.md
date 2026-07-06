# GRX Management — Telas e Funcionalidades

Versão: 1.0  
Data: 02/07/2026

---

## 1. Navegação principal

```
├── Dashboard Executivo
├── Financeiro
│   ├── Lançamentos
│   └── Fluxo de Caixa
├── Frota
│   ├── Veículos
│   ├── Participação Societária
│   ├── Motoristas
│   ├── Vencimentos
│   └── Histórico
├── Estacionamento
│   ├── Movimentos
│   └── Preços
├── Lava-rápido
│   ├── Serviços
│   └── Preços (compartilhado)
├── Relatórios
│   ├── Por Veículo
│   ├── Por Sócio
│   ├── Por Motorista
│   └── Mensal
└── Cadastros
    ├── Sócios
    ├── Clientes
    ├── Fornecedores
    ├── Contas DRE
    └── Tipos de Veículo
```

---

## 2. Telas detalhadas

### 2.1 Login
- Email + senha
- Redireciona para Dashboard Executivo

---

### 2.2 Dashboard Executivo
**Substitui:** Dashboard_Executivo_GRX, Dashboard_GRX

| Elemento | Descrição |
|----------|-----------|
| Cards KPI | Receita Total, Despesa Total, Resultado, Margem Média |
| Tabela veículos | Placa, Receita, Despesa, Resultado, Margem, Status |
| Tabela sócios | Sócio, Receita Atribuída, Resultado Atribuído, % Total |
| Alertas | Vencimentos próximos (≤ 30 dias) |
| Filtro | Período (mês, trimestre, ano, customizado) |

**Ações:** clicar em veículo → Dashboard Veículo; clicar em sócio → Dashboard Participação

---

### 2.3 Lançamentos Financeiros
**Substitui:** Controle financeiro

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Data | Date picker | Sim |
| Valor | Currency | Sim |
| Tipo | Badge (derivado) | Auto |
| Conta DRE | Select (cadastro) | Sim |
| Classificação | Badge (derivado) | Auto |
| Cliente | Select (se Receita) | Sim* |
| Fornecedor | Select (se Despesa) | Sim* |
| Data do Serviço | Date picker | Não |
| Motorista | Select (cadastro) | Não |
| Van Operacional | Select (veículos) | Não |
| Rateio | Select (veículos) | Recomendado |
| Descrição | Textarea | Não |

**Funcionalidades:**
- Listagem paginada com filtros
- Botão "+ Novo Lançamento"
- Botão "+ Cadastro rápido" (cliente/fornecedor inline)
- Alerta se Rateio vazio em lançamento com valor alto
- Exportar CSV

---

### 2.4 Fluxo de Caixa
**Substitui:** Fluxo de caixa

Mesmos campos do lançamento + Status (Projetado/Realizado/Cancelado).

**Funcionalidades:**
- Visualização timeline/calendário (futuro)
- Botão "Marcar como Realizado" → cria lançamento vinculado
- Filtro: apenas futuros / todos

---

### 2.5 Veículos
**Substitui:** Cadastro_Veiculos

| Campo | Tipo |
|-------|------|
| Código | Auto |
| Placa | Text (normalizada) |
| Modelo, Ano | Text/Number |
| Categoria | Select |
| Responsável Operacional | Select (sócios) |
| Status | Select |
| Observações | Textarea |

**Painel lateral:** Receita, Despesa, Resultado (calculados, somente leitura)

**Ações:** Ver Participação | Ver Lançamentos | Ver Vencimentos

---

### 2.6 Participação Societária
**Substitui:** Participacao_Veiculo

- Selecionar veículo
- Tabela de sócios com percentual
- Barra visual de distribuição (deve totalizar 100%)
- Toggle "Responsável Operacional"
- Validação em tempo real da soma

---

### 2.7 Motoristas
**Substitui:** Cadastro_Motoristas

- CRUD padrão
- Alerta ao digitar nome similar a existente
- Link para Dashboard Motorista individual

---

### 2.8 Vencimentos
**Substitui:** Agenda_Vencimentos_GRX

| Campo | Tipo |
|-------|------|
| Veículo | Select |
| Tipo Documento | Select |
| Descrição | Text |
| Data Vencimento | Date |
| Responsável | Select (sócios) |
| Valor Previsto | Currency |
| Pago? | Select (Não/Pago/Parcial) |

**Visual:** calendário + lista com badges de alerta (Normal/Atenção/Crítico/Vencido)

---

### 2.9 Histórico de Veículos
**Substitui:** Historico_Veiculos_GRX

- Timeline por veículo
- Tipos de evento configuráveis
- Vínculo opcional com lançamento financeiro

---

### 2.10 Estacionamento — Movimentos
**Substitui:** Controle_Estacionamento

| Campo | Tipo |
|-------|------|
| Placa | Text |
| Tipo Veículo | Select |
| Marca, Modelo, Ano | Text |
| Cliente, Telefone | Text |
| Data/Hora Entrada | DateTime |
| Data/Hora Saída | DateTime |
| Diárias | Calculado (readonly) |
| Valor Diária | Calculado (readonly) |
| Valor Total | Calculado (readonly) |
| Status | Select |

**Fluxo:**
1. Operador registra entrada → status Aberto
2. No checkout, informa saída → sistema calcula diárias e valor
3. Status → Finalizado

---

### 2.11 Lava-rápido — Serviços
**Substitui:** Controle_Lava_Rapido

Similar ao estacionamento, com:
- Serviço (select da tabela de preços)
- Valor calculado automaticamente
- Forma de pagamento
- Status: Aberto → Concluído

---

### 2.12 Tabela de Preços
**Substitui:** Tabela_Precos_Vigencia

| Campo | Tipo |
|-------|------|
| Modalidade | Estacionamento / Lava-rápido |
| Tipo Veículo | Select |
| Serviço | Select |
| Valor | Currency |
| Unidade | Select |
| Vigência Início | Date |
| Vigência Fim | Date (opcional) |
| Status | Ativo/Inativo |

**Regra UI:** botão "Novo Preço" (nunca editar valor de preço ativo — criar nova vigência)

---

### 2.13 Cadastros auxiliares

| Tela | Campos principais |
|------|-------------------|
| Sócios | Código, Nome, Tipo, Status |
| Clientes | Código, Nome, CNPJ/CPF, Contato, Cidade |
| Fornecedores | Código, Nome, Categoria, CNPJ/CPF |
| Contas DRE | Nome, Classificação, Tipo, Status |
| Tipos Veículo | Código, Nome, Categoria Uso |

---

## 3. Princípios de UX (Framework PSCS)

1. **Menos cliques que a planilha** — lançamento financeiro em ≤ 5 campos visíveis + expandir detalhes
2. **Selects, não digitação** — todo campo com cadastro usa dropdown com busca
3. **Feedback imediato** — validações inline (participação, duplicidade, preço)
4. **Mobile-friendly** — estacionamento e lava-rápido usáveis em tablet/celular
5. **Consistência** — mesma estrutura de listagem/CRUD em todos os cadastros

---

## Histórico de versões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 02/07/2026 | PSCS | Especificação inicial de telas |
