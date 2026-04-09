"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black overflow-hidden">
      {/* Main Content */}
      <div className="relative flex flex-col items-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          <div className="relative bg-black p-6 rounded-full border border-white/10 shadow-2xl">
            <svg viewBox="0 0 24 24" className="w-16 h-16 text-white fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <h1 className="text-xl sm:text-2xl font-bold tracking-[0.2em] uppercase text-white bg-clip-text text-center px-4">
            WELCOME TO Twitter Clone
          </h1>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
            className="h-[1px] bg-gradient-to-r from-transparent via-twitter-blue to-transparent w-full"
          />
          <p className="text-gray-500 font-medium tracking-widest text-[10px] uppercase mt-1">
            Loading your experience
          </p>
        </motion.div>
      </div>

      {/* Modern bottom loader bar */}
      <div className="absolute bottom-12 w-48 h-[2px] bg-white/5 rounded-full overflow-hidden">
        <motion.div
          animate={{ 
            x: ["-100%", "100%"] 
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="w-1/2 h-full bg-twitter-blue"
        />
      </div>
    </div>
  );
}
