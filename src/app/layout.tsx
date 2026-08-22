import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AppProviders } from "@/components/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FixIt — Diagnose, troubleshoot, or find the right technician",
  description:
    "FixIt helps you understand what is wrong with your equipment, safely attempt troubleshooting, and escalate to the right professional when necessary.",
  keywords: [
    "FixIt",
    "appliance repair",
    "troubleshooting",
    "diagnostic",
    "technician",
    "Addis Ababa",
  ],
  authors: [{ name: "FixIt" }],
  icons: {
    icon: "/logo.svg",
  },
};

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AppProviders session={session}>{children}</AppProviders>
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
