# Code Review Notes

## Missing Source Directories
The repository configuration references frontend and backend sources under `client/`, `server/`, and `shared/`, but these paths are absent from the tracked files. This gap will prevent the project from compiling or running.

## Schema Path in Drizzle Config
`drizzle.config.ts` expects a `./shared/schema.ts` file for migrations. Without the schema file checked into the repository, database commands cannot run.

## Build Scripts Reference Missing Entry Points
`package.json` scripts such as `npm run dev` and `npm run build` target `server/index.ts`, which is also missing, leading to runtime failures.
