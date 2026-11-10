import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import { FormFeedback } from "@/components/controls/form-feedback";

export const metadata: Metadata = {
  title: "SplitFlow",
  description: "Shared expenses, clear shares and confirmed repayments",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        <FormFeedback />
      </body>
    </html>
  );
}
