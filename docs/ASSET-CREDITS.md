# Visual assets: sources, licences and use

Every image on the public site is listed here. Do not add an image to the site without adding a row, and do not use an image whose commercial-use rights have not been checked.

## Photography (`public/images/photography/`)

All five photos are under the [Unsplash License](https://unsplash.com/license): free for commercial use, modification allowed, **attribution not required**; the only restrictions are selling unmodified copies and building a competing image service. We credit the photographer anyway, in the caption under every captioned photo (“Photo: … on Unsplash”). Each was checked to be a free Unsplash photo, not an *Unsplash+* one, which has a different, paid licence: free photos are served from `images.unsplash.com/photo-…`, Unsplash+ photos from `plus.unsplash.com/premium_photo-…`.

Downloaded 2026-11-04, converted to WebP (quality 78) with `sharp`; Next.js serves resized AVIF/WebP from these masters.

| File | Source | Photographer | Licence | Attribution | Changes | Used on |
|---|---|---|---|---|---|---|
| `container-ship-aerial.webp` | [unsplash.com/photos/1cqIcrWFQBI](https://unsplash.com/photos/aerial-view-of-boat-on-water-1cqIcrWFQBI) (San Pedro, Los Angeles) | Venti Views ([@ventiviews](https://unsplash.com/@ventiviews)) | Unsplash License | Not required (hero has no caption) | Resized to 2400 px wide | Home hero |
| `port-unloading-aerial.webp` | [unsplash.com/photos/4ZornyPnGlA](https://unsplash.com/photos/cargo-ship-loaded-with-colorful-containers-at-a-busy-port-4ZornyPnGlA) (Port of Vancouver) | Daniel Miksha ([@danielmiksha](https://unsplash.com/@danielmiksha)) | Unsplash License | Not required; credited in caption | Resized to 2000 px | Services |
| `air-freighter-apron.webp` | [unsplash.com/photos/PEf3deR3l_U](https://unsplash.com/photos/a-large-white-cargo-airplane-with-stairs-attached-PEf3deR3l_U) (Sydney Airport) | Peaky_82 ([@peaky_82](https://unsplash.com/@peaky_82)) | Unsplash License | Not required; credited in caption | Resized to 2000 px | Services |
| `warehouse-aisle-team.webp` | [unsplash.com/photos/c_4eaGRDSVU](https://unsplash.com/photos/workers-walking-through-warehouse-aisle-c_4eaGRDSVU) (Bucharest) | Adrian Sulyok ([@sulyok_imaging](https://unsplash.com/@sulyok_imaging)) | Unsplash License | Not required, but **the photographer asks for a credit link to https://www.sulyokimaging.ro**: the caption credit links there | Resized to 2000 px | Services |
| `port-sea-panorama.webp` | [unsplash.com/photos/Zuxxq0iHkN4](https://unsplash.com/photos/aerial-view-photo-of-freight-containers-Zuxxq0iHkN4) (Port of Barcelona) | Olga Subach ([@create4eyes](https://unsplash.com/@create4eyes)) | Unsplash License | Not required; credited in caption | Cropped to the sea and cranes (removes small container-line and gas-terminal lettering) | About |

### Selection rules applied

- No prominent third-party logo (carriers, airlines, couriers). Logos that are only legible when zoomed far in were removed by cropping where possible.
- Photos show the industry, never people, vehicles or premises presented as Marchelo’s own. Captions describe the scene generically (“A cargo aircraft on the apron”), not as our operation.
- No service is implied as confirmed: the service cards keep “Availability to be confirmed” (S-01).

### Rejected candidates

| Candidate | Reason |
|---|---|
| Owner photo `yard-loading-container.jpeg` (previous hero) | Large Hapag-Lloyd logo on the container; crops without it lost the scene. Kept in `assets/photos`, not shown (A-02). |
| Owner photo `side-loader-container.jpeg` | 300×300 pixels; lifting-equipment branding. |
| Container ship loading at golden hour (Haris Illahi, `9VmKFc_c748`) | “MSC” across the hull and a terminal name on the crane. |
| Cranes loading ships (`WdQevQ2nlh4`, `yfTSNbggFyE`) | ONE / China Shipping containers in the foreground. |
| Orange container stack (`sNY6B9NsPP8`), container yard (`q6j5mSRpi50`), ship at sunset (`AMXFr97d00c`) | “Lloyd”, OOCL/COSCO, ANL lettering. |
| Blue-hulled container ships (`jOqJbvo1P9g`, `oL3wEM0JEwQ`) | Distinctive carrier livery. |
| Aircraft loading in Frankfurt (`miHHRMLDDH8`), Mumbai apron (`cs4VC3XAPVo`), aircraft with trailers (`MCQIYzTqx8M`) | Airline liveries (Qatar Airways, Air India, Finnair and others). |
| Courier unloading a van (`YjjAU8eQjDc`) | Courier company logo on the van. |
| Team loading boxes into a truck (`slXXhWv_ZBk`) | Low resolution, many product brands on the boxes. |
| Pile of boxes with blue tape (`qO2ztAz5g7A`), boxes in a warehouse (`RVP3wAw9gJY`) | Look computer-generated. |
| Dublin Port view (`iCEpp61EFoI`) | Haulier names legible on trailers. |
| Dark HDR port photos (Timelab, `sWOvgOOFk1g`, `yx20mpDyr2I`) | Over-processed, artificial look. |
| Packing and parcel photos found in searches | Unsplash+ (paid licence). |
| Pexels | Not usable from this environment (automated access blocked), so nothing was taken from it. |

## Illustrations (`public/images/illustrations/`)

**Original artwork created for this site** (2026-11-04). No third-party illustration library, traced artwork or other company’s characters were used. They are generated by `scripts/illustrations/build.mjs` (`npm run illustrations:build`) from shared primitives (palette, figures, parcels, vehicles, organic backgrounds), so the family stays consistent. Owned by the project; no attribution required.

| File | Shows | Used on |
|---|---|---|
| `request-quote.svg` | Customer filling in a quote form on a laptop | Home (How it works 1), How it works (step 1) |
| `team-review.svg` | Team member with headset reviewing a request | Home (How it works 2), How it works (step 2) |
| `quote-received.svg` | Customer receiving a quote on a phone | Home (How it works 3), How it works (step 3) |
| `handover.svg` | Customer handing a parcel to a team member at a container | How it works (step 4) |
| `tracking.svg` | Customer following a route and milestones on a phone | Home (How it works 4), How it works (step 5), Track (empty state) |
| `receive-parcel.svg` | Person receiving a parcel at their door | How it works (step 6) |
| `container-loading.svg` | Worker wheeling a barrel and box into a container | Services (guide band) |
| `pack-parcel.svg` | Person packing clothes into a box | Home (packing band) |
| `support-chat.svg` | Customer talking with a team member | Home (final call to action, md and up), Contact |
| `route-map.svg` | Ireland ⇄ Cameroon by air and sea, with both flags | Home (monthly departures) |
| `connections.svg` | Sender and recipient linked by a travelling parcel | About |
| `service-parcels.svg`, `service-barrels.svg`, `service-air.svg`, `service-sea.svg`, `service-vehicle.svg`, `service-commercial.svg` | One spot per service category | Service grid (Home, Services) |
| `guide-packing.svg`, `guide-labelling.svg`, `guide-list.svg` | Packing, labelling, contents list | Shipping guide |

Palette: the site tokens (ink `#172030`, logo blue `#1495dc`, deeper blue `#1d5fa8`, sky and pale blues), warm cardboard neutrals, a sparing amber accent (high-visibility vests) and a muted green for plants. The only other colours are the Irish and Cameroonian flags on `route-map.svg`.

## Logo

`public/brand/*`: the business’s own logo (A-01).
