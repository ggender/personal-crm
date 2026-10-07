"use client";

import { Check, CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { MarkContactedResult, SaveResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { UNDO_WINDOW_MS } from "@/lib/keep-in-touch";
import { cn } from "@/lib/utils";

type ContactedButtonProps = {
  /** card: on the contact page; row: in a row of the "Пора связаться" block. */
  mode: "card" | "row";
  markAction: () => Promise<MarkContactedResult>;
  undoAction: (previous: string | null, marked: string) => Promise<SaveResult>;
};

type State =
  | { kind: "idle" }
  // "Отменить" is offered with what undo needs.
  | { kind: "marked"; previous: string | null; marked: string }
  // Row only: the undo window is over and the row is about to leave the block.
  | { kind: "done" };

/**
 * "Пообщались" → "Отмечено · Отменить" for a few seconds → "Пообщались" again.
 * The actions do not revalidate, so this component refreshes the page itself: on the contact page
 * right away (the due date changes, the undo stays), in the block only once the undo window is
 * over, otherwise the row would leave before "Отменить" could be pressed.
 *
 * In a row, the component renders as a flex item of the row and marks it with data-marked, so the
 * row's own text can switch to "Отмечено" (see KeepInTouchSection).
 */
export function ContactedButton({ mode, markAction, undoAction }: ContactedButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const markRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  // Keyboard focus goes back to "Пообщались" when "Отменить" disappears under it.
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (state.kind !== "marked") return;
    undoRef.current?.focus();
    const timer = window.setTimeout(() => {
      if (mode === "row") {
        setState({ kind: "done" });
        router.refresh();
      } else {
        restoreFocus.current = document.activeElement === undoRef.current;
        setState({ kind: "idle" });
      }
    }, UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [state, mode, router]);

  useEffect(() => {
    // A disabled button cannot take focus, so wait until the action has finished.
    if (state.kind !== "idle" || pending || !restoreFocus.current) return;
    restoreFocus.current = false;
    markRef.current?.focus();
  }, [state, pending]);

  function mark() {
    setError(undefined);
    startTransition(async () => {
      const result = await markAction();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setState({ kind: "marked", previous: result.previous, marked: result.marked });
      if (mode === "card") router.refresh();
    });
  }

  function undo() {
    if (state.kind !== "marked") return;
    const { previous, marked } = state;
    setError(undefined);
    startTransition(async () => {
      const result = await undoAction(previous, marked);
      if (result.error) {
        setError(result.error);
        return;
      }
      restoreFocus.current = true;
      setState({ kind: "idle" });
      router.refresh();
    });
  }

  const isRow = mode === "row";
  const size = isRow
    ? "h-11 px-3 text-14 sm:h-10 sm:px-3.5"
    : "h-11 px-4 text-15 sm:h-10 sm:px-3.5 sm:text-14";

  return (
    <>
      {state.kind === "idle" && (
        <Button
          ref={markRef}
          variant="outline"
          disabled={pending}
          onClick={mark}
          className={cn("font-semibold", size)}
        >
          <Check className={cn("text-accent", isRow && "hidden sm:block")} strokeWidth={2.5} />
          Пообщались
        </Button>
      )}
      {state.kind === "marked" && (
        <div className="flex shrink-0 items-center gap-2">
          {!isRow && (
            <>
              <span className="inline-flex items-center gap-1.5 text-15 font-medium sm:text-14">
                <Check className="size-4 text-accent" strokeWidth={2.5} />
                Отмечено
              </span>
              <span aria-hidden className="text-muted">
                ·
              </span>
            </>
          )}
          <Button
            ref={undoRef}
            variant="ghost"
            onClick={undo}
            className={cn(
              "font-semibold text-accent-text underline underline-offset-4",
              size,
              !isRow && "px-2.5 sm:px-2.5",
            )}
          >
            Отменить
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className={cn(
            "flex basis-full items-start gap-1.5 text-14 font-medium text-destructive",
            isRow ? "pb-2 pl-15" : "w-full rounded-12 bg-note px-3 py-2.5 text-15",
          )}
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <span
        aria-live="polite"
        className="sr-only"
        data-marked={state.kind === "idle" ? undefined : ""}
      >
        {state.kind === "marked" ? "Отмечено" : ""}
      </span>
    </>
  );
}
