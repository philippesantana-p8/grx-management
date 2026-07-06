# GRX Management — Regras de Negócio

Versão: 1.0  
Data: 02/07/2026  
Status: Aprovado para modelagem  
Origem: `Financeiro_Rafa_GRX_V3_Estacionamento_LavaRapido.xlsx`

---

## 1. Escopo do sistema

O GRX Management substitui a planilha financeira-operacional da GRX, cobrindo:

1. **Transporte executivo** (vans, transfers, diárias, agregamentos)
2. **Gestão societária** (participação de sócios por veículo)
3. **Estacionamento** (controle de entrada/saída com cobrança por diária)
4. **Lava-rápido** (controle de serviços com precificação por tipo)

---

## 2. Atores

| Ator | Descrição |
|------|-----------|
| Sócio | Participa da propriedade de veículos e visualiza resultados atribuídos |
| Operador financeiro | Registra lançamentos, concilia e projeta fluxo de caixa |
| Operador de frota | Gerencia veículos, motoristas, documentos e histórico |
| Operador estacionamento/lava-rápido | Registra entradas, saídas e serviços |
| Administrador | Configura cadastros, contas DRE, preços e participações |
| Empresa (GRX) | Entidade corporativa distinta dos sócios individuais |

---

## 3. Regras gerais

### RN-001 — Multiempresa
Todo dado pertence a uma empresa (`company_id`). Cadastros, lançamentos e relatórios são isolados por empresa.

### RN-002 — Cadastro único
Veículos, sócios, motoristas, clientes, fornecedores e contas DRE devem ser selecionados de cadastros. Não é permitido digitar valores livres em campos que possuem cadastro associado.

### RN-003 — Status padrão
Entidades cadastráveis possuem status: `Ativo`, `Inativo`, `Pendente`, `Encerrado` (conforme contexto).

### RN-004 — Auditoria
Todo registro transacional deve registrar: data de criação, usuário criador, data de alteração e usuário alterador.

---

## 4. Plano de contas (DRE)

### RN-010 — Conta DRE obrigatória
Todo lançamento financeiro (realizado ou projetado) deve possuir uma Conta DRE válida e ativa.

### RN-011 — Classificação automática
Ao selecionar a Conta DRE, o sistema preenche automaticamente:
- **Classificação** (Receitas, Operacional, Administrativo, RH, Finanças, Ocupação, TI, Marketing, Lavagens, Taxas e Tributos, Movimentações)
- **Tipo** (Receita, Despesa ou Outros)

O usuário **não altera** classificação e tipo manualmente — eles derivam da conta.

### RN-012 — Conta DRE imutável em lançamentos históricos
Se uma conta DRE for inativada, lançamentos antigos mantêm a referência. Novos lançamentos não podem usar contas inativas.

---

## 5. Lançamentos financeiros (Controle financeiro)

### RN-020 — Campos obrigatórios
Data, Valor, Conta DRE e Tipo (derivado) são obrigatórios.

### RN-021 — Valor positivo
Valor é sempre positivo. O Tipo (Receita/Despesa) define a natureza do lançamento.

### RN-022 — Van operacional
Campo **Van** identifica o veículo utilizado na operação do serviço. Deve ser selecionado do cadastro de veículos quando informado.

### RN-023 — Rateio societário
Campo **Rateio** identifica o veículo/centro de custo ao qual o resultado financeiro será **atribuído** para fins societários. Deve ser selecionado do cadastro de veículos ou centros de rateio configurados.

### RN-024 — Van ≠ Rateio
Van operacional e Rateio societário são conceitos distintos e podem ser diferentes no mesmo lançamento.

**Exemplo:** serviço operado com van GHR, rateado para SWU9H17.

### RN-025 — Cliente/Fornecedor
Deve ser selecionado do cadastro de clientes (receitas) ou fornecedores (despesas). Em casos excepcionais, o administrador pode cadastrar rapidamente antes de concluir o lançamento.

### RN-026 — Motorista
Quando informado, deve ser selecionado do cadastro de motoristas.

### RN-027 — Data do serviço
Quando aplicável (corridas, transfers), a data do serviço pode diferir da data do pagamento/recebimento.

### RN-028 — Descrição
Campo livre para detalhamento operacional (origem, destino, referência de parcela, etc.).

---

## 6. Fluxo de caixa (projeções)

### RN-030 — Natureza projetada
Lançamentos de fluxo de caixa representam **compromissos futuros** (contas a pagar/receber, parcelas recorrentes).

