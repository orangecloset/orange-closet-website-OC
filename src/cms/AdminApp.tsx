import { useEffect, useRef, useState } from "react";
import { NavLink, Route, Routes, Link, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Home, Tags, Settings, LogOut, Store, Menu, Info, ShoppingBag, Users } from "lucide-react";
import { isAuthenticated, logout, getCmsSession } from "./store/auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queries";
import { CmsProvider } from "./store/cmsStore";
import { useCms } from "./store/cmsContext";
import { ToastProvider } from "./components/ui";
import { useToast } from "./store/toastContext";
import { cn } from "./lib/utils";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AccountsPage from "./pages/AccountsPage";
import ProductsPage from "./pages/ProductsPage";
import ProductFormPage from "./pages/ProductFormPage";
import SoldPage from "./pages/SoldPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import HomepagePage from "./pages/HomepagePage";
import TypesPage from "./pages/TypesPage";
import SettingsPage from "./pages/SettingsPage";
import AboutPage from "./pages/AboutPage";
import LegalEditorPage from "./pages/LegalEditorPage";
import "../styles/cms-theme.css";

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", to: "/cms-admin", icon: LayoutDashboard, end: true },
      { label: "Sell", to: "/cms-admin/sell", icon: ShoppingBag, end: false },
      { label: "Products", to: "/cms-admin/products", icon: Package, end: false },
      { label: "Categories", to: "/cms-admin/categories", icon: Tags, end: false },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Homepage", to: "/cms-admin/homepage", icon: Home, end: false },
      { label: "About", to: "/cms-admin/about", icon: Info, end: false },
    ],
  },
];

const SETTINGS_ITEM = { label: "Settings", to: "/cms-admin/settings", icon: Settings, end: false };
const ACCOUNTS_ITEM = { label: "Accounts", to: "/cms-admin/accounts", icon: Users, end: false };

const NAV_TITLES: Record<string, string> = {
  "/cms-admin": "Dashboard",
  "/cms-admin/sell": "Sell",
  "/cms-admin/sales-history": "Sales History",
  "/cms-admin/products": "Products",
  "/cms-admin/products/new": "Add Product",
  "/cms-admin/homepage": "Homepage",
  "/cms-admin/about": "About Page",
  "/cms-admin/categories": "Categories",
  "/cms-admin/settings": "Settings",
  "/cms-admin/accounts": "Accounts",
};

