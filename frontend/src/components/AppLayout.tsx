import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, CircleUserRound, Database, FileEdit, LayoutGrid, LogOut, MoonStar, PlusSquare, Search, SunMedium, Upload } from "lucide-react";
import { clearToken, fetchCurrentUser, getStoredUser, getToken, subscribeAuthUserChange, type AuthUser } from "../api";
import { useTheme } from "./ThemeProvider";

function getUserInitials(user: AuthUser | null) {
  const source = String(user?.name || user?.email || user?.username || "").trim();
  if (!source) return "";

  const parts = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return source.slice(0, 1).toUpperCase();
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}

function NavItem({ to, label, Icon }: { to: string; label: string; Icon: any }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link to={to} className={`nav-link ${active ? "nav-link-active" : ""}`}>
      <Icon size={16} />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());

  useEffect(() => {
    let active = true;

    const syncStoredUser = () => {
      if (!active) return;
      setCurrentUser(getStoredUser());
    };

    syncStoredUser();
    const unsubscribe = subscribeAuthUserChange(syncStoredUser);

    if (getToken()) {
      void fetchCurrentUser()
        .then((user) => {
          if (!active) return;
          setCurrentUser(user);
        })
        .catch(() => undefined);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const initials = getUserInitials(currentUser);

  return (
    <div className="app-shell relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-140px] top-[-120px] h-[500px] w-[500px] rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-140px] h-[520px] w-[520px] rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <header className="app-header sticky top-0 z-40 border-b border-zinc-200/70 backdrop-blur-md">
        <div className="mx-auto max-w-[1480px] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="brand-mark">GP</div>
              <div className="leading-tight">
                <div className="heading text-lg font-semibold">Banco de Dados</div>
                <div className="text-xs text-zinc-500">GeoProjetos - Painel Interno</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                title={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
                aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
              >
                <span className="theme-toggle-icon">{isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}</span>
                <span className="theme-toggle-copy hidden sm:inline">{isDark ? "Modo claro" : "Modo escuro"}</span>
              </button>
              <span className="badge hidden sm:inline-flex">
                <Activity size={13} className="mr-1.5" />
                Sessao ativa
              </span>
              <Link
                to="/usuario"
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-900 text-sm font-semibold text-white shadow-sm transition hover:border-zinc-300"
                title="Abrir perfil"
                aria-label="Abrir perfil"
              >
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Foto do usuario" className="h-full w-full object-cover" />
                ) : initials ? (
                  <span>{initials}</span>
                ) : (
                  <CircleUserRound size={16} />
                )}
              </Link>
              <button
                className="btn"
                onClick={() => {
                  clearToken();
                  window.location.href = "/login";
                }}
                title="Sair"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>

          <nav className="nav-strip mt-3 flex items-center gap-1 overflow-x-auto pb-1">
            <NavItem to="/" label="Dashboard" Icon={LayoutGrid} />
            <NavItem to="/consultas" label="Consultas" Icon={Search} />
            <NavItem to="/modelagem" label="Follow up" Icon={Database} />
            <NavItem to="/insersao" label="Insercao" Icon={PlusSquare} />
            <NavItem to="/edicao" label="Edicao" Icon={FileEdit} />
            <NavItem to="/import" label="Importar" Icon={Upload} />
            <NavItem to="/usuario" label="Usuario" Icon={CircleUserRound} />
          </nav>
        </div>
      </header>

      <motion.main
        className="relative mx-auto max-w-[1480px] p-4 sm:p-6"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25 }}
      >
        {children}
      </motion.main>
    </div>
  );
}
