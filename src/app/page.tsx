import { HomeExperience } from "@/components/home/home-experience";
import { HomeHeader } from "@/components/home/home-header";
import { AboutScene, ContactScene, ExperimentsScene, HeroScene, WorkScene } from "@/components/home/home-sections";
import { SmoothScroll } from "@/components/layout/smooth-scroll";

export default function HomePage() {
  return (
    <div className="home">
      <SmoothScroll />
      <HomeExperience />
      <HomeHeader />
      <main className="home-main">
        <HeroScene />
        <WorkScene />
        <ExperimentsScene />
        <AboutScene />
        <ContactScene />
      </main>
    </div>
  );
}
