import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { CrmShell } from "@/components/layout/CrmShell";
import "./globals.css";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "PSS SOLUTION — Lead CRM",
  description: "PSS SOLUTION Lead CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body className={font.className}>
        <CrmShell>{children}</CrmShell>
      </body>
    </html>
  );
}
