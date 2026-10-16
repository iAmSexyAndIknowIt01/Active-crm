import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Footer from "@/src/components/landingPage/Footer";
import { ThemeProvider } from "@/src/components/ThemeProvider";
import ValidationMessages from "@/src/components/ValidationMessages";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Active CRM",
  description: "Үйлчлүүлэгчийн бүртгэлийн систем",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning нь server болон client дээр theme зөрүүтэй байхаас үүсэх алдаанаас сэргийлнэ
    <html
      lang="mn"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col justify-between bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* Формын шалгалтын мессежийг браузерын хэлээс үл хамааран монголоор харуулна */}
          <ValidationMessages />
          {/* Үндсэн контент */}
          <div className="flex-1 flex flex-col">
            {children}
          </div>

          {/* Бүх хуудсанд харагдах Footer */}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}