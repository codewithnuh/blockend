import { HeroSection } from "@/components/sections/HeroSection";
import { SocialProofSection } from "@/components/sections/SocialProofSection";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { GeneratedOutputSection } from "@/components/sections/GeneratedOutputSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { BlocksCatalogSection } from "@/components/sections/BlocksCatalogSection";
import { FrameworkSupportSection } from "@/components/sections/FrameworkSupportSection";
import { MCPSection } from "@/components/sections/MCPSection";
import { RoadmapSection } from "@/components/sections/RoadmapSection";
import { PhilosophySection } from "@/components/sections/PhilosophySection";
import { FAQSection } from "@/components/sections/FAQSection";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { Footer } from "@/components/globals/Footer";
import { RevealProvider } from "@/components/sections/RevealProvider";
import { SecuritySection } from "@/components/sections/Security";

export default function HomePage() {
  return (
    <RevealProvider>
      <main className="relative z-10 space-y-24 md:space-y-32 ">
        <HeroSection />
        <SocialProofSection />
        <ProblemSection />
        <HowItWorksSection />
        <GeneratedOutputSection />
        <FeaturesSection />
        <BlocksCatalogSection />
        <FrameworkSupportSection />
        <MCPSection />
        <RoadmapSection />
        <PhilosophySection />
        <SecuritySection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </RevealProvider>
  );
}
