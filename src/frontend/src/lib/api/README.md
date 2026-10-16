# Generated OpenAPI types

`src/lib/api/schema.ts` and `openapi.json` are produced from the Spring backend.
Do not edit them by hand.

## Regenerating

The backend must be running first (it serves `/v3/api-docs`):

```bash
# from the repo root: database + API
docker compose up -d
powershell -ExecutionPolicy Bypass -File src/backend/run.ps1

# then, from src/frontend/
bun run gen:api
```

## What feeds it

JSON controllers return `ResponseFormat<?>`. Their `@ApiResponse` annotations
specify the envelope and the concrete `data` schema, including array items.
Update those annotations when an endpoint changes its payload. Audio streaming
keeps `ResponseEntity<Resource>` because it returns bytes and range headers.

Renaming a Java field without regenerating breaks `bun run check`, because
`src/types/index.ts` aliases these schemas instead of restating them.

## Known gap

springdoc does not attach `@RestControllerAdvice` responses to individual
operations, so error bodies are absent from the document. The error envelope is
modelled by hand in `src/types/index.ts` (`ApiEnvelope`) and by `ApiError` in
`src/services/api.ts`.
