"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ContactFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContactField } from "@/lib/validation";

type FieldProps = {
  name: ContactField;
  label: string;
  hint?: string;
  state: ContactFormState;
  children: (props: {
    id: string;
    name: string;
    defaultValue?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
};

function Field({ name, label, hint, state, children }: FieldProps) {
  const id = `contact-${name}`;
  const error = state.errors?.[name];
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        name,
        defaultValue: state.values?.[name],
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={`${id}-error`} className="text-14 text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-14 text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type ContactFormProps = {
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  initialValues?: Partial<Record<ContactField, string>>;
  submitLabel: string;
  cancelHref: string;
  /** New contacts can start with a note; existing ones edit notes on their page. */
  withFirstNote?: boolean;
};

export function ContactForm({
  action,
  initialValues = {},
  submitLabel,
  cancelHref,
  withFirstNote = false,
}: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, { values: initialValues });

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <Field name="name" label="Имя *" state={state}>
        {(props) => (
          <Input
            {...props}
            required
            maxLength={200}
            autoFocus
            placeholder="Например, Анна Смирнова"
          />
        )}
      </Field>
      <Field name="about" label="Кто это" state={state}>
        {(props) => (
          <Input {...props} maxLength={500} placeholder="Например: бывший коллега, дизайнер" />
        )}
      </Field>
      <Field name="howWeMet" label="Откуда знакомы" state={state}>
        {(props) => (
          <Textarea
            {...props}
            maxLength={1000}
            rows={2}
            placeholder="Например: учились вместе в МГУ"
          />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="phone" label="Телефон" state={state}>
          {(props) => (
            <Input
              {...props}
              type="tel"
              maxLength={50}
              autoComplete="off"
              placeholder="+7 900 123-45-67"
            />
          )}
        </Field>
        <Field name="email" label="Почта" state={state}>
          {(props) => (
            <Input
              {...props}
              type="email"
              maxLength={200}
              autoComplete="off"
              placeholder="name@example.com"
            />
          )}
        </Field>
      </div>
      {withFirstNote && (
        <Field
          name="firstNote"
          label="О чём договорились"
          hint="Сохранится первой заметкой в карточке контакта"
          state={state}
        >
          {(props) => <Textarea {...props} maxLength={5000} rows={3} />}
        </Field>
      )}

      {state.message && (
        <p role="alert" className="text-14 text-destructive">
          {state.message}
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Сохраняю…" : submitLabel}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>Отмена</Link>
        </Button>
      </div>
    </form>
  );
}
