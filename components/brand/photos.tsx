import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import yardLoading from "@/assets/photos/yard-loading-container.jpeg";
import sideLoader from "@/assets/photos/side-loader-container.jpeg";

/**
 * Photos from the business's own operations (supplied with the project; see
 * docs/DECISIONS-REQUIRED.md A-02). No stock photography is used.
 * Static imports give width/height, a blur placeholder and AVIF/WebP output.
 */
export const PHOTOS = {
  yardLoading: { src: yardLoading, altKey: "yardLoadingAlt", captionKey: "yardLoadingCaption" },
  sideLoader: { src: sideLoader, altKey: "sideLoaderAlt", captionKey: "sideLoaderCaption" },
} as const satisfies Record<string, { src: StaticImageData; altKey: string; captionKey: string }>;

export function Photo({
  src,
  alt,
  caption,
  sizes,
  priority,
  className,
  imageClassName,
}: {
  src: StaticImageData;
  alt: string;
  caption?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-2xl bg-muted", className)}>
      <Image src={src} alt={alt} sizes={sizes} priority={priority} placeholder="blur" className={cn("w-full object-cover", imageClassName)} />
      {caption && <figcaption className="px-4 py-3 text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
