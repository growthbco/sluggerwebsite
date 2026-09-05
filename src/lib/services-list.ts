// The "Core 30" services list. This mirrors the services on our Google
// Business Profile word-for-word so GBP and the site send one consistent
// signal. If a service or description changes on GBP, change it here too.

export type Service = {
  name: string;
  // Display price string ("$25", "From $25", "Free") or null when quoted.
  price: string | null;
  description: string;
  // The most relevant existing page for this service.
  href: string;
};

export type ServiceGroup = {
  title: string;
  services: Service[];
};

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    title: "Embroidery",
    services: [
      {
        name: "Custom Embroidered Hats",
        price: "From $30",
        description:
          "Fitted, snapback, and trucker hats embroidered with your logo - 6-hat minimum per design. Free mockup; a one-time digitizing fee applies if we create the embroidery file, or bring your own stitch file and skip it. Embroidered in-house in our Ocala shop - in-stock styles are usually ready in a couple of days, about a week if we order your blanks in.",
        href: "/custom-hats",
      },
      {
        name: "Custom Fitted Hats (Flexfit)",
        price: "$30",
        description:
          "Cap America and Pacific Headwear performance caps with Flexfit stretch in sizes XS-XXL, embroidered with your team or business logo. Add an embroidered back number for $5.",
        href: "/custom-hats",
      },
      {
        name: "Custom Snapback Hats",
        price: "$30",
        description:
          "Premium trucker-style snapbacks with a structured front panel and breathable mesh back, one size fits most. Embroidered with your logo - flat or 3D puff stitching.",
        href: "/custom-hats",
      },
      {
        name: "Custom Trucker Hats",
        price: "$30",
        description:
          "Classic mesh-back trucker caps embroidered with your design. Great for leagues, tournaments, businesses, and giveaways - 6-hat minimum per design.",
        href: "/custom-hats",
      },
      {
        name: "Embroidered Player Numbers",
        price: "$5",
        description:
          "Add an embroidered player number to the back of any hat for $5. Team orders collect each player's number automatically so every cap matches your roster.",
        href: "/custom-hats",
      },
      {
        name: "3D Puff Embroidery",
        price: null,
        description:
          "Bold raised stitching that pops off the cap - the pro ball cap look. Best for big letters, numbers, and simple logos that need to read from a distance.",
        href: "/custom-hats",
      },
      {
        name: "Flat Logo Embroidery",
        price: null,
        description:
          "Crisp, detailed flat stitching for full-color logos, mascots, and fine text. Durable and washable - ideal for business logos and detailed team crests.",
        href: "/embroidery",
      },
      {
        name: "Logo Digitizing",
        price: "One-time fee",
        description:
          "We convert your logo into a stitch-ready embroidery file in-house for a one-time digitizing fee - or bring your own DST/EMB file and skip it. Send a PNG, JPG, PDF, or even a photo; you approve a proof before we stitch anything.",
        href: "/embroidery",
      },
      {
        name: "Embroidered Polos & Coaches Gear",
        price: null,
        description:
          "Sideline-ready polos, quarter-zips, and jackets embroidered with your team logo, names, and titles. Perfect for coaches, staff, and team parents.",
        href: "/embroidery",
      },
      {
        name: "Embroidered Bags & Beanies",
        price: null,
        description:
          "Duffle bags, backpacks, and beanies embroidered with your logo to round out the team look.",
        href: "/embroidery",
      },
      {
        name: "Business & Spirit Wear Embroidery",
        price: null,
        description:
          "Uniform shirts, spirit wear, and booster club gear embroidered with your logo - for local businesses, schools, and organizations across Central Florida.",
        href: "/embroidery",
      },
    ],
  },
  {
    title: "Custom Uniforms & Apparel",
    services: [
      {
        name: "Custom Team Uniforms",
        price: null,
        description:
          "Full uniform programs for baseball, softball, and every sport - jerseys, pants, and more with free in-house design. One roster link, one order, one look.",
        href: "/team-uniforms",
      },
      {
        name: "Round-Neck Jerseys (Any Sport)",
        price: "$28",
        description:
          "Fully sublimated round-neck jerseys in any color or design - baseball, softball, soccer, pickleball, and more. Dry-fit material and free custom design included.",
        href: "/pricing",
      },
      {
        name: "V-Neck Jerseys",
        price: "$30",
        description:
          "Fully sublimated V-neck jerseys with custom design, names, and numbers included.",
        href: "/pricing",
      },
      {
        name: "Two-Button Jerseys",
        price: "$32",
        description:
          "Classic two-button baseball and softball jerseys, fully sublimated with your design, names, and numbers. Free design and proof included.",
        href: "/pricing",
      },
      {
        name: "Full-Button Jerseys",
        price: "$35",
        description:
          "Pro-style full-button jerseys, fully sublimated in your team's colors with names and numbers. Free design and proof included.",
        href: "/pricing",
      },
      {
        name: "Long-Sleeve Shirts",
        price: "$32",
        description:
          "Custom sublimated long-sleeve shirts for cold-weather games, warmups, and practice.",
        href: "/pricing",
      },
      {
        name: "Reversible Basketball Uniforms",
        price: "$85",
        description:
          "Two looks in one - reversible home and away basketball uniforms, custom designed for your team.",
        href: "/pricing",
      },
      {
        name: "Baseball & Softball Pants",
        price: "$40",
        description:
          "Custom baseball and softball pants in team colors, youth through adult sizes.",
        href: "/pricing",
      },
      {
        name: "Knickers",
        price: "$40",
        description:
          "Custom knicker-style baseball and softball pants in your team colors.",
        href: "/pricing",
      },
      {
        name: "Custom Shorts",
        price: "$25",
        description:
          "Custom sublimated shorts in team colors - great for practice, workouts, and summer ball.",
        href: "/pricing",
      },
      {
        name: "Team Hoodies",
        price: "$40",
        description:
          "Custom team hoodies for the dugout and off the field, designed to match your uniforms.",
        href: "/pricing",
      },
      {
        name: "Custom Socks",
        price: "$15",
        description:
          "Custom team socks in your colors to complete the uniform.",
        href: "/pricing",
      },
      {
        name: "3D Hype Chains",
        price: "From $40",
        description:
          "Custom 3D hype chains for dugout celebrations - built to match your team's logo and colors. Free mockup; one-time $50 3D design file fee, then each chain starts at $40 depending on detail and colors.",
        href: "/hype-chains",
      },
    ],
  },
  {
    title: "How We Work",
    services: [
      {
        name: "Free Custom Design & Proofs",
        price: "Free",
        description:
          "Our in-house designers create your custom look for free. You see a proof, request changes, and approve before anything is produced - what you approve is what we make.",
        href: "/design",
      },
      {
        name: "Team Order Management",
        price: "Free",
        description:
          "Share one roster link and every player enters their own name, number, and size. No spreadsheets, no group texts - the order builds itself.",
        href: "/team-order",
      },
      {
        name: "Roster Import (Photo or Spreadsheet)",
        price: "Free",
        description:
          "Snap a photo of your roster or upload a spreadsheet and our AI reads it in - you just confirm names, numbers, and sizes.",
        href: "/team-order",
      },
      {
        name: "Team Stores for Fundraising",
        price: "Free",
        description:
          "A private online shop built from your approved design so players, parents, and fans can buy gear anytime. Great for fundraisers.",
        href: "/team-stores",
      },
      {
        name: "Rush Production (2 Weeks)",
        price: "$100 / $150 at 50+ pieces",
        description:
          "A confirmed Rush targets two weeks of production for an order-level fee: $100 for 1–49 pieces or $150 for 50+ pieces. Shipping time is additional. Deadlines inside two weeks require a separately priced Priority review.",
        href: "/faq",
      },
      {
        name: "Free Local Pickup (Ocala)",
        price: "Free",
        description:
          "Skip shipping - pick up your order free at our Ocala shop.",
        href: "/contact",
      },
    ],
  },
];
