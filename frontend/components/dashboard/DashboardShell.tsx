"use client";

import {
  BarChart3,
  Blocks,
  ChevronRight,
  CreditCard,
  FileQuestion,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getCurrentUser } from "@/lib/api";
import {
  type AuthUser,
  clearToken,
  getStoredToken,
} from "@/lib/auth";

interface DashboardContextValue {
  user: AuthUser;
  setUser: (user: AuthUser) => void;
}

interface DashboardShellProps {
  children: ReactNode;
}

type MenuItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

const clientMenu: MenuItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Meus Quizzes", href: "/dashboard/quizzes", icon: FileQuestion },
  { label: "Leads", href: "/dashboard/leads", icon: Users },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Integrações", href: "/dashboard/integrations", icon: Blocks },
  { label: "Configurações", href: "/dashboard/settings", icon: Settings },
];

const adminMenu: MenuItem[] = [
  { label: "Dashboard Admin", href: "/dashboard", icon: LayoutDashboard },
  { label: "Usuários", href: "/dashboard/admin/users", icon: Users },
  { label: "Todos os Quizzes", href: "/dashboard/quizzes", icon: FileQuestion },
  { label: "Planos e Assinaturas", href: "/dashboard/plans", icon: CreditCard },
  {
    label: "Configurações gerais",
    href: "/dashboard/admin/settings",
    icon: SlidersHorizontal,
  },
];

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    getCurrentUser(token)
      .then(setUser)
      .catch(() => {
        clearToken();
        router.replace("/login");
      });
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const menu = useMemo(
    () => (user?.role === "admin" ? adminMenu : clientMenu),
    [user?.role],
  );

  function logout() {
    clearToken();
    router.replace("/login");
  }

  if (!user) {
    return <DashboardLoading />;
  }

  const isFocusedQuizPage =
    /^\/dashboard\/quizzes\/[^/]+\/(edit|preview|final-page|checkout)$/.test(
      pathname,
    );

  if (isFocusedQuizPage) {
    return (
      <DashboardContext.Provider value={{ user, setUser }}>
        {children}
      </DashboardContext.Provider>
    );
  }

  return (
    <DashboardContext.Provider value={{ user, setUser }}>
      <div className="min-h-screen bg-[#F8F9FA]">
        <MobileHeader onOpen={() => setMobileOpen(true)} />

        {mobileOpen && (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-navy/55 backdrop-blur-sm lg:hidden"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[285px] flex-col bg-navy px-4 py-5 text-white transition-transform duration-200 lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-2">
            <Link href="/dashboard" className="rounded-xl px-1 py-2">
              <Image
                src="/split-master-logo-dark.png"
                alt="Split Master"
                width={601}
                height={328}
                priority
                className="h-auto w-40"
              />
            </Link>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-8 flex-1 space-y-1">
            {menu.map((item) => (
              <DashboardMenuLink
                key={item.href}
                item={item}
                active={isActivePath(pathname, item.href)}
              />
            ))}
          </nav>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
              Plano atual
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-extrabold capitalize text-green">
                {user.plan}
              </span>
              {user.role === "client" && (
                <Link
                  href="/dashboard/settings"
                  className="flex items-center text-xs font-bold text-white/70 hover:text-white"
                >
                  Upgrade
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="px-3 pb-3">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-white/45">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
              Sair da conta
            </button>
          </div>
        </aside>

        <main className="min-h-screen pt-20 lg:pl-[285px] lg:pt-0">
          <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-9 lg:py-9">
            {children}
          </div>
        </main>
      </div>
    </DashboardContext.Provider>
  );
}

export function useDashboardUser(): DashboardContextValue {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error("useDashboardUser deve ser usado dentro do dashboard.");
  }

  return context;
}

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-20 items-center justify-between border-b border-navy/10 bg-white px-4 lg:hidden">
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={onOpen}
        className="rounded-xl border border-navy/10 p-2.5 text-navy"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Image
        src="/split-master-logo.png"
        alt="Split Master"
        width={601}
        height={328}
        priority
        className="absolute left-1/2 h-auto w-32 -translate-x-1/2"
      />
      <div className="w-10" />
    </header>
  );
}

function DashboardMenuLink({
  item,
  active,
}: {
  item: MenuItem;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
        active
          ? "bg-green text-navy shadow-lg shadow-green/15"
          : "text-white/65 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-navy/10 border-t-green" />
        <p className="mt-4 text-sm font-bold text-navy/55">
          Preparando seu painel...
        </p>
      </div>
    </main>
  );
}
