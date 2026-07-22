// Single source of truth for customer FAQs: rendered on /faq (with JSON-LD)
// and fed to the AI assistant on design-request message threads so both give
// the same answers.
import { DESIGN_FEE_WAIVED } from "@/lib/design-fee";

export type Faq = { q: string; a: string; link?: { href: string; label: string } };

export const FAQS: Faq[] = [
  { q: "How much does custom gear cost?", a: "Flat per-piece pricing with the custom design included: round-neck jerseys are $28 (any sport), two-button $35, full-button $38, pants and hoodies $40, shorts $25, embroidered hats $25-30, socks $15. No minimums - see the full list on our Pricing page. Prices are plus tax." },
  { q: "How do I place a team order?", a: "Head to Team Order, pick your jersey style, then either enter your roster yourself or share a link so each player adds their own name, number, and size. We email your total and a free design proof to approve before production." },
  { q: "Is there a minimum order?", a: "Team orders are built for groups, but reach out for small runs - we'll work with you. Individual buy-in drops have no minimum; you just buy your size." },
  { q: "How long does production take?", a: "Most orders ship in 2-3 weeks after you approve your design. Need it sooner? Rush gets you there in about a week. Specialty items like hoodies, pants, or long-sleeve jerseys may add a few days." },
  { q: "How does sizing work?", a: "Our signature jerseys have a relaxed fit and run slightly large. Every product page has a size guide, and on team orders each player picks their own size to cut down on returns." },
  { q: "Do you really design for free?", a: DESIGN_FEE_WAIVED
      ? "Yes - and right now there's no fee at all. We're waiving the usual $35 design fee for a limited time, so you can start a custom design completely free, see a proof, and approve it with no commitment."
      : "Yes - with one small step. We charge $35 upfront to start the design, then credit 100% of it back to your final team order, so the design is free with purchase. The $35 just keeps us from designing for people who shop our artwork elsewhere. Returning Slugger customers get it waived automatically." },
  { q: "Can I customize name and number?", a: "Absolutely. Jerseys and apparel let you add a player name and number right on the product page, and team orders capture them per player." },
  { q: "What's a Buy-In?", a: "A Buy-In is a limited, themed drop (like our horror or seasonal collections). You buy your size during the open window - once it closes, that drop is done." },
  { q: "Do you make custom embroidered hats?", a: "Yes - fitted Flexfit caps, snapbacks, and trucker hats embroidered with your logo. Snapbacks and truckers are $25, fitted hats are $30, and an embroidered number on the back adds $5. Logo digitizing and your proof are free. Hats are embroidered in-house, so smaller orders turn around in just days.", link: { href: "/custom-hats", label: "See custom embroidered hats" } },
  { q: "Is there a minimum for custom hats?", a: "No - custom embroidered hats have no minimum order. Buy a single hat or cover the whole team at the same flat price.", link: { href: "/custom-hats", label: "Custom hats with no minimum" } },
  { q: "How do I set up a team store?", a: "Reach out and we'll set up a branded store for your team so players and fans can order gear directly. Great for fundraisers and ongoing orders." },
];
