import { test as base } from '@playwright/test';
import { E2eDb } from './db';
import { EntitiesStore } from './entities';

type TestFixtures = { entities: EntitiesStore };
type WorkerFixtures = { db: E2eDb };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  db: [
    async ({}, use) => {
      const db = await E2eDb.connect();
      await use(db);
      await db.close();
    },
    { scope: 'worker' },
  ],
  entities: async ({}, use) => {
    await use(EntitiesStore.open());
  },
});

export const expect = test.expect;