### RN-031 — Mesma estrutura classificatória
Segue as mesmas regras de Conta DRE (RN-010 a RN-012).

### RN-032 — Consolidação por veículo
Totais por veículo consideram: **realizado (Controle financeiro) + projetado (Fluxo de caixa)**.

### RN-033 — Conciliação futura
Quando um lançamento projetado se concretiza, deve ser marcado como realizado e vinculado ao lançamento efetivo correspondente (evitar duplicidade).

---

## 7. Gestão societária

### RN-040 — Participação por veículo
Cada veículo possui uma ou mais participações societárias, cada uma com percentual entre 0,01 e 100,00 (ex.: 60,00 = 60%).

### RN-041 — Soma de percentuais
A soma dos percentuais de participação ativos de um veículo deve ser **exatamente 100%**. O sistema impede gravação se a soma exceder 100%.

### RN-042 — Responsável operacional
O responsável operacional do veículo é definido em `vehicles.operational_partner_id`, não na participação societária.

### RN-043 — Vigência de participação
Participação possui `effective_date` (início) e, opcionalmente, `end_date` (fim). Participações encerradas não entram no cálculo atual.

### RN-044 — Entidade GRX
"GRX" como sócio representa a operação corporativa (veículo/receita da empresa, não de sócio individual).

### RN-045 — Receita atribuída
```
Receita Atribuída (sócio, veículo) = Receita Total do Veículo × Percentual de Participação
```

### RN-046 — Despesa atribuída
```
Despesa Atribuída (sócio, veículo) = Despesa Total do Veículo × Percentual de Participação
```

### RN-047 — Resultado atribuído
```
Resultado Atribuído = Receita Atribuída − Despesa Atribuída
```

### RN-048 — Percentual do resultado total
```
% Resultado Total (sócio) = Resultado Atribuído do Sócio / Resultado Total da Empresa
```

---

## 8. Veículos e frota

### RN-050 — Identificação por placa
A placa (Van/Placa) é o identificador operacional principal do veículo. Deve ser única por empresa.

### RN-051 — Totais calculados
Receita Total, Despesa Total e Resultado do veículo são **calculados** a partir dos lançamentos (realizado + projetado), nunca digitados manualmente.

### RN-052 — Margem
```
Margem = Resultado / Receita Total  (quando Receita > 0)
```

### RN-053 — Normalização de placa
O sistema armazena placa normalizada (sem espaços, maiúsculas) para evitar duplicidade (ex.: "GHR" vs "GHR2C77" devem ser tratados como cadastros distintos, mas o operador deve ser alertado sobre similaridade).

---

## 9. Motoristas

### RN-060 — Cadastro único
Motorista é cadastrado uma única vez. Nomes similares geram alerta de possível duplicidade (ex.: Cristovão / Cristóvão).

### RN-061 — Tipos
Motorista pode ser: Empregado, Agregado, Terceiro ou Prestador.

### RN-062 — Performance financeira
Dashboard de motoristas consolida receitas e despesas vinculadas ao motorista nos lançamentos financeiros.

---

## 10. Clientes e fornecedores

### RN-070 — Cliente em receitas
Lançamentos de receita devem referenciar cliente cadastrado.

### RN-071 — Fornecedor em despesas
Lançamentos de despesa devem referenciar fornecedor cadastrado.

### RN-072 — Categorias de fornecedor
Fornecedor possui categoria: Combustível, Manutenção, Seguro, Documentação, Pneus, RH, Finanças, Outros.

---

## 11. Estacionamento

### RN-080 — Registro de movimento
Cada estacionamento gera um movimento com: placa, tipo de veículo, datas/horas de entrada e saída, status.

### RN-081 — Status do movimento
Valores permitidos: `Aberto`, `Finalizado`, `Cancelado`.

### RN-082 — Cálculo de diárias
```
Diárias = MAX(1, Data Saída − Data Entrada + 1)
```
Mínimo de 1 diária, mesmo em permanência parcial.

### RN-083 — Preço vigente
Valor da diária é obtido da Tabela de Preços vigente na **data de entrada**, filtrando: Modalidade = Estacionamento, Tipo de Veículo, Serviço = Diária Estacionamento, Status = Ativo.

### RN-084 — Valor total
```
Valor Total = Diárias × Valor Diária
```
Calculado automaticamente. Movimentos abertos (sem saída) não calculam valor total.

### RN-085 — Cancelamento
Movimentos cancelados não entram em receita.

---

