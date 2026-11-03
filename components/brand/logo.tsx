import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Marchelo Logistics logo, vectorised from public/LOGO.png (colour-separated
 * trace: the logo's own black #010101 and blue #0796da). "reversed" swaps the
 * black for white so the logo stays legible on dark backgrounds. Served as static
 * SVG files (no optimisation needed) and cached by the browser across pages.
 */
export function Logo({ variant = "color", className, priority }: { variant?: "color" | "reversed"; className?: string; priority?: boolean }) {
  return (
    <Image
      src={variant === "reversed" ? "/brand/marchelo-logo-reversed.svg" : "/brand/marchelo-logo.svg"}
      alt="Marchelo Logistics"
      width={2528}
      height={1360}
      unoptimized
      priority={priority}
      className={cn("h-12 w-auto", className)}
    />
  );
}
