import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth, ADMIN_LOGIN } from "../lib/auth";
import { Btn, Field, IconAlert, IconBolt, IconShield, IconTerminal, IconUser, LogoMark, Spinner, TextInput, useToast } from "../components/ui";

export default function Auth() {
  const { user, login, signup } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
        push("ok", "Welcome back — session started.");
      } else {
        await signup(email, password, name);
        push("ok", "Account created. Welcome aboard!");
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const fillAdmin = () => {
    setMode("login");
    setEmail(ADMIN_LOGIN.alias);
    setPassword(ADMIN_LOGIN.password);
    setError(null);
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-140px)] max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_440px] lg:items-center lg:py-16">
      {/* left pitch */}
      <div className="anim-rise hidden lg:block">
        <LogoMark size={44} className="text-fog-200" />
        <h1 className="mt-6 font-display text-[clamp(2.2rem,4vw,3.4rem)] font-extrabold leading-[1.04] tracking-tight text-fog-50">
          Your capture console
          <br />
          for <span className="text-kj-400">Kijiji</span>, <span className="text-olx-400">OLX</span> &amp; <span className="text-ric-400">Ricardo</span>.
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fog-300">
          One workspace for searches, scraped listings, German translations and exports. Everything you capture is private to your account.
        </p>
        <ul className="mt-8 space-y-4">
          {[
            { icon: <IconTerminal size={16} />, text: "Live run monitor with per-source progress & logs" },
            { icon: <IconBolt size={16} />, text: "Parallel scraping jobs with rate limiting & retries" },
            { icon: <IconShield size={16} />, text: "Row-level security — nobody else sees your data" },
          ].map((b) => (
            <li key={b.text} className="flex items-center gap-3 text-[13.5px] text-fog-300">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-600/60 bg-ink-850 text-amber-400">{b.icon}</span>
              {b.text}
            </li>
          ))}
        </ul>

        {/* admin credentials card */}
        <div className="mt-9 max-w-md rounded-2xl border border-amber-500/35 bg-amber-500/[0.07] p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <IconUser size={15} />
            </span>
            <div>
              <div className="text-[13.5px] font-bold text-amber-300">Admin login</div>
              <div className="font-mono text-[11px] text-fog-400">built-in account · ready to use</div>
            </div>
          </div>
          <dl className="mt-3.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12.5px]">
            <dt className="text-fog-500">username</dt>
            <dd className="text-fog-100">admin</dd>
            <dt className="text-fog-500">password</dt>
            <dd className="text-fog-100">admin123</dd>
          </dl>
          <Btn variant="outline" size="sm" className="mt-4" onClick={fillAdmin}>
            Fill in admin credentials
          </Btn>
        </div>
      </div>

      {/* form */}
      <div className="anim-rise" style={{ animationDelay: "100ms" }}>
        <div className="panel rounded-2xl p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-ink-600/60 bg-ink-900/70 p-1 text-center text-[13px] font-semibold">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className={`rounded-lg py-2 transition-all duration-200 ${mode === m ? "bg-amber-500 text-ink-950 shadow" : "text-fog-400 hover:text-fog-100"}`}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <Field label="Display name">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
              </Field>
            )}
            <Field label="E-mail / username">
              <TextInput type="text" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com or admin" autoComplete="username" autoFocus />
            </Field>
            <Field label="Password" hint={mode === "signup" ? "min. 6 characters" : undefined}>
              <TextInput type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </Field>

            {error && (
              <div className="anim-fade flex items-start gap-2.5 rounded-lg border border-err-500/40 bg-err-500/10 px-3.5 py-2.5 text-[13px] text-err-400">
                <IconAlert size={15} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <Btn size="lg" className="w-full" loading={busy}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Btn>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-fog-600">
            <span className="h-px flex-1 bg-ink-600/70" /> admin <span className="h-px flex-1 bg-ink-600/70" />
          </div>

          <button
            onClick={fillAdmin}
            className="group flex w-full items-center justify-between rounded-xl border border-amber-500/35 bg-amber-500/[0.06] px-4 py-3 text-left transition-all duration-200 hover:border-amber-500/70 hover:bg-amber-500/[0.12]"
          >
            <span>
              <span className="block text-[13px] font-bold text-amber-300">Sign in as admin</span>
              <span className="block font-mono text-[11px] text-fog-400">admin · admin123</span>
            </span>
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-widest text-amber-400 transition-transform duration-200 group-hover:translate-x-1">fill →</span>
          </button>

          <p className="mt-3 text-center text-[12px] leading-relaxed text-fog-500">
            The built-in admin account starts with a clean workspace — run your own captures right away.
          </p>
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-center font-mono text-[11px] text-fog-600">
          {busy ? <Spinner size={12} /> : <IconShield size={12} />} credentials hashed client-side · sessions token-based
        </p>
      </div>
    </div>
  );
}
