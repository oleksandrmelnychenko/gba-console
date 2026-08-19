import sql from 'mssql';

const MARKER_NAME = 'GbaE2EStandDb';
const SERVER_IDENTITY = '01934d77f334';

export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
  label?: string;
}

export class E2eDb {
  private constructor(private readonly pool: sql.ConnectionPool) {}

  static async connect(): Promise<E2eDb> {
    const password = process.env.E2E_SQL_PASSWORD;
    if (!password) {
      throw new Error('Set E2E_SQL_PASSWORD (sa password of the dev MSSQL instance).');
    }
    const pool = await new sql.ConnectionPool({
      server: process.env.E2E_SQL_HOST ?? '127.0.0.1',
      port: Number(process.env.E2E_SQL_PORT ?? 1433),
      database: process.env.E2E_SQL_DB ?? 'ConcordDb_V5_E2E',
      user: process.env.E2E_SQL_USER ?? 'sa',
      password,
      options: { trustServerCertificate: true, encrypt: false },
      pool: { max: 4 },
      requestTimeout: 120_000,
    }).connect();

    const fence = await pool.request().query(`
      SELECT CONVERT(nvarchar(128), @@SERVERNAME) AS serverName,
             DB_NAME() AS dbName,
             (SELECT COUNT(*) FROM sys.extended_properties
               WHERE class = 0 AND name = '${MARKER_NAME}'
                 AND CONVERT(nvarchar(4000), value) LIKE 'GBA[_]E2E[_]STAND|%') AS markerCount
    `);
    const row = fence.recordset[0] as { serverName: string; dbName: string; markerCount: number };
    const refuse = async (reason: string) => {
      await pool.close();
      throw new Error(`E2E DB fence: ${reason}`);
    };
    if (row.serverName !== SERVER_IDENTITY) {
      await refuse(`unexpected @@SERVERNAME "${row.serverName}" (expected ${SERVER_IDENTITY})`);
    }
    if (!/_E2E$/.test(row.dbName)) {
      await refuse(`database "${row.dbName}" does not end with _E2E`);
    }
    if (!row.markerCount) {
      await refuse(`database "${row.dbName}" has no ${MARKER_NAME} marker`);
    }
    return new E2eDb(pool);
  }

  async query<T = Record<string, unknown>>(text: string, params?: Record<string, unknown>): Promise<T[]> {
    const request = this.pool.request();
    for (const [name, value] of Object.entries(params ?? {})) {
      request.input(name, value as never);
    }
    const result = await request.query(text);
    return result.recordset as T[];
  }

  async scalar<T>(text: string, params?: Record<string, unknown>): Promise<T | undefined> {
    const rows = await this.query<Record<string, T>>(text, params);
    if (!rows.length) return undefined;
    const first = rows[0];
    const key = Object.keys(first)[0];
    return first[key];
  }

  async poll<T = Record<string, unknown>>(
    text: string,
    predicate: (rows: T[]) => boolean,
    options?: PollOptions,
    params?: Record<string, unknown>,
  ): Promise<T[]> {
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const intervalMs = options?.intervalMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;
    let last: T[] = [];
    while (Date.now() < deadline) {
      last = await this.query<T>(text, params);
      if (predicate(last)) return last;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(
      `DB poll timed out after ${timeoutMs}ms${options?.label ? ` (${options.label})` : ''}; last result: ${JSON.stringify(last).slice(0, 2000)}`,
    );
  }

  async close(): Promise<void> {
    await this.pool.close();
  }
}
