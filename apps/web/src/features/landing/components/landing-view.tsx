"use client";

import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingChores } from "./landing-chores";
import { LandingShowcase } from "./landing-showcase";
import { LandingSegments } from "./landing-segments";
import { LandingFeatures } from "./landing-features";
import { LandingSignupSection } from "./landing-signup-section";
import { LandingFaq } from "./landing-faq";
import { LandingFooter } from "./landing-footer";

export function LandingView({ signedInName }: { signedInName?: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <LandingHeader signedIn={Boolean(signedInName)} />
      <main className="flex-1">
        <LandingHero />
        <LandingChores />
        <LandingShowcase />
        <LandingSegments />
        <LandingFeatures />
        <LandingFaq />
        <LandingSignupSection signedInName={signedInName} />
      </main>
      <LandingFooter />
    </div>
  );
}
