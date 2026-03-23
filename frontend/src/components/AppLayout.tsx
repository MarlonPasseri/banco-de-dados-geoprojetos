import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, BarChart3, BellRing, CircleUserRound, Database, FileEdit, LayoutGrid, LogOut, MoonStar, PlusSquare, Search, SunMedium, Upload } from "lucide-react";
import { clearToken, fetchCurrentUser, getStoredUser, getToken, listFollowUps, subscribeAuthUserChange, type AuthUser } from "../api";
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

function NavItem({ to, label, Icon }: { to: string; label: string; Icon: any }) {
  const { pathname, search } = useLocation();
  const [targetPathname, targetSearch = ""] = to.split("?");
  const currentParams = new URLSearchParams(search);
  const targetParams = new URLSearchParams(targetSearch);
  const currentTab = currentParams.get("tab");
  const targetTab = targetParams.get("tab");
  const active = targetTab ? pathname === targetPathname && currentTab === targetTab : pathname === targetPathname;

  return (
    <Link to={to} className={`nav-link ${active ? "nav-link-active" : ""}`}>
      <Icon size={16} />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

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
            <NavItem to="/graficos" label="Graficos" Icon={BarChart3} />
            <NavItem to="/modelagem" label="Follow up" Icon={Database} />
            <NavItem to="/atividades" label="Atividades" Icon={Activity} />
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
