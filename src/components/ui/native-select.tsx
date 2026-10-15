import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * A plain <select> in the look of Input. On a phone the system picker opens, which is easier to use
 * than a drop-down menu; 16px text keeps iPhone from zooming the page in when the field is tapped.
 */
function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div
      className={cn(
        "group/native-select relative w-full min-w-0 has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className="h-11 w-full min-w-0 appearance-none rounded-12 border border-line-strong bg-surface py-1 pr-9 pl-3.5 text-16 text-ink transition-[border-color,box-shadow] outline-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/15 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15"
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle select-none" aria-hidden="true" data-slot="native-select-icon" />
    </div>
  )
}

function NativeSelectOption({
  ...props
}: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />
}

export { NativeSelect, NativeSelectOption }
