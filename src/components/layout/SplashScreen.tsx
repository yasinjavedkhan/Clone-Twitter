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
              <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z" />
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
