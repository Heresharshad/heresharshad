import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { PageReveal } from "@/components/layout/page-reveal";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SmoothScroll />
      <div className="blueprint-grid" aria-hidden="true" />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <SiteHeader />
        <PageReveal className="flex-1 px-(--pad-x) pt-16">{children}</PageReveal>
        <SiteFooter />
      </div>
    </>
  );
}
