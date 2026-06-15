import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Split Master | Quizzes de vendas que convertem",
  description:
    "Crie quizzes de vendas, capture leads qualificados e direcione cada pessoa para uma oferta personalizada.",
  icons: {
    icon: "/split-master-favicon.png",
    shortcut: "/split-master-favicon.png",
    apple: "/split-master-favicon.png",
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
