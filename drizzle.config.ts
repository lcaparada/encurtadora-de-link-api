import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/drizzle/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: 'db',
    database: 'db',
    password: 'pass',
    user: 'user',
    port: 3306,
  },
});
