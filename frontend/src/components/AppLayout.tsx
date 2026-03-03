import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Database, FileEdit, LayoutGrid, LogOut, PlusSquare, Search, Upload } from "lucide-react";
import { clearToken } from "../api";

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-140px] top-[-120px] h-[500px] w-[500px] rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-140px] h-[520px] w-[520px] rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <header className="app-header sticky top-0 z-40 border-b border-zinc-200/70 backdrop-blur-md">
        <div className="mx-auto max-w-[1480px] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-900 font-semibold text-white shadow-md">
                GP
              </div>
              <div className="leading-tight">
                <div className="heading text-lg font-semibold">Banco de Dados</div>
                <div className="text-xs text-zinc-500">GeoProjetos - Painel Interno</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="badge hidden sm:inline-flex">
                <Activity size={13} className="mr-1.5" />
                Sessao ativa
              </span>
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

          <nav className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
            <NavItem to="/" label="Dashboard" Icon={LayoutGrid} />
            <NavItem to="/consultas" label="Consultas" Icon={Search} />
            <NavItem to="/modelagem" label="Modelagem" Icon={Database} />
            <NavItem to="/insersao" label="Insercao" Icon={PlusSquare} />
            <NavItem to="/edicao" label="Edicao" Icon={FileEdit} />
            <NavItem to="/import" label="Importar" Icon={Upload} />
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
