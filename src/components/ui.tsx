/** Design system: custom inline SVG icons + shared primitives + toast bus. */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { MARKETPLACES } from "../lib/scraper";
import type { MarketplaceId } from "../types";

/* ================= icons ================= */

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function svgProps({ size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
}

export const IconRadar = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" opacity="0.55" />
    <path d="M12 12L18.5 5.8" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
    <path d="M7.5 10.5a3 3 0 0 1 3-3" opacity="0.6" />
  </svg>
);
export const IconPlay = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconStop = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none" />
  </svg>
);
export const IconDownload = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M12 4v10m0 0l-4-4m4 4l4-4" />
    <path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
  </svg>
);
export const IconExternal = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M9 5H6a1.5 1.5 0 0 0-1.5 1.5V18A1.5 1.5 0 0 0 6 19.5h11.5A1.5 1.5 0 0 0 19 18v-3" />
    <path d="M13.5 4.5H19.5V10.5" />
    <path d="M19 5L11 13" />
  </svg>
);
export const IconTrash = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M5 7h14M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
    <path d="M7 7l1 12.2A1.6 1.6 0 0 0 9.6 20.7h4.8a1.6 1.6 0 0 0 1.6-1.5L17 7" />
    <path d="M10.2 11v6M13.8 11v6" opacity="0.7" />
  </svg>
);
export const IconChevronL = (p: IconProps) => (
  <svg {...svgProps(p)}><path d="M14.5 5.5L8 12l6.5 6.5" /></svg>
);
export const IconChevronR = (p: IconProps) => (
  <svg {...svgProps(p)}><path d="M9.5 5.5L16 12l-6.5 6.5" /></svg>
);
export const IconChevronD = (p: IconProps) => (
  <svg {...svgProps(p)}><path d="M5.5 9.5L12 16l6.5-6.5" /></svg>
);
export const IconArrowR = (p: IconProps) => (
  <svg {...svgProps(p)}><path d="M4 12h15m0 0l-5.5-5.5M19 12l-5.5 5.5" /></svg>
);
export const IconUser = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" />
  </svg>
);
export const IconLogout = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" />
    <path d="M10 12h10m0 0l-3.5-3.5M20 12l-3.5 3.5" />
  </svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...svgProps(p)}><path d="M4.5 12.5l5 5L19.5 6.5" /></svg>
);
export const IconX = (p: IconProps) => (
  <svg {...svgProps(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconAlert = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M12 3.5L2.8 19.5h18.4z" />
    <path d="M12 9.5v4.5" />
    <circle cx="12" cy="16.8" r="0.4" fill="currentColor" />
  </svg>
);
export const IconInfo = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.5" fill="currentColor" />
  </svg>
);
export const IconGlobe = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5s1.3-6.1 3.9-8.5z" />
  </svg>
);
export const IconClock = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5.2l3.4 2" />
  </svg>
);
export const IconDb = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <ellipse cx="12" cy="6" rx="7.5" ry="2.8" />
    <path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6" />
    <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" opacity="0.65" />
  </svg>
);
export const IconRefresh = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.8 3.6v3.6h-3.6" />
  </svg>
);
export const IconLayers = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z" />
    <path d="M3.5 12.5L12 17l8.5-4.5" opacity="0.7" />
    <path d="M3.5 16.5L12 21l8.5-4.5" opacity="0.4" />
  </svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.8l1 2.3 2.5-.5 1.5 2 2.4 1-.3 2.5 1.7 1.9-1.7 1.9.3 2.5-2.4 1-1.5 2-2.5-.5-1 2.3-1-2.3-2.5.5-1.5-2-2.4-1 .3-2.5L3.4 12l1.7-1.9-.3-2.5 2.4-1 1.5-2 2.5.5z" opacity="0.9" />
  </svg>
);
export const IconHistory = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M4.2 12a7.8 7.8 0 1 1 2.3 5.5" />
    <path d="M4 17.5v-3.6h3.6" />
    <path d="M12 8v4.3l2.8 1.7" />
  </svg>
);
export const IconGrid = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <rect x="4" y="4" width="7" height="7" rx="1.2" />
    <rect x="13" y="4" width="7" height="7" rx="1.2" opacity="0.7" />
    <rect x="4" y="13" width="7" height="7" rx="1.2" opacity="0.7" />
    <rect x="13" y="13" width="7" height="7" rx="1.2" opacity="0.45" />
  </svg>
);
export const IconDoc = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M7 3.5h7L18.5 8v11A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" />
    <path d="M14 3.5V8h4.5" />
    <path d="M8.5 12h7M8.5 15.5h7M8.5 8.5H11" opacity="0.7" />
  </svg>
);
export const IconTerminal = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.6" />
    <path d="M7.5 9l3 3-3 3M12.5 15.5h4.5" />
  </svg>
);
export const IconShield = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M12 3.5l7.5 2.8v5.4c0 4.5-3 7.8-7.5 9.3-4.5-1.5-7.5-4.8-7.5-9.3V6.3z" />
    <path d="M8.8 12l2.2 2.2 4.2-4.4" />
  </svg>
);
export const IconBolt = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M13 3L5 13.5h5L10.5 21 19 10.5h-5z" />
  </svg>
);
export const IconImage = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.6" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M5 17.5l4.8-4.5 3.2 3 2.5-2.2 3.5 3.7" />
  </svg>
);
export const IconEye = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);
export const IconFilter = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

