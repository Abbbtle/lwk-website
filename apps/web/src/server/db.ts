import 'server-only';
import { readFileSync } from 'node:fs';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// One client per PrismaClient class, reused across hot reloads in development. Keying by class
// means a regenerated client (new tables or columns) gets a fresh instance, while separate
// module copies (e.g. pages and route handlers) never close each other's connection pools.
const globalForPrisma = globalThis as unknown as {
  prismaClients?: WeakMap<typeof PrismaClient, PrismaClient>;
};

// How long a fetched password is reused. RDS rotates the master password every 7 days;
// new connections pick up a rotated password within this window.
const PASSWORD_CACHE_MS = 60_000;

let cachedPassword: { value: string; fetchedAt: number } | undefined;
let secrets: SecretsManagerClient | undefined;

/** Current database password from the RDS-managed secret (never logged or stored on disk). */
async function databasePassword(secretArn: string): Promise<string> {
  if (cachedPassword && Date.now() - cachedPassword.fetchedAt < PASSWORD_CACHE_MS) {
    return cachedPassword.value;
  }
  secrets ??= new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'af-south-1' });
  const { SecretString } = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const { password } = JSON.parse(SecretString ?? '{}') as { password?: string };
  if (!password) throw new Error('Database secret has no password');
  cachedPassword = { value: password, fetchedAt: Date.now() };
  return password;
}

/**
 * Local development and tests use DATABASE_URL. In AWS the app connects with the RDS-managed
 * secret over TLS, verifying the server against the RDS certificate bundle.
 */
function createAdapter() {
  const url = process.env.DATABASE_URL;
  if (url) return new PrismaPg({ connectionString: url });

  const { DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_SECRET_ARN } =
    process.env;
  if (!DATABASE_HOST || !DATABASE_NAME || !DATABASE_USER || !DATABASE_SECRET_ARN) {
    throw new Error('Set DATABASE_URL, or DATABASE_HOST/NAME/USER/SECRET_ARN in AWS');
  }
  return new PrismaPg({
    host: DATABASE_HOST,
    port: Number(DATABASE_PORT ?? 5432),
    database: DATABASE_NAME,
    user: DATABASE_USER,
    password: () => databasePassword(DATABASE_SECRET_ARN),
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync(process.env.PGSSLROOTCERT ?? '/etc/lwk/rds-ca.pem', 'utf8'),
    },
    max: 10,
  });
}

/** Lazily created so importing this module never needs a database (e.g. during `next build`). */
export function getDb(): PrismaClient {
  globalForPrisma.prismaClients ??= new WeakMap();
  let client = globalForPrisma.prismaClients.get(PrismaClient);
  if (!client) {
    client = new PrismaClient({ adapter: createAdapter() });
    globalForPrisma.prismaClients.set(PrismaClient, client);
  }
  return client;
}
