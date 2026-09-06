/**
 * Single source of truth for the cities Clean Slate has a dedicated
 * location page for. Every "areas served" list on the site derives from
 * this array: the /locations index, the service-area section on
 * /services, the mention on /services/household-cleanouts, and the
 * LocalBusiness JSON-LD schema.
 *
 * To add a city: first create src/pages/locations/<slug>.astro with
 * real, city-specific content, then add an entry here. Nothing else
 * needs to change. Do NOT add a city here without a matching page —
 * the "areas served" lists would then link to a 404 and the schema
 * would claim coverage we don't have a page for.
 */
export interface Location {
  /** City name, as displayed. */
  name: string;
  /** URL slug. The page lives at /locations/<slug>. */
  slug: string;
  /** One-line description shown on the /locations index cards. */
  description: string;
}

export const locations: Location[] = [
  {
    name: "Ankeny",
    slug: "ankeny",
    description:
      "Reliable junk removal and cleanout services without the truck or dump run.",
  },
  {
    name: "Clive",
    slug: "clive",
    description:
      "Professional removal services for homes, rentals, and renovation projects.",
  },
  {
    name: "Des Moines",
    slug: "des-moines",
    description:
      "Residential and property cleanout services throughout the Des Moines area.",
  },
  {
    name: "Indianola",
    slug: "indianola",
    description:
      "Furniture removal, cleanouts, remodeling debris, and general hauling.",
  },
  {
    name: "Norwalk",
    slug: "norwalk",
    description:
      "Junk removal, furniture removal, cleanouts, construction cleanup, and more.",
  },
  {
    name: "Urbandale",
    slug: "urbandale",
    description: "Clean Slate handles the lifting, loading, hauling, and removal.",
  },
  {
    name: "Waukee",
    slug: "waukee",
    description:
      "Furniture removal, property cleanouts, garage cleanouts, and more.",
  },
  {
    name: "West Des Moines",
    slug: "west-des-moines",
    description:
      "Professional hauling and cleanout services for homes, rentals, and renovation projects.",
  },
];

/** City names only — for "areas served" lists and schema areaServed. */
export const locationNames = locations.map((location) => location.name);

/** State shared by every served city (used for schema). */
export const locationState = "IA";
