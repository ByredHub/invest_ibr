"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field, FormError, Spinner } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { postJson } from "@/components/ui/client";

export function LoginForm({ next }: { next?: string }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await postJson<{ redirect: string }>("/api/auth/login", { phone, password });
      window.location.href = next ?? res.redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <Field label="Телефон">
        <PhoneInput value={phone} onChange={setPhone} autoComplete="username" required />
      </Field>
      <Field label="Пароль">
        <div className="relative">
          <input
            className="input pr-11"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Скрыть пароль" : "Показать пароль"}
            className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:text-ink"
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </Field>
      <FormError message={error} />
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy && <Spinner />}
        Войти
      </button>
    </form>
  );
}
