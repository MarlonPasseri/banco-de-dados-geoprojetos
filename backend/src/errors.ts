import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function statusFromPrisma(error: Prisma.PrismaClientKnownRequestError) {
  if (error.code === "P2002") return 409;
  if (error.code === "P2025") return 404;
  return 400;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({ error: error.message, details: error.details });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(statusFromPrisma(error)).json({
      error: "Database request failed",
      code: error.code,
    });
  }

  if (error instanceof Error) {
    const low = error.message.toLowerCase();
    if (error instanceof SyntaxError && "body" in (error as any)) {
      return res.status(400).json({ error: "JSON invalido" });
    }
    if (low.includes("cors")) {
      return res.status(403).json({ error: "CORS origin not allowed" });
    }
    if (low.includes(".xlsx") || low.includes("planilha") || low.includes("sheet")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }

  return res.status(500).json({ error: "Internal server error" });
}
