import type { NextFunction, Request, Response } from "express";

type KeyGenerator = (req: Request) => string;

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix?: string;
  keyGenerator?: KeyGenerator;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function defaultKeyGenerator(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createRateLimiter(options: RateLimitOptions) {
  const keyPrefix = options.keyPrefix ?? "rate";
  const keyGenerator = options.keyGenerator ?? defaultKeyGenerator;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    if (buckets.size > 5000) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }

    const key = `${keyPrefix}:${keyGenerator(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: options.message });
    }

    return next();
  };
}
