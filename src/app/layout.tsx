import type { Metadata } from "next";
import { Literata, Onest } from "next/font/google";

import { Logo } from "@/components/logo";

import "./globals.css";

// next/font hosts the fonts itself; its CSS variables take over the font names from tokens.css.
const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const literata = Literata({
  variable: "--font-serif",
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
  // Optical sizes keep large headings as crisp as on the landing.
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: { default: "Контакты", template: "%s · Контакты" },
  description: "Личная CRM: люди, которых я знаю, и контекст общения с ними",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${onest.variable} ${literata.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="page-container flex h-14 items-center pt-2">
          <Logo />
        </header>
        {children}
      </body>
    </html>
  );
}
