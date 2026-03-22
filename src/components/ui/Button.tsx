import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost";
    size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-full font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95",
                    {
                        "background-gradient text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:brightness-110": variant === "primary",
                        "bg-white text-black hover:bg-gray-200": variant === "secondary",
                        "bg-transparent border border-white/10 text-white hover:bg-white/5 backdrop-blur-sm": variant === "outline",
                        "bg-transparent text-white hover:bg-white/5": variant === "ghost",
                        "px-4 py-1.5 text-sm": size === "sm",
                        "px-6 py-2 text-md": size === "md",
                        "px-8 py-3 text-lg": size === "lg",
                    },
                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = "Button";

export { Button };
