import Link from "next/link";

import { Header } from "@/components/Header";

const benefits = [
  "Capture leads qualificados",
  "Personalize cada página final",
  "Envie para o checkout preenchido",
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <Header />

      <section className="relative isolate">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(circle_at_80%_15%,rgba(0,196,140,0.14),transparent_30%),radial-gradient(circle_at_15%_80%,rgba(15,31,61,0.07),transparent_28%)]"
        />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-32">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-green/10 px-4 py-2 text-sm font-bold text-[#008A64]">
              Quiz, leads e checkout em um único fluxo
            </span>

            <h1 className="mt-7 text-balance text-4xl font-extrabold tracking-[-0.04em] text-navy sm:text-5xl lg:text-6xl">
              Crie quizzes de vendas que{" "}
              <span className="text-green">convertem</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-navy/70 sm:text-xl">
              Conheça melhor cada lead, apresente a oferta certa e leve seu
              cliente a um checkout pré-preenchido, sem perder o ritmo da
              venda.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                id="comecar"
                href="/register"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-green px-7 py-3.5 text-base font-bold text-navy shadow-lg shadow-green/20 transition hover:-translate-y-0.5 hover:bg-[#08d29a] focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2"
              >
                Começar grátis
              </Link>
              <p className="text-sm font-medium text-navy/55">
                Configure seu primeiro quiz em minutos.
              </p>
            </div>

            <ul className="mt-10 grid gap-4 text-sm font-semibold text-navy/75 sm:grid-cols-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green text-xs text-navy"
                  >
                    ✓
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-green/20 to-navy/5 blur-2xl" />
            <div className="rounded-[2rem] border border-navy/10 bg-white p-5 shadow-soft sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-green">
                    Seu quiz
                  </p>
                  <p className="mt-1 font-bold text-navy">
                    Encontre a estratégia ideal
                  </p>
                </div>
                <span className="rounded-full bg-navy px-3 py-1.5 text-xs font-bold text-white">
                  2 de 5
                </span>
              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-navy/8">
                <div className="h-full w-2/5 rounded-full bg-green" />
              </div>

              <h2 className="mt-8 text-2xl font-extrabold tracking-tight text-navy">
                Qual é o principal objetivo do seu negócio agora?
              </h2>

              <div className="mt-6 space-y-3">
                {[
                  "Gerar mais leads",
                  "Aumentar as conversões",
                  "Conhecer melhor meu público",
                ].map((answer, index) => (
                  <div
                    key={answer}
                    className={`rounded-2xl border p-4 text-sm font-semibold ${
                      index === 1
                        ? "border-green bg-green/8 text-navy"
                        : "border-navy/10 text-navy/65"
                    }`}
                  >
                    {answer}
                  </div>
                ))}
              </div>

              <div className="mt-7 flex justify-end">
                <span className="rounded-full bg-navy px-6 py-3 text-sm font-bold text-white">
                  Continuar
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
