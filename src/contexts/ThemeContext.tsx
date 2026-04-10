"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "dim";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>("dark");

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme") as Theme;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.classList.remove("light", "dim");
            if (savedTheme !== "dark") {
                document.documentElement.classList.add(savedTheme);
            }
        }
    }, []);

    const toggleTheme = () => {
        setTheme((prev) => {
            let newTheme: Theme;
            if (prev === "dark") newTheme = "light";
            else if (prev === "light") newTheme = "dim";
            else newTheme = "dark";

            localStorage.setItem("theme", newTheme);
            document.documentElement.classList.remove("light", "dim");
            if (newTheme !== "dark") {
                document.documentElement.classList.add(newTheme);
            }
            return newTheme;
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
