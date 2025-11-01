# Code Review Notes

## Placeholder Source Files
The `client/`, `server/`, and `shared/` directories now exist with placeholder implementations that keep the project
structure intact. Replace each placeholder with the original logic before attempting to build or run the project.

## Schema Path in Drizzle Config
`drizzle.config.ts` expects `./shared/schema.ts`; a placeholder file has been added so commands resolve, but the actual schema
definition still needs to be restored from the original project.

## Binary Assets Missing
Image and media assets referenced in the original index were not available in the upload. Re-add the listed files under
`attached_assets/` and `test-files/` so the application can render and test correctly.
