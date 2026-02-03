import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#7C3AED] text-white hover:bg-[#6D28D9] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(124,58,237,0.3)] active:scale-[0.98] shadow-[0_2px_8px_rgba(124,58,237,0.2)] min-h-[44px] px-7 py-3.5 text-base font-medium",
        destructive: "bg-[#EF4444] text-white hover:bg-[#DC2626] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] active:scale-[0.98] shadow-[0_2px_8px_rgba(239,68,68,0.2)] min-h-[44px] px-7 py-3.5 text-base font-medium",
        outline: "border-2 border-[#7C3AED] bg-transparent text-[#7C3AED] hover:bg-[#EDE9FE] hover:border-[#6D28D9] min-h-[44px] px-6 py-3 text-base font-medium",
        secondary: "bg-[#EDE9FE] text-[#7C3AED] hover:bg-[#DDD6FE] min-h-[44px] px-7 py-3.5 text-base font-medium",
        ghost: "bg-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] px-4 py-2 text-base font-medium",
        link: "text-[#7C3AED] underline-offset-4 hover:underline p-0 text-base font-medium",
      },
      size: {
        default: "h-[44px] px-7 py-3.5 text-base",
        sm: "h-9 rounded-lg px-3 text-sm",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10 rounded-lg p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
