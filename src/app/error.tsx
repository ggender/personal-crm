"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid justify-items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <p className="max-w-md text-muted-foreground">
        Не получилось загрузить или сохранить данные. Проверьте, что база данных
        запущена, и попробуйте ещё раз.
      </p>
      <Button onClick={() => retry()}>Попробовать ещё раз</Button>
    </div>
  );
}
