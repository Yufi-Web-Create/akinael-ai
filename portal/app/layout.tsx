import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "アキナエルAI｜お客様ポータル", description: "相談・案件・制作進捗を確認するお客様専用ページ" };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
