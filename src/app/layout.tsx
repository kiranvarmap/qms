import type { Metadata } from "next";
import { Figtree, Poppins } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Vibe design system fonts: Figtree for body/UI, Poppins for titles/headings.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QMS - Quality Management System",
  description: "Internal quality management and product management tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${figtree.variable} ${poppins.variable} light-app-theme antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
