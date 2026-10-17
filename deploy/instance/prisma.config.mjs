// Prisma config used on the web server to apply migrations (DATABASE_URL is set by activate.sh).
export default {
  schema: 'schema.prisma',
  migrations: { path: 'migrations' },
  datasource: { url: process.env.DATABASE_URL },
};
