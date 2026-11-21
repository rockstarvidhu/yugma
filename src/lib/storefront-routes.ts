export const storefrontRoutes = {
  home: "/#home",
  collection: "/#templates",
  catalogue: "/templates",
  howItWorks: "/#how-it-works",
  contact: "/#contact",
  publicSupport: "https://github.com/rockstarvidhu/yugma/issues",
} as const;

export const storefrontNavigation = [
  { label: "Home", href: storefrontRoutes.home },
  { label: "Templates", href: storefrontRoutes.catalogue },
  { label: "How It Works", href: storefrontRoutes.howItWorks },
  { label: "Contact", href: storefrontRoutes.contact },
] as const;
