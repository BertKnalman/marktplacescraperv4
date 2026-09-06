import { useEffect, useState } from "react";
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { subscribeRun } from "./lib/engine";
import {
  Btn, IconChevronD, IconLogout, IconRadar, IconUser, LogoMark, Spinner, StatusDot, ToastProvider,
} from "./components/ui";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ListingsPage from "./pages/Listings";
import Searches from "./pages/Searches";
import Exports from "./pages/Exports";
import Settings from "./pages/Settings";

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <LogoMark size={40} className="text-fog-300" />
        <Spinner size={22} className="text-amber-400" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/listings", label: "Listings" },
  { to: "/searches", label: "Searches" },
  { to: "/exports", label: "Exports" },
  { to: "/settings", label: "Settings" },
];

function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [live, setLive] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => subscribeRun((run) => setLive(run?.status === "running")), []);
  useEffect(() => window.scrollTo({ top: 0 }), [location.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b hairline bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5">
        <Link to="/" className="group flex items-center gap-2.5">
          <LogoMark size={30} className="text-fog-200 transition-transform duration-300 group-hover:rotate-6" />
          <span className="font-display text-[16.5px] font-extrabold tracking-tight text-fog-50">
            Marketplace<span className="text-amber-400"> Scraper</span>
          </span>
        </Link>

        {live && (
          <Link to="/dashboard" className="hidden items-center gap-2 rounded-full border border-warn-400/40 bg-warn-400/10 px-3 py-1 font-mono text-[10.5px] font-bold uppercase tracking-widest text-warn-400 transition-colors hover:bg-warn-400/20 sm:flex">
            <StatusDot color="#FFD066" pulse /> live run
          </Link>
        )}

        {user && (
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `relative rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200 ${
                    isActive ? "text-amber-400" : "text-fog-400 hover:text-fog-100"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {n.label}
                    {isActive && <span className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-amber-500" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}

        <div className={user ? "relative" : "ml-auto"}>
          {user ? (
            <>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2.5 rounded-full border border-ink-600/60 bg-ink-850/80 py-1.5 pl-1.5 pr-3 transition-colors hover:border-ink-500"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                  <IconUser size={14} />
                </span>
                <span className="hidden max-w-[140px] truncate text-[12.5px] font-semibold text-fog-200 sm:block">
                  {user.display_name}
                </span>
                <IconChevronD size={13} className={`text-fog-500 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <div className="anim-fade absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-xl border border-ink-600/60 bg-ink-850 shadow-lift">
                  <div className="border-b hairline px-4 py-3">
                    <div className="text-[13px] font-bold text-fog-100">{user.display_name}</div>
                    <div className="truncate font-mono text-[11px] text-fog-500">{user.email}</div>
                  </div>
                  <div className="p-1.5 md:hidden">
                    {NAV.map((n) => (
                      <NavLink key={n.to} to={n.to} className={({ isActive }) => `block rounded-lg px-3 py-2 text-[13px] font-semibold ${isActive ? "bg-ink-700 text-amber-400" : "text-fog-300 hover:bg-ink-700/60"}`}>
                        {n.label}
                      </NavLink>
                    ))}
                    <div className="my-1 h-px bg-ink-700" />
                  </div>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-fog-300 transition-colors hover:bg-err-500/10 hover:text-err-400"
                  >
                    <IconLogout size={14} /> Sign out
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link to="/login">
              <Btn size="sm">Sign in</Btn>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t hairline bg-ink-900/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6">
        <div className="flex items-center gap-2.5 text-fog-500">
          <LogoMark size={20} className="text-fog-500" />
          <span className="text-[12.5px]">
            Marketplace Scraper — <span className="text-fog-400">no Python, no installs, runs in your cloud.</span>
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-fog-600">
          <span className="flex items-center gap-1.5"><IconRadar size={12} /> kijiji · olx · ricardo</span>
          <span className="rounded-full border border-ink-600/60 px-2.5 py-0.5 uppercase tracking-wider">demo build · SCRAPER_DEMO_MODE</span>
        </div>
      </div>
    </footer>
  );
}

function Shell() {
  return (
    <div className="bg-stage relative flex min-h-screen flex-col">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[620px]" aria-hidden />
      <div className="noise-overlay pointer-events-none fixed inset-0 z-[1]" aria-hidden />
      <div className="relative z-[2] flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/listings" element={<Protected><ListingsPage /></Protected>} />
            <Route path="/listing/:id" element={<Protected><ListingsPage /></Protected>} />
            <Route path="/searches" element={<Protected><Searches /></Protected>} />
            <Route path="/exports" element={<Protected><Exports /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  );
}