function SidebarSectionTitle({ label, collapsed, divider = true }: { label: string; collapsed: boolean; divider?: boolean }) {
  return (
    <div aria-hidden={collapsed} className="relative flex h-5 shrink-0 items-center px-2.5">
      {divider && (
        <div
          className={cn(
            "absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-[var(--border-base)] transition-opacity duration-200",
            collapsed ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        />
      )}
      <span
        className={cn(
          "relative overflow-hidden whitespace-nowrap text-[11px] font-medium uppercase tracking-wide transition-all duration-200",
          collapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100",
          collapsed ? "text-transparent" : "text-[var(--fg-muted)]"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function SidebarNavItem({ item, collapsed }: { item: { label: string; to: string; icon: typeof LayoutDashboard; end: boolean }; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
          isActive
            ? "bg-[var(--bg-subtle)] text-[var(--fg-base)] shadow-[var(--borders-base)]"
            : "text-[var(--fg-subtle)] hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]"
        )
      }
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <item.icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-all duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        {item.label}
      </span>
    </NavLink>
  );
}

function SidebarFooterLink({ to, icon: Icon, label, collapsed }: { to: string; icon: typeof Store; label: string; collapsed: boolean }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-all duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        {label}
      </span>
    </Link>
  );
}

function OfflineNotice() {
  const { showToast } = useToast();

  useEffect(() => {
    if (!navigator.onLine) showToast("No internet connection.");

    const handleOffline = () => showToast("No internet connection.");
    const handleOnline = () => showToast("Connection restored.");

    const interval = setInterval(() => {
      if (!navigator.onLine) showToast("No internet connection.");
    }, 10_000);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, [showToast]);

  return null;
}

function UnsavedChangesNotice() {
  const { configDirty } = useCms();
  const { showToast, dismissAll } = useToast();
  const location = useLocation();
  const prevDirtyRef = useRef<Set<string>>(new Set());
  const prevPathRef = useRef(location.pathname);

  const showDirtyToast = () => showToast("Changes detected. Click Save to apply them.", true, "warning");

  useEffect(() => {
    const pathChanged = prevPathRef.current !== location.pathname;
    prevPathRef.current = location.pathname;

    const hadDirty = prevDirtyRef.current.size > 0;
    const added = configDirty.filter((key) => !prevDirtyRef.current.has(key));
    prevDirtyRef.current = new Set(configDirty);

    if (pathChanged) {
      dismissAll();
      if (configDirty.length > 0) {
        requestAnimationFrame(showDirtyToast);
      }
    } else if (added.length > 0) {
      showDirtyToast();
    } else if (hadDirty && configDirty.length === 0) {
      dismissAll();
    }
  }, [configDirty, location.pathname, showToast, dismissAll]);

  return null;
}

function AdminShell({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) return true;
    return false;
  });
  const me = getCmsSession()?.user ?? null;
  const { settings } = useCms();

  const handleLogout = () => {
    logout();
    onLogout();
    navigate("/cms-admin", { replace: true });
  };

  const currentTitle = NAV_TITLES[location.pathname] ?? "Products";

  useEffect(() => {
    document.title = `${currentTitle} · ${settings.storeName || "Store"} CMS`;
  }, [currentTitle, settings.storeName]);

  return (
    <ToastProvider>
      <OfflineNotice />
      <UnsavedChangesNotice />
    <div className="cms-admin flex h-screen overflow-hidden bg-[var(--bg-subtle)] text-[var(--fg-base)]">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-[var(--border-base)] bg-[var(--bg-base)] transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        <div className="flex h-14 items-center justify-end gap-2 border-b border-[var(--border-base)] px-3">
          <div
            className={cn(
              "flex items-center gap-2 overflow-hidden transition-all duration-200",
              collapsed ? "w-0 opacity-0" : "mr-auto w-auto opacity-100"
            )}
          >
            {settings.faviconUrl?.trim() ? (
              <img
                src={settings.faviconUrl}
                alt=""
                className="h-7 w-7 shrink-0 object-contain"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--button-inverted)]">
                <span className="text-sm font-bold text-[var(--contrast-fg-primary)]">O</span>
              </div>
            )}
            <div className="flex flex-col whitespace-nowrap">
              <span className="text-[13px] font-medium text-[var(--fg-base)]">
                {settings.storeName || "Store"}
              </span>
              <span className="text-[11px] text-[var(--fg-muted)]">CMS Admin</span>
            </div>
          </div>
          {collapsed && (
            <div className="flex sm:hidden h-7 w-7 shrink-0 items-center justify-center mr-1.5">
              {settings.faviconUrl?.trim() ? (
                <img src={settings.faviconUrl} alt="" className="h-5 w-5 object-contain" />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--button-inverted)]">
                  <span className="text-[10px] font-bold text-[var(--contrast-fg-primary)]">O</span>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--fg-subtle)] hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)] mr-1.5"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-3 p-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <SidebarSectionTitle label={section.label} collapsed={collapsed} divider={section.label !== "Main"} />
              {section.items.map((item) => (
                <SidebarNavItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          ))}
          <div className="mt-auto flex flex-col gap-0.5">
            <SidebarSectionTitle label="Settings" collapsed={collapsed} />
            <SidebarNavItem item={SETTINGS_ITEM} collapsed={collapsed} />
            <SidebarNavItem item={ACCOUNTS_ITEM} collapsed={collapsed} />
          </div>
        </nav>

        <div className="flex flex-col gap-0.5 border-t border-[var(--border-base)] p-3">
          <SidebarFooterLink to="/" icon={Store} label="Storefront" collapsed={collapsed} />
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              <LogOut className="h-4 w-4" />
            </span>
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-all duration-200",
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden transition-all duration-200">
        <div className="flex h-14 shrink-0 items-center border-b border-[var(--border-base)] bg-[var(--bg-base)] px-4">
          <nav className="flex items-center gap-1 text-[13px]">
            <span className="text-[var(--fg-muted)]">{settings.storeName || "Store"}</span>
            <span className="text-[var(--fg-muted)]">/</span>
            <span className="font-medium text-[var(--fg-base)]">{currentTitle}</span>
          </nav>
          {me && (
            <span className="ml-auto hidden text-[13px] text-[var(--fg-muted)] sm:block">
              {me.name}
            </span>
          )}
        </div>

        <main className="flex-1 overflow-y-auto p-4">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="sell" element={<SoldPage />} />
            <Route path="sales-history" element={<SalesHistoryPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:productId/edit" element={<ProductFormPage />} />
            <Route path="homepage" element={<HomepagePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="categories" element={<TypesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="legal/:slug/edit" element={<LegalEditorPage />} />
            <Route path="accounts" element={<AccountsPage />} />
          </Routes>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
export default function AdminApp() {
  const [authed, setAuthed] = useState(isAuthenticated());

  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <CmsProvider>
        <AdminShell onLogout={() => setAuthed(false)} />
      </CmsProvider>
    </QueryClientProvider>
  );
}
