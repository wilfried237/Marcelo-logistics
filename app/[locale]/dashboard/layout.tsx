import type { Metadata } from "next";
import { PreviewGate } from "@/components/preview/preview-gate";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <PreviewGate>{children}</PreviewGate>;
}
