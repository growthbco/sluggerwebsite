// Shared size-chart tables, used by /size-guide and embedded in team stores.
// Measurements from Slugger Athletics' official size charts (inches).

export const JERSEYS_ADULT = [
  ["AS", "22", "28.5"], ["AM", "23", "29.5"], ["AL", "24", "30.5"], ["AXL", "25", "31.5"],
  ["A2XL", "26", "32.5"], ["A3XL", "27", "33.5"], ["A4XL", "28", "34.5"], ["A5XL", "29", "35.5"],
];
export const JERSEYS_YOUTH = [
  ["YS", "18.5", "24"], ["YM", "19", "24.5"], ["YL", "19.5", "25"], ["YXL", "20", "25.5"],
];
// Girls' volleyball V-neck jerseys use their own fitted block. Keep this
// separate from the relaxed-fit all-sport jersey chart above.
export const VOLLEYBALL_GIRLS_ADULT = [
  ["AXS", "18.5", "26"], ["S", "19.5", "27"], ["M", "20.5", "28"],
  ["L", "21.5", "29"], ["XL", "22.5", "30"], ["2XL", "23.5", "31"],
];
export const VOLLEYBALL_GIRLS_YOUTH = [
  ["YXS", "13.5", "21"], ["YS", "14.5", "22"], ["YM", "15.5", "23"],
  ["YL", "16.5", "24"], ["YXL", "17.5", "25"],
];
export const HOODIES = [
  ["S", "23", "29"], ["M", "24.5", "30"], ["L", "26", "32"], ["XL", "27.5", "33"],
  ["2XL", "29", "35"], ["3XL", "31.5", "36"], ["4XL", "33", "37"], ["5XL", "34", "38"],
];
export const PANTS_ADULT = [
  ["XS", "26-28", "29"], ["S", "29-31", "30"], ["M", "32-34", "31"],
  ["L", "35-37", "32"], ["XL", "38-40", "33"], ["XXL", "41-43", "33"],
];
export const PANTS_YOUTH = [
  ["S", "23-25", "26"], ["M", "25-27", "26.5"], ["L", "27-29", "27"], ["XL", "29-31", "27.5"],
];
// Fitted hats: hat-size ranges for the two cap brands we use. We match the
// brand to the team's design, so both are listed.
export const FITTED_HATS = [
  ["XS", '6 1/2" - 6 7/8"', '6 3/8" - 6 7/8"'],
  ["S/M", '7" - 7 3/8"', '6 7/8" - 7 1/4"'],
  ["L/XL", '7 3/8" - 7 7/8"', '7 3/8" - 8"'],
  ["XXL", '7 7/8" - 8 1/4"', "-"],
];
export const FITTED_HAT_HEADERS = ["Size", "Cap America", "Pacific Headwear"];

// Flag football = SLEEVELESS COMPRESSION uniform. Width = across the chest 1"
// below the armhole; length = highest point of shoulder to hem (inches).
export const FLAG_FOOTBALL = [
  ["Youth XS", "12", "20"], ["Youth S", "13", "21"], ["Youth M", "14", "22"],
  ["Youth L", "15", "23"], ["Youth XL", "16", "24"],
  ["XS", "17", "25"], ["S", "18", "26"], ["M", "19", "27"], ["L", "20", "28"],
  ["XL", "21", "29"], ["2XL", "22", "30"], ["3XL", "23", "31"],
];

// Supplier finished-item measurements in inches. The waist range
// belongs to the skirt/bottom, while chest and sleeve measurements belong to
// the top. Row labels mirror CHEER_SIZES in order-items.ts.
export const CHEER_SET_HEADERS = [
  "Size",
  "Garment length",
  "Chest",
  "Skirt waist",
  "Sleeve length",
  "Sock thigh circumference",
  "Sock length",
];
export const CHEER_SET = [
  ["6", '18"', '22.5"', '20.5-27.5"', '14.5"', '7.1-18.9"', '15.7"'],
  ["8", '20"', '24.5"', '22-29"', '15.5"', '7.1-18.9"', '15.7"'],
  ["10", '22"', '26.5"', '23.5-30.5"', '17"', '7.1-18.9"', '18.9"'],
  ["12", '23.5"', '28.5"', '25-32"', '18.5"', '7.1-18.9"', '18.9"'],
  ["14", '25.5"', '30.5"', '27-33.5"', '19.5"', '7.1-18.9"', '18.9"'],
  ["16", '27.5"', '32.5"', '28.5-35"', '21"', '7.1-18.9"', '18.9"'],
];

