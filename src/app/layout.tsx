import type { Metadata } from "next";
import { Onest } from "next/font/google";

import "./globals.css";

const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: { default: "Контакты", template: "%s · Контакты" },
  description: "Личная CRM: люди, которых я знаю, и контекст общения с ними",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${onest.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
