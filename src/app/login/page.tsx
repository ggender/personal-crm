import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getHeaderUser } from "@/lib/current-user";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage() {
  // Someone who is already in goes to the contacts.
  if (await getHeaderUser()) redirect("/");

  return (
    <main className="page-container pt-10 pb-16">
      <div className="mx-auto max-w-sm">
        <h1 className="mb-6 font-serif text-26 font-medium sm:text-h2">Вход</h1>
        <LoginForm />
      </div>
    </main>
  );
}
