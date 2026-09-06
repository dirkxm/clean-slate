export const site = {
  // =====================================================
  // Business
  // =====================================================

  name: "Clean Slate",

  legalName: "Clean Slate Services, LLC",

  tagline: "Construction Cleanup & Haul Away • Commercial & Residential",

  description:
    "Professional construction cleanup, junk removal, and portable storage throughout the Des Moines metro and Central Iowa.",

  url: "https://clean-slate-dsm.com",

  logo: "/logo.svg",

  ogImage: "/open-graph-image.jpg",

  // =====================================================
  // Contact
  // =====================================================

  phone: "(515) 519-9878",

  phoneRaw: "5155199878",

  email: "info@clean-slate-dsm.com",

  // =====================================================
  // Address
  // =====================================================

  address: {
    city: "Norwalk",
    state: "IA",
    zip: "",
    country: "US",
  },

  // =====================================================
  // Service Area
  // =====================================================
  //
  // The list of served cities lives in src/data/locations.ts (one entry
  // per city that has a dedicated /locations/<slug> page). Import
  // `locationNames` from there rather than duplicating a list here.

  // =====================================================
  // Navigation
  // =====================================================

  navigation: [
    {
      label: "Services",
      href: "/services",
    },
    {
      label: "Construction Cleanup",
      href: "/construction-cleanup",
    },
    {
      label: "Pricing",
      href: "/pricing",
    },
    {
      label: "About",
      href: "/about",
    },
    {
      label: "Contact",
      href: "/contact",
    },
  ],

  // =====================================================
  // Social
  // =====================================================

  social: {
    facebook: "",
    instagram: "",
    google: "",
  },

  // =====================================================
  // SEO
  // =====================================================

  keywords: [
    "Construction Cleanup",
    "Junk Removal",
    "Property Cleanup",
    "Garage Cleanout",
    "Estate Cleanout",
    "Portable Storage",
    "Construction Cleanup Des Moines",
    "Junk Removal Des Moines",
  ],

  // =====================================================
  // Draft pages
  // =====================================================
  //
  // Pages whose content is not yet signed off for public search.
  // Each listed path is marked <meta robots="noindex,nofollow"> by the
  // page itself and is excluded from the sitemap (see astro.config.mjs).
  // Remove a path here to take that page live. Use the trailing-slash
  // form, e.g. "/pricing/".
  draftPages: [] as string[],
};

export type Site = typeof site;