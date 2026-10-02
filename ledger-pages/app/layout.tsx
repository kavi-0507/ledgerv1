import type { Metadata } from "next";
import "./globals.css";
import "./readability.css";

export const metadata: Metadata = {
  title: "Ledger — Your money, made simple",
  description:
    "Less money admin. More student life. Your spending, budget, rent and bills in one calm place.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg`,
    shortcut: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
