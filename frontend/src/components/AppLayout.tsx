import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  BellRing,
  CircleUserRound,
  Database,
  FileEdit,
  LayoutGrid,
  LogOut,
  MoonStar,
  PlusSquare,
  Search,
  SunMedium,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { clearToken, fetchCurrentUser, getStoredUser, getToken, listFollowUps, subscribeAuthUserChange, type AuthUser } from "../api";
import { GeoProjetosMark, GeoProjetosSignature } from "./BrandLogo";
import { useTheme } from "./ThemeProvider";

const ACTIVITY_REMINDER_ACK_KEY = "activities_reminder_ack_date";
const ACTIVITY_REMINDER_HIDDEN_UNTIL_KEY = "activities_reminder_hidden_until";
const ACTIVITY_REMINDER_INTERVAL_MS = 2 * 60 * 1000;

function todayDateInput() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatReminderDate(date: string) {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date());
}

function getStoredReminderAckDate() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVITY_REMINDER_ACK_KEY) || "";
}

function setStoredReminderAckDate(date: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVITY_REMINDER_ACK_KEY, date);
}

function getStoredReminderHiddenUntil() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(ACTIVITY_REMINDER_HIDDEN_UNTIL_KEY) || "0");
}

function setStoredReminderHiddenUntil(timestamp: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVITY_REMINDER_HIDDEN_UNTIL_KEY, String(timestamp));
}

function clearStoredReminderHiddenUntil() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVITY_REMINDER_HIDDEN_UNTIL_KEY);
}

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

function isNavTargetActive(to: string, pathname: string, search: string) {
  const [targetPathname, targetSearch = ""] = to.split("?");
  const currentParams = new URLSearchParams(search);
  const targetParams = new URLSearchParams(targetSearch);
  const currentTab = currentParams.get("tab");
  const targetTab = targetParams.get("tab");
  return targetTab ? pathname === targetPathname && currentTab === targetTab : pathname === targetPathname;
}

function NavItem({
  to,
  label,
  Icon,
  badgeCount = 0,
}: {
  to: string;
  label: string;
  Icon: LucideIcon;
  badgeCount?: number;
}) {
  const { pathname, search } = useLocation();
  const active = isNavTargetActive(to, pathname, search);

  return (
    <Link to={to} className={`nav-link ${active ? "nav-link-active" : ""}`} aria-current={active ? "page" : undefined} title={label}>
      <Icon size={16} />
      <span className="nav-link-label whitespace-nowrap">{label}</span>
      {badgeCount > 0 ? <span className="nav-link-badge">{badgeCount > 99 ? "99+" : badgeCount}</span> : null}
    </Link>
  );
}

