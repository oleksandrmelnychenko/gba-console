import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('e2e/.artifacts/entities.json');

type EntitiesData = { runId: string } & Record<string, unknown>;

export class EntitiesStore {
  private constructor(private data: EntitiesData) {}

  static reset(): EntitiesStore {
    const store = new EntitiesStore({ runId: `e2e-${Date.now().toString(36)}` });
    store.save();
    return store;
  }

  static open(): EntitiesStore {
    if (!fs.existsSync(FILE)) {
      throw new Error('entities.json is missing; run the setup project first (npx playwright test --project=smoke).');
    }
    return new EntitiesStore(JSON.parse(fs.readFileSync(FILE, 'utf8')) as EntitiesData);
  }

  get runId(): string {
    return this.data.runId;
  }

  record(key: string, value: unknown): void {
    this.data[key] = value;
    this.save();
  }

  get<T>(key: string): T | undefined {
    return this.data[key] as T | undefined;
  }

  require<T>(key: string, hint: string): T {
    const value = this.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Missing "${key}" in entities.json — ${hint}`);
    }
    return value;
  }

  private save(): void {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(this.data, null, 2));
  }
}