## 12. Lava-rápido

### RN-090 — Registro de serviço
Cada serviço gera registro com: data do serviço, placa, tipo de veículo, serviço, status.

### RN-091 — Status do serviço
Valores permitidos: `Aberto`, `Concluído`, `Cancelado`.

### RN-092 — Preço vigente
Valor do serviço é obtido da Tabela de Preços vigente na **data do serviço**, filtrando: Modalidade = Lava Rápido, Tipo de Veículo, Serviço selecionado, Status = Ativo.

### RN-093 — Serviços disponíveis
Lavagem Simples, Lavagem Completa, Lavagem Técnica, Higienização Interna, Polimento.

### RN-094 — Forma de pagamento
Opcional: Pix, Dinheiro, Cartão, Faturado, Outros.

---

## 13. Tabela de preços

### RN-100 — Vigência obrigatória
Todo preço possui data de início de vigência. Data de fim é opcional (vigência aberta).

### RN-101 — Não sobrescrever histórico
Para alterar um preço, cria-se **nova linha** com nova vigência. Preços anteriores são preservados.

### RN-102 — Chave de preço
Combinação única por vigência: Modalidade + Tipo de Veículo + Serviço.

### RN-103 — Unidades de cobrança
Diária, Serviço, Hora, Mensal.

### RN-104 — Status do preço
Ativo ou Inativo. Apenas preços ativos e dentro da vigência são usados em cálculos.

---

## 14. Agenda de vencimentos

### RN-110 — Documentos controlados
Seguro, IPVA, Licenciamento, Tacógrafo, CRLV, Contrato e outros configuráveis.

### RN-111 — Alertas
Sistema calcula dias restantes até vencimento e exibe status: Normal, Atenção (≤ 30 dias), Crítico (≤ 7 dias), Vencido.

### RN-112 — Pagamento
Campo Pago: Sim, Não, Parcial. Vencimentos pagos saem dos alertas ativos.

---

## 15. Histórico de veículos

### RN-120 — Eventos registráveis
Manutenção preventiva/corretiva, troca de óleo/pneus, documento renovado, multa, sinistro, revisão, abastecimento, lavagem.

### RN-121 — Vínculo opcional
Evento pode gerar lançamento financeiro vinculado (ex.: manutenção → despesa).

---

## 16. Relatórios e dashboards

### RN-130 — Resultado mensal
```
Resultado Mês = Receita do Mês − Despesa do Mês
Saldo Acumulado = Saldo Anterior + Resultado Mês
```

### RN-131 — Filtro por período
Todos os dashboards respeitam filtro de período (mês, trimestre, ano, intervalo customizado).

### RN-132 — Dashboard executivo
Consolida: Receita Total, Despesa Total, Resultado Total, Margem Média, visão por veículo e por sócio.

### RN-133 — Integração estacionamento/lava-rápido
Receitas de estacionamento e lava-rápido alimentam dashboards específicos e, futuramente, o DRE (conta configurável por modalidade).

---

## 17. Regras de validação e qualidade de dados

### RN-140 — Alerta de placa similar
Ao cadastrar veículo ou lançamento, se placa parcial coincidir com existente (ex.: GHR vs GHR2C77), exibir alerta.

### RN-141 — Alerta de motorista duplicado
Ao cadastrar motorista, buscar nomes similares (fonética/sem acento) e alertar.

### RN-142 — Alerta de participação incompleta
Veículo com lançamentos financeiros mas sem participação societária definida gera alerta no dashboard.

### RN-143 — Alerta de vencimento
Documentos com vencimento nos próximos 30 dias aparecem na agenda e no dashboard executivo.

---

## 18. Prioridade de correção (legado da planilha)

Itens identificados na planilha que o sistema deve resolver:

| # | Problema legado | Regra sistêmica |
|---|-----------------|-----------------|
| 1 | 45 variações de placa | RN-002, RN-050, RN-053 |
| 2 | Cliente/fornecedor livre | RN-025, RN-070, RN-071 |
| 3 | Motoristas duplicados | RN-002, RN-060, RN-061 |
| 4 | Participação incompleta | RN-040, RN-041, RN-142 |
| 5 | Van ≠ Rateio confuso | RN-022, RN-023, RN-024 |
| 6 | Preços sobrescritos | RN-101 |
| 7 | Vencimentos sem controle | RN-110, RN-111, RN-143 |

---

## Histórico de versões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 02/07/2026 | PSCS | Regras derivadas da análise funcional da planilha V3 |
