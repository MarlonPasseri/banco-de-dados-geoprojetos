import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "./config.js";

type TokenPayload = {
  sub: string;
  username: string;
  email?: string;
  name?: string;
};

function parseTokenPayload(decoded: string | JwtPayload): TokenPayload | null {
  if (!decoded || typeof decoded === "string") return null;
  const sub = typeof decoded.sub === "string" ? decoded.sub : "";
  const username = typeof decoded.username === "string" ? decoded.username : "";
  const email = typeof decoded.email === "string" ? decoded.email : undefined;
  const name = typeof decoded.name === "string" ? decoded.name : undefined;
  if (!sub || !username) return null;
  return { sub, username, email, name };
}

export function signToken(payload: { sub: string | number; username?: string | null; email?: string | null; name?: string | null }) {
  const username =
    String(payload.username ?? "").trim() ||
    String(payload.email ?? "").trim() ||
    `user-${String(payload.sub)}`;
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
    algorithm: "HS256",
    subject: String(payload.sub),
  };
  return jwt.sign(
    {
      username,
      email: payload.email ?? undefined,
      name: payload.name ?? undefined,
    },
    env.jwtSecret,
    options
  );
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";

  if (!token) return res.status(401).json({ error: "Sem token" });

  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
    const payload = parseTokenPayload(decoded);
    if (!payload) return res.status(401).json({ error: "Token invalido" });
    (req as any).user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Token expirado" });
    }
    return res.status(401).json({ error: "Token invalido" });
  }
}