/** Brand mark: radar sweep inside capture brackets. */
export const LogoMark = ({ size = 26, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
    <path d="M4 10V6a2 2 0 0 1 2-2h4M22 4h4a2 2 0 0 1 2 2v4M28 22v4a2 2 0 0 1-2 2h-4M10 28H6a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="8.2" stroke="#FFB224" strokeWidth="2" />
    <circle cx="16" cy="16" r="3.6" stroke="#35D3BE" strokeWidth="1.6" opacity="0.8" />
    <path d="M16 16l5.4-5.4" stroke="#FFB224" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="1.4" fill="#FFB224" />
    <circle cx="19.6" cy="18.6" r="1.1" fill="#35D3BE" />
  </svg>
);

/* ================= primitives ================= */

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "subtle" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Btn({ variant = "primary", size = "md", loading, className = "", children, disabled, ...rest }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] transition-all duration-200 select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none";
  const sizes = { sm: "text-[12.5px] px-3 py-1.5", md: "text-[13.5px] px-4 py-2.5", lg: "text-[15px] px-6 py-3" };
  const variants = {
    primary: "bg-amber-500 text-ink-950 hover:bg-amber-400 shadow-[0_8px_24px_-10px_rgba(255,178,36,0.55)]",
    ghost: "text-fog-200 hover:text-fog-50 hover:bg-ink-700/60 border border-transparent",
    outline: "text-fog-100 border border-ink-600 hover:border-amber-500/60 hover:text-amber-300 bg-ink-900/40",
    subtle: "bg-ink-700/70 text-fog-100 hover:bg-ink-600/70 border border-ink-600/50",
    danger: "bg-err-500/15 text-err-400 border border-err-500/35 hover:bg-err-500/25",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`anim-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[11.5px] font-semibold uppercase tracking-[0.14em] text-fog-500">
        {label}
        {hint && <span className="normal-case tracking-normal font-normal text-fog-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ""}`} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...rest} className={`field appearance-none pr-9 ${className ?? ""}`}>
        {children}
      </select>
      <IconChevronD size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fog-500" />
    </div>
  );
}

export function Check({ checked, onChange, label, dotColor }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; dotColor?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`group flex w-full items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-left transition-all duration-200 ${
        checked ? "border-amber-500/55 bg-amber-500/[0.07]" : "border-ink-600/60 bg-ink-900/50 hover:border-ink-500"
      }`}
      role="checkbox"
      aria-checked={checked}
    >
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-all ${
          checked ? "border-amber-500 bg-amber-500 text-ink-950" : "border-ink-500 bg-ink-800 text-transparent group-hover:border-fog-500"
        }`}
      >
        <IconCheck size={12} strokeWidth={2.6} />
      </span>
      {dotColor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor, boxShadow: checked ? `0 0 8px ${dotColor}` : "none" }} />}
      <span className={`text-[13.5px] font-medium ${checked ? "text-fog-50" : "text-fog-300"}`}>{label}</span>
    </button>
  );
}

export function Bar({ value, color, active }: { value: number; color: string; active?: boolean }) {
  return (
    <div className="h-[7px] w-full overflow-hidden rounded-full bg-ink-700/80">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${active ? "bar-stripes" : ""}`}
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, background: color, boxShadow: `0 0 10px ${color}66` }}
      />
    </div>
  );
}

export function MTag({ id, size = "md" }: { id: MarketplaceId; size?: "sm" | "md" }) {
  const m = MARKETPLACES[id];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]"}`}
      style={{ color: m.color, borderColor: `${m.color}44`, background: `${m.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.short}
    </span>
  );
}

export function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${pulse ? "dot-live" : ""}`} style={{ background: color, boxShadow: `0 0 8px ${color}88` }} />;
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[22px] font-semibold leading-tight tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fog-500">{label}</div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="anim-fade flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-600/70 bg-ink-900/40 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-600/60 bg-ink-800/80 text-fog-400">{icon}</div>
      <h3 className="font-display text-lg font-bold text-fog-100">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-fog-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SmartImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-ink-700 via-ink-800 to-ink-900 text-fog-600 ${className ?? ""}`}>
        <IconImage size={26} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("in");
            io.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ================= toasts ================= */

export type ToastKind = "ok" | "err" | "info" | "warn";
interface Toast {
  id: number;
  kind: ToastKind;
  msg: string;
}

const ToastContext = createContext<{ push: (kind: ToastKind, msg: string) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside provider");
  return ctx;
}

const TOAST_STYLE: Record<ToastKind, { border: string; icon: ReactNode }> = {
  ok: { border: "border-ok-500/45", icon: <IconCheck size={15} className="text-ok-400" /> },
  err: { border: "border-err-500/45", icon: <IconAlert size={15} className="text-err-400" /> },
  warn: { border: "border-warn-400/45", icon: <IconAlert size={15} className="text-warn-400" /> },
  info: { border: "border-ink-500", icon: <IconInfo size={15} className="text-kj-400" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const push = useCallback((kind: ToastKind, msg: string) => {
    const id = idRef.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`anim-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border ${TOAST_STYLE[t.kind].border} bg-ink-850/95 px-3.5 py-3 shadow-lift backdrop-blur`}>
            <span className="mt-0.5 shrink-0">{TOAST_STYLE[t.kind].icon}</span>
            <p className="text-[13px] font-medium leading-snug text-fog-100">{t.msg}</p>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="ml-auto shrink-0 text-fog-500 transition-colors hover:text-fog-200" aria-label="Dismiss">
              <IconX size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
