export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: "Openmesh Genesis",
  description: "Become a part of the Openmesh future.",
  mainNav: [
    {
      title: "Home",
      href: "/",
    },
    {
      title: "Mint",
      href: "/mint",
    },
  ],
  links: {
    openmesh: "https://openmesh.network/",
  },
} as const
