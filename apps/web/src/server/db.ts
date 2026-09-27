import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Lazily created so importing this module never needs a database (e.g. during `next build`). */
export function getDb(): PrismaClient {
  // After `prisma generate` the dev server reloads this module with a new PrismaClient class;
  // replace the cached client so it knows about new tables and columns.
  if (globalForPrisma.prisma && !(globalForPrisma.prisma instanceof PrismaClient)) {
    void (globalForPrisma.prisma as { $disconnect(): Promise<void> }).$disconnect();
    globalForPrisma.prisma = undefined;
  }
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    globalForPrisma.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return globalForPrisma.prisma;
}
