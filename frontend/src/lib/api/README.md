# Generated OpenAPI types

`src/lib/api/schema.ts` and `openapi.json` are produced from the Spring backend.
Do not edit them by hand.

## Regenerating

The backend must be running first (it serves `/v3/api-docs`):

```bash
# from the repo root: database + API
docker compose up -d
powershell -ExecutionPolicy Bypass -File backend/run.ps1

# then, from frontend/
bun run gen:api
```

## What feeds it

springdoc reflects the **declared** types of the controllers. A
`ResponseEntity<?>` return type publishes an empty schema, so every controller
and `@ExceptionHandler` spells out its generic
(`ResponseEntity<ResponseFormat<SongResponse>>` and friends). Adding a DTO field
or a new endpoint is enough; changing a wildcard to a concrete type is what
makes the change visible here.

Renaming a Java field without regenerating breaks `bun run check`, because
`src/types/index.ts` aliases these schemas instead of restating them.

## Known gap

springdoc does not attach `@RestControllerAdvice` responses to individual
operations, so error bodies are absent from the document. The error envelope is
modelled by hand in `src/types/index.ts` (`ApiEnvelope`) and by `ApiError` in
`src/services/api.ts`.
