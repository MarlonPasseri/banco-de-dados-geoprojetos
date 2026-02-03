export function safeUUID() {
  // @ts-ignore
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  // fallback simples (bom o suficiente pra ids de UI/toast)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