function MobileDockItem({
  to,
  label,
  Icon,
  badgeCount = 0,
}: {
  to: string;
  label: string;
  Icon: LucideIcon;
  badgeCount?: number;
}) {
  const { pathname, search } = useLocation();
  const active = isNavTargetActive(to, pathname, search);

  return (
    <Link to={to} className={`mobile-dock-item ${active ? "mobile-dock-item-active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon size={18} />
      <span>{label}</span>
      {badgeCount > 0 ? <span className="mobile-dock-badge">{badgeCount > 99 ? "99+" : badgeCount}</span> : null}
    </Link>
  );
}

const NAV_ITEMS: Array<{ to: string; label: string; subtitle: string; Icon: LucideIcon }> = [
  { to: "/", label: "Dashboard", subtitle: "Visao geral operacional", Icon: LayoutGrid },
  { to: "/consultas", label: "Consultas", subtitle: "Busca direcionada e leitura de dados", Icon: Search },
  { to: "/graficos", label: "Graficos", subtitle: "Leitura analitica e comparativos", Icon: BarChart3 },
  { to: "/modelagem", label: "Follow up", subtitle: "Acompanhamento e gestao de follow-ups", Icon: Database },
  { to: "/atividades", label: "Atividades", subtitle: "Agenda operacional do dia", Icon: Activity },
  { to: "/insersao", label: "Insercao", subtitle: "Cadastro de novos registros", Icon: PlusSquare },
  { to: "/edicao", label: "Edicao", subtitle: "Ajustes e manutencao de dados", Icon: FileEdit },
  { to: "/import", label: "Importar", subtitle: "Sincronizacao de planilhas", Icon: Upload },
  { to: "/usuario", label: "Usuario", subtitle: "Perfil e configuracoes da conta", Icon: CircleUserRound },
];

const MOBILE_DOCK_ITEMS = NAV_ITEMS.filter((item) =>
  ["/", "/consultas", "/modelagem", "/atividades", "/usuario"].includes(item.to),
);

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [activityReminder, setActivityReminder] = useState<{ date: string; count: number; visible: boolean } | null>(null);
  const [acknowledgedDate, setAcknowledgedDate] = useState(() => getStoredReminderAckDate());
  const reminderCheckInFlight = useRef(false);

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

  useEffect(() => {
    if (pathname === "/atividades") {
      const today = todayDateInput();
      setStoredReminderAckDate(today);
      clearStoredReminderHiddenUntil();
      setAcknowledgedDate(today);
      setActivityReminder(null);
      return;
    }

    if (!getToken()) {
      setActivityReminder(null);
      return;
    }

    let active = true;

    const checkDailyActivities = async () => {
      if (!active || reminderCheckInFlight.current) return;
      const today = todayDateInput();
      const storedAckDate = getStoredReminderAckDate();
      const hiddenUntil = getStoredReminderHiddenUntil();

      if (storedAckDate === today) {
        if (active) {
          setAcknowledgedDate(storedAckDate);
          setActivityReminder(null);
        }
        return;
      }

      if (hiddenUntil > Date.now()) {
        if (active) {
          setActivityReminder((prev) => (prev ? { ...prev, visible: false } : null));
        }
        return;
      }

      reminderCheckInFlight.current = true;

      try {
        const items = await listFollowUps({ date: today });
        if (!active) return;

        if ((items || []).length > 0) {
          setActivityReminder({
            date: today,
            count: items.length,
            visible: true,
          });
        } else {
          setActivityReminder(null);
        }
      } catch {
        if (!active) return;
      } finally {
        reminderCheckInFlight.current = false;
      }
    };

    void checkDailyActivities();
    const timer = window.setInterval(checkDailyActivities, ACTIVITY_REMINDER_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [acknowledgedDate, pathname]);

  const currentSection = useMemo(
    () =>
      NAV_ITEMS.find((item) => item.to === pathname) || {
        to: pathname,
        label: "Painel",
        subtitle: "Painel operacional Geoprojetos",
        Icon: LayoutGrid,
      },
    [pathname],
  );
  const todayLabel = useMemo(() => formatTodayLabel(), []);
  const reminderCount = pathname === "/atividades" ? 0 : activityReminder?.count || 0;
  const userLabel = currentUser?.name || currentUser?.username || currentUser?.email || "Usuario autenticado";

  return (
    <div className="app-shell app-blueprint-shell relative min-h-screen overflow-hidden">
      <a className="skip-link" href="#main-content">
        Ir para o conteudo principal
      </a>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-140px] top-[-120px] h-[500px] w-[500px] rounded-full bg-[rgba(0,51,102,0.18)] blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(29,125,242,0.14)] blur-3xl" />
        <div className="app-shell-watermark">
          <GeoProjetosMark className="app-shell-watermark-mark" />
        </div>
      </div>

      <aside className="shell-sidebar hidden lg:flex">
        <div className="shell-sidebar-inner">
          <div className="shell-sidebar-brand">
            <GeoProjetosSignature compact className="shell-brand-lockup" />
          </div>

          <nav className="shell-nav" aria-label="Navegacao principal">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} Icon={item.Icon} badgeCount={item.to === "/atividades" ? reminderCount : 0} />
            ))}
          </nav>

          <div className="shell-sidebar-footer">
            <Link to="/insersao" className="shell-primary-action">
              <PlusSquare size={15} />
              Nova entrada
            </Link>

            <div className="shell-status-card">
              <div className="shell-status-label">Status do sistema</div>
              <div className="shell-status-value">
                <span className="shell-status-dot" />
                Sessao ativa
              </div>
              <div className="shell-status-copy">{userLabel}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div className="mx-auto max-w-[1480px] px-4 pt-4 sm:px-6">
            <div className="shell-topbar-inner">
              <div className="shell-topbar-brandline">
                <GeoProjetosMark className="shell-topbar-mark" />

                <div className="shell-topbar-copy">
                  <div className="shell-topbar-eyebrow">Geoprojetos engenharia ltda.</div>
                  <div className="shell-topbar-meta">
                    <span className="shell-topbar-section">{currentSection.label}</span>
                    <span className="shell-topbar-subtitle">{currentSection.subtitle}</span>
                  </div>
                </div>
              </div>

              <div className="shell-topbar-actions">
                <Link to="/consultas" className="shell-search-link" title="Abrir consultas">
                  <Search size={15} />
                  <span className="sm:hidden">Buscar</span>
                  <span className="hidden sm:inline">Buscar contrato, cliente ou follow-up</span>
                </Link>

                <Link to="/atividades" className="shell-icon-btn" title="Abrir atividades" aria-label="Abrir atividades">
                  <BellRing size={16} />
                  {reminderCount > 0 ? <span className="shell-action-badge">{reminderCount > 99 ? "99+" : reminderCount}</span> : null}
                </Link>

                <button
                  className="theme-toggle"
                  onClick={toggleTheme}
                  title={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
                  aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
                >
                  <span className="theme-toggle-icon">{isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}</span>
                  <span className="theme-toggle-copy hidden sm:inline">{isDark ? "Modo claro" : "Modo escuro"}</span>
                </button>

                <Link to="/usuario" className="profile-chip" title="Abrir perfil" aria-label="Abrir perfil">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="Foto do usuario" />
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
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>

            <nav className="nav-strip shell-mobile-nav mt-3 hidden items-center gap-1 overflow-x-auto pb-1 md:flex lg:hidden">
              {NAV_ITEMS.map((item) => (
                <NavItem key={item.to} to={item.to} label={item.label} Icon={item.Icon} badgeCount={item.to === "/atividades" ? reminderCount : 0} />
              ))}
            </nav>

            <div className="shell-context-strip">
              <div className="shell-context-card">
                <span className="shell-context-icon">
                  <currentSection.Icon size={16} />
                </span>
                <div className="shell-context-copy">
                  <div className="shell-context-title">{currentSection.label}</div>
                  <div className="shell-context-text">{currentSection.subtitle}</div>
                </div>
              </div>

              <div className="shell-context-pills" aria-label="Resumo de contexto">
                <span className="shell-context-pill">{todayLabel}</span>
                <span className="shell-context-pill shell-context-pill-brand">40 anos de excelencia</span>
                {pathname === "/atividades" ? (
                  <span className="shell-context-pill shell-context-pill-accent">Agenda do dia aberta</span>
                ) : reminderCount > 0 ? (
                  <Link to="/atividades" className="shell-context-pill shell-context-pill-accent">
                    {reminderCount} atividade(s) aguardando
                  </Link>
                ) : (
                  <span className="shell-context-pill">Agenda acompanhada</span>
                )}
                <span className="shell-context-pill">{userLabel}</span>
              </div>
            </div>
          </div>
        </header>

        <motion.main
          id="main-content"
          tabIndex={-1}
          className="shell-content relative mx-auto max-w-[1480px] p-4 sm:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {children}
        </motion.main>
      </div>

      <nav className="mobile-dock md:hidden" aria-label="Navegacao principal">
        <div className="mobile-dock-inner">
          {MOBILE_DOCK_ITEMS.map((item) => (
            <MobileDockItem key={item.to} to={item.to} label={item.label} Icon={item.Icon} badgeCount={item.to === "/atividades" ? reminderCount : 0} />
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {activityReminder?.visible && pathname !== "/atividades" ? (
          <motion.div
            key={`activity-reminder-${activityReminder.date}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="reminder-overlay fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="reminder-modal w-full max-w-[480px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="activity-reminder-title"
            >
              <div className="reminder-kicker">
                <BellRing size={15} />
                Aviso de atividades
              </div>

              <h2 id="activity-reminder-title" className="reminder-title">
                Existe atividade programada para hoje
              </h2>

              <p className="reminder-text">
                Foram encontradas <strong>{activityReminder.count}</strong> atividade(s) para{" "}
                {formatReminderDate(activityReminder.date)}.
                O lembrete volta em 2 minutos enquanto a tela de <strong>Atividades</strong> nao for aberta.
              </p>

              <div className="reminder-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    navigate("/atividades");
                  }}
                  type="button"
                >
                  <Activity size={15} />
                  Abrir atividades
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setActivityReminder((prev) => (prev ? { ...prev, visible: false } : null));
                    setStoredReminderHiddenUntil(Date.now() + ACTIVITY_REMINDER_INTERVAL_MS);
                  }}
                  type="button"
                >
                  Lembrar depois
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
