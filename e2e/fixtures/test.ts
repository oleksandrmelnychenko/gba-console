import { test as base } from '@playwright/test';
import { E2eDb } from './db';
import { EntitiesStore } from './entities';

type TestFixtures = { entities: EntitiesStore };
type WorkerFixtures = { db: E2eDb };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  db: [
    async ({ browserName }, provide) => {
      void browserName
      const db = await E2eDb.connect();
      await provide(db);
      await db.close();
    },
    { scope: 'worker' },
  ],
  entities: async ({ browserName }, provide) => {
    void browserName
    await provide(EntitiesStore.open());
  },
});

export const expect = test.expect;
