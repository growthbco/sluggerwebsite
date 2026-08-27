// Hand-picked jersey mockups pinned to the top of the "Recent Designs" home
// showcase. These are the clean, front+back garment renders staff have chosen
// to feature (they take priority over the auto-pulled approved designs, and an
// auto design with the same team name is de-duped out so nothing shows twice).
// To add one: upload the image to Vercel Blob and paste its URL here.
export type FeaturedDesign = { teamName: string; image: string };

export const FEATURED_DESIGNS: FeaturedDesign[] = [
  {
    teamName: "Legacy",
    image:
      "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/featured/legacy-velez-HLEbRwu6p5IL2fhNy4HPmxvCdFwkZU.png",
  },
  {
    teamName: "Misfits in Action",
    image:
      "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/featured/misfits-in-action-javi-QZn0giDfgp6wW4wG9Cv3FyHhomzjsG.png",
  },
  {
    teamName: "Aces of Bases",
    image:
      "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/featured/aces-of-bases-glynn-TgOvTRCP7wfLq89YlZ0BHUfQg6GahQ.png",
  },
  {
    teamName: "Hammer Time",
    image:
      "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/featured/hammer-time-mexico-XDFzzXNVmNElQzM6ie7sL7SeH4g9Nl.png",
  },
  {
    teamName: "Calesa Legends",
    image:
      "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/featured/calesa-legends-F6xE8XYA8nwDnd8nLEvqINsBAcwk2B.png",
  },
];
