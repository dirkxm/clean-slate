export const site = {
  // =====================================================
  // Business
  // =====================================================

  name: "Clean Slate",

  legalName: "Clean Slate Services",

  tagline: "Construction Cleanup & Haul Away • Commercial & Residential",

  description:
    "Professional construction cleanup, junk removal, and portable storage throughout the Des Moines metro and Central Iowa.",

  url: "https://cleanslate.services",

  logo: "/logo.svg",

  ogImage: "/images/og-image.jpg",

  // =====================================================
  // Contact
  // =====================================================

  phone: "(515) 555-1234",

  phoneRaw: "5155551234",

  email: "hello@cleanslate.services",

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

  serviceArea: [
    "Des Moines",
    "West Des Moines",
    "Waukee",
    "Ankeny",
    "Johnston",
    "Urbandale",
    "Norwalk",
    "Clive",
    "Grimes",
    "Altoona",
    "Indianola",
    "Pleasant Hill",
  ],

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
};

export type Site = typeof site;