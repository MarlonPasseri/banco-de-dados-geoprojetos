import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "./db.js";
import { env } from "./config.js";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isStrongEnoughPassword(password: string) {
  if (password.length < 8 || password.length > 256) return false;
  return /[a-z]/i.test(password) && /\d/.test(password);
}

function buildVerificationUrl(token: string) {
  return `${env.appBaseUrl}/verificar-email?token=${encodeURIComponent(token)}`;
}

function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function sendEmail(payload: EmailPayload) {
  if (env.emailProvider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Falha ao enviar e-mail de verificacao.");
    }

    return;
  }

  console.log("");
  console.log("[email-preview] Verificacao de e-mail");
  console.log(`To: ${payload.to}`);
  console.log(`Subject: ${payload.subject}`);
  console.log(payload.text);
  console.log("");
}

function buildVerificationMessage(user: Pick<User, "name" | "email">, verifyUrl: string) {
  const displayName = String(user.name ?? "").trim() || "usuario";
  const email = String(user.email ?? "").trim();
  const subject = "Confirme seu e-mail - GeoProjetos";
  const text =
    `Ola, ${displayName}.\n\n` +
    `Confirme seu e-mail para ativar sua conta GeoProjetos:\n${verifyUrl}\n\n` +
    `Se voce nao solicitou esse cadastro, ignore esta mensagem.\n`;
  const html =
    `<p>Ola, <strong>${displayName}</strong>.</p>` +
    `<p>Confirme seu e-mail para ativar sua conta GeoProjetos.</p>` +
    `<p><a href="${verifyUrl}">Confirmar e-mail</a></p>` +
    `<p>Se voce nao solicitou esse cadastro, ignore esta mensagem.</p>`;

  return { to: email, subject, text, html };
}

export async function createEmailVerification(user: Pick<User, "id" | "name" | "email">) {
  const email = String(user.email ?? "").trim();
  if (!email) throw new Error("Usuario sem e-mail para verificacao.");

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + env.emailVerificationExpiresHours * 60 * 60 * 1000);

  await prisma.userVerificationToken.deleteMany({
    where: {
      userId: user.id,
      consumedAt: null,
    },
  });

  await prisma.userVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const verifyUrl = buildVerificationUrl(rawToken);
  await sendEmail(buildVerificationMessage(user, verifyUrl));

  return {
    verifyUrl,
    expiresAt,
    previewUrl: env.nodeEnv === "production" ? null : verifyUrl,
  };
}

export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = hashVerificationToken(token);
  const verification = await prisma.userVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!verification) {
    return { ok: false as const, reason: "invalid" as const };
  }

  if (verification.consumedAt) {
    return { ok: false as const, reason: "used" as const };
  }

  if (verification.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.userVerificationToken.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    });

    const user = await tx.user.update({
      where: { id: verification.userId },
      data: {
        emailVerifiedAt: verification.user.emailVerifiedAt ?? new Date(),
      },
    });

    await tx.userVerificationToken.deleteMany({
      where: {
        userId: verification.userId,
        id: { not: verification.id },
      },
    });

    return user;
  });

  return { ok: true as const, user: result };
}
