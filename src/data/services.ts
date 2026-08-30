import {
  Building2,
  Hammer,
  HardHat,
  Home,
  HouseHeart,
  Package,
  Sofa,
  Truck,
  Warehouse,
} from "lucide-astro";
import type { ComponentProps } from "astro/types";
import type { ImageMetadata } from "astro";

import furnitureRemovalImage from "../assets/images/furniture-haul-away.jpg";
import junkRemovalImage from "../assets/images/clean-slate-haul-away.jpg";
import householdCleanoutsImage from "../assets/images/clean-slate-haul-away.jpg";
import garageCleanoutImage from "../assets/images/garage-cleanout.jpg";
import estateCleanoutImage from "../assets/images/estate-cleanout.jpg";
import propertyCleanoutImage from "../assets/images/property-cleanout.jpg";
import constructionCleanupImage from "../assets/images/construction-cleanup-pile.jpg";
import smallDemolitionImage from "../assets/images/small-demolition.jpg";
import portableStorageImage from "../assets/images/temporary-storage.jpg";

/**
 * Clean Slate's finalized service architecture:
 *
 *   Junk Removal      → Furniture Removal, Appliance Removal, General Junk Removal
 *   Cleanouts         → Household Cleanouts, Garage Cleanouts, Estate Cleanouts, Property Cleanouts
 *   Construction      → Construction Cleanup, Small Demolition
 *   Portable Storage  → Portable Storage Rental
 *
 * `category` groups a service under one of the four umbrellas above and
 * drives ordering/grouping in navigation, the services grid, and online
 * ordering. Services without a dedicated marketing page yet (Appliance
 * Removal, General Junk Removal as a *distinct* page) are intentionally
 * not listed here — see online-ordering.astro, which is where a customer
 * can still select them even without a page to link to.
 */
export type ServiceCategory =
  | "Junk Removal"
  | "Cleanouts"
  | "Construction"
  | "Portable Storage";

export interface Service {
  title: string;
  slug: string;
  category?: ServiceCategory;
  hook: string;
  short: string;
  image: ImageMetadata;
  icon: (props: ComponentProps<typeof Sofa>) => any;
  /** Overrides the default `/services/{slug}` link, for services whose page lives elsewhere. */
  href?: string;
}

export const services: Service[] = [
  {
    title: "Furniture Removal",
    slug: "furniture-removal",
    category: "Junk Removal",
    hook: "Get the old furniture out.",
    short:
      "Couches, mattresses, dressers, and other bulky furniture hauled away.",
    image: furnitureRemovalImage,
    icon: Sofa,
  },

  {
    title: "Junk Removal",
    slug: "junk-removal",
    category: "Junk Removal",
    hook: "Get rid of the stuff taking up space.",
    short:
      "Furniture, household junk, appliances, debris, and other unwanted items hauled away.",
    image: junkRemovalImage,
    icon: Truck,
  },

  {
    title: "Household Cleanouts",
    slug: "household-cleanouts",
    category: "Cleanouts",
    hook: "Clear a home quickly and efficiently.",
    short:
      "Full-service house and household cleanouts — furniture, belongings, boxes, and more.",
    image: householdCleanoutsImage,
    icon: Home,
    href: "/cleanouts",
  },

  {
    title: "Garage Cleanouts",
    slug: "garage-cleanouts",
    category: "Cleanouts",
    hook: "Take your garage back.",
    short:
      "We'll remove unwanted furniture, boxes, tools, debris, and years of accumulated stuff.",
    image: garageCleanoutImage,
    icon: Warehouse,
  },

  {
    title: "Estate Cleanouts",
    slug: "estate-cleanouts",
    category: "Cleanouts",
    hook: "Clear the property with less stress.",
    short:
      "Complete cleanout services for estates, transitions, moves, and property sales.",
    image: estateCleanoutImage,
    icon: HouseHeart,
  },

  {
    title: "Property Cleanouts & Vacant Property Maintenance",
    slug: "property-cleanouts",
    category: "Cleanouts",
    hook: "Clear the whole property.",
    short:
      "Cleanouts, lawn care, overgrowth removal, volunteer trees, brush, and basic property maintenance for vacant and bank-owned properties.",
    image: propertyCleanoutImage,
    icon: Building2,
  },

  {
    title: "Construction Cleanup",
    slug: "construction-cleanup",
    category: "Construction",
    hook: "Leave the job site ready for what's next.",
    short:
      "Post-construction and renovation cleanup for contractors, builders, remodelers, and homeowners.",
    image: constructionCleanupImage,
    icon: HardHat,
  },

  {
    title: "Small Demolition",
    slug: "small-demolition",
    category: "Construction",
    hook: "Tear-outs without the heavy equipment.",
    short:
      "Small demolition and tear-out projects, plus the cleanup and hauling that follows.",
    image: smallDemolitionImage,
    icon: Hammer,
  },

  {
    title: "Portable Storage",
    slug: "portable-storage",
    category: "Portable Storage",
    hook: "Extra space delivered to your driveway.",
    short:
      "Secure portable storage for renovations, moves, remodeling projects, and temporary storage needs.",
    image: portableStorageImage,
    icon: Package,
  },
];
