import type { Metadata } from "next";
import { Literata, Onest } from "next/font/google";

import { Logo } from "@/components/logo";
import { SessionRefresh } from "@/components/session-refresh";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/login/actions";
import { getHeaderUser } from "@/lib/current-user";

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
  // A plain file from public/: as app/icon.svg Next.js served it with its own x-nextjs-cache header.
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" } },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getHeaderUser();

  return (
    <html lang="ru" className={`${onest.variable} ${literata.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="page-container flex h-14 items-center gap-4 pt-2">
          <div className="shrink-0">
            <Logo />
          </div>
          {user && (
            <div className="ml-auto flex min-w-0 items-center gap-1">
              <span className="truncate text-14 text-subtle" title={user.email}>
                {user.email}
              </span>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Выйти
                </Button>
              </form>
              <SessionRefresh />
            </div>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
