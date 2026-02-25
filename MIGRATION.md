# Database Migration Guide

## Generate Migration

Run this command to generate the migration files based on schema changes:

```bash
bun run drizzle-kit generate
```

## Apply Migration

Run this command to apply the migrations to your Neon PostgreSQL database:

```bash
bun run drizzle-kit migrate
```

## Alternative: Push Schema Directly

For development, you can push the schema directly without generating migration files:

```bash
bun run drizzle-kit push
```

