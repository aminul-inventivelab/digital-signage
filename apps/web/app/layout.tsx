import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/google-sans/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signage Console",
  description: "Digital signage dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
