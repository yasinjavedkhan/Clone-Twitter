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
                    "inline-flex items-center justify-center rounded-full font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    {
                        "bg-blue-500 text-white hover:bg-blue-600": variant === "primary",
                        "bg-white text-black hover:bg-gray-200": variant === "secondary",
                        "bg-transparent border border-gray-600 text-white hover:bg-gray-900": variant === "outline",
                        "bg-transparent text-white hover:bg-gray-900": variant === "ghost",
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
