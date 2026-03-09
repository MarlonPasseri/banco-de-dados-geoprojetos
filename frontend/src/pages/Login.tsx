import { useEffect, useMemo, useState } from "react";
import { login, setupAdmin } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Database, Eye, EyeOff, Lock, MoonStar, ShieldCheck, Sparkles, SunMedium, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { safeUUID } from "../utils/uuid";
import { useTheme } from "../components/ThemeProvider";

const highlights = [
  {
    icon: Database,
    title: "Dados centralizados",
    text: "Importacao, consulta e modelagem em um unico fluxo.",
  },
  {
    icon: ShieldCheck,
    title: "Ambiente local",
    text: "Controle de acesso via token e operacao dentro da sua rede.",
  },
  {
    icon: Sparkles,
    title: "Operacao rapida",
    text: "Edicao e acompanhamento das GPs com menos passos.",
  },
];

export default function Login() {
  const nav = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const canSubmit = useMemo(() => username.trim() && password.trim(), [username, password]);

  useEffect(() => {
    if (localStorage.getItem("token")) nav("/", { replace: true });
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit) {
      setFormError("Informe usuario e senha para entrar.");
      setToast({
        id: safeUUID(),
        type: "error",
        title: "Campos obrigatorios",
        text: "Informe usuario e senha para entrar.",
      });
      return;
    }

    setFormError("");
    setLoading(true);

    try {
      await setupAdmin();
      await login(username, password);

      setToast({
        id: safeUUID(),
        type: "success",
        title: "Bem-vindo",
        text: "Login realizado com sucesso.",
      });

      setTimeout(() => nav("/", { replace: true }), 350);
    } catch (e: any) {
      const message = e?.message || "Usuario ou senha invalidos.";
      setFormError(message);
      setToast({
        id: safeUUID(),
        type: "error",
        title: "Falha no login",
        text: message,
      });
    } finally {
      setLoading(false);
    }
  }

  function fillDefaultCredentials() {
    setUsername("admin");
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
              <div className="login-mark">
                GP
              </div>
              <h1 className="mt-7 heading text-3xl font-semibold leading-tight">
                Banco de Dados
                <br />
                GeoProjetos
              </h1>
              <p className="mt-3 max-w-md text-sm text-zinc-200">
                Plataforma interna para acompanhar contratos, GPs e follow-ups com operacao rapida.
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
                  <div className="text-lg font-semibold">JWT</div>
                  <div className="text-[11px] text-zinc-300">Acesso</div>
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
                <h2 className="mt-1 heading text-2xl font-semibold text-zinc-900">Entrar</h2>
                <p className="mt-1 text-sm text-zinc-500">Use seu usuario e senha para continuar.</p>
              </div>
              <div className="hidden rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 sm:block">
                Ambiente local
              </div>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-zinc-700">Usuario</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    <User size={16} />
                  </span>
                  <input
                    className="input pl-10"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (formError) setFormError("");
                    }}
                    placeholder="admin"
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
                    placeholder="admin123"
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

              <button className="btn btn-primary h-11 w-full" disabled={loading || !canSubmit}>
                <AnimatePresence mode="wait">
                  {loading ? (
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
                disabled={loading}
                title="Preenche as credenciais padrao de desenvolvimento"
              >
                Usar admin padrao
              </button>

              <div className="space-y-2 pt-1 text-xs text-zinc-500">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="badge">Padrao: admin / admin123</span>
                  <span className="text-zinc-400">configure em backend/.env</span>
                </div>
                <p className="text-zinc-400">
                  Dica: apos primeiro acesso, altere as credenciais no backend para ambiente produtivo.
                </p>
              </div>
            </form>
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}
