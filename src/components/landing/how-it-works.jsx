"use client";

import { motion } from "framer-motion";
import { FileText, UserCircle, Wand2, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: FileText,
    title: "Write Your Script",
    description: "Paste your ad script or use AI-powered hooks. Viral templates included for skincare, ecom, fitness & more.",
  },
  {
    number: "02",
    icon: UserCircle,
    title: "Choose Avatar & Voice",
    description: "Pick from 20+ Indian faces and 10 natural Indian-English accent voices. Or upload your own avatar.",
  },
  {
    number: "03",
    icon: Wand2,
    title: "Generate & Download",
    description: "Hit generate. Your 9:16 video is ready in under 2 minutes with lip-sync, music overlay & product hooks.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative gradient-bg-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Three Steps to Your{" "}
            <span className="gradient-text">First Reel</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No video editing skills required. No studio. No hiring. 
            Just your script and 60 seconds.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector Line (desktop) */}
          <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="relative text-center"
            >
              {/* Step Number Circle */}
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center shadow-xl glow-purple">
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center shadow">
                  {step.number}
                </span>
              </div>

              <h3 className="text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>

              {/* Arrow (between steps on mobile) */}
              {index < steps.length - 1 && (
                <div className="md:hidden flex justify-center my-6">
                  <ArrowRight className="w-6 h-6 text-primary/40 rotate-90" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
