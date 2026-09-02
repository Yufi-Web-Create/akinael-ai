"use client";
import dynamic from "next/dynamic";

const PortalClient = dynamic(() => import("./PortalClient"), { ssr: false });

export default function PortalPage() {
  return <PortalClient />;
}
