"use client";

import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingProblems } from "./landing-problems";
import { LandingSegments } from "./landing-segments";
import { LandingFeatures } from "./landing-features";
import { LandingFaq } from "./landing-faq";
import { LandingFooter } from "./landing-footer";

export function LandingView() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingProblems />
        <LandingSegments />
        <LandingFeatures />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
