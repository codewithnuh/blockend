import { HeroSection } from "@/components/sections/HeroSection";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { InitCLISimulator } from "@/components/sections/InitCLISimulator";
import { RoadmapSection } from "@/components/sections/RoadmapSection";
import { PhilosophySection } from "@/components/sections/PhilosophySection";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { Footer } from "@/components/globals/Footer";
import { RevealProvider } from "@/components/sections/RevealProvider";

export default function HomePage() {
  return (
    <RevealProvider>
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <InitCLISimulator />
        <RoadmapSection />
        <PhilosophySection />
        <FinalCTASection />
      </main>
      <Footer />
    </RevealProvider>
  );
}
