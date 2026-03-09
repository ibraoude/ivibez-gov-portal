
// app/providers.tsx
"use client";

import type { ReactNode } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { MotionConfig, AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";

/**
 * Global client providers:
 *  - next-themes (dark / light / system)
 *  - framer-motion (honor "reduced motion")
 *  - AnimatePresence for route transitions
 *  - Floating dark-mode toggle
 *
 * Important: All hooks are called once at the top level (no conditionals),
 * so the hook order is identical across renders.
 */
export default function Providers({ children }: { children: ReactNode }) {
  // ✅ Called unconditionally at top-level
  const pathname = usePathname();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {/* Honor user's reduced-motion preference */}
      <MotionConfig reducedMotion="user">
        {/* Route transition wrapper (keep unconditional) */}
        <AnimatePresence mode="wait" initial={false}>
         <motion.main
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {/* Floating dark-mode toggle */}
            <div className="fixed right-5 top-5 z-50">
              <ThemeToggle />
            </div>

            {children}
          </motion.main>
        </AnimatePresence>
      </MotionConfig>
    </ThemeProvider>
  );
}

/** Small floating button to toggle themes globally */
function ThemeToggle() {
  const { theme, setTheme } = useTheme(); // ✅ Hook inside provider tree
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur hover:bg-white dark:hover:bg-white/10 text-gray-800 dark:text-gray-100 shadow-sm transition"
      aria-label="Toggle dark mode"
      title="Toggle theme"
      type="button"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
