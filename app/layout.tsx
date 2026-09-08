import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReviewWhisper AI",
  description:
    "AI assistant that answers shopper questions from verified product reviews.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
