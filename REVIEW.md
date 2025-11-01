# Code Review Notes

## Restored Source Layout
- Actual client, server, and shared modules have been recovered from the uploaded root-level files and moved into their proper folders.
- Placeholder React stubs and helper shims have been removed so the TypeScript sources in `client/src`, `server/`, and `shared/` now match the production codebase again.

## Environment and Secrets Checklist
- The backend expects a Postgres connection string in `DATABASE_URL`; without it the server boot throws immediately in `server/db.ts`.
- Replit OIDC login requires `REPLIT_DOMAINS`, `REPL_ID`, `SESSION_SECRET`, and related issuer variables before `/api/login` can succeed.
- Object storage integration depends on `PRIVATE_OBJECT_DIR` and `PUBLIC_OBJECT_SEARCH_PATHS`; missing values cause runtime errors when uploading/serving files.
- Whisper transcription needs the OpenAI key (`OPENAI_API_KEY`) exposed in the environment for `server/utils/whisper-service.ts`.

## Follow-up Suggestions
- Replace the lightweight placeholder media in `test-files/` with the real EPUB/MP3 fixtures if you need parity with production demos.
- Re-run `drizzle-kit push` (or your migration workflow) after configuring the database to ensure the schema matches `shared/schema.ts`.