export function ChartTable({ headers, rows, wide = false }: { headers: string[]; rows: string[][]; wide?: boolean }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className={`w-full text-left text-sm ${wide ? "min-w-[1050px]" : ""}`}>
        <thead>
          <tr className="bg-brand text-on-brand display">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]} className={i % 2 ? "bg-steel" : "bg-ink"}>
              {r.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? "display text-foreground" : "text-muted"} ${wide ? "whitespace-nowrap" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CheerSizingNotes() {
  return (
    <div className="mt-3 max-w-2xl border border-line bg-steel p-4 text-sm text-muted">
      <p className="font-medium text-foreground">Before choosing cheer sizes</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>The chart lists finished-item measurements, not body measurements. Measure the athlete instead of relying on age or a usual clothing size.</li>
        <li>Choose the top by chest and the skirt/bottom by the skirt waist measurement. Top and skirt sizes may be different.</li>
        <li>If a measurement falls between two sizes, choose the larger size.</li>
        <li>Sock thigh circumference is the stretch range. Garments are measured by hand, so minor measurement variation is normal.</li>
        <li>Review both sizes before the roster closes. Custom uniforms cannot be returned or exchanged for a sizing change; manufacturing defects are covered under our <a href="/returns" className="text-brand hover:underline">Returns &amp; Exchanges policy</a>.</li>
      </ul>
    </div>
  );
}

// Each chart section, standalone so pages can show only what's being ordered.
function JerseySection() {
  return (
    <section>
      <h3 className="display text-lg text-foreground">Jerseys & Shirts</h3>
      <div className="mt-3 grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="display text-sm text-brand mb-2">Adult</h4>
          <ChartTable headers={["Size", "Width", "Length"]} rows={JERSEYS_ADULT} />
        </div>
        <div>
          <h4 className="display text-sm text-brand mb-2">Youth</h4>
          <ChartTable headers={["Size", "Width", "Length"]} rows={JERSEYS_YOUTH} />
        </div>
      </div>
    </section>
  );
}
function HoodieSection() {
  return (
    <section>
      <h3 className="display text-lg text-foreground">Hoodies & Pullovers</h3>
      <div className="mt-3 max-w-md">
        <ChartTable headers={["Size", "Width", "Length"]} rows={HOODIES} />
      </div>
    </section>
  );
}
function HatSection() {
  return (
    <section>
      <h3 className="display text-lg text-foreground">Hats</h3>
      <p className="mt-2 text-foreground">
        🧢 <strong>Snapback Hats: one size fits most</strong>{" "}
        <span className="text-muted">- adjustable, no size to pick.</span>
      </p>
      <p className="mt-3 text-sm text-muted">Fitted hats by hat size:</p>
      <div className="mt-2 max-w-md">
        <ChartTable headers={FITTED_HAT_HEADERS} rows={FITTED_HATS} />
      </div>
    </section>
  );
}
function CheerSection() {
  return (
    <section>
      <h3 className="display text-lg text-foreground">Cheer Sets</h3>
      <CheerSizingNotes />
      <div className="mt-3">
        <p className="mb-2 text-xs text-muted sm:hidden">Swipe sideways to see all measurements.</p>
        <ChartTable headers={CHEER_SET_HEADERS} rows={CHEER_SET} wide />
      </div>
    </section>
  );
}
function PantsSection() {
  return (
    <section>
      <h3 className="display text-lg text-foreground">Pants (Knickers & Long Pants)</h3>
      <div className="mt-3 grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="display text-sm text-brand mb-2">Adult</h4>
          <ChartTable headers={["Size", "Waist", "Inseam"]} rows={PANTS_ADULT} />
        </div>
        <div>
          <h4 className="display text-sm text-brand mb-2">Youth</h4>
          <ChartTable headers={["Size", "Waist", "Inseam"]} rows={PANTS_YOUTH} />
        </div>
      </div>
    </section>
  );
}

function FlagFootballSection() {
  return (
    <section>
      <h3 className="display text-lg text-foreground">Flag Football (sleeveless compression)</h3>
      <p className="mt-2 text-sm text-muted">A snug compression fit. Width = across the chest 1&quot; below the armhole; length = shoulder to hem. Want a looser fit? Choose a standard crew-neck jersey instead.</p>
      <div className="mt-3 max-w-md">
        <ChartTable headers={["Size", "Width", "Length"]} rows={FLAG_FOOTBALL} />
      </div>
    </section>
  );
}

// Map an order-item key to the chart section it needs. Socks (self-explanatory
// S/M, L/XL) have no chart. Keep in sync with ITEM_TYPES in order-items.ts.
type ChartGroup = "jersey" | "flag_football" | "hoodie" | "hats" | "cheer" | "pants";
function chartGroup(itemKey: string): ChartGroup | null {
  const k = itemKey.toLowerCase();
  if (/cheer/.test(k)) return "cheer";
  if (/flag[_\s-]?football/.test(k)) return "flag_football"; // before /jersey/
  if (/hoodie|pullover/.test(k)) return "hoodie";
  if (/hat|beanie|cap/.test(k)) return "hats";
  if (/knicker|pant|short/.test(k)) return "pants";
  if (/jersey|shirt/.test(k)) return "jersey";
  return null; // socks, unknown
}

const GROUP_SECTION: Record<ChartGroup, () => React.ReactElement> = {
  jersey: JerseySection,
  flag_football: FlagFootballSection,
  hoodie: HoodieSection,
  hats: HatSection,
  cheer: CheerSection,
  pants: PantsSection,
};
// Show groups in a stable, sensible order regardless of item order.
const GROUP_ORDER: ChartGroup[] = ["jersey", "flag_football", "cheer", "hoodie", "hats", "pants"];

/** Only the charts an order actually needs, based on its item keys. Falls back
 *  to the jersey chart if nothing maps (e.g. a socks-only or unknown order). */
export function SizeChartsFor({ items }: { items: string[] }) {
  const groups = new Set<ChartGroup>();
  for (const k of items) {
    const g = chartGroup(k);
    if (g) groups.add(g);
  }
  const ordered = GROUP_ORDER.filter((g) => groups.has(g));
  if (ordered.length === 0) ordered.push("jersey");
  return (
    <div className="space-y-8">
      {ordered.map((g) => {
        const Section = GROUP_SECTION[g];
        return <Section key={g} />;
      })}
    </div>
  );
}

/** The full chart set (every product) as one block - used by /size-guide. */
export function AllSizeCharts() {
  return (
    <div className="space-y-8">
      <JerseySection />
      <FlagFootballSection />
      <HoodieSection />
      <HatSection />
      <CheerSection />
      <PantsSection />
    </div>
  );
}
