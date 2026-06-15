import "dotenv/config";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }

  return value;
}

function getPort(value: string | undefined): number {
  const port = Number(value ?? 3001);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("A variável PORT deve ser um número inteiro positivo.");
  }

  return port;
}

function getSecret(name: string): string {
  const value = getRequiredEnv(name);

  if (value.length < 32) {
    throw new Error(`${name} deve ter pelo menos 32 caracteres.`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "0.0.0.0",
  port: getPort(process.env.PORT),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  jwtSecret: getSecret("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  adminBootstrapSecret: getSecret("ADMIN_BOOTSTRAP_SECRET"),
  encryptionKey: getSecret("ENCRYPTION_KEY"),
  supabaseUrl: getRequiredEnv("SUPABASE_URL"),
  supabaseAnonKey: getRequiredEnv("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseStorageBucket:
    process.env.SUPABASE_STORAGE_BUCKET ?? "split_master",
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  directDatabaseUrl: getRequiredEnv("DIRECT_DATABASE_URL"),
} as const;
