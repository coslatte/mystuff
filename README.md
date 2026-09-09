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

```bash
cd backend
./mvnw spring-boot:run
# Flyway ejecuta backend/src/main/resources/db/migration/V1__init_schema.sql automáticamente
```

Variables de entorno:

| Var | Default |
|-----|---------|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `cosmiclatte` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | `postgres` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4321,http://localhost:3000` |

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

## Despliegue independiente

- **Vercel** → Root Directory `frontend/` — Build `bun run build` — Output `dist/`
- **Render / Railway / Fly.io** → Root Directory `backend/` — Build `./mvnw package -DskipTests` — Start `java -jar target/*.jar`

## Integración

`frontend/src/services/api.ts` centraliza los `fetch` hacia `/api/*` usando `import.meta.env.PUBLIC_API_URL`.
