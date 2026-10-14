"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth, LOGIN_ERROR } from "@/lib/auth";
import { LOGIN_EMAIL_ERROR, loginEmailSchema } from "@/lib/validation";

export type LoginFormState = {
  /** What was typed, so a form that answered keeps it in the field. */
  email?: string;
  /** Set once the email has gone out: the address it was sent to. */
  sentTo?: string;
  /** Under the field: the address is wrong. */
  fieldError?: string;
  /** Under the button: anything else that went wrong. */
  error?: string;
};

const TOO_OFTEN = "Слишком часто, попробуйте через несколько минут";
const SEND_FAILED = "Не удалось отправить письмо. Попробуйте ещё раз.";

export async function requestLoginLinkAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const typed = String(formData.get("email") ?? "");
  const email = loginEmailSchema.safeParse(typed);
  if (!email.success) return { email: typed, fieldError: LOGIN_EMAIL_ERROR };

  try {
    await getAuth().api.signInMagicLink({
      body: {
        email: email.data,
        callbackURL: "/",
        newUserCallbackURL: "/",
        errorCallbackURL: "/login/expired",
      },
      headers: await headers(),
    });
  } catch (error) {
    const code =
      error instanceof APIError ? (error.body as { code?: string } | undefined)?.code : undefined;
    if (code === LOGIN_ERROR.invalidEmail) return { email: typed, fieldError: LOGIN_EMAIL_ERROR };
    if (code === LOGIN_ERROR.tooOften) return { email: email.data, error: TOO_OFTEN };
    console.error("Failed to send a login email", error);
    return { email: email.data, error: SEND_FAILED };
  }

  return { email: email.data, sentTo: email.data };
}

/** "Выйти": ends the login on this device only, then opens the login page. */
export async function signOutAction() {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch (error) {
    // The cookie is cleared anyway on the next visit; the person still lands on the login page.
    console.error("Failed to end the login", error);
  }
  redirect("/login");
}
