import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// Keep DATE columns as "YYYY-MM-DD". The default parser builds a local-time Date,
// which moves eligibility dates across a day boundary.
types.setTypeParser(1082, (value) => value);

declare global {
  var lifedropPool: Pool | undefined;
}

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  globalThis.lifedropPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 6),
  });
  return globalThis.lifedropPool;
}

export type Queryable = Pick<PoolClient, "query">;

// 40001 and 40P01 are how a distributed database reports that two transactions
// collided. The work is safe to repeat, and YugabyteDB expects clients to do so.
function isRetryable(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === "40001" || code === "40P01";
}

async function withRetry<T>(work: () => Promise<T>, attempts = 8): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * 2 ** attempt + Math.random() * 40));
    }
  }
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await withRetry(() => pool().query<T>(text, params));
  return rows;
}

export function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  return withRetry(async () => {
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function closePool(): Promise<void> {
  await globalThis.lifedropPool?.end();
  globalThis.lifedropPool = undefined;
}
