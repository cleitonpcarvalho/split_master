import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footerText: string;
  footerLinkLabel: string;
  footerLinkHref: string;
}

export function AuthShell({
  title,
  description,
  children,
  footerText,
  footerLinkLabel,
  footerLinkHref,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F7FAFC] px-5 py-12">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(0,196,140,0.14),transparent_28%),radial-gradient(circle_at_85%_80%,rgba(15,31,61,0.09),transparent_32%)]"
      />

      <section className="relative w-full max-w-md rounded-[2rem] border border-navy/10 bg-white p-6 shadow-soft sm:p-9">
        <Link
          href="/"
          aria-label="Voltar para a página inicial"
          className="mx-auto block w-fit"
        >
          <Image
            src="/split-master-logo.png"
            alt="Split Master"
            width={601}
            height={328}
            priority
            className="h-auto w-44"
          />
        </Link>

        <div className="mt-7 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-navy">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-navy/60">{description}</p>
        </div>

        <div className="mt-8">{children}</div>

        <p className="mt-7 text-center text-sm text-navy/60">
          {footerText}{" "}
          <Link
            href={footerLinkHref}
            className="font-bold text-[#008A64] transition hover:text-green"
          >
            {footerLinkLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}
