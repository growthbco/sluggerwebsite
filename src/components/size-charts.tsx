// Shared size-chart tables, used by /size-guide and embedded in team stores.
// Measurements from Slugger Athletics' official size charts (inches).

export const JERSEYS_ADULT = [
  ["AS", "22", "28.5"], ["AM", "23", "29.5"], ["AL", "24", "30.5"], ["AXL", "25", "31.5"],
  ["A2XL", "26", "32.5"], ["A3XL", "27", "33.5"], ["A4XL", "28", "34.5"], ["A5XL", "29", "35.5"],
];
export const JERSEYS_YOUTH = [
  ["YS", "18.5", "24"], ["YM", "19", "24.5"], ["YL", "19.5", "25"], ["YXL", "20", "25.5"],
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

export function ChartTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full text-left text-sm">
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
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? "display text-foreground" : "text-muted"}`}>
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

/** The full chart set (jerseys / hoodies / pants) as one block. */
export function AllSizeCharts() {
  return (
    <div className="space-y-8">
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
      <section>
        <h3 className="display text-lg text-foreground">Hoodies</h3>
        <div className="mt-3 max-w-md">
          <ChartTable headers={["Size", "Width", "Length"]} rows={HOODIES} />
        </div>
      </section>
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
    </div>
  );
}
