export type BrowserNotificationPermission = NotificationPermission | "unsupported";
export type BrowserNotificationOptions = NotificationOptions & {
  renotify?: boolean;
  requireInteraction?: boolean;
};

const DEFAULT_AUTO_CLOSE_MS = 12_000;

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  const current = getBrowserNotificationPermission();
  if (current === "unsupported" || current === "granted" || current === "denied") return current;

  try {
    return await window.Notification.requestPermission();
  } catch {
    return getBrowserNotificationPermission();
  }
}

export function showBrowserNotification(
  title: string,
  options: BrowserNotificationOptions = {},
  autoCloseMs = DEFAULT_AUTO_CLOSE_MS
): { ok: true; notification: Notification } | { ok: false; permission: BrowserNotificationPermission; error?: unknown } {
  const permission = getBrowserNotificationPermission();
  if (permission !== "granted") return { ok: false, permission };

  try {
    const notification = new window.Notification(title, {
      lang: "pt-BR",
      ...options,
    } as NotificationOptions);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    if (!options.requireInteraction && autoCloseMs > 0) {
      window.setTimeout(() => notification.close(), autoCloseMs);
    }

    return { ok: true, notification };
  } catch (error) {
    return { ok: false, permission, error };
  }
}
