# Split Master

Base full stack do Split Master, uma plataforma SaaS para criar quizzes de
vendas, capturar leads, exibir páginas finais personalizadas e direcionar o
usuário para um checkout pré-preenchido.

## Tecnologias

- Frontend: Next.js 14, App Router, TypeScript, Tailwind CSS e Recharts
- Backend: Node.js, Express 5, TypeScript, bcrypt e JWT
- Dados e arquivos: Supabase e Supabase Storage
- Desenvolvimento local: Docker Compose com hot reload

## Pré-requisitos

- Node.js 22 ou superior
- npm
- Docker e Docker Compose, caso prefira executar em containers

## Configuração

O arquivo `backend/.env` local já está configurado para o projeto informado e
não deve ser versionado. Para configurar outro ambiente:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Preencha no backend:

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_BOOTSTRAP_SECRET`
- `ENCRYPTION_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`

A chave `SUPABASE_SERVICE_ROLE_KEY` possui acesso administrativo e nunca deve
ser enviada ao navegador ou adicionada ao Git.

`JWT_SECRET` e `ADMIN_BOOTSTRAP_SECRET` devem ser chaves distintas, aleatórias
e ter pelo menos 32 caracteres.
`ENCRYPTION_KEY` também deve ter pelo menos 32 caracteres e é usada para
criptografar credenciais de integrações, como a API Key do ActiveCampaign.

## Banco de dados

A migração inicial está em:

```text
backend/supabase/migrations/001_initial_schema.sql
backend/supabase/migrations/002_quiz_editor.sql
backend/supabase/migrations/003_public_quiz.sql
backend/supabase/migrations/004_final_page.sql
backend/supabase/migrations/005_integrations.sql
backend/supabase/migrations/006_analytics_indexes.sql
```

Ela cria:

- `users`
- `quizzes`
- `questions`
- `question_options`
- `leads`
- `quiz_integrations`
- `checkout_configs`
- `final_page_blocks`
- `integration_logs`
- `analytics_events`

A migration `006_analytics_indexes.sql` adiciona índices para consultas por
`quiz_id`, `event_type` e `created_at`, além de funções RPC usadas pelos
relatórios agregados de analytics.

Todas as tabelas têm RLS ativo e não concedem acesso aos papéis `anon` e
`authenticated`. O backend acessa os dados com `service_role`.

`DATABASE_URL` usa o Supavisor em modo sessão e funciona em redes IPv4, como o
Docker Desktop. `DIRECT_DATABASE_URL` preserva a conexão direta IPv6 do
Supabase para servidores compatíveis.

Para reaplicar a migração idempotente:

```bash
cd backend
set -a
source .env
set +a
npm run db:migrate
```

Com Docker:

```bash
docker compose exec backend npm run db:migrate
```

## Executar com Docker

Na raiz do projeto:

```bash
docker compose up --build
```

Serviços:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health check: http://localhost:3001/api/health
- Status do Supabase: http://localhost:3001/api/health/supabase

Os volumes do Compose mantêm o hot reload ativo para alterações em `frontend/`
e `backend/`.

## Executar sem Docker

Em dois terminais:

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Validação

```bash
cd frontend
npm run lint
npm run build

cd ../backend
npm run lint
npm run build
```

## Nota de segurança

O requisito deste projeto fixa o frontend no Next.js 14. A versão instalada,
`14.2.35`, é a última dessa major, mas o `npm audit` atual ainda aponta
vulnerabilidades corrigidas apenas em versões mais novas do Next.js. Antes de
publicar em produção, planeje a migração para uma major com suporte ativo.

## Autorização

- `GET /api/health`: confirma que a API está respondendo
- `GET /api/health/supabase`: valida as credenciais e verifica se o bucket
  `split_master` existe
- `POST /api/auth/register`: cria uma conta e retorna um JWT
- `POST /api/auth/login`: autentica o usuário e retorna um JWT
- `GET /api/auth/me`: retorna o usuário autenticado

As rotas de dashboard, quizzes, leads e conta usam o middleware
`authenticate`. As rotas sob `/api/admin` também usam `isAdmin`.

O middleware consulta o usuário atual no banco a cada requisição, portanto
alterações de plano, role ou status entram em vigor mesmo para tokens já
emitidos. Contas desativadas perdem o acesso imediatamente.

Use o token JWT nas rotas protegidas:

```http
Authorization: Bearer SEU_TOKEN
```

O cadastro público cria clientes. Para criar o primeiro administrador, envie
`role: "admin"` e o segredo de bootstrap somente em uma chamada administrativa:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -H "x-admin-bootstrap: $ADMIN_BOOTSTRAP_SECRET" \
  -d '{
    "name": "Hélio",
    "email": "admin@exemplo.com",
    "password": "uma-senha-forte",
    "role": "admin"
  }'
```

