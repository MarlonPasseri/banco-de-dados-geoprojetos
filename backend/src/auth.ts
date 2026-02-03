import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export function signToken(payload: object) {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign(payload, secret, { expiresIn: "12h" });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";

  if (!token) return res.status(401).json({ error: "Sem token" });

  try {
    const secret = process.env.JWT_SECRET!;
    (req as any).user = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}
