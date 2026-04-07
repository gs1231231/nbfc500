import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NBFC Sathi — Lending OS for Indian NBFCs",
  description:
    "NBFC Sathi is the all-in-one lending operating system built for Indian NBFCs. Loan origination, LMS, collections, co-lending, and more — RBI compliant, cloud-native.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-gray-50`}>{children}</body>
    </html>
  );
}
