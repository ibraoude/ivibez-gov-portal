
"use client";

import { PropsWithChildren } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { MotionConfig, AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";

/**
 * Wraps the app with:
 *  - next-themes (dark mode)
 *  - framer-motion (global motion settings)
 *  - AnimatePresence route transitions
 *  - A floating Dark Mode toggle
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {/* Respect user 'reduce motion' preference */}
      <MotionConfig reducedMotion="user">
        {/* Route-level transitions */}
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {/* Global dark-mode toggle */}
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
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/15 bg-white/80 dark:bg-white/5 backdrop-blur hover:bg-white dark:hover:bg-white/10 text-gray-800 dark:text-gray-100 shadow-sm transition"
      aria-label="Toggle dark mode"
      title="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
