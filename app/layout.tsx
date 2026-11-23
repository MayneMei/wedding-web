import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maggie & Mayne · Wedding RSVP",
  description: "Explore the wedding map with Maggie and Mayne’s two cats, find the gift registry, and RSVP.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: { icon: "/black-cat.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
