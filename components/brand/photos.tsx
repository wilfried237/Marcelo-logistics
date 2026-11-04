import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import containerShip from "@/public/images/photography/container-ship-aerial.webp";
import portUnloading from "@/public/images/photography/port-unloading-aerial.webp";
import airFreighter from "@/public/images/photography/air-freighter-apron.webp";
import warehouse from "@/public/images/photography/warehouse-aisle-team.webp";
import portPanorama from "@/public/images/photography/port-sea-panorama.webp";

/**
 * Licensed photography (Unsplash License, commercial use allowed, attribution not
 * required but given). Sources, licences and where each photo is used are listed
 * in docs/ASSET-CREDITS.md. Photos show the industry, never Marchelo's own staff,
 * vehicles or premises; none shows a prominent third-party logo.
 * Static imports give width/height, a blur placeholder and AVIF/WebP output.
 */
export type PhotoCredit = { name: string; href: string };

export const PHOTOS = {
  containerShip: { src: containerShip, altKey: "containerShipAlt", credit: { name: "Venti Views", href: "https://unsplash.com/photos/aerial-view-of-boat-on-water-1cqIcrWFQBI" } },
  portUnloading: {
    src: portUnloading,
    altKey: "portUnloadingAlt",
    captionKey: "portUnloadingCaption",
    credit: { name: "Daniel Miksha", href: "https://unsplash.com/photos/cargo-ship-loaded-with-colorful-containers-at-a-busy-port-4ZornyPnGlA" },
  },
  airFreighter: {
    src: airFreighter,
    altKey: "airFreighterAlt",
    captionKey: "airFreighterCaption",
    credit: { name: "Peaky_82", href: "https://unsplash.com/photos/a-large-white-cargo-airplane-with-stairs-attached-PEf3deR3l_U" },
  },
  // The photographer asks for a link to their studio site with the credit.
  warehouse: { src: warehouse, altKey: "warehouseAlt", captionKey: "warehouseCaption", credit: { name: "Adrian Sulyok", href: "https://www.sulyokimaging.ro" } },
  portPanorama: {
    src: portPanorama,
    altKey: "portPanoramaAlt",
    captionKey: "portPanoramaCaption",
    credit: { name: "Olga Subach", href: "https://unsplash.com/photos/aerial-view-photo-of-freight-containers-Zuxxq0iHkN4" },
  },
} as const satisfies Record<string, { src: StaticImageData; altKey: string; captionKey?: string; credit: PhotoCredit }>;

type PhotoEntry = { src: StaticImageData; altKey: string; captionKey?: string; credit: PhotoCredit };

/** Translated props for <Photo>, from the "media" namespace translator. */
export function photoProps(media: (key: string, values?: Record<string, string>) => string, photo: PhotoEntry, { caption = true } = {}) {
  return {
    src: photo.src,
    alt: media(photo.altKey),
    caption: caption && photo.captionKey ? media(photo.captionKey) : undefined,
    credit: { label: media("credit", { name: photo.credit.name }), href: photo.credit.href },
  };
}

export function Photo({
  src,
  alt,
  caption,
  credit,
  sizes,
  priority,
  className,
  imageClassName,
}: {
  src: StaticImageData;
  alt: string;
  caption?: string;
  /** Already-translated credit line and the link it points to. */
  credit?: { label: string; href: string };
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-2xl bg-muted", className)}>
      <Image src={src} alt={alt} sizes={sizes} priority={priority} placeholder="blur" className={cn("w-full object-cover", imageClassName)} />
      {(caption || credit) && (
        <figcaption className="px-4 py-3 text-sm text-muted-foreground">
          {caption}
          {credit && (
            <a href={credit.href} target="_blank" rel="noopener noreferrer" className={cn("block text-xs underline-offset-2 hover:text-foreground hover:underline", caption && "mt-1")}>
              {credit.label}
            </a>
          )}
        </figcaption>
      )}
    </figure>
  );
}
