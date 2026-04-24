import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Sign Document",
};

export default function SignLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
