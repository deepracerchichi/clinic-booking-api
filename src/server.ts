import { createApp } from './app';
import { config } from './config';
import { closePool, runMigrations } from './db/migrate';
import { seedIfEmpty } from './services/slotService';

async function main(): Promise<void> {
  await runMigrations();
  await seedIfEmpty();

  const server = createApp().listen(config.port, () => {
    console.log(`listening on port ${config.port}`);
  });

  // Render sends SIGTERM on deploys: stop accepting requests, let in-flight ones finish, close the DB.
  const shutdown = () => {
    server.close(() => {
      void closePool().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('startup failed', error);
  process.exit(1);
});
