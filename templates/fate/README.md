# fate Templates

This directory is the canonical source for fate project scaffolds.

- `default/` contains the imported tRPC + Prisma quick-start template.
- Future matrix support should be split into `shared/`, `transports/`, `databases/`, and `presets/`.
- `presets/` should contain named scaffold choices such as `trpc-prisma`, `trpc-drizzle`, `native-prisma`, and `native-drizzle`. Avoid maintaining four full app copies; presets should compose shared files plus transport and database overlays.
