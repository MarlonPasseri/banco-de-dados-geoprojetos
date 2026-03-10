import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { ImagePlus, KeyRound, Trash2, UserRound } from "lucide-react";
import { changePassword, fetchCurrentUser, updateCurrentUser, type AuthUser } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { safeUUID } from "../utils/uuid";

function fmtDate(value: string | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("pt-BR");
}

function getUserInitials(user: Pick<AuthUser, "name" | "email" | "username"> | null | undefined) {
  const source = String(user?.name || user?.email || user?.username || "").trim();
  if (!source) return "U";

  const parts = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return source.slice(0, 1).toUpperCase();
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Falha ao ler a imagem selecionada."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Falha ao ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel processar a imagem."));
    image.src = src;
  });
}

async function buildAvatarDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem deve ter no maximo 5 MB.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const size = 180;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Nao foi possivel preparar a imagem.");
  }

  const scale = Math.max(size / image.width, size / image.height);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const x = Math.round((size - width) / 2);
  const y = Math.round((size - height) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(image, x, y, width, height);

  return canvas.toDataURL("image/jpeg", 0.86);
}

export default function Usuario() {
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [processingAvatar, setProcessingAvatar] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSaveProfile = useMemo(() => {
    if (!user) return false;

    return (
      name.trim() !== String(user.name ?? "").trim() ||
      email.trim() !== String(user.email ?? "").trim() ||
      avatarUrl.trim() !== String(user.avatarUrl ?? "").trim()
    );
  }, [avatarUrl, email, name, user]);

  const canSavePassword = useMemo(
    () => Boolean(currentPassword.trim() && newPassword.trim() && confirmPassword.trim()),
    [confirmPassword, currentPassword, newPassword]
  );

  function notify(type: "success" | "error", title: string, text: string) {
    setToast({ id: safeUUID(), type, title, text });
  }

  async function loadUser() {
    setLoading(true);
    try {
      const current = await fetchCurrentUser();
      setUser(current);
      setName(String(current.name ?? ""));
      setEmail(String(current.email ?? ""));
      setAvatarUrl(String(current.avatarUrl ?? ""));
    } catch (e: any) {
      notify("error", "Erro", e?.message || "Falha ao carregar os dados do usuario.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUser();
  }, []);

  async function onSelectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessingAvatar(true);
    try {
      const nextAvatarUrl = await buildAvatarDataUrl(file);
      setAvatarUrl(nextAvatarUrl);
      notify("success", "Foto preparada", "Agora clique em salvar perfil para aplicar a nova foto.");
    } catch (e: any) {
      notify("error", "Foto invalida", e?.message || "Nao foi possivel carregar a foto.");
    } finally {
      setProcessingAvatar(false);
    }
  }

  function onRemoveAvatar() {
    setAvatarUrl("");
  }

  async function onSaveProfile() {
    if (!user || !canSaveProfile || processingAvatar) return;

    setSavingProfile(true);
    try {
      const result = await updateCurrentUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        avatarUrl: avatarUrl.trim(),
      });
      setUser(result.user);
      setName(String(result.user.name ?? ""));
      setEmail(String(result.user.email ?? ""));
      setAvatarUrl(String(result.user.avatarUrl ?? ""));
      notify("success", "Perfil atualizado", "Suas informacoes foram salvas.");
    } catch (e: any) {
      notify("error", "Erro ao salvar", e?.message || "Falha ao atualizar o perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword() {
    if (!canSavePassword) return;
    if (newPassword !== confirmPassword) {
      return notify("error", "Validacao", "A confirmacao da nova senha nao confere.");
    }

    setSavingPassword(true);
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify("success", "Senha atualizada", result.message || "Senha alterada com sucesso.");
    } catch (e: any) {
      notify("error", "Erro ao trocar senha", e?.message || "Falha ao alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  const avatarInitials = getUserInitials({
    name: name.trim() || user?.name || "",
    email: email.trim() || user?.email || "",
    username: user?.username || "",
  });

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.div className="page-hero" variants={item}>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-zinc-900 text-xl font-semibold text-white shadow-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Foto do usuario" className="h-full w-full object-cover" />
            ) : (
              <span>{avatarInitials}</span>
            )}
          </div>

          <div>
            <div className="page-kicker">Conta</div>
            <h1 className="page-title inline-flex items-center gap-2">
              <UserRound size={22} />
              Area do usuario
            </h1>
            <p className="page-desc">Atualize seus dados de acesso, sua foto e sua senha.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="badge">{user?.email || user?.username || "Conta interna"}</span>
          <span className="badge">{avatarUrl ? "Foto definida" : "Sem foto"}</span>
          <span className="badge">{loading ? "Carregando" : "Conta ativa"}</span>
        </div>
      </motion.div>

      <motion.div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]" variants={item}>
        <section className="panel-soft space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="heading text-xl font-semibold text-zinc-900">Perfil</h2>
              <p className="text-sm text-zinc-500">Informacoes basicas da sua conta.</p>
            </div>
            <button
              className="btn btn-primary"
              disabled={!canSaveProfile || savingProfile || loading || processingAvatar}
              onClick={onSaveProfile}
            >
              {savingProfile ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-900 text-2xl font-semibold text-white shadow-sm">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Preview da foto" className="h-full w-full object-cover" />
                  ) : (
                    <span>{avatarInitials}</span>
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold text-zinc-800">Foto do perfil</div>
                  <p className="text-sm text-zinc-500">JPG, PNG ou WEBP. A imagem sera ajustada automaticamente.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onSelectAvatar}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={loading || processingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={16} />
                  {processingAvatar ? "Processando..." : avatarUrl ? "Trocar foto" : "Escolher foto"}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={loading || processingAvatar || !avatarUrl}
                  onClick={onRemoveAvatar}
                >
                  <Trash2 size={16} />
                  Remover foto
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Nome</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-zinc-600">E-mail</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Usuario</label>
              <input className="input" value={String(user?.username ?? "-")} disabled />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Status</label>
              <input className="input" value={loading ? "Carregando..." : "Ativo"} disabled />
            </div>
          </div>
        </section>

        <section className="panel-soft space-y-4">
          <div className="inline-flex items-center gap-2">
            <KeyRound size={18} />
            <h2 className="heading text-xl font-semibold text-zinc-900">Senha</h2>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Senha atual</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Nova senha</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimo 8 caracteres com letra e numero"
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-600">Confirmar nova senha</label>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button className="btn btn-primary w-full" disabled={!canSavePassword || savingPassword || loading} onClick={onChangePassword}>
            {savingPassword ? "Salvando..." : "Alterar senha"}
          </button>
        </section>
      </motion.div>

      <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-2" variants={item}>
        <section className="panel-soft space-y-2">
          <div className="text-sm font-semibold text-zinc-700">Resumo da conta</div>
          <div className="text-sm text-zinc-600">
            Nome atual: <b>{user?.name || "-"}</b>
          </div>
          <div className="text-sm text-zinc-600">
            E-mail atual: <b>{user?.email || "-"}</b>
          </div>
          <div className="text-sm text-zinc-600">
            Usuario interno: <b>{user?.username || "-"}</b>
          </div>
          <div className="text-sm text-zinc-600">
            Foto: <b>{user?.avatarUrl ? "Configurada" : "Nao definida"}</b>
          </div>
        </section>

        <section className="panel-soft space-y-2">
          <div className="text-sm font-semibold text-zinc-700">Auditoria</div>
          <div className="text-sm text-zinc-600">
            Criado em: <b>{fmtDate(user?.createdAt)}</b>
          </div>
          <div className="text-sm text-zinc-600">
            Ultima atualizacao: <b>{fmtDate(user?.updatedAt)}</b>
          </div>
        </section>
      </motion.div>
    </motion.div>
  );
}
