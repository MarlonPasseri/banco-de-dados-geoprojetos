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
  const [rememberSession, setRememberSession] = useState(true);
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
        <div className="absolute left-[-180px] top-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(0,51,102,0.2)] blur-3xl" />
        <div className="absolute right-[-160px] bottom-[-160px] h-[520px] w-[520px] rounded-full bg-[rgba(249,115,22,0.18)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "linear-gradient(to right, var(--login-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--login-grid) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
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

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1180px] items-center px-5 py-8 sm:px-8">
        <motion.main
          className="login-blueprint-frame grid w-full md:grid-cols-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <motion.section
            className="login-blueprint-form md:col-span-5 lg:col-span-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.03 }}
          >
            <header className="login-blueprint-header">
              <div className="login-blueprint-brand">
                <div className="login-mark">GP</div>
                <div className="login-blueprint-brand-copy">
                  <div className="login-blueprint-brand-name">Banco de Dados</div>
                  <div className="login-blueprint-brand-sub">GeoProjetos Internal DB</div>
                </div>
              </div>

              <div className="login-blueprint-eyebrow">Acesso autenticado</div>
              <h1 className="login-blueprint-title">{mode === "login" ? "Acesso ao projeto" : "Criar novo acesso"}</h1>
              <p className="login-blueprint-desc">
                {mode === "login"
                  ? "Entre com suas credenciais internas para acessar consultas, edicao e follow-up."
                  : "Cadastre um novo usuario interno sem perder o fluxo atual de login do sistema."}
              </p>
            </header>

            <div className="mb-6 flex items-start justify-between gap-3">
              <div className="auth-env hidden sm:block">
                Ambiente local
              </div>
            </div>

            <div className="auth-switch mb-5">
              <button
                type="button"
                className={`auth-switch-tab ${mode === "login" ? "auth-switch-tab-active" : ""}`}
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
                className={`auth-switch-tab ${mode === "register" ? "auth-switch-tab-active" : ""}`}
                onClick={() => {
                  setMode("register");
                  setFormError("");
                }}
              >
                <UserRoundPlus size={16} />
                Criar conta
              </button>
            </div>

            {formError ? <div className="auth-alert mb-4">{formError}</div> : null}

            {mode === "login" ? (
              <form onSubmit={onSubmitLogin} className="space-y-6">
                <div className="login-blueprint-field">
                  <label className="login-blueprint-label">Email ou usuario</label>
                  <div className="login-blueprint-input">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      {identifier.includes("@") ? <Mail size={16} /> : <User size={16} />}
                    </span>
                    <input
                      className="input login-blueprint-text-input pl-10"
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

                <div className="login-blueprint-field">
                  <div className="login-blueprint-label-row">
                    <label className="login-blueprint-label">Chave de seguranca</label>
                    <button type="button" className="login-blueprint-field-action" onClick={fillDefaultCredentials}>
                      Usar admin padrao
                    </button>
                  </div>
                  <div className="login-blueprint-input">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Lock size={16} />
                    </span>
                    <input
                      className="input login-blueprint-text-input pl-10 pr-10"
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
                      className="auth-icon-button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <label className="login-blueprint-check">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(e) => setRememberSession(e.target.checked)}
                  />
                  <span>Manter sessao ativa por 24 horas</span>
                </label>

                <button className="login-blueprint-submit" disabled={loadingAction !== null || !canLogin}>
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
                        Autorizando...
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
                        Autorizar acesso
                        <ArrowRight size={16} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <div className="auth-note space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="badge">Padrao: admin / admin123</span>
                    <span className="text-zinc-400">configure em backend/.env</span>
                  </div>
                  <p className="text-zinc-400">Novos usuarios entram imediatamente apos o cadastro.</p>
                </div>
              </form>
            ) : (
              <form onSubmit={onSubmitRegister} className="space-y-6">
                <div className="login-blueprint-field">
                  <label className="login-blueprint-label">Nome</label>
                  <div className="login-blueprint-input">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <User size={16} />
                    </span>
                    <input
                      className="input login-blueprint-text-input pl-10"
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

                <div className="login-blueprint-field">
                  <label className="login-blueprint-label">E-mail</label>
                  <div className="login-blueprint-input">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Mail size={16} />
                    </span>
                    <input
                      className="input login-blueprint-text-input pl-10"
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

                <div className="login-blueprint-field">
                  <label className="login-blueprint-label">Chave de seguranca</label>
                  <div className="login-blueprint-input">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Lock size={16} />
                    </span>
                    <input
                      className="input login-blueprint-text-input pl-10 pr-10"
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
                      className="auth-icon-button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="login-blueprint-field">
                  <label className="login-blueprint-label">Confirmar chave</label>
                  <div className="login-blueprint-input">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Lock size={16} />
                    </span>
                    <input
                      className="input login-blueprint-text-input pl-10 pr-10"
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
                      className="auth-icon-button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Ocultar confirmacao" : "Mostrar confirmacao"}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button className="login-blueprint-submit" disabled={loadingAction !== null || !canRegister}>
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
                        Criando acesso...
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
                        Criar acesso
                        <UserRoundPlus size={16} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <div className="auth-note">
                  Depois do cadastro, o usuario ja pode usar o login com o e-mail e a senha criados.
                </div>
              </form>
            )}

            <footer className="login-blueprint-footer">
              <div className="login-blueprint-footer-block">
                <span className="login-blueprint-footer-label">Status do sistema</span>
                <div className="login-blueprint-footer-value">
                  <span className="login-blueprint-dot" />
                  Operacional
                </div>
              </div>
              <div className="login-blueprint-footer-block">
                <span className="login-blueprint-footer-label">Regiao</span>
                <div className="login-blueprint-footer-value">BR-SP-01</div>
              </div>
            </footer>
          </motion.section>

          <motion.section
            className="login-blueprint-visual hidden md:block md:col-span-7 lg:col-span-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.09 }}
          >
            <div className="login-blueprint-visual-inner">
              <div className="flex items-start justify-between gap-4">
                <div className="login-blueprint-chip-row">
                  <span className="login-blueprint-chip">Consultas</span>
                  <span className="login-blueprint-chip">Edicao</span>
                  <span className="login-blueprint-chip">Follow-up</span>
                </div>

                <div className="login-blueprint-stat">
                  <div className="login-blueprint-stat-top">
                    <div className="login-blueprint-stat-icon">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="login-blueprint-stat-label">Fluxos ativos</div>
                      <div className="login-blueprint-stat-value">{highlights.length} modulos</div>
                    </div>
                  </div>
                  <div className="login-blueprint-stat-text">Consulta, edicao e acompanhamento centralizados.</div>
                </div>
              </div>

              <div className="login-blueprint-quote-wrap">
                <div className="login-blueprint-accent-bar" />
                <blockquote className="login-blueprint-quote">
                  "A integridade do projeto nao depende so do contrato, mas da <span>precisao</span> dos dados."
                </blockquote>
                <div className="login-blueprint-caption">
                  <div className="login-blueprint-caption-line" />
                  Painel interno GeoProjetos
                </div>

                <div className="login-blueprint-metrics">
                  {highlights.map((item) => (
                    <div key={item.title} className="login-blueprint-metric">
                      <div className="login-blueprint-metric-icon">
                        <item.icon size={16} />
                      </div>
                      <div>
                        <div className="login-blueprint-metric-title">{item.title}</div>
                        <div className="login-blueprint-metric-text">{item.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        </motion.main>
      </div>
    </div>
  );
}
