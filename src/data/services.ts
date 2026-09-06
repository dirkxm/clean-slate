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

import furnitureRemovalImage from "../assets/images/furniture-haul-away.webp";
import junkRemovalImage from "../assets/images/clean-slate-haul-away.webp";
import householdCleanoutsImage from "../assets/images/household-cleanout.webp";
import garageCleanoutImage from "../assets/images/garage-cleanout.webp";
import estateCleanoutImage from "../assets/images/estate-cleanout.webp";
import propertyCleanoutImage from "../assets/images/property-cleanout.webp";
import constructionCleanupImage from "../assets/images/construction-cleanup-pile.webp";
import smallDemolitionImage from "../assets/images/small-demolition.webp";
import portableStorageImage from "../assets/images/temporary-storage.webp";

/**
 * Clean Slate's finalized service architecture:
 *
 *   Cleanouts         → Household Cleanouts, Garage Cleanouts, Estate Cleanouts, Property Cleanouts
 *   Construction      → Construction Cleanup, Small Demolition
 *   Junk Removal      → Furniture & Appliance Removal, General Junk Removal
 *   Portable Storage  → Portable Storage Rental
 *
 * `category` groups a service under one of the four umbrellas above and
 * drives ordering/grouping in navigation, the services grid, and online
 * ordering. Cleanouts and Construction come before Junk Removal in every
 * ordered list. Services without a dedicated marketing page yet (General
 * Junk Removal as a *distinct* page) are intentionally not listed here —
 * see online-ordering.astro, which is where a customer can still select
 * them even without a page to link to.
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
    title: "Household Cleanouts",
    slug: "household-cleanouts",
    category: "Cleanouts",
    hook: "Clear a home quickly and efficiently.",
    short:
      "Full-service house and household cleanouts — furniture, belongings, boxes, and more.",
    image: householdCleanoutsImage,
    icon: Home,
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
    title: "Furniture & Appliance Removal",
    slug: "furniture-removal",
    category: "Junk Removal",
    hook: "Get the old furniture and appliances out.",
    short:
      "Couches, mattresses, dressers, refrigerators, washers, and other bulky items hauled away.",
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
