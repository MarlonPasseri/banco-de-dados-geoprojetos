import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutGrid, Search, Upload, LogOut, PlusSquare, FileEdit } from "lucide-react";
import { clearToken } from "../api";

function NavItem({ to, label, Icon }: { to: string; label: string; Icon: any }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={`btn ${active ? "btn-primary" : ""}`}
      style={{ paddingLeft: 12, paddingRight: 12 }}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-40 h-[520px] w-[520px] rounded-full bg-zinc-900/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[520px] w-[520px] rounded-full bg-zinc-900/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(24,24,27,0.04),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(24,24,27,0.06),transparent_45%)]" />
      </div>
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-[1400px] p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-zinc-900 text-white grid place-items-center font-semibold">
              GP
            </div>
            <div className="leading-tight">
              <div className="font-semibold heading text-lg">Banco de Dados</div>
              <div className="text-xs text-zinc-500">GeoProjetos � Local</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <NavItem to="/" label="Dashboard" Icon={LayoutGrid} />
            <NavItem to="/consultas" label="Consultas" Icon={Search} />
            <NavItem to="/insersao" label="Inserção" Icon={PlusSquare} />
            <NavItem to="/edicao" label="Edição" Icon={FileEdit} />
            <NavItem to="/import" label="Importar" Icon={Upload} />

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
          </nav>
        </div>
      </header>

      <motion.main
        className="relative mx-auto max-w-[1400px] p-6"
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
