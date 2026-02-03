// frontend/src/pages/Login.tsx
import { useEffect, useMemo, useState } from "react";
import { login, setupAdmin } from "../api";
import { Toast, type ToastMsg } from "../components/Toast";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { safeUUID } from "../utils/uuid";

export default function Login() {
  const nav = useNavigate();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const canSubmit = useMemo(() => username.trim() && password.trim(), [username, password]);

  useEffect(() => {
    // já logado? manda pro dashboard
    if (localStorage.getItem("token")) nav("/", { replace: true });
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setToast({
        id: safeUUID(),
        type: "error",
        title: "Campos obrigatórios",
        text: "Informe usuário e senha para entrar.",
      });
      return;
    }

    setLoading(true);
    try {
      await setupAdmin(); // cria admin se não existir
      await login(username, password); // login já salva o token
      setToast({
        id: safeUUID(),
        type: "success",
        title: "Bem-vindo!",
        text: "Login realizado com sucesso.",
      });

      // pequena pausa pra parecer “premium”
      setTimeout(() => nav("/", { replace: true }), 350);
    } catch (e: any) {
      setToast({
        id: safeUUID(),
        type: "error",
        title: "Falha no login",
        text: e?.message || "Usuário ou senha inválidos.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 relative overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-40 h-[520px] w-[520px] rounded-full bg-zinc-900/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[520px] w-[520px] rounded-full bg-zinc-900/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(24,24,27,0.04),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(24,24,27,0.06),transparent_45%)]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-12 grid place-items-center min-h-screen">
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.99 }}
          transition={{ duration: 0.25 }}
        >
          <div className="card overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Brand panel */}
              <div className="bg-zinc-900 text-white p-8 md:p-10 relative">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_45%)]" />
                <div className="relative">
                  <div className="h-12 w-12 rounded-2xl bg-white text-zinc-900 grid place-items-center font-semibold">
                    GP
                  </div>
                  <h1 className="mt-6 text-2xl font-semibold leading-tight">
                    Banco de Dados
                    <br />
                    GeoProjetos
                  </h1>
                  <p className="mt-2 text-sm text-zinc-300">
                    Acesse o painel para importar, consultar e editar seus contratos com rapidez.
                  </p>

                  <div className="mt-6 space-y-2 text-sm text-zinc-200">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Ambiente local seguro
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      Dados sempre organizados
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Edição em tempo real
                    </div>
                  </div>

                  <div className="mt-10 text-xs text-zinc-400">GeoProjetos • Local</div>
                </div>
              </div>

              {/* Form panel */}
              <div className="p-8 md:p-10 bg-white">
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Entrar</h2>
                    <p className="text-sm text-zinc-500">Use seu usuário e senha para continuar.</p>
                  </div>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm text-zinc-600">Usuário</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                        <User size={16} />
                      </span>
                      <input
                        className="input pl-10"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm text-zinc-600">Senha</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                        <Lock size={16} />
                      </span>
                      <input
                        className="input pl-10"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="admin123"
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  <button className="btn btn-primary w-full" disabled={loading || !canSubmit}>
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
                        >
                          Login
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>

                  <div className="pt-2 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-2">
                    <span className="badge">Padrão: admin / admin123</span>
                    <span className="text-zinc-400 whitespace-nowrap">ajuste no backend/.env</span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
