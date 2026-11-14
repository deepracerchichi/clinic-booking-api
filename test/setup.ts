// Runs before any test file, so config.ts sees these values when it is first imported.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a throwaway Postgres database (the tests wipe it).');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.API_KEY = 'test-key';
