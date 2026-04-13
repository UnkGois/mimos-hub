# MDA - Mimos de Alice | Garantias

Sistema de emissao e gerenciamento de certificados de garantia para joias, com envio automatico via WhatsApp e geracao de cupons de desconto para clientes recorrentes.

## Stack

| Camada   | Tecnologia                                    |
|----------|-----------------------------------------------|
| Frontend | React 19, Vite 7, Tailwind CSS 4              |
| Backend  | FastAPI, SQLAlchemy (async), Pydantic v2       |
| Banco    | PostgreSQL 16                                  |
| PDF      | ReportLab                                      |
| WhatsApp | Z-API                                          |
| Infra    | Docker, Docker Compose                         |

## Funcionalidades

- Login JWT com seed de operador automatico
- Emissao de certificado de garantia com PDF profissional (A4 portrait)
- Busca automatica de CEP (ViaCEP) e CPF (cliente recorrente)
- Envio de certificado via WhatsApp (Z-API)
- Geracao automatica de cupom de desconto para clientes recorrentes
- Cupom manual com tipo de desconto configuravel
- Dashboard com metricas, ultimas garantias/mensagens e alertas de vencimento
- Consulta de garantias com filtros, paginacao e acoes (PDF, WhatsApp, cupom)
- Reenvio de mensagens com falha
- Perfil do operador editavel

## Como rodar localmente

### Pre-requisitos

- **Docker** e **Docker Compose** (para banco + API)
- **Node.js** 18+ e **npm** (para o frontend)

### 1. Clone e entre na pasta

```bash
git clone <repo-url>
cd mda-garantias
```

### 2. Configure as variaveis de ambiente

**Backend** — copie e edite:

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env` com suas credenciais Z-API (se quiser WhatsApp real) e uma `SECRET_KEY` forte.

**Frontend** — copie e edite (opcional, o padrao aponta para `localhost:8000`):

```bash
cp .env.example .env
```

### 3. Suba o banco + API

```bash
# Modo producao (sem hot-reload):
docker compose up -d

# Modo desenvolvimento (com hot-reload no backend):
docker compose up -d db
docker compose --profile dev up -d api-dev
```

O backend criara as tabelas e um operador seed automaticamente:

| Campo | Valor                           |
|-------|---------------------------------|
| Email | `matheus.wftgois@gmail.com`     |
| Senha | `123456`                        |

### 4. Suba o frontend

```bash
npm install
npm run dev
```

Acesse **http://localhost:5173** e faca login com as credenciais acima.

### 5. Build de producao do frontend

```bash
npm run build
npm run preview   # testa o build localmente em :4173
```

## Variaveis de ambiente

### Backend (`backend/.env`)

| Variavel                      | Descricao                              | Exemplo                               |
|-------------------------------|----------------------------------------|---------------------------------------|
| `DATABASE_URL`                | Connection string PostgreSQL (asyncpg) | `postgresql+asyncpg://user:pass@db:5432/dbname` |
| `SECRET_KEY`                  | Chave para assinar tokens JWT          | `minha-chave-secreta-forte`           |
| `ALGORITHM`                   | Algoritmo JWT                          | `HS256`                               |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duracao do token em minutos            | `480`                                 |
| `ZAPI_INSTANCE_ID`            | Instance ID da Z-API                   | `abc123`                              |
| `ZAPI_TOKEN`                  | Token da Z-API                         | `xyz789`                              |
| `ZAPI_CLIENT_TOKEN`           | Client Token da Z-API                  | `def456`                              |
| `CORS_ORIGINS`                | Origens permitidas (separar por `,`)   | `https://meu-site.com`               |

### Frontend (`.env`)

| Variavel       | Descricao            | Exemplo                        |
|----------------|----------------------|--------------------------------|
| `VITE_API_URL` | URL base da API      | `https://api.meu-site.com/api` |

## Deploy

### Frontend (Vercel / Netlify)

1. Conecte o repositorio Git
2. Configure:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Root directory:** `.` (raiz do projeto, onde esta `package.json`)
3. Adicione a variavel de ambiente `VITE_API_URL` apontando para a URL do backend em producao
4. Deploy automatico a cada push

### Backend (Railway / Render / VPS)

1. Conecte o repositorio Git
2. Configure o **root directory** como `backend/`
3. Adicione um servico PostgreSQL e copie a connection string para `DATABASE_URL` (troque `postgresql://` por `postgresql+asyncpg://`)
4. Configure todas as variaveis de ambiente do backend
5. O **Dockerfile** ja esta pronto em `backend/Dockerfile`
6. Na primeira execucao, o sistema cria as tabelas e o operador seed automaticamente

### Docker Compose (VPS)

Para deploy em VPS com Docker Compose:

```bash
# Ajuste as variaveis no docker-compose.yml ou use backend/.env
# Em producao, altere SECRET_KEY e a senha do PostgreSQL!

docker compose up -d --build
```

### Pos-deploy

- [ ] Testar login em producao
- [ ] Testar emissao de garantia completa
- [ ] Testar envio de WhatsApp real (configurar Z-API)
- [ ] Verificar PDF gerado corretamente
- [ ] Configurar dominio personalizado (se disponivel)
- [ ] Verificar HTTPS/SSL (Vercel/Netlify fazem automaticamente; para VPS, usar Caddy ou Nginx + Certbot)

## Estrutura do projeto

```
mda-garantias/
├── backend/
│   ├── app/
│   │   ├── config.py         # Configuracoes (pydantic-settings)
│   │   ├── database.py       # Engine + session async
│   │   ├── main.py           # FastAPI app + lifespan + CORS
│   │   ├── models/           # SQLAlchemy models
│   │   ├── routers/          # Endpoints (auth, clientes, garantias, mensagens, cupons, dashboard)
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Logica de negocio
│   │   └── utils/            # Seguranca, PDF, WhatsApp
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── public/
│   └── favicon.svg
├── src/
│   ├── components/           # Toast, MetricCard, LoadingSkeleton, ErrorState, ProtectedRoute
│   ├── contexts/             # AuthContext
│   ├── layouts/              # MainLayout (sidebar, header, perfil)
│   ├── pages/                # Dashboard, NovaGarantia, ConsultaGarantias, Mensagens, Login
│   ├── services/             # API services (axios)
│   ├── utils/                # Masks, validators, viaCep
│   ├── App.jsx               # Rotas + lazy loading
│   ├── main.jsx              # React root
│   └── index.css             # Tailwind theme + animacoes
├── docker-compose.yml
├── package.json
├── vite.config.js
└── index.html
```
