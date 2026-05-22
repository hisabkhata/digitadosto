import { createFileRoute, Link, Navigate, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Package, ShoppingCart, Wallet, BarChart3, LogOut, Store, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

function AuthLayout() {
  const { user, loading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">…</div>;
  if (!user) return <Navigate to="/login" />;

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { to: "/products", icon: Package, label: t("products") },
    { to: "/sales", icon: ShoppingCart, label: t("sales") },
    { to: "/due", icon: Wallet, label: t("due") },
    { to: "/reports", icon: BarChart3, label: t("reports") },
  ];

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-sidebar-foreground">{t("appName")}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((it) => {
            const active = location.pathname === it.to || (it.to !== "/dashboard" && location.pathname.startsWith(it.to));
            return (
              <Link key={it.to} to={it.to} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setLang((lang === "bn" ? "en" : "bn") as Lang)}>
            <Languages className="mr-2 h-4 w-4" /> {lang === "bn" ? "English" : "বাংলা"}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-destructive" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> {t("logout")}
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <span className="font-bold">{t("appName")}</span>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setLang((lang === "bn" ? "en" : "bn") as Lang)}>
              <Languages className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 pb-24 md:p-8 md:pb-8">
          <Outlet />
        </main>
        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-10 grid grid-cols-5 border-t bg-card md:hidden">
          {navItems.map((it) => {
            const active = location.pathname === it.to || (it.to !== "/dashboard" && location.pathname.startsWith(it.to));
            return (
              <Link key={it.to} to={it.to} className={`flex flex-col items-center gap-1 py-2 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                <it.icon className="h-5 w-5" />
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
