"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ContactFormState } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContactField, ContactFormValues } from "@/lib/contact-input";

type ContactFormProps = {
  action: (
    previous: ContactFormState,
    formData: FormData,
  ) => Promise<ContactFormState>;
  initialValues: ContactFormValues;
  submitLabel: string;
  cancelHref: string;
};

export function ContactForm({
  action,
  initialValues,
  submitLabel,
  cancelHref,
}: ContactFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  // After a failed submit React resets the form, so inputs fall back to these values.
  const values = state.values ?? initialValues;
  const errors = state.errors ?? {};

  const field = (name: ContactField) => ({
    id: name,
    name,
    defaultValue: values[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form action={formAction} className="grid gap-5">
      <FormField label="Имя" htmlFor="name" error={errors.name}>
        <Input
          {...field("name")}
          required
          autoFocus
          autoComplete="off"
          placeholder="Например: Анна Смирнова"
        />
      </FormField>

      <FormField label="Кто это" htmlFor="about" error={errors.about}>
        <Textarea
          {...field("about")}
          rows={2}
          placeholder="Например: дизайнер, сосед, двоюродный брат"
        />
      </FormField>

      <FormField label="Откуда знакомы" htmlFor="howWeMet" error={errors.howWeMet}>
        <Textarea
          {...field("howWeMet")}
          rows={2}
          placeholder="Например: учились вместе в университете"
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Телефон" htmlFor="phone" error={errors.phone}>
          <Input
            {...field("phone")}
            type="tel"
            autoComplete="off"
            placeholder="+7 900 000-00-00"
          />
        </FormField>

        <FormField label="Почта" htmlFor="email" error={errors.email}>
          <Input
            {...field("email")}
            type="email"
            autoComplete="off"
            placeholder="name@example.com"
          />
        </FormField>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Сохраняю…" : submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}

function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: ContactField;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
