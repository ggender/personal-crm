"use client";

import { useActionState } from "react";

import { type LoginFormState, requestLoginLinkAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The email field and "Получить ссылку". After an answer the form keeps the address. */
export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginFormState, FormData>(
    requestLoginLinkAction,
    {},
  );

  return (
    // noValidate: only the server judges the address, so the screen shows exactly its message.
    <form action={formAction} noValidate className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="login-email">Почта</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          // The form is reset after every answer: the typed address must come back into the field.
          defaultValue={state.email ?? ""}
          aria-invalid={state.fieldError ? true : undefined}
          aria-describedby={state.fieldError ? "login-email-error" : undefined}
        />
        {state.fieldError && (
          <p id="login-email-error" role="alert" className="text-14 text-destructive">
            {state.fieldError}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Отправляю…" : "Получить ссылку"}
      </Button>

      {state.error && (
        <p role="alert" className="text-14 text-destructive">
          {state.error}
        </p>
      )}
      {state.sentTo && (
        <p role="status" className="text-15 text-note-text">
          Ссылка для входа отправлена на {state.sentTo}
        </p>
      )}
    </form>
  );
}