Nunca exponha `ADMIN_BOOTSTRAP_SECRET` no frontend.

## Rotas da API

### Dashboard e conta

- `GET /api/dashboard`: resumo do dashboard conforme o role
- `PUT /api/account/profile`: altera nome e e-mail
- `PUT /api/account/password`: altera a senha após validar a senha atual

### Quizzes

- `GET /api/quizzes`: lista os quizzes acessíveis
- `POST /api/quizzes`: cria um quiz com slug automático
- `GET /api/quizzes/:id`: retorna um quiz
- `PUT /api/quizzes/:id`: altera título, status, subdomínio ou configurações
- `DELETE /api/quizzes/:id`: exclui o quiz e seus dados relacionados
- `POST /api/quizzes/:id/duplicate`: duplica quiz, perguntas e opções
- `POST /api/quizzes/:id/logo`: envia a logo do quiz para o Supabase Storage

### Editor de quiz

- `GET /api/quizzes/:id/questions`: lista perguntas e opções em ordem
- `POST /api/quizzes/:id/questions`: cria uma pergunta
- `PUT /api/quizzes/:id/questions/:questionId`: atualiza uma pergunta
- `DELETE /api/quizzes/:id/questions/:questionId`: exclui uma pergunta
- `PUT /api/quizzes/:id/questions/reorder`: reordena perguntas
- `POST /api/questions/:questionId/options`: cria uma opção
- `PUT /api/questions/:questionId/options/:optionId`: atualiza uma opção
- `DELETE /api/questions/:questionId/options/:optionId`: exclui uma opção
- `PUT /api/questions/:questionId/options/reorder`: reordena opções

As reordenações são executadas por funções transacionais no PostgreSQL. Cada
opção pode continuar no fluxo padrão, apontar para outra pergunta ou encerrar
o quiz na página final.

Clientes acessam somente os próprios quizzes. Administradores acessam todos e
podem filtrar por proprietário com `?userId=UUID`.

### Página final e checkout

- `GET /api/quizzes/:id/final-page`: lista os blocos da página final
- `POST /api/quizzes/:id/final-page/blocks`: cria um bloco
- `PUT /api/quizzes/:id/final-page/blocks/:blockId`: atualiza um bloco
- `DELETE /api/quizzes/:id/final-page/blocks/:blockId`: exclui um bloco
- `PUT /api/quizzes/:id/final-page/blocks/reorder`: reordena os blocos
- `POST /api/quizzes/:id/final-page/images`: envia uma imagem para o Storage
- `GET /api/quizzes/:id/checkout`: lista os checkouts do quiz
- `POST /api/quizzes/:id/checkout`: cria um checkout
- `PUT /api/quizzes/:id/checkout/:checkoutId`: atualiza um checkout
- `DELETE /api/quizzes/:id/checkout/:checkoutId`: exclui um checkout

Hotmart, Kiwify, Eduzz e Stripe recebem templates iniciais próprios. Também é
possível cadastrar parâmetros extras ou usar um template personalizado. Os
valores são interpolados e codificados no backend; parâmetros com variáveis
ausentes são removidos da URL.

### Integrações

