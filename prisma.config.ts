import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// reads DATABASE_URL from .env and passes it to Prisma
export default defineConfig({
    schema: 'prisma/schema',       // points to the schema FOLDER (multi-file!)
    migrations: { path: 'prisma/migrations' },
    datasource: { url: env('DATABASE_URL') },
})
