import type { Metadata } from "next";
import Link from "next/link";
import { CLAIM_REPORT_WINDOW_DAYS } from "@/lib/customer-policy";

export const metadata: Metadata = {
  alternates: { canonical: "/returns" },
  title: "Returns, Exchanges & Order Claims - Custom Gear Policy",
  description:
    "Slugger Athletics policy for custom and stock returns, exchanges, cancellations, sizing, color variation, defects, shipping damage, and order claims.",
};

type PolicySection = {
  h: string;
  body: string[];
  bullets?: string[];
};

const SECTIONS: PolicySection[] = [
  {
    h: "1. Custom and personalized items are final sale",
    body: [
      "Most Slugger Athletics products are created specifically for one customer or team and cannot be resold. Once production begins, custom, decorated, altered, or personalized items are final sale unless they have a covered manufacturing defect or Slugger Athletics made a production error.",
      "Custom items include products made with a team design, logo, colors, player name or number, custom sizing roster, embroidery, sublimation, rhinestones, or other customer-selected decoration. This generally includes custom uniforms, jerseys, cheer sets, team-store apparel, decorated hats, embroidered goods, and custom accessories.",
    ],
    bullets: [
      "A change of mind, player or season cancellation, duplicate order, or change in team needs does not make a custom item returnable.",
      "Incorrect names, numbers, sizes, quantities, colorways, or other information supplied or approved by the customer are not production errors.",
      "Normal color, material, print, embroidery, rhinestone, placement, or construction variation described below is not a defect.",
      "Damage caused by wear, misuse, alteration, improper storage, or care that conflicts with the garment instructions is not a manufacturing defect.",
    ],
  },
  {
    h: "2. Proof, roster, and order approval",
    body: [
      "The approved proof and final roster are the production instructions for a custom order. Before approval or submission, review the product style, artwork, spelling, logos, names, numbers, sizes, top and bottom sizes, quantities, colors, and colorway assigned to every person.",
      "For a team or group order, approval by the coach, organizer, purchaser, or other authorized order contact is treated as approval for the order. Information entered by an individual through a roster or team-store link is treated as that person's final selection unless it is corrected before production begins.",
      "Roster and order selections may be corrected until a deposit or full payment is recorded. Payment locks the roster and confirmed order specifications for production. Later additions or requested changes must be accepted by Slugger Athletics and may be handled as separately priced add-ons with their own production and shipping timeline.",
      "A digital mockup is a design proof, not a photograph of a finished garment. Small differences caused by garment shape, size grading, seams, fabric, and the production process are expected. Anything important that is missing or incorrect must be changed before approval.",
    ],
  },
  {
    h: "3. Sizes and fit",
    body: [
      "Customers are responsible for choosing sizes from the applicable size guide. Do not rely only on age, grade, or a usual retail-clothing size. Custom items cannot be exchanged because they fit differently than expected when the ordered size was produced correctly.",
      "For cheer uniforms and other two-piece sets, top and bottom sizes must be reviewed separately. If measurements fall between sizes, follow the recommendation in the size guide or contact us before submitting the roster.",
      "A mislabeled garment, the wrong size being produced, or a garment that materially fails to correspond to the ordered size because of a manufacturing error may qualify as a covered claim. Normal fit preference, growth, body changes, or selecting the wrong size does not.",
    ],
  },
  {
    h: "4. Changes and cancellations",
    body: [
      "Contact us immediately if an order needs to change or be cancelled. A request is not accepted until Slugger Athletics confirms it in writing. We will tell you what is still possible based on the order's production status.",
      "Once production has begun, custom orders cannot be changed, cancelled, or refunded except for a covered defect, a Slugger Athletics error, or when required by law. Production may include ordering special materials, preparing print or embroidery files, printing, cutting, sewing, decorating, or otherwise committing the order to a supplier or production run.",
      "If an online, phone, or mail order cannot ship within the promised time, we will provide any delay notice, consent option, cancellation right, or refund required by applicable law. Nothing in this policy removes rights that cannot legally be waived.",
    ],
  },
  {
    h: "5. Defects, our mistakes, and normal production variation",
    body: [
      "If an item arrives with a manufacturing defect, a missing or incorrect design element, or a substantial difference from the approved proof or final roster, that is on us. After reviewing the claim, we will provide an appropriate remedy for the affected item at no charge.",
      "Digital proofs show the design, placement, and overall color direction, but they are not physical color samples. Phones, monitors, and tablets display color differently based on screen brightness and calibration. Finished colors can also shift slightly when ink is sublimated into fabric, and different printers, heat presses, fabric lots, garment materials, and production runs may not reproduce a shade 100% identically.",
      "Reasonable differences in shade, brightness, saturation, gradient appearance, print placement, or alignment around seams are normal production variation and are not considered defects. Reorders produced at a later date may also vary slightly from the original batch. A clearly wrong color family, major inconsistency within the same batch, damaged garment, printing failure, or missing or incorrect artwork is not normal variation - contact us and we will review it.",
      "If an exact brand-color match is critical, tell us before approving the proof so we can discuss a Pantone reference or physical sample. Unless a physical sample or specific color standard is approved in writing, an on-screen proof cannot guarantee an exact shade match.",
    ],
    bullets: [
      "Covered examples may include holes, tears, stains, broken seams, a wrong item or size, incorrect personalization, omitted artwork, major print failure, or rhinestones missing when the item arrives.",
      "Normal variation may include slight differences in thread, stone, fabric, shade, gloss, texture, print scale, print or embroidery position, and alignment where artwork crosses seams or garment panels.",
      "A later reorder is a new production run. For the closest possible consistency, order the full quantity and reasonable extras together.",
    ],
  },
  {
    h: "6. Wear, care, and alterations",
    body: [
      "Inspect items before they are worn, washed, decorated further, or altered. Follow the care label and any product-specific instructions. Washing or altering an item can make it harder to determine whether an issue existed at delivery.",
      "Normal wear and tear is not a defect. Claims do not cover damage from abrasion, contact sports, Velcro or rough surfaces, snags, accidents, chemicals, bleach, high heat, ironing, commercial dryers, improper washing, unauthorized repair, tailoring, or added decoration.",
      "For rhinestone garments, wash inside out in cold water on a gentle cycle and air-dry. Do not use bleach, an iron, or high heat. Stone loss caused by wear or improper care is not covered; stones missing on arrival may be a covered defect.",
    ],
  },
  {
    h: "7. How to report a problem",
    body: [
      `Report a suspected defect, production error, wrong or missing item, or shipping damage within ${CLAIM_REPORT_WINDOW_DAYS} calendar days of carrier-recorded delivery or the recorded local-pickup handoff. For an order delivered in multiple packages, the window begins when the final package is marked delivered. Contact us before returning anything; packages sent without authorization may be delayed or refused.`,
      "Keep the affected item, tags, original packaging, and shipping carton until the claim is resolved. We may request additional photographs, measurements, or return of the item so we can confirm the cause and prevent it from happening again.",
    ],
    bullets: [
      "Include the order reference and team or customer name.",
      "Identify each affected item, player name or number, size, and quantity.",
      "Provide one photo of the full item and clear close-ups of the issue. For color concerns, use neutral lighting without filters and include multiple affected pieces together when possible.",
      "For shipping damage, photograph the outside of the package, shipping label, packing materials, and damaged contents before discarding anything.",
    ],
  },
  {
    h: "8. Claim review and remedies",
    body: [
      "We review the approved proof, final roster or order record, photographs, and the finished item when needed. A covered claim will be resolved with an appropriate repair, remake, replacement, refund, or other agreed solution. The remedy applies to the affected item or quantity unless the issue materially affects the entire order.",
      "If we require a covered item to be returned, we will provide return instructions and cover reasonable return shipping. Do not discard an item that is part of an open claim unless we authorize it in writing.",
      "Approved refunds are issued to the original payment method. We initiate the refund after approval and any required return or inspection; the customer's bank or payment provider controls when the credit appears.",
    ],
  },
  {
    h: "9. Shipping loss, damage, and delays",
    body: [
      "Transit damage must be reported through the claim process above. Once a package is accepted by the carrier, a carrier, weather, routing, customs, or other transit delay is not a product defect and does not by itself make a custom order returnable. We will assist with tracking and carrier claims when appropriate.",
      "When offered at checkout, optional Package Protection is provided through XCover and may cover eligible loss, theft, or transit damage subject to its policy terms, exclusions, evidence requirements, and claim deadlines. The protection charge is optional, shown separately, and used to purchase coverage when the shipping label is created. Slugger Athletics submits or assists with the claim because the policy is connected to our shipping account.",
      "If tracking shows delivered but the package cannot be found, check the delivery location, household or business recipients, neighbors, and the carrier first, then contact us promptly. An incorrect or incomplete address submitted by the customer may result in additional shipping or replacement costs.",
      "Keep all packaging and damaged contents. Contact us promptly if a protected package is marked delivered but missing, because XCover may require a claim within 15 days of the delivery scan. A package that remains undelivered should be reported as soon as practical and within the provider's applicable deadline.",
      "This section does not limit any cancellation or refund right that applicable law provides for merchandise that was not shipped within a required or agreed timeframe.",
    ],
  },
  {
    h: "10. Stock items without customization",
    body: [
      "An item qualifies for the stock-item return policy only when it was sold as an in-stock product and has no custom design, team decoration, name, number, embroidery, alteration, or other personalization.",
      `Eligible stock items may be returned within ${CLAIM_REPORT_WINDOW_DAYS} calendar days of carrier-recorded delivery or the recorded local-pickup handoff if they are unworn, unwashed, unused, unaltered, and returned with their original tags and packaging. Contact us first for authorization. The customer pays return shipping, and original shipping is not refundable unless Slugger Athletics shipped the wrong item or the item has a covered defect.`,
      "A refund is issued to the original payment method after the returned item is received and inspected. Items showing wear, washing, odor, damage, missing tags, or incomplete packaging may be refused or have their refund reduced to reflect lost value where permitted by law.",
    ],
  },
  {
    h: "11. Purchases made through another seller",
    body: [
      "This policy applies only to purchases made directly from Slugger Athletics. If you purchased through a school, league, marketplace, retailer, reseller, or another organization that was the seller of record, contact that seller and follow its return and claim process.",
    ],
  },
  {
    h: "12. Policy scope",
    body: [
      "This policy is intended to explain our standard process and does not limit warranties, remedies, or consumer rights that cannot be excluded under applicable law. If another written agreement signed by Slugger Athletics applies to a specific order, that agreement controls only where it directly conflicts with this policy.",
    ],
  },
];

