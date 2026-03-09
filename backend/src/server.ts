import "dotenv/config";
import express from "express";
import cors, { type CorsOptions } from "cors";
import { router } from "./routes.js";
import { env } from "./config.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { securityHeaders } from "./security.js";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const allowedOrigins = new Set(
  env.corsOrigins.length > 0 ? env.corsOrigins : defaultCorsOrigins
);

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

function isDevLanOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const port = Number(url.port);
    if (!Number.isInteger(port)) return false;

    const isViteDevPort =
      (port >= 5173 && port <= 5183) ||
      (port >= 4173 && port <= 4183);
    if (!isViteDevPort) return false;

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    return isPrivateIpv4(url.hostname);
  } catch {
    return false;
  }
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (env.nodeEnv === "development" && isDevLanOrigin(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 600,
};

const app = express();
app.disable("x-powered-by");
if (env.trustProxy) app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

app.use("/api", router);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, "0.0.0.0", () => {
  console.log(`API on http://0.0.0.0:${env.port}/api`);
});
