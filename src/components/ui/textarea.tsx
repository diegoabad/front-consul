import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[10px] border-[1.5px] border-[#D1D5DB] bg-white px-4 py-3.5 text-base font-normal text-[#374151] ring-offset-background placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:border-[#2563eb] focus-visible:ring-[0_0_0_3px_rgba(124,58,237,0.1)] transition-all duration-200 disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:opacity-60 resize-y",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
