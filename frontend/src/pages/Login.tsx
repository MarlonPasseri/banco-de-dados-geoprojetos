import { useEffect, useMemo, useState } from "react";
import { login, registerUser, setupAdmin } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Database,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MoonStar,
  ShieldCheck,
  Sparkles,
  SunMedium,
  User,
  UserRoundPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { safeUUID } from "../utils/uuid";
import { useTheme } from "../components/ThemeProvider";

type AuthMode = "login" | "register";

const highlights = [
  {
    icon: Database,
    title: "Dados centralizados",
    text: "Importacao, consulta e follow up em um unico fluxo.",
  },
  {
    icon: ShieldCheck,
    title: "Acesso simples",
    text: "Cadastro direto com nome, e-mail e senha, sem depender de provedor externo.",
  },
  {
    icon: Sparkles,
    title: "Operacao rapida",
    text: "Criou a conta, entrou. Menos etapas para o time interno.",
  },
];

export default function Login() {
  const nav = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loadingAction, setLoadingAction] = useState<"login" | "register" | null>(null);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const canLogin = useMemo(() => Boolean(identifier.trim() && password.trim()), [identifier, password]);
  const canRegister = useMemo(
    () => Boolean(name.trim() && email.trim() && registerPassword.trim() && confirmPassword.trim()),
    [confirmPassword, email, name, registerPassword]
  );

  useEffect(() => {
    if (localStorage.getItem("token")) nav("/", { replace: true });
  }, [nav]);

  function clearRegisterForm() {
    setName("");
    setEmail("");
    setRegisterPassword("");
    setConfirmPassword("");
  }

  async function onSubmitLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!canLogin) {
      setFormError("Informe seu usuario ou e-mail e a senha.");
      return;
    }

    setFormError("");
    setLoadingAction("login");

    try {
      if (identifier.trim().toLowerCase() === "admin") {
        await setupAdmin().catch(() => undefined);
      }

      await login(identifier.trim(), password);
      setToast({
        id: safeUUID(),
        type: "success",
        title: "Bem-vindo",
        text: "Login realizado com sucesso.",
      });
      setTimeout(() => nav("/", { replace: true }), 300);
    } catch (e: any) {
      const message = e?.message || "Usuario, e-mail ou senha invalidos.";
      setFormError(message);
      setToast({
        id: safeUUID(),
        type: "error",
        title: "Falha no login",
        text: message,
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function onSubmitRegister(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!canRegister) {
      setFormError("Preencha nome, e-mail, senha e confirmacao.");
      return;
    }

    if (registerPassword !== confirmPassword) {
      setFormError("A confirmacao de senha nao confere.");
      return;
    }

    setFormError("");
    setLoadingAction("register");

    try {
      const result = await registerUser({
        name: trimmedName,
        email: normalizedEmail,
        password: registerPassword,
      });

      setMode("login");
      setIdentifier(normalizedEmail);
      setPassword("");
      clearRegisterForm();
      setToast({
        id: safeUUID(),
        type: "success",
        title: "Cadastro criado",
        text: result.message,
      });
    } catch (e: any) {
      const message = e?.message || "Falha ao criar a conta.";
      setFormError(message);
      setToast({
        id: safeUUID(),
        type: "error",
        title: "Falha no cadastro",
        text: message,
      });
    } finally {
      setLoadingAction(null);
    }
  }

  function fillDefaultCredentials() {
    setMode("login");
    setIdentifier("admin");
    setPassword("admin123");
    setFormError("");
  }

  return (
    <div className="login-shell relative min-h-screen overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-180px] top-[-140px] h-[520px] w-[520px] rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute right-[-160px] bottom-[-160px] h-[520px] w-[520px] rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute inset-0 opacity-30 [background:linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:34px_34px]" />
      </div>

      <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-8">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
          aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          <span className="theme-toggle-icon">{isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}</span>
          <span className="theme-toggle-copy">{isDark ? "Modo claro" : "Modo escuro"}</span>
        </button>
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center px-5 py-10 sm:px-8">
        <motion.div
          className="grid w-full gap-6 lg:grid-cols-[1.08fr_0.92fr]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <motion.section
            className="card relative overflow-hidden border-zinc-800/10 bg-zinc-900 p-7 text-white sm:p-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.03 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(125,211,252,0.35),transparent_45%),radial-gradient(circle_at_85%_78%,rgba(251,191,36,0.25),transparent_45%)]" />
            <div className="absolute right-6 top-6 rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-zinc-200">
              GeoProjetos Local
            </div>

            <div className="relative">
              <div className="login-mark">GP</div>
              <h1 className="mt-7 heading text-3xl font-semibold leading-tight">
                Banco de Dados
                <br />
                GeoProjetos
              </h1>
              <p className="mt-3 max-w-md text-sm text-zinc-200">
                Plataforma interna para acompanhar contratos, GPs e follow-ups com cadastro e acesso simplificados.
              </p>

              <div className="mt-7 grid gap-3">
                {highlights.map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-3">
                    <div className="mt-0.5 rounded-xl bg-white/15 p-2">
                      <item.icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-zinc-200">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold">GP</div>
                  <div className="text-[11px] text-zinc-300">Controle</div>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold">SQL</div>
                  <div className="text-[11px] text-zinc-300">Persistencia</div>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold">LOGIN</div>
                  <div className="text-[11px] text-zinc-300">Direto</div>
                </div>
              </div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1 text-xs text-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Ambiente ativo para uso interno
              </div>
            </div>
          </motion.section>

          <motion.section
            className="card border-zinc-200/90 bg-white/95 p-7 sm:p-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.09 }}
          >
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Acesso ao sistema</p>
                <h2 className="mt-1 heading text-2xl font-semibold text-zinc-900">
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {mode === "login"
                    ? "Use seu usuario ou e-mail para continuar."
                    : "Cadastre um novo usuario e entre em seguida, sem etapa extra de verificacao."}
                </p>
              </div>
              <div className="hidden rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 sm:block">
                Ambiente local
              </div>
            </div>

            <div className="mb-5 inline-flex w-full rounded-2xl border border-zinc-200 bg-zinc-100 p-1">
              <button
                type="button"
                className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${mode === "login" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"}`}
                onClick={() => {
                  setMode("login");
                  setFormError("");
                }}
              >
                <ArrowRight size={16} />
                Entrar
              </button>
              <button
                type="button"
                className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${mode === "register" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"}`}
                onClick={() => {
                  setMode("register");
                  setFormError("");
                }}
              >
                <UserRoundPlus size={16} />
                Criar conta
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={onSubmitLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm text-zinc-700">Usuario ou e-mail</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      {identifier.includes("@") ? <Mail size={16} /> : <User size={16} />}
                    </span>
                    <input
                      className="input pl-10"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (formError) setFormError("");
                      }}
                      placeholder="admin ou voce@empresa.com"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-zinc-700">Senha</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Lock size={16} />
                    </span>
                    <input
                      className="input pl-10 pr-10"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (formError) setFormError("");
                      }}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button className="btn btn-primary h-11 w-full" disabled={loadingAction !== null || !canLogin}>
                  <AnimatePresence mode="wait">
                    {loadingAction === "login" ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex items-center gap-2"
                      >
                        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Entrando...
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex items-center gap-2"
                      >
                        Continuar
                        <ArrowRight size={16} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <button
                  type="button"
                  className="btn h-11 w-full"
                  onClick={fillDefaultCredentials}
                  disabled={loadingAction !== null}
                  title="Preenche as credenciais padrao de desenvolvimento"
                >
                  Usar admin padrao
                </button>

                <div className="space-y-2 pt-1 text-xs text-zinc-500">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="badge">Padrao: admin / admin123</span>
                    <span className="text-zinc-400">configure em backend/.env</span>
                  </div>
                  <p className="text-zinc-400">Novos usuarios entram imediatamente apos o cadastro.</p>
                </div>
              </form>
            ) : (
              <form onSubmit={onSubmitRegister} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm text-zinc-700">Nome</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <User size={16} />
                    </span>
                    <input
                      className="input pl-10"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (formError) setFormError("");
                      }}
                      placeholder="Seu nome"
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-zinc-700">E-mail</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Mail size={16} />
                    </span>
                    <input
                      className="input pl-10"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (formError) setFormError("");
                      }}
                      placeholder="voce@empresa.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-zinc-700">Senha</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Lock size={16} />
                    </span>
                    <input
                      className="input pl-10 pr-10"
                      type={showPassword ? "text" : "password"}
                      value={registerPassword}
                      onChange={(e) => {
                        setRegisterPassword(e.target.value);
                        if (formError) setFormError("");
                      }}
                      placeholder="Minimo 8 caracteres com letra e numero"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-zinc-700">Confirmar senha</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Lock size={16} />
                    </span>
                    <input
                      className="input pl-10 pr-10"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (formError) setFormError("");
                      }}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Ocultar confirmacao" : "Mostrar confirmacao"}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button className="btn btn-primary h-11 w-full" disabled={loadingAction !== null || !canRegister}>
                  <AnimatePresence mode="wait">
                    {loadingAction === "register" ? (
                      <motion.span
                        key="loading-register"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex items-center gap-2"
                      >
                        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Criando conta...
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle-register"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex items-center gap-2"
                      >
                        Criar conta
                        <UserRoundPlus size={16} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
                  Depois do cadastro, o usuario ja pode usar o login com o e-mail e a senha criados.
                </div>
              </form>
            )}
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}
