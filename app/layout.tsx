import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SBC Abuja",
  description: "Silent Book Club Abuja: who came, what they brought, what the club reads.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f1e7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="mx-auto min-h-dvh max-w-md px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
