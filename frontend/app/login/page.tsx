"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";

import { AuthShell } from "@/components/AuthShell";
import { FormField } from "@/components/FormField";
import { login } from "@/lib/api";
import { getStoredToken, storeToken } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (getStoredToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await login({ email, password });
      storeToken(session.token);
      router.replace("/dashboard");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      description="Entre para acompanhar seus quizzes, leads e conversões."
      footerText="Ainda não tem uma conta?"
      footerLinkLabel="Criar conta"
      footerLinkHref="/register"
    >
      {searchParams.get("registered") === "true" && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-green/25 bg-green/10 px-4 py-3 text-sm font-semibold text-[#087A5B]"
        >
          Conta criada com sucesso. Agora faça seu login.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField
          id="email"
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <FormField
          id="password"
          label="Senha"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-green px-6 font-bold text-navy shadow-lg shadow-green/20 transition hover:bg-[#08D29A] focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </AuthShell>
  );
}

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy/10 border-t-green" />
    </main>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível entrar. Tente novamente.";
}