export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Returns</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Returns &amp; Exchanges</h1>
        <p className="mt-3 text-muted">
          Custom gear is made just for you. This policy explains final-sale items, order changes,
          normal production variation, covered defects, stock returns, and how to report a problem.
        </p>
        <p className="mt-3 text-xs text-muted">Last updated August 30, 2026</p>
      </header>

      <div className="mt-8 border border-brand/50 bg-brand/[0.08] p-5">
        <p className="display text-foreground">The short version</p>
        <p className="mt-2 text-sm text-muted">
          Custom and personalized items are final sale once production begins. We cover manufacturing
          defects and our production mistakes. Eligible, non-custom stock items have a 7-day return
          window. Contact us before sending anything back.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link href="/size-guide" className="text-brand hover:underline">Size Guide</Link>
          <Link href="/terms" className="text-brand hover:underline">Terms &amp; Conditions</Link>
          <Link href="/shipping" className="text-brand hover:underline">Shipping Policy</Link>
        </div>
      </div>

      <div className="mt-12 space-y-12">
        {SECTIONS.map((section) => (
          <section key={section.h}>
            <h2 className="display text-2xl text-foreground">{section.h}</h2>
            <div className="mt-3 space-y-3 text-muted">
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && (
                <ul className="list-disc space-y-2 pl-5">
                  {section.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 bg-steel border border-line p-6 text-center">
        <h2 className="display text-xl text-foreground">Something not right with your order?</h2>
        <p className="mt-2 text-muted text-sm">
          Contact us within 7 days of carrier-recorded delivery or recorded local pickup with your order reference and clear photos. Email{" "}
          <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a> or call{" "}
          <a href="tel:+13524147270" className="text-brand hover:underline">352-414-7270</a>.
        </p>
        <Link href="/contact?topic=delivery" className="inline-block mt-5 clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark transition-colors">
          Contact Us
        </Link>
      </div>
    </div>
  );
}
