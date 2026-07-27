## Recomendação de banco de dados

**Lovable Cloud (Supabase por baixo)**. Motivos:
- Autenticação pronta (e-mail + senha) sem servidor próprio.
- Postgres relacional — ideal para clientes, vendas, serviços e relatórios com somas por período (semana/mês).
- Row Level Security (RLS) garante que cada usuário só veja os próprios clientes/lançamentos.
- Integra direto com o front sem precisar hospedar Node/MongoDB.

Firebase seria pior aqui: agrupar valores por semana/mês em NoSQL é mais trabalhoso e caro.

## Escopo e regra de ouro

Mantém HTML/CSS/tipografia/paleta atual (preto, editorial, tipografia condensada, cards com bordas finas). Só troco textos e adiciono novas telas reaproveitando as classes existentes (`section-dark`, `service-card`, `deliverable-card`, `button--primary`, `faq-item`, etc.). Nenhuma cor nova, nenhuma fonte nova.

## 1. Limpeza de textos "IA"

Substituições em `src/routes/index.tsx`:
- "Social IA Pro" → "Sistema de Gestão"
- "DOMINE A IA E TRANSFORME SUAS REDES SOCIAIS" → "GERENCIE CLIENTES, SERVIÇOS E CAIXA EM UM SÓ PAINEL"
- "Quero Dominar a IA Agora" → "Acessar o Painel"
- "O QUE VOCÊ GANHA COM O SOCIAL IA PRO" → "O QUE O PAINEL DE CONTROLE OFERECE"
- Cards Agilidade/Clareza/Escala → "Cadastro de Clientes", "Controle de Caixa", "Fechamento Mensal" (copy adaptada).
- "TREINAMENTO IA PARA REDES SOCIAIS" → "PAINEL DE GESTÃO COMPLETO".
- FAQ reescrito para dúvidas de sistema (login, dados, fechamento).
- Meta title/description atualizados.

## 2. Autenticação

- Habilitar Lovable Cloud.
- Login por e-mail + senha, política simples (sem exigência de maiúscula/número/especial — deixo o mínimo de 6 caracteres do Supabase, que é o menor permitido).
- Sem tabela de perfis extra (usuário não precisa de nome/avatar agora).
- Rota `/auth` pública com abas Entrar / Criar conta.
- Rota `/_authenticated/` (gate gerenciado pela integração) contendo painel, clientes e caixa.
- Landing pública em `/` com CTA "Acessar o Painel" que leva a `/auth` (ou direto ao painel se logado).

## 3. Banco de dados (migração Lovable Cloud)

Tabelas em `public`, todas com `owner_id uuid references auth.users(id)` e RLS `owner_id = auth.uid()`:

- `clients` — `id, owner_id, name, email, phone, notes, created_at`
- `products` — `id, owner_id, name, default_price numeric, created_at` (produto principal reutilizável)
- `sales` — `id, owner_id, client_id, product_id, description, amount numeric, occurred_at date, kind text check in ('produto','servico'), created_at`

Índices: `sales(owner_id, occurred_at)`, `sales(client_id)`, `clients(owner_id, name)`.

GRANTs `SELECT, INSERT, UPDATE, DELETE` para `authenticated`; `ALL` para `service_role`. Sem acesso a `anon`.

## 4. Telas novas (dentro de `_authenticated/`)

Todas reutilizando `section-dark`, cards já existentes, tipografia atual.

- `/painel` — Dashboard de caixa
  - Filtro Semana / Mês (botões estilo `button--comparison`).
  - Totais: entradas totais, produtos, serviços, nº de clientes ativos.
  - Lista das últimas vendas (tabela minimalista com bordas `rgba(255,255,255,.08)`).

- `/clientes` — Lista
  - Campo de busca por nome (input dark, mesma borda dos cards).
  - Botão "Novo cliente" (`button--primary`).
  - Cards no grid de 3 colunas usando o layout de `service-card`.

- `/clientes/$id` — Perfil
  - Cabeçalho com nome/contato.
  - Botão "Adicionar venda/serviço" abre modal (produto principal ou serviço adicional, data, valor, descrição).
  - Levantamento mensal: seletor de mês; tabela com data, tipo, descrição, valor; totais no rodapé.
  - Botão "Gerar Fechamento / Recibo" → abre página imprimível `/clientes/$id/fechamento?mes=YYYY-MM` com CSS `@media print`, cabeçalho, tabela, total, "pago/em aberto", e botão "Imprimir / Salvar em PDF" (usa `window.print()`; salvar como PDF vem do próprio diálogo do navegador — sem dependência extra).

## 5. Lógica de caixa

- Server functions (`createServerFn` + `requireSupabaseAuth`) para:
  - `listClients({ search })`
  - `getClient({ id })`
  - `createClient`, `updateClient`, `deleteClient`
  - `listSales({ clientId?, from, to })`
  - `createSale`, `deleteSale`
  - `getCashSummary({ range: 'week' | 'month' })` — usa `sum(amount)` agrupado no Postgres.
  - `getMonthlyClosing({ clientId, month })` — retorna itens + total do mês.

- Front usa TanStack Query (`useSuspenseQuery` + `queryOptions`) no padrão do template.

## 6. Estrutura de arquivos

```text
src/routes/
  index.tsx                 (landing atualizada, sem termos de IA)
  auth.tsx                  (login/cadastro)
  _authenticated/
    route.tsx               (gate gerenciado pela integração)
    painel.tsx              (dashboard caixa)
    clientes/
      index.tsx             (lista + busca)
      $id.tsx               (perfil + levantamento mensal)
      $id.fechamento.tsx    (recibo imprimível)
src/lib/
  clients.functions.ts
  sales.functions.ts
  cash.functions.ts
```

## 7. Entrega passo a passo

1. Habilitar Lovable Cloud.
2. Rodar migração criando `clients`, `products`, `sales` com RLS + grants.
3. Reescrever textos da landing.
4. Criar tela `/auth` e o gate `_authenticated`.
5. Criar server functions.
6. Criar telas Painel, Clientes, Perfil, Fechamento.
7. Ajustar CTA da landing para "Acessar o Painel".
8. Testar fluxo: cadastro → login → criar cliente → lançar vendas → ver caixa semanal/mensal → gerar fechamento imprimível.

## Perguntas rápidas antes de implementar

1. Você quer manter a landing pública em `/` (com CTA "Acessar o Painel") **ou** que `/` já seja o login e a landing suma?
2. Cada usuário vê **apenas os próprios clientes** (multi-tenant simples) ou **todos veem tudo** (equipe compartilhada)?
3. No fechamento, quero incluir um campo "status de pagamento" (pago / em aberto) por venda, ok?

Se responder as três, sigo direto para a implementação.