- `GET /api/integrations`: lista integrações do usuário logado
- `GET /api/integrations?quizId=UUID`: lista integrações de um quiz
- `POST /api/integrations`: salva ou atualiza uma integração por quiz e tipo
- `DELETE /api/integrations/:id`: remove uma integração
- `POST /api/integrations/activecampaign/test`: testa credenciais do AC
- `GET /api/integrations/activecampaign/lists`: carrega listas do AC
- `GET /api/integrations/activecampaign/tags`: carrega tags do AC
- `GET /api/integrations/activecampaign/fields`: carrega campos personalizados
- `POST /api/integrations/webhook/test`: envia um payload de teste ao webhook

As credenciais do ActiveCampaign são salvas criptografadas com AES-256-GCM. A
API nunca retorna a chave descriptografada, apenas `hasApiKey`. O envio para
ActiveCampaign e webhooks é feito em segundo plano quando leads são criados ou
atualizados, com até três tentativas e logs em `integration_logs`.

### Leads

- `GET /api/leads`: lista os leads acessíveis com paginação
- `GET /api/leads?quiz_id=UUID`: filtra por quiz
- `GET /api/leads?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`: filtra por período
- `GET /api/leads?completed=true`: filtra por leads concluídos ou em andamento
- `GET /api/leads?has_email=true`: retorna apenas leads com e-mail
- `GET /api/leads/:id`: retorna respostas, variáveis, UTMs e timeline do lead
- `GET /api/leads/export/csv`: exporta leads com variáveis e UTMs
- `GET /api/leads/export/csv?quiz_id=UUID&completed=true`: exporta com filtros

### Analytics

- `GET /api/analytics/summary`: resumo geral por período
- `GET /api/analytics/timeline`: linha do tempo diária geral
- `GET /api/analytics/:quizId/summary`: resumo de um quiz
- `GET /api/analytics/:quizId/timeline`: linha do tempo diária do quiz
- `GET /api/analytics/:quizId/funnel`: funil por pergunta e checkout
- `GET /api/analytics/:quizId/answers`: distribuição de respostas por pergunta
- `GET /api/analytics/:quizId/utm`: distribuição de UTMs

Todas as rotas aceitam `start_date` e `end_date`; as rotas gerais também aceitam
`quiz_id`. Clientes recebem apenas dados dos próprios quizzes e administradores
podem consultar todos. As respostas são agregadas, sem expor dados brutos de
leads nos endpoints de analytics.

### Quiz público

- `GET /api/public/quiz/:slug`: retorna somente quizzes ativos e dados públicos
- `POST /api/public/quiz/:slug/visit`: registra uma visita sem lead
- `POST /api/public/leads`: cria ou retoma um lead pelo e-mail
- `PUT /api/public/leads/:id`: atualiza respostas e variáveis
- `POST /api/public/leads/:id/event`: registra eventos do funil
- `GET /api/public/quiz/:slug/checkout-url?lead_id=UUID`: gera uma URL de
  checkout pré-preenchida

As atualizações e eventos exigem o header `X-Lead-Token`, retornado na criação
do lead. O token impede alterações usando apenas um UUID de lead descoberto.
O mesmo header é obrigatório para gerar a URL de checkout. Um checkout
específico pode ser solicitado com `&checkout_id=UUID`.

As rotas públicas de criação têm limite de 10 requisições por minuto por IP,
com headers padrão `RateLimit`. O store em memória é adequado para uma
instância; uma implantação horizontal deve configurar um store compartilhado,
como Redis ou PostgreSQL.

O backend valida o honeypot, bloqueia e-mails falsos conhecidos e remove
respostas ou variáveis que não pertencem ao quiz antes de gravar no banco.

### Administração

- `GET /api/admin/users`: lista usuários e total de quizzes
- `GET /api/admin/users?plan=pro&status=active`: filtra usuários
- `PUT /api/admin/users/:id`: altera plano ou status
- `GET /api/admin/users/:id/quizzes`: lista quizzes de um usuário

## Páginas

