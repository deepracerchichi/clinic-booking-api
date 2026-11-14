import path from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const databaseUrl = required('DATABASE_URL');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  apiKey: required('API_KEY'),
  databaseUrl,
  // Hosted Postgres (Neon) requires TLS; a local database does not.
  databaseSsl: !/localhost|127\.0\.0\.1/.test(databaseUrl),
  rateLimit: { maxAttempts: 5, windowSeconds: 60 },
  migrationsDir: path.resolve(process.cwd(), 'migrations'),
  publicDir: path.resolve(process.cwd(), 'web', 'dist'),
} as const;
