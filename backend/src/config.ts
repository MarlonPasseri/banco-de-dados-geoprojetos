import "dotenv/config";

type NodeEnv = "development" | "test" | "production";

function readRequiredEnv(name: string, minLength = 1) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  if (value.length < minLength) {
    throw new Error(`Invalid env var ${name}: must have at least ${minLength} characters.`);
  }
  return value;
}

function parseNodeEnv(raw: string | undefined): NodeEnv {
  const value = String(raw ?? "development").toLowerCase().trim();
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }
  throw new Error(`Invalid NODE_ENV: ${value}`);
}

function parsePort(raw: string | undefined) {
  const parsed = Number(raw ?? "3001");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }
  return parsed;
}

function parseOrigins(raw: string | undefined) {
  return String(raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseBoolean(raw: string | undefined, fallback = false) {
  if (raw === undefined) return fallback;
  const value = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "sim", "on"].includes(value)) return true;
  if (["0", "false", "no", "nao", "off"].includes(value)) return false;
  throw new Error(`Invalid boolean env value: ${raw}`);
}

function isWeakSecret(secret: string) {
  const lower = secret.toLowerCase();
  return (
    lower.includes("change-this") ||
    lower.includes("example") ||
    lower === "secret" ||
    lower === "jwt_secret" ||
    /^([a-z0-9])\1+$/.test(lower)
  );
}

function assertStrongPassword(password: string, envName: string) {
  if (password.length < 12) {
    throw new Error(`${envName} must be at least 12 characters in production.`);
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error(`${envName} must include uppercase, lowercase, and number in production.`);
  }
}

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
const isProduction = nodeEnv === "production";

const jwtSecret = readRequiredEnv("JWT_SECRET", isProduction ? 32 : 16);
if (isProduction && isWeakSecret(jwtSecret)) {
  throw new Error("JWT_SECRET is too weak for production.");
}

const databaseUrl = readRequiredEnv("DATABASE_URL", 10);
const port = parsePort(process.env.PORT);
const corsOrigins = parseOrigins(process.env.CORS_ORIGINS);

if (isProduction && corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS is required in production.");
}

const setupToken = String(process.env.SETUP_TOKEN ?? "").trim() || null;
if (setupToken && setupToken.length < 16) {
  throw new Error("SETUP_TOKEN must be at least 16 chars when provided.");
}

const adminUser = String(process.env.ADMIN_USER ?? "admin").trim() || "admin";
const adminPass = String(process.env.ADMIN_PASS ?? "admin123").trim();
if (isProduction) {
  if (!adminPass || adminPass === "admin123") {
    throw new Error("Set a non-default ADMIN_PASS in production.");
  }
  assertStrongPassword(adminPass, "ADMIN_PASS");
}

const jwtIssuer = String(process.env.JWT_ISSUER ?? "geo-projetos-api").trim();
const jwtAudience = String(process.env.JWT_AUDIENCE ?? "geo-projetos-web").trim();
const jwtExpiresIn = String(process.env.JWT_EXPIRES_IN ?? "12h").trim() || "12h";
const trustProxy = parseBoolean(process.env.TRUST_PROXY, false);
const enableHsts = parseBoolean(process.env.ENABLE_HSTS, isProduction);

export const env = {
  nodeEnv,
  jwtSecret,
  databaseUrl,
  port,
  corsOrigins,
  setupToken,
  adminUser,
  adminPass,
  jwtIssuer,
  jwtAudience,
  jwtExpiresIn,
  trustProxy,
  enableHsts,
} as const;
