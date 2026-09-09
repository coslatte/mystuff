# CosmicLatte Web — Monorepo

Portfolio + música con comentarios y ratings.

## Estructura

```
.
├── backend/   # Spring Boot 4.1.1 / Java 21 / JPA / Flyway / PostgreSQL
└── frontend/  # Astro / React / Tailwind v4 / Bun
```

## Desarrollo local

### Backend

**Opcion A — con Docker (recomendada, no necesitas instalar Postgres):**

```bash
# 1. Edita .env en la raiz si quieres cambiar el password (por defecto postgres/postgres)
# 2. Levanta la DB
docker compose up -d db
# 3. Arranca el backend (lee .env automaticamente)
powershell -ExecutionPolicy Bypass -File backend/run.ps1
# o manual:
cd backend && ./mvnw spring-boot:run
# Flyway ejecuta backend/src/main/resources/db/migration/V1__init_schema.sql automaticamente
```

**Opcion B — con Postgres instalado localmente:**

Tu error `FATAL: password authentication failed for user "postgres"` significa que el password
de tu Postgres local no es `postgres`. Solucion:

```bash
# 1. Copia .env.example -> .env y pon tu password real
copy .env.example .env
# edita DB_PASSWORD con el password que usaste al instalar Postgres

# 2. Crea la DB si no existe (psql -U postgres -c "CREATE DATABASE cosmiclatte;")

# 3. En IntelliJ: Run -> Edit Configurations -> tu App -> Environment variables:
#    DB_HOST=localhost;DB_PORT=5432;DB_NAME=cosmiclatte;DB_USERNAME=postgres;DB_PASSWORD=tu_password_real
#    (o instala el plugin EnvFile y apunta a .env)

# 4. Run
```

Variables de entorno (todas leidas en `backend/src/main/resources/application.yml:8-10,22-28`):

| Var | Default | Descripcion |
|-----|---------|-------------|
| `DB_HOST` | `localhost` | Host de Postgres |
| `DB_PORT` | `5432` | Puerto (Supabase pooler usa `6543`) |
| `DB_NAME` | `cosmiclatte` | Nombre DB (`postgres` en Supabase) |
| `DB_USERNAME` | `postgres` | Usuario |
| `DB_PASSWORD` | `postgres` | **Cambialo si tu Postgres tiene otro password** |
| `DB_SSLMODE` | `disable` | `disable` local / `require` Supabase |
| `JDBC_URL` | *(construida)* | URL completa JDBC — si se define ignora `DB_HOST/PORT/NAME/SSLMODE` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4321,http://localhost:3000` | Origenes permitidos |

> **Supabase:** pon `DB_HOST=db.xxxxx.supabase.co`, `DB_NAME=postgres`, `DB_SSLMODE=require` (o `JDBC_URL=jdbc:postgresql://db.xxxxx.supabase.co:5432/postgres?sslmode=require`). Para Transaction Pooler (PgBouncer) usa `aws-0-us-east-1.pooler.supabase.com:6543`. Cero cambios de codigo — solo variables en `.env` o en Render/Railway.

### Frontend

```bash
cd frontend
bun install
bun run dev        # http://localhost:4321
```

Variable de entorno frontend:

```
PUBLIC_API_URL=http://localhost:8080
```
En producción (Vercel) definir `PUBLIC_API_URL=https://tu-backend.fly.dev`.

**Pinned repos de GitHub (*opcional, permite datos en vivo*):** la home consulta
`src/services/github.ts` con GraphQL. Si existe `GITHUB_TOKEN` usa los repos anclados
reales de `coslatte`; si no, cae a `src/data/projects.ts`.

```
# frontend/.env (copiar de .env.example — NO usar prefijo PUBLIC_ o el token se filtra al cliente)
GITHUB_TOKEN=ghp_xxx
```

- Token en GitHub -> Settings > Developer settings > Personal access tokens (classic), permiso `public_repo` / `read:user`.
- En Vercel: Project -> Settings -> Environment Variables -> `GITHUB_TOKEN`.
- No puede tener prefijo `PUBLIC_` (ese prefijo expone la variable al navegador).

## Despliegue independiente

- **Vercel** → Root Directory `frontend/` — Build `bun run build` — Output `dist/`
- **Render / Railway / Fly.io** → Root Directory `backend/` — Build `./mvnw package -DskipTests` — Start `java -jar target/*.jar`

## Integración

`frontend/src/services/api.ts` centraliza los `fetch` hacia `/api/*` usando `import.meta.env.PUBLIC_API_URL`.
