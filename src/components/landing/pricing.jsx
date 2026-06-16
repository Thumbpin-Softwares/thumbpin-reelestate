"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "Try it out – no credit card needed",
    credits: "2 video + 2 avatar generations",
    features: [
      "2 free video generations",
      "2 free avatar generations",
      "Access to all 20+ avatars",
      "All Indian-accent voices",
      "9:16 vertical format",
      "720p video quality",
      "Basic music overlays",
      "Download & share",
    ],
    cta: "Get Started Free",
    popular: false,
    href: "/auth/signup",
  },
  {
    name: "Pro",
    price: "₹9,440",
    period: "/month",
    description: "For serious creators & brands",
    credits: "500 credits/mo",
    features: [
      "500 video generations/month",
      "All avatars + upload custom",
      "All premium voices",
      "Priority queue (2x faster)",
      "1080p HD video quality",
      "Premium music library",
      "Custom watermark",
      "Analytics dashboard",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    popular: true,
    href: "/auth/signup",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 relative gradient-bg-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple,{" "}
            <span className="gradient-text">Transparent Pricing</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free. Scale when you&apos;re ready. No hidden fees, no lock-in.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
            >
              <Card className={`relative h-full ${plan.popular ? "border-primary shadow-xl glow-purple" : "border-border/50"} bg-card/80 backdrop-blur-sm`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gradient-bg text-white border-0 px-4 py-1 shadow-lg">
                      <Sparkles className="w-3 h-3 mr-1" /> Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2 pt-8">
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.period}</span>
                  </div>
                  <Badge variant="secondary" className="w-fit mt-2">
                    {plan.credits}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href}>
                    <Button
                      className={`w-full cursor-pointer ${plan.popular ? "gradient-bg text-white hover:opacity-90 shadow-lg" : ""}`}
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
