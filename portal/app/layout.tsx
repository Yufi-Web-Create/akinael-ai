import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "アキナエルAI｜お客様ポータル",
  description: "相談、案件、制作進捗を確認するアキナエルAIのお客様専用ポータルです。",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: "https://akinael-ai.com/portal/" },
  openGraph: {
    title: "アキナエルAI｜お客様ポータル",
    description: "相談、案件、制作進捗を確認するお客様専用ポータルです。",
    url: "https://akinael-ai.com/portal/",
    type: "website",
  },
  twitter: { card: "summary", title: "アキナエルAI｜お客様ポータル", description: "相談、案件、制作進捗を確認するお客様専用ポータルです。" },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
