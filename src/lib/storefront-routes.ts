/** Version 0.1: public Day 1 destinations; reserved backend routes live in the contract doc. */
export const storefrontRoutes = {
  home: "/#home",
  collection: "/#templates",
  howItWorks: "/#how-it-works",
  contact: "/#contact",
} as const;

export const storefrontNavigation = [
  { label: "Home", href: storefrontRoutes.home },
  { label: "Templates", href: storefrontRoutes.collection },
  { label: "How It Works", href: storefrontRoutes.howItWorks },
  { label: "Contact", href: storefrontRoutes.contact },
] as const;
