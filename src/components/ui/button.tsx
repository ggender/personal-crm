import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-12 border border-transparent font-medium whitespace-nowrap transition-[background-color,color,opacity] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink font-semibold text-bg hover:opacity-88",
        outline: "border-line-strong bg-surface text-ink hover:bg-strip/60",
        secondary: "bg-strip text-ink hover:bg-line",
        ghost: "text-ink hover:bg-strip",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:outline-destructive",
        link: "text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-15",
        xs: "h-7 gap-1 rounded-10 px-2.5 text-13 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-10 px-3 text-14",
        lg: "h-12 rounded-14 px-5 text-16",
        /** The landing's call to action: text plus an accent square on the right (see CtaLink). */
        cta: "h-12 gap-3 rounded-14 pr-1.5 pl-5 text-16",
        icon: "size-10",
        "icon-xs": "size-7 rounded-10 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-10",
        "icon-lg": "size-12 rounded-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
