import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SmoothScroll } from "@/components/layout/smooth-scroll";

/**
 * Pages that are rooms of the 3D world: the shared canvas (root layout) draws
 * the room behind them, this shell carries the header, content and footer.
 * Each page wraps its content in <RoomPage id=...> to say which room it is.
 */
export default function RoomsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SmoothScroll />
      <div className="room-fallback" aria-hidden="true" />
      <div className="room-grain" aria-hidden="true" />
      <div className="room-vignette" aria-hidden="true" />
      <div className="room-shell flex min-h-dvh flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
      </div>
    </>
  );
}
