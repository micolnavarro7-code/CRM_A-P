"use client";

import { BedDouble, Eye, EyeOff, KeyRound, Palmtree, Tag } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button, Field, Input } from "../ui";
import { Logo } from "./Sidebar";

/** Traduce los errores de Supabase Auth que puede ver el usuario. */
function mensajeError(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Este email aún no está confirmado.";
  if (/fetch|network/i.test(msg)) return "No se pudo conectar con el servidor. Revisa la conexión a internet.";
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Espera un momento y vuelve a probar.";
  return msg;
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)] md:grid-cols-2">
        <div className="bg-brand hidden flex-col justify-between p-8 text-white md:flex">
          <div>
            <p className="text-sm font-semibold tracking-wide text-white/70 uppercase">A&amp;P Real Estate</p>
            <p className="mt-3 text-2xl leading-snug font-bold">Tus propiedades, reservas y contratos en un solo sitio.</p>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-white/90">
            <li className="flex items-center gap-3"><Palmtree size={18} className="shrink-0" /> Alquiler turístico: Booking, Airbnb y reservas propias</li>
            <li className="flex items-center gap-3"><BedDouble size={18} className="shrink-0" /> Habitaciones, inquilinos y vencimientos</li>
            <li className="flex items-center gap-3"><Tag size={18} className="shrink-0" /> Propiedades en venta</li>
          </ul>
        </div>

        <form
          className="p-6 sm:p-8"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
              if (error) setErr(mensajeError(error.message));
            } catch (x) {
              setErr(mensajeError((x as Error).message));
            }
            setBusy(false);
          }}
        >
          <Logo />
          <h1 className="mt-8 text-xl font-bold">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-ink-2">Entra con el usuario que te ha dado el administrador.</p>

          <div className="mt-6 flex flex-col gap-4">
            <Field label="Email">
              <Input type="email" required placeholder="nombre@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
            </Field>
            <Field label="Contraseña">
              <div className="relative">
                <Input
                  type={ver ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-ink"
                  aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {ver ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
            {err && <p className="rounded-xl bg-gasto/10 px-3 py-2 text-sm text-[#b54848]" role="alert">{err}</p>}
            <Button type="submit" disabled={busy} icon={<KeyRound size={16} />} className="mt-1 w-full">
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
