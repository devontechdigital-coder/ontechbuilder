import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[12.5px] font-medium transition-[background-color,box-shadow,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-sm shadow-slate-950/10 hover:bg-primary/88 active:bg-primary/80",
        secondary: "border border-border bg-surface text-foreground shadow-sm shadow-slate-950/5 hover:border-input hover:bg-surface-secondary",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        danger: "bg-destructive text-white shadow-sm shadow-destructive/20 hover:bg-destructive/90",
      },
      size: {
        sm: "h-7 px-2.5 text-[12px]",
        md: "h-8 px-3",
        icon: "size-8 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
}

interface ButtonLinkProps extends VariantProps<typeof buttonVariants> {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export function ButtonLink({ className, variant, size, href, children, ariaLabel }: ButtonLinkProps) {
  return (
    <Link aria-label={ariaLabel} className={cn(buttonVariants({ variant, size, className }))} href={href}>
      {children}
    </Link>
  );
}

export function IconButton({ label, children, className, variant = "secondary", ...props }: IconButtonProps) {
  return (
    <Button aria-label={label} className={className} size="icon" type="button" variant={variant} {...props}>
      {children}
    </Button>
  );
}

export { buttonVariants };
export { cn as cx };