- `/login`: autenticação
- `/register`: criação de conta cliente
- `/dashboard`: visão geral adaptada para cliente ou administrador
- `/dashboard/quizzes`: gerenciamento de quizzes e visão global para admin
- `/dashboard/quizzes/:id/edit`: editor visual com três colunas e autosave
- `/dashboard/quizzes/:id/preview`: simulação navegável do fluxo do quiz
- `/dashboard/quizzes/:id/final-page`: editor de blocos da página final
- `/dashboard/quizzes/:id/checkout`: configuração de múltiplos checkouts
- `/q/:slug`: experiência pública mobile-first para responder o quiz
- `/q/:slug/result`: página final pública personalizada
- `/dashboard/leads`: listagem, filtros, detalhe da jornada e exportação CSV
- `/dashboard/settings`: perfil, senha e plano do cliente
- `/dashboard/admin/users`: gerenciamento de usuários, planos e status
- `/dashboard/analytics`: dashboard geral de analytics com cards, gráfico e tabela por quiz
- `/dashboard/analytics/:quizId`: analytics detalhado com funil, respostas e UTMs
- `/dashboard/integrations`: cards e status das integrações disponíveis
- `/dashboard/integrations/activecampaign`: credenciais, lista, tags e campos
- `/dashboard/integrations/webhook`: webhook genérico com headers customizados
- `/dashboard/integrations/pixels`: Facebook Pixel, GTM e GA4
- `/dashboard/plans`: página preparada para planos e assinaturas
- `/dashboard/admin/settings`: página preparada para configurações gerais

O layout protegido possui sidebar desktop, menu móvel, navegação por role,
indicador do plano atual e logout. As ações assíncronas apresentam loading,
toast de sucesso ou erro e confirmação antes da exclusão.

No editor, perguntas e opções podem ser reordenadas por drag and drop. Em
dispositivos móveis, as três colunas são apresentadas nas abas `Lista`,
`Editor` e `Config`. O salvamento automático ocorre a cada 30 segundos e
também ao trocar de pergunta.

As variáveis `name`, `email` e `phone` ajustam automaticamente o tipo da
pergunta. A logo aceita PNG, JPG, WEBP ou SVG de até 5 MB e é armazenada no
bucket público `split_master`.

Na página pública, UTMs, `fbclid`, `gclid`, respostas, posição do fluxo e token
do lead ficam salvos no `localStorage` para retomada. O lead é criado assim que
o e-mail é respondido e passa a ser atualizado progressivamente. A página
final substitui expressões como `{{name}}` pelas variáveis capturadas.

O editor da página final permite inserir, editar, excluir e reordenar títulos,
textos, imagens, vídeos, listas, depoimentos, botões, divisores e espaços. O
preview usa o mesmo renderer da página pública, possui modos desktop e mobile
e salva alterações automaticamente a cada 30 segundos.

No resultado público, o botão de checkout solicita uma URL montada pelo backend
a partir do lead validado, registra o evento `checkout_click` e abre o destino
em uma nova aba.

Pixels configurados por quiz são injetados automaticamente na página pública.
O frontend dispara `PageView` na inicialização dos scripts, `Lead` quando o
e-mail é capturado e `Purchase` ao clicar no checkout.

## Verificação funcional

Além de lint e build, as rotas foram exercitadas contra o Supabase com usuários
temporários. A verificação cobre:

- isolamento de quizzes e leads entre clientes
- bloqueio das rotas administrativas para clientes
- CRUD e duplicação de quiz com perguntas e opções
- detalhe e exportação CSV de leads
- dashboards de cliente e administrador
- alteração de plano, status, perfil e senha
- CRUD e reordenação de perguntas e opções
- fluxo condicional e limpeza de destinos ao excluir perguntas
- validação de slug e upload real para o Supabase Storage
- quiz público ativo/inativo e payload sem dados do proprietário
- captura progressiva, retomada por e-mail, UTMs e eventos
- proteção por token público, honeypot e rate limit
- CRUD, reordenação e payload público dos blocos da página final
- CRUD de checkouts e seleção de checkout por botão
- codificação dos dados na URL e remoção de parâmetros sem valor
- CRUD de integrações, payload público de pixels e webhook assíncrono
- criptografia e mascaramento da API Key do ActiveCampaign
- migrations e RPCs de analytics aplicadas no Supabase
- build dos dashboards com gráficos e filtros de analytics

Todas as rotas desconhecidas e falhas de controller passam pelo middleware
centralizado de erros.
