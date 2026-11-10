import type { Metadata } from "next";
import { Onest } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const onest = Onest({ subsets: ["cyrillic", "latin"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: { default: "IBR Invest — кабинет инвестора", template: "%s · IBR Invest" },
  description: "Закрытый кабинет инвесторов IBR Group",
  robots: { index: false, follow: false },
  icons: { icon: "/logo.webp" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={onest.variable}>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
