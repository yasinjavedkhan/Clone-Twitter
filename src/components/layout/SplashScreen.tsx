"use client";

import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black overflow-hidden">
      {/* Background Glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: [0.15, 0.3, 0.15],
          scale: [1, 1.2, 1],
        }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="absolute w-[500px] h-[500px] bg-twitter-blue/20 rounded-full blur-[120px]"
      />

      {/* Main Content */}
      <div className="relative flex flex-col items-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          {/* Radiant ring around icon */}
          <motion.div
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-twitter-blue/30 rounded-full blur-2xl"
          />
          
          <div className="relative bg-black p-6 rounded-full border border-white/10 shadow-2xl">
            <Globe className="w-16 h-16 text-white" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <h1 className="text-2xl font-bold tracking-[0.2em] uppercase text-white bg-clip-text">
            A New Beginning
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
