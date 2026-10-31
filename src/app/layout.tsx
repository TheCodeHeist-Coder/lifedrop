import type { Metadata, Viewport } from "next";
import { Hind } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const hind = Hind({
  variable: "--font-hind",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "devanagari"],
});

export const metadata: Metadata = {
  title: `${APP_NAME}: no one should search for blood alone`,
  description: "Tell us the blood group and location. We reach nearby donors who can give, on WhatsApp.",
};

export const viewport: Viewport = {
  themeColor: "#faf6f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hind.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
