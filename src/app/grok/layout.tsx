import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Grok / Twitter",
  description: "Grok is an AI assistant built into the Twitter clone.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function GrokLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
