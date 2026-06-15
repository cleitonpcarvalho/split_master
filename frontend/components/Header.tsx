import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-navy/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          aria-label="Ir para a página inicial do Split Master"
          className="shrink-0"
        >
          <Image
            src="/split-master-logo.png"
            alt="Split Master"
            width={601}
            height={328}
            priority
            className="h-auto w-36 sm:w-44"
          />
        </Link>

        <Link
          href="/login"
          className="rounded-full border border-navy/15 px-4 py-2 text-sm font-semibold text-navy transition hover:border-green hover:text-green focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2"
        >
          Entrar
        </Link>
      </div>
    </header>
  );
}
