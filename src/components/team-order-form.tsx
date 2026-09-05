"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { SmsConsentNote } from "@/components/sms-consent";
import {
  approvedDesignsNeedPlayerChoice,
  ITEM_TYPES,
  fabricFor,
  fixedJerseyMaterialFor,
  jerseyMaterialsFor,
  missingCheerSizeLabels,
  sizeFieldsForItems,
} from "@/lib/order-items";
import { RosterImport, type ImportedRow } from "@/components/roster-import";
import { loadRememberedContact, saveRememberedContact } from "@/lib/remembered-contact";
import { DeliveryTimingAcknowledgment } from "@/components/delivery-timing-acknowledgment";
import { computeTeamOrderQuote, itemPriceCents } from "@/lib/team-order-pricing";
import { buildCustomerOrderSpec } from "@/lib/order-spec";
import { OrderSpecificationCard } from "@/components/order-specification-card";
import { CustomerDeliveryChoice } from "@/components/customer-delivery-choice";
import { CustomerProductionChoice } from "@/components/customer-production-choice";

const JERSEY_STYLES = ["Standard Crew Neck", "V-Neck", "Bowling Shirt (Camp Collar)", "Full Button", "Two Button", "Quarter-Zip"];
const DEFAULT_JERSEY_STYLE = "Standard Crew Neck";
const COMMON_ADD_ON_KEYS = new Set(["shorts", "long_pants", "hoodie", "lightweight_hoodie", "fitted_hat", "socks"]);
const BULK_SIZE_ITEM_KEYS = new Set(["socks"]);
const OTHER_JERSEY_ITEM_KEYS = new Set(["hockey_jersey", "flag_football_jersey", "practice_jersey"]);
const JERSEY_STYLE_DESCRIPTIONS: Record<string, string> = {
  "Standard Crew Neck": "Our versatile $28 starting point for softball, soccer, basketball, practice squads, and more.",
  "V-Neck": "A classic athletic V collar for teams that prefer a sharper neckline.",
  "Bowling Shirt (Camp Collar)": "A classic camp-collar bowling shirt in premium lightweight microfiber.",
  "Full Button": "A traditional button-front baseball jersey.",
  "Two Button": "A button-front baseball cut with a cleaner placket.",
  "Quarter-Zip": "A premium quarter-zip jersey for a more elevated team look.",
};

type Row = { name: string; number: string; sizes: Record<string, string>; notes: string; design: string };
type FlowStep = "team" | "gear" | "details" | "roster" | "review";
type PoloMaterial = "dri-fit" | "pin-dot";

const emptyRow = (design = ""): Row => ({ name: "", number: "", sizes: {}, notes: "", design });

const DIRECT_ORDER_DRAFT_VERSION = 1;
const DIRECT_ORDER_DRAFT_PREFIX = "slugger-team-order-draft";

type DirectOrderDraft = {
  version: number;
  teamName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  jerseyStyle?: string;
  material?: string;
  materialTouched?: boolean;
  items?: string[];
  rows?: Row[];
  hatQty?: Record<string, Record<string, number>>;
  poloMaterial?: PoloMaterial;
  localPickup?: boolean;
  rushShipping?: boolean;
  smsOptIn?: boolean;
  flowStep?: FlowStep;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isFlowStep(value: unknown): value is FlowStep {
  return value === "team" || value === "gear" || value === "details" || value === "roster" || value === "review";
}

function isPoloMaterial(value: unknown): value is PoloMaterial {
  return value === "dri-fit" || value === "pin-dot";
}

function normalizePoloItems(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => (item === "polo_pin_dot" ? "polo" : item))));
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => key.length <= 80 && typeof entry === "string")
      .map(([key, entry]) => [key, entry]),
  );
}

function restoreRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).map((row) => {
    const source = row && typeof row === "object" && !Array.isArray(row)
      ? row as Record<string, unknown>
      : {};
    return {
      name: stringValue(source.name),
      number: stringValue(source.number),
      sizes: stringRecord(source.sizes),
      notes: stringValue(source.notes),
      design: stringValue(source.design),
    };
  });
}

function restoreHatQty(value: unknown): Record<string, Record<string, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const restored: Record<string, Record<string, number>> = {};
  for (const [item, sizes] of Object.entries(value)) {
    if (item.length > 80 || !sizes || typeof sizes !== "object" || Array.isArray(sizes)) continue;
    const quantities = Object.fromEntries(
      Object.entries(sizes)
        .filter(([size, quantity]) => size.length <= 80 && typeof quantity === "number" && Number.isFinite(quantity) && quantity >= 0)
        .map(([size, quantity]) => [size, Math.floor(quantity as number)]),
    );
    if (Object.keys(quantities).length) restored[item] = quantities;
  }
  return restored;
}

function readDraft(value: string | null): DirectOrderDraft | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const draft = parsed as Record<string, unknown>;
    if (draft.version !== DIRECT_ORDER_DRAFT_VERSION) return null;
    return {
      version: DIRECT_ORDER_DRAFT_VERSION,
      teamName: stringValue(draft.teamName),
      contactName: stringValue(draft.contactName),
      contactEmail: stringValue(draft.contactEmail),
      contactPhone: stringValue(draft.contactPhone),
      jerseyStyle: stringValue(draft.jerseyStyle),
      material: stringValue(draft.material),
      materialTouched: draft.materialTouched === true,
      items: Array.isArray(draft.items)
        ? [...new Set(draft.items.filter((item): item is string => typeof item === "string" && ITEM_TYPES.some((type) => type.key === item)))].slice(0, ITEM_TYPES.length)
        : [],
      rows: restoreRows(draft.rows),
      hatQty: restoreHatQty(draft.hatQty),
      smsOptIn: draft.smsOptIn === true,
      localPickup: draft.localPickup === true,
      rushShipping: typeof draft.rushShipping === "boolean" ? draft.rushShipping : undefined,
      flowStep: isFlowStep(draft.flowStep) ? draft.flowStep : "team",
    };
  } catch {
    return null;
  }
}

type Prefill = {
  designToken: string;
  teamName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  approvedDesignUrl: string | null;
  items?: string[];
  sport?: string | null;
  designJerseyStyle?: string | null;
  rush?: boolean;
  neededBy?: string | null;
  /** Approved colorways to choose from. >1 means the roster shows a per-row
   *  design picker (which artwork each player gets). */
  designs?: { label: string; image: string; sku?: string | null }[];
};

/** Best-effort match of the design's jersey cut onto this form's style list. */
function styleFromDesign(designStyle?: string | null): string | undefined {
  const s = (designStyle ?? "").toLowerCase();
  if (!s) return undefined;
  if (s.includes("bowl") || s.includes("camp collar")) return "Bowling Shirt (Camp Collar)";
  if (s.includes("two")) return "Two Button";
  if (s.includes("full")) return "Full Button";
  if (s.includes("v-neck") || s.includes("v neck")) return "V-Neck";
  if (s.includes("crew") || s.includes("round")) return "Standard Crew Neck";
  return JERSEY_STYLES.find((j) => j.toLowerCase() === s);
}

function recommendedJerseyStyleForSport(sport?: string | null): string {
  return /bowling/i.test(sport ?? "") ? "Bowling Shirt (Camp Collar)" : DEFAULT_JERSEY_STYLE;
}

function specialUniformKeyForSport(sport?: string | null): string | undefined {
  if (/hockey/i.test(sport ?? "")) return "hockey_jersey";
  if (/flag[\s-]*football/i.test(sport ?? "")) return "flag_football_jersey";
  return undefined;
}

export function TeamOrderForm({ prefill }: { prefill?: Prefill }) {
  // Approved designs may be colorways players choose between or separate
  // product mockups that all belong to the same order.
  const designs = prefill?.designs ?? [];
  const hasApprovedDesign = Boolean(prefill && designs.length > 0);
  const soleDesign = designs.length === 1 ? designs[0].label : "";
  const [mode, setMode] = useState<"manual" | "link">("manual");
  const [teamName, setTeamName] = useState(prefill?.teamName ?? "");
  const [contactName, setContactName] = useState(prefill?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(prefill?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(prefill?.contactPhone ?? "");
  // The standard crew neck is Slugger's versatile $28 starting point. An
  // approved design style still wins whenever one has already been chosen.
  const initialItems = normalizePoloItems(prefill?.items?.length ? prefill.items : ["jersey"]);
  const initialJerseyStyle = styleFromDesign(prefill?.designJerseyStyle)
    ?? (initialItems.includes("jersey") ? recommendedJerseyStyleForSport(prefill?.sport) : "");
  const initialPoloMaterial: PoloMaterial = prefill?.items?.includes("polo_pin_dot") ? "pin-dot" : "dri-fit";
  const [jerseyStyle, setJerseyStyle] = useState(initialJerseyStyle);
  const [material, setMaterial] = useState(fabricFor(initialJerseyStyle, prefill?.sport));
  const [materialTouched, setMaterialTouched] = useState(false);
  // Orders from an approved design start with the items the design actually
  // covers (a hoodie design pre-selects hoodie, not the jersey default).
  const [items, setItems] = useState<string[]>(initialItems);
  const [poloMaterial, setPoloMaterial] = useState<PoloMaterial>(initialPoloMaterial);
  const needsDesign = approvedDesignsNeedPlayerChoice(designs, items);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(soleDesign), emptyRow(soleDesign), emptyRow(soleDesign)]);
  // Hats are ordered in bulk by size (not per player): { fitted_hat: { "S/M": 5 } }.
  const [hatQty, setHatQty] = useState<Record<string, Record<string, number>>>({});
  const setQty = (key: string, size: string, n: number) =>
    setHatQty((h) => ({ ...h, [key]: { ...(h[key] ?? {}), [size]: n } }));
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<{ shareUrl: string; manageUrl: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [manageUrl, setManageUrl] = useState<string | null>(null);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [rosterAck, setRosterAck] = useState(false);
  const [deliveryAck, setDeliveryAck] = useState(false);
  const [localPickup, setLocalPickup] = useState(false);
  const [rushShipping, setRushShipping] = useState(prefill?.rush ?? false);
  const [flowStep, setFlowStep] = useState<FlowStep>("team");
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftStorageKey = `${DIRECT_ORDER_DRAFT_PREFIX}:v${DIRECT_ORDER_DRAFT_VERSION}:${prefill?.designToken ?? "new"}`;

  // Retain a direct-entry roster for the life of this browser tab, so a reload
  // cannot silently leave the coach reviewing only rows they re-entered.
  useEffect(() => {
    let draft: DirectOrderDraft | null = null;
    try {
      draft = readDraft(window.sessionStorage.getItem(draftStorageKey));
    } catch {
      // Browsers that block storage still retain the in-page form normally.
    }
    if (draft) {
      // An approved design owns the team/contact identity; never replace it
      // with a browser-stored value.
      if (!prefill) {
        setTeamName(draft.teamName ?? "");
        setContactName(draft.contactName ?? "");
        setContactEmail(draft.contactEmail ?? "");
        setContactPhone(draft.contactPhone ?? "");
      }
      if (draft.jerseyStyle) setJerseyStyle(draft.jerseyStyle);
      if (draft.material) setMaterial(draft.material);
      setMaterialTouched(Boolean(draft.materialTouched));
      if (draft.items?.length) setItems(normalizePoloItems(draft.items));
      if (draft.rows?.length) setRows(draft.rows);
      setHatQty(draft.hatQty ?? {});
      if (isPoloMaterial(draft.poloMaterial)) setPoloMaterial(draft.poloMaterial);
      else if (draft.items?.includes("polo_pin_dot")) setPoloMaterial("pin-dot");
      setSmsOptIn(Boolean(draft.smsOptIn));
      setLocalPickup(Boolean(draft.localPickup));
      if (typeof draft.rushShipping === "boolean") setRushShipping(draft.rushShipping);
      setFlowStep(draft.flowStep ?? "team");
      setDraftRestored(true);
    }
    setDraftReady(true);
  }, [draftStorageKey, prefill]);

  useEffect(() => {
    if (!draftReady || status === "done") return;
    const draft: DirectOrderDraft = {
      version: DIRECT_ORDER_DRAFT_VERSION,
      teamName,
      contactName,
      contactEmail,
      contactPhone,
      jerseyStyle,
      material,
      materialTouched,
      items,
      rows,
      hatQty,
      poloMaterial,
      smsOptIn,
      localPickup,
      rushShipping,
      flowStep,
    };
    try {
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // The final submission path remains unchanged when storage is blocked.
    }
  }, [contactEmail, contactName, contactPhone, draftReady, draftStorageKey, flowStep, hatQty, items, jerseyStyle, localPickup, rushShipping, material, materialTouched, poloMaterial, rows, smsOptIn, status, teamName]);

  // Returning visitor prefill (browser-local). Skipped when the identity is
  // already locked from an approved design.
  useEffect(() => {
    if (prefill) return;
    const saved = loadRememberedContact();
    if (saved) {
      setContactName((v) => v || saved.name);
      setContactEmail((v) => v || saved.email);
      setContactPhone((v) => v || saved.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputCls =
    "w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  function chooseJerseyStyle(nextStyle: string) {
    setJerseyStyle(nextStyle);
    const fixedMaterial = fixedJerseyMaterialFor(nextStyle, prefill?.sport);
    if (fixedMaterial) {
      setMaterial(fixedMaterial);
    } else if (!materialTouched) {
      setMaterial(fabricFor(nextStyle, prefill?.sport));
    }
  }

  function toggleItem(key: string) {
    if (key === "jersey" && !items.includes("jersey") && !jerseyStyle) {
      chooseJerseyStyle(DEFAULT_JERSEY_STYLE);
    }
    setItems((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function update(i: number, key: keyof Row, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));
  }
  function updateSize(i: number, itemKey: string, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, sizes: { ...row.sizes, [itemKey]: value } } : row)));
  }
  const addRow = () => setRows((r) => [...r, emptyRow(soleDesign)]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const filledRows = rows.filter((r) => r.name || r.number || Object.keys(r.sizes).length);
  // A polo is one customer-facing product. Its material determines the
  // canonical item key only after the customer makes that choice in Details.
  const resolvedItems = items.map((item) => (item === "polo" && poloMaterial === "pin-dot" ? "polo_pin_dot" : item));
  // Selected item types in canonical order, jersey first. Per-player items get
  // a size column on each roster row; in-house hats are ordered in bulk by size.
  const selected = ITEM_TYPES.filter((t) => resolvedItems.includes(t.key));
  // One-size items ordered in bulk by size: in-house hats AND outsourced beanies.
  const perPlayerSelected = selected.filter((t) => !t.inHouse && !t.outsourced && !BULK_SIZE_ITEM_KEYS.has(t.key));
  const bulkSelected = selected.filter((t) => t.inHouse || t.outsourced || BULK_SIZE_ITEM_KEYS.has(t.key));
  const needsPlayerRoster = perPlayerSelected.length > 0;
  const perPlayerKeys = perPlayerSelected.map((t) => t.key);
  const perPlayerSizeFields = sizeFieldsForItems(perPlayerKeys, prefill?.sport);
  const bulkRows = () =>
    bulkSelected.flatMap((t) =>
      t.sizes
        .filter((s) => (hatQty[t.key]?.[s] ?? 0) > 0)
        .map((s) => ({ name: "", number: "", sizes: { [t.key]: s }, notes: "", design: "", quantity: hatQty[t.key][s] })),
    );
  // Jersey style/material only apply when a jersey is actually being ordered
  // - a hoodie-only order must not carry a phantom jersey style.
  const hasJersey = items.includes("jersey");
  const fixedJerseyMaterial = hasJersey ? fixedJerseyMaterialFor(jerseyStyle, prefill?.sport) : undefined;
  const materialOptions = jerseyMaterialsFor(jerseyStyle, prefill?.sport);
  const effectiveMaterial = fixedJerseyMaterial ?? material;
  const orderSetupComplete = items.length > 0 && (!hasJersey || Boolean(jerseyStyle && effectiveMaterial)) && (!items.includes("polo") || Boolean(poloMaterial));
  const commonAddOns = ITEM_TYPES.filter((item) => COMMON_ADD_ON_KEYS.has(item.key));
  const otherJerseyItems = ITEM_TYPES.filter((item) => OTHER_JERSEY_ITEM_KEYS.has(item.key));
  const specialtyAddOns = ITEM_TYPES.filter((item) => item.key !== "jersey" && item.key !== "polo_pin_dot" && !COMMON_ADD_ON_KEYS.has(item.key) && !OTHER_JERSEY_ITEM_KEYS.has(item.key));
  const approvedDesignSport = prefill?.sport?.trim() ?? "";
  const hasSportLinkedDesign = Boolean(prefill?.designToken && approvedDesignSport);
  const designRecommendedStyle = hasJersey
    ? styleFromDesign(prefill?.designJerseyStyle) ?? recommendedJerseyStyleForSport(approvedDesignSport)
    : undefined;
  const displayedJerseyStyles = designRecommendedStyle
    ? [designRecommendedStyle, ...JERSEY_STYLES.filter((style) => style !== designRecommendedStyle)]
    : JERSEY_STYLES;
  const designRecommendedUniformKey = hasSportLinkedDesign ? specialUniformKeyForSport(approvedDesignSport) : undefined;
  const designRecommendedUniform = otherJerseyItems.find((item) => item.key === designRecommendedUniformKey);
  const designRecommendedUniformSelected = Boolean(designRecommendedUniform && items.includes(designRecommendedUniform.key));
  const designRecommendedUniformDescription = designRecommendedUniform?.key === "hockey_jersey"
    ? "Sublimated hockey sweater."
    : "Sleeveless compression game shirt.";
  const additionalUniforms = otherJerseyItems.filter((item) => item.key !== designRecommendedUniformKey);
  const teamDetailsComplete = Boolean(prefill || (teamName.trim() && contactName.trim() && contactEmail.trim()));
  const sizeGuideHref = /basketball/i.test(prefill?.sport ?? "")
    ? "/size-guide#basketball"
    : /volleyball/i.test(prefill?.sport ?? "")
      ? "/size-guide#girls-volleyball"
      : "/size-guide#jerseys";
  const submissionRoster = [
    ...rows.map((row) => ({ ...row, quantity: 1 })),
    ...bulkRows(),
  ].filter((row) => row.name || row.number || Object.values(row.sizes).some(Boolean));
  const hasEnteredSizes = submissionRoster.length > 0;
  const submissionRosterForPricing = submissionRoster.map((row, index) => ({
    id: `preview-${index}`,
    playerName: row.name,
    playerNumber: row.number,
    sizes: row.sizes,
    quantity: row.quantity,
  }));
  const submissionOrder = {
    teamName,
    items: resolvedItems,
    sport: prefill?.sport,
    jerseyStyle: hasJersey ? jerseyStyle : null,
    jerseyMaterial: hasJersey ? effectiveMaterial : null,
    rushShipping,
    localPickup,
    requestedInHandAt: prefill?.neededBy ? new Date(`${prefill.neededBy}T12:00:00`) : null,
  };
  const submissionQuote = computeTeamOrderQuote(submissionOrder, submissionRosterForPricing);
  const submissionSpec = buildCustomerOrderSpec(
    submissionOrder,
    submissionRosterForPricing,
    { designs, colors: null },
    submissionQuote,
  );

  async function submit() {
    if (!rosterAck || !deliveryAck) return;
    // Multi-design team: every player row with anything on it must say which
    // design it gets, so nothing falls back to a guess in production.
    if (needsDesign && hasJersey) {
      const missing = rows.some((r) => (r.name || r.number || Object.keys(r.sizes).length) && !r.design);
      if (missing) { setStatus("error"); setMessage("This team has more than one design - pick which one each player gets."); return; }
    }
    if (rows.some((r) => (r.name || r.number || Object.values(r.sizes).some(Boolean)) && missingCheerSizeLabels(resolvedItems, r.sizes).length)) {
      setStatus("error"); setMessage("Choose both a cheer top size and skirt size for every cheerleader."); return;
    }
    setStatus("sending"); setMessage("");
    try {
      const res = await fetch("/api/team-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, contactName, contactEmail, contactPhone, sport: prefill?.sport, jerseyStyle: hasJersey && jerseyStyle ? jerseyStyle : undefined, jerseyMaterial: hasJersey ? effectiveMaterial : undefined, items: resolvedItems, roster: [...rows, ...bulkRows()], designToken: prefill?.designToken, smsConsent: smsOptIn, rushShipping, localPickup, deliveryTermsAccepted: true, specConfirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus("done");
      try { window.sessionStorage.removeItem(draftStorageKey); } catch {}
      saveRememberedContact({ name: contactName, email: contactEmail, phone: contactPhone });
      setMessage(`Order ${data.reference} submitted! We'll be in touch with your total.`);
      if (data.manageUrl) setManageUrl(data.manageUrl);
    } catch (e) { setStatus("error"); setMessage((e as Error).message); }
  }

  async function createLink() {
    setStatus("sending"); setMessage("");
    try {
      const res = await fetch("/api/team-order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, contactName, contactEmail, contactPhone, sport: prefill?.sport, jerseyStyle: hasJersey && jerseyStyle ? jerseyStyle : undefined, jerseyMaterial: hasJersey ? effectiveMaterial : undefined, items: resolvedItems, designToken: prefill?.designToken, smsConsent: smsOptIn, rushShipping, localPickup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create link");
      setLinks({ shareUrl: data.shareUrl, manageUrl: data.manageUrl });
      setStatus("idle");
    } catch (e) { setStatus("error"); setMessage((e as Error).message); }
  }

  async function copyLink(url: string, which: string) {
    await navigator.clipboard.writeText(url);
    setCopied(which);
    setTimeout(() => setCopied(""), 2000);
  }

  if (status === "done") {
    return (
      <div className="bg-steel border border-line p-8 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
        <h2 className="display text-2xl text-foreground mt-4">Roster Submitted</h2>
        <p className="mt-3 text-muted">{message}</p>
        {manageUrl && (
          <div className="mt-6 text-left bg-ink border border-line p-4">
            <p className="display text-sm text-foreground">📌 Save your order link</p>
            <p className="mt-1 text-sm text-muted">
              This is your page for this order - check its status anytime, and if someone joins the
              team later you can add extra jerseys and pay for just those pieces right there.
            </p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={manageUrl} className="flex-1 bg-steel border border-line px-3 py-2 text-xs text-foreground/80" />
              <button
                type="button"
                onClick={() => copyLink(manageUrl, "manage")}
                className="clip-slant bg-brand text-on-brand display text-sm px-4 py-2 hover:bg-brand-dark"
              >
                {copied === "manage" ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!hasApprovedDesign && (
        <div className="border border-brand/60 bg-brand/[0.08] p-4" role="alert">
          <p className="display text-foreground">Approved design required before submission</p>
          <p className="mt-1 text-sm text-muted">
            You can create a roster link and let players add their sizes now, but the final order cannot be submitted until your artwork is approved.
          </p>
          <a href="/design" className="mt-3 inline-flex clip-slant bg-brand px-4 py-2 text-sm display text-on-brand hover:bg-brand-dark">
            Start free design
          </a>
        </div>
      )}

      <ol className="grid grid-cols-5 gap-2" aria-label="Team order progress">
        {([
          ["team", "Team"],
          ["gear", "Gear"],
          ["details", "Details"],
          ["roster", needsPlayerRoster ? "Roster" : "Sizes"],
          ["review", "Review"],
        ] as const).map(([step, label], index) => {
          const active = flowStep === step;
          const complete = (["team", "gear", "details", "roster", "review"] as FlowStep[]).indexOf(flowStep) > index;
          return (
            <li key={step} className={`border px-2.5 py-2 text-center ${active ? "border-brand bg-brand/[0.08]" : complete ? "border-brand/50" : "border-line"}`} aria-current={active ? "step" : undefined}>
              <span className={`mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${active || complete ? "bg-brand text-on-brand" : "bg-foreground/10 text-muted"}`}>{complete ? "✓" : index + 1}</span>
              <span className={`display text-xs ${active ? "text-foreground" : "text-muted"}`}>{label}</span>
            </li>
          );
        })}
      </ol>

      {flowStep === "team" && (
        <>
      {/* Mode selector */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={() => { setMode("manual"); setLinks(null); }} className={`text-left p-4 border transition-colors ${mode === "manual" ? "border-brand bg-steel" : "border-line hover:border-brand/50"}`}>
          <span className="display text-foreground">I&apos;ll enter the team sizes</span>
          <p className="text-sm text-muted mt-1">Use player details for personalized gear, or simple size totals for items like socks and hats.</p>
        </button>
        <button onClick={() => setMode("link")} className={`text-left p-4 border transition-colors ${mode === "link" ? "border-brand bg-steel" : "border-line hover:border-brand/50"}`}>
          <span className="display text-foreground">Let players enter their own</span>
          <p className="text-sm text-muted mt-1">Share a link - each player fills in their own details.</p>
        </button>
      </div>

      {draftRestored && (
        <p className="-mt-4 text-xs text-muted" role="status">
          Your saved roster draft was restored in this browser tab. It will clear automatically once the order is submitted.
        </p>
      )}

      {/* Team + contact - locked when arriving from an approved design so the
          team-order stays tied to the design (same name = same job). */}
      {prefill ? (
        <div className="bg-steel border border-brand/40 p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="display text-foreground">{prefill.teamName}</span>
            <span className="text-[10px] uppercase tracking-wider text-brand">From approved design</span>
          </div>
          <p className="text-xs text-muted">
            {prefill.contactName} · {prefill.contactEmail}{prefill.contactPhone ? ` · ${prefill.contactPhone}` : ""}
          </p>
          <p className="text-[11px] text-muted/80">
            Team name &amp; contact are locked to keep this order tied to your approved design.
            Need to change them? Email <a href="mailto:apparel@sluggerathletics.com" className="underline">apparel@sluggerathletics.com</a>.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="team-order-team-name" className="display text-sm text-foreground">Team Name *</label>
            <input id="team-order-team-name" name="teamName" autoComplete="organization" required className={`mt-2 ${inputCls}`} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Sandstorm" />
          </div>
          <div>
            <label htmlFor="team-order-contact-name" className="display text-sm text-foreground">Your Name *</label>
            <input id="team-order-contact-name" name="contactName" autoComplete="name" required className={`mt-2 ${inputCls}`} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Coach / contact" />
          </div>
          <div>
            <label htmlFor="team-order-email" className="display text-sm text-foreground">Email *</label>
            <input id="team-order-email" name="contactEmail" type="email" autoComplete="email" required className={`mt-2 ${inputCls}`} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="email@team.com" />
          </div>
          <div>
            <label htmlFor="team-order-phone" className="display text-sm text-foreground">Phone</label>
            <input id="team-order-phone" name="contactPhone" type="tel" autoComplete="tel" className={`mt-2 ${inputCls}`} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(000) 000-0000" />
          </div>
          <div className="sm:col-span-2">
            <SmsConsentNote onChange={setSmsOptIn} />
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setStatus("idle"); setMessage(""); setFlowStep("gear"); }}
          disabled={!teamDetailsComplete}
          className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-6 py-3 disabled:opacity-50"
        >
          Continue to gear
        </button>
      </div>
        </>
      )}

      {/* Keep the whole uniform line visible up front. Fabric is a separate
          decision on the next step, after the team has picked its products. */}
      {flowStep === "gear" && (
        <>
          {designRecommendedUniform && (
            <section className="border border-brand bg-brand/[0.08] p-4 sm:p-5" aria-labelledby="design-uniform-title">
              <p className="display text-xs uppercase tracking-[0.16em] text-brand">Your approved {approvedDesignSport} design</p>
              <h2 id="design-uniform-title" className="display mt-1 text-2xl text-foreground">Recommended uniform</h2>
              <p className="mt-2 text-sm text-muted">This is the uniform type tied to your design. You can still add any other jersey or team item below.</p>
              <button
                type="button"
                onClick={() => toggleItem(designRecommendedUniform.key)}
                aria-pressed={designRecommendedUniformSelected}
                className={`!block mt-4 min-h-11 border p-4 text-left transition-colors ${designRecommendedUniformSelected ? "border-brand bg-brand text-on-brand" : "border-line bg-steel text-foreground hover:border-brand/50"}`}
              >
                <span className="display text-sm">{designRecommendedUniformSelected ? "✓ " : "+ "}{designRecommendedUniform.label} — ${(itemPriceCents(designRecommendedUniform.key) / 100).toFixed(0)}</span>
                <span className={`mt-1 block text-xs ${designRecommendedUniformSelected ? "text-on-brand/80" : "text-muted"}`}>{designRecommendedUniformSelected ? "Selected from your approved design. " : "Recommended for your approved design. "}{designRecommendedUniformDescription}</span>
              </button>
            </section>
          )}

          <section aria-labelledby="team-jersey-title">
            <p className="display text-xs uppercase tracking-[0.16em] text-brand">Step 1 · Team uniform</p>
            <h2 id="team-jersey-title" className="display mt-1 text-2xl text-foreground">{designRecommendedUniform ? "Other jersey styles" : "Choose a jersey style"}</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              {hasSportLinkedDesign && !designRecommendedUniform
                ? `Based on your approved ${approvedDesignSport} design, we put the best match first. Every other cut remains available if your team needs a different option.`
                : designRecommendedUniform
                  ? "Your design-matched uniform is above. These all-sport cuts remain available for an additional jersey or a change in direction."
                  : "The Standard Crew Neck is the $28 default, not the only option. Every jersey cut is shown here so teams can choose what fits their sport. Fabric comes next."}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {displayedJerseyStyles.map((style) => {
                const on = hasJersey && jerseyStyle === style;
                const isDesignRecommendation = hasSportLinkedDesign && style === designRecommendedStyle;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      chooseJerseyStyle(style);
                      setItems((current) => current.includes("jersey") ? current : [...current, "jersey"]);
                    }}
                    aria-pressed={on}
                    className={`!block min-h-11 border p-4 text-left transition-colors ${on ? "border-brand bg-brand/[0.08]" : "border-line bg-steel hover:border-brand/50"}`}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="display text-foreground">{on ? "✓ " : ""}{style}</span>
                      <span className="display text-sm text-foreground">${(itemPriceCents("jersey", style, undefined, fabricFor(style, prefill?.sport)) / 100).toFixed(0)}</span>
                    </span>
                    {style === DEFAULT_JERSEY_STYLE && <span className="mt-2 block text-xs font-semibold uppercase tracking-wider text-brand">{isDesignRecommendation ? (on ? "Selected from approved design" : `Recommended for ${approvedDesignSport}`) : "Included by default"}</span>}
                    {isDesignRecommendation && style !== DEFAULT_JERSEY_STYLE && <span className="mt-2 block text-xs font-semibold uppercase tracking-wider text-brand">{on ? "Selected from approved design" : `Recommended for ${approvedDesignSport}`}</span>}
                    <span className="mt-1 block text-sm text-muted">{JERSEY_STYLE_DESCRIPTIONS[style]}</span>
                    {style === DEFAULT_JERSEY_STYLE && (
                      <span className="mt-3 flex items-center gap-3 border border-brand/30 bg-ink p-2">
                        <Image
                          src="/styles/crew.jpg"
                          alt="Example Standard Crew Neck jersey, shown front and back"
                          width={1400}
                          height={1055}
                          sizes="128px"
                          className="h-24 w-32 shrink-0 object-cover"
                        />
                        <span className="text-xs text-muted">Crew-neck example, front and back. Artwork, colors, names, and numbers are customized for your team.</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {hasJersey && (
              <button type="button" onClick={() => toggleItem("jersey")} className="mt-3 min-h-11 text-sm text-muted underline underline-offset-4 hover:text-foreground">
                This order doesn&apos;t need a standard jersey
              </button>
            )}
          </section>

          {additionalUniforms.length > 0 && (
          <section className="border border-line bg-steel p-4" aria-labelledby="other-uniforms-title">
            <p id="other-uniforms-title" className="display text-sm text-foreground">Other team uniform types</p>
            <p className="mt-1 text-sm text-muted">Hockey, flag football, and practice jerseys are regular options—not hidden specialty gear. Add any of these alongside the jersey style above when the order needs multiple uniform types.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {additionalUniforms.map((item) => {
                const on = items.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleItem(item.key)}
                    aria-pressed={on}
                    className={`!block min-h-11 border p-3 text-left transition-colors ${on ? "border-brand bg-brand text-on-brand" : "border-line text-foreground hover:border-brand/50"}`}
                  >
                    <span className="display text-sm">{on ? "✓ " : "+ "}{item.label} — ${(itemPriceCents(item.key) / 100).toFixed(0)}</span>
                    <span className={`mt-1 block text-xs ${on ? "text-on-brand/80" : "text-muted"}`}>{item.key === "hockey_jersey" ? "Sublimated hockey sweater." : item.key === "flag_football_jersey" ? "Sleeveless compression game shirt." : "Lightweight extra jersey for training or warmups."}</span>
                  </button>
                );
              })}
            </div>
          </section>
          )}

          <section aria-labelledby="team-gear-title">
            <p id="team-gear-title" className="display text-sm text-foreground">Add team gear <span className="text-muted">(optional)</span></p>
            <p className="mt-1 text-sm text-muted">Pick every extra this team needs. Hats and socks will use simple team-size totals instead of player names.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {commonAddOns.map((item) => {
                const on = items.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleItem(item.key)}
                    aria-pressed={on}
                    className={`min-h-11 clip-slant display text-sm px-4 py-2 transition-colors ${on ? "bg-brand text-on-brand" : "bg-steel border border-line text-foreground/80 hover:border-brand/50"}`}
                  >
                    {on ? "✓ " : "+ "}{item.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 border border-line bg-steel p-4">
              <p className="display text-sm text-foreground">More apparel and accessories</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {specialtyAddOns.map((item) => {
                  const on = items.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleItem(item.key)}
                      aria-pressed={on}
                      className={`min-h-11 clip-slant display text-sm px-4 py-2 transition-colors ${on ? "bg-brand text-on-brand" : "border border-line text-foreground/80 hover:border-brand/50"}`}
                    >
                      {on ? "✓ " : "+ "}{item.key === "polo" ? "Custom Polo" : item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setFlowStep("team")} className="clip-slant border border-line text-foreground display px-5 py-3 hover:bg-foreground/5">
          Back
        </button>
        <button
          type="button"
          onClick={() => { setStatus("idle"); setMessage(""); setFlowStep("details"); }}
          disabled={!items.length}
          className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-6 py-3 disabled:opacity-50"
        >
          {!items.length ? "Choose gear to continue" : "Continue to details"}
        </button>
      </div>
        </>
      )}

      {flowStep === "details" && (
        <section className="space-y-7" aria-labelledby="team-order-details-title">
          <div>
            <p className="display text-xs uppercase tracking-[0.16em] text-brand">Selected gear</p>
            <h2 id="team-order-details-title" className="display mt-1 text-2xl text-foreground">Choose the details that matter</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">Only selected products appear here, so you can make the right cut and fabric choices without sorting through a catalogue.</p>
          </div>

          {hasJersey && (
            <div className="border border-line bg-steel p-5">
              <p className="display text-sm text-foreground">{fixedJerseyMaterial ? "Included jersey material" : "Jersey material"}</p>
              <p className="mt-1 text-sm text-muted">
                {fixedJerseyMaterial
                  ? "This jersey cut has one production fabric, so there is nothing else to choose."
                  : "We selected the recommended fabric for this cut. Choose another only if you have a preference."}
              </p>
              <div className={`mt-3 grid gap-3 ${fixedJerseyMaterial ? "" : "sm:grid-cols-2"}`}>
                {materialOptions.map((option) => {
                  const on = effectiveMaterial === option.key;
                  if (fixedJerseyMaterial) {
                    return (
                      <div key={option.key} className="border border-brand bg-brand/[0.08] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="display text-foreground">✓ {option.label}</span>
                          <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-brand">Included</span>
                        </div>
                        <p className="mt-1 text-sm text-muted">{option.description}</p>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => { setMaterial(option.key); setMaterialTouched(true); }}
                      aria-pressed={on}
                      className={`relative min-h-11 border p-4 text-left transition-colors ${on ? "border-brand bg-brand/[0.08]" : "border-line hover:border-brand/50"}`}
                    >
                      {option.recommended && (
                        <span className="absolute right-3 top-3 display bg-brand px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-on-brand">Recommended</span>
                      )}
                      <span className="display text-foreground">{on ? "✓ " : ""}{option.label}</span>
                      <p className="mt-1 text-sm text-muted">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {items.includes("polo") && (
            <div className="border border-line bg-steel p-5">
              <p className="display text-sm text-foreground">Custom Polo fabric</p>
              <p className="mt-1 text-sm text-muted">Choose the fabric for the polo you selected on the previous step.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPoloMaterial("dri-fit")}
                  aria-pressed={poloMaterial === "dri-fit"}
                  className={`min-h-11 border p-4 text-left transition-colors ${poloMaterial === "dri-fit" ? "border-brand bg-brand/[0.08]" : "border-line hover:border-brand/50"}`}
                >
                  <span className="display text-foreground">{poloMaterial === "dri-fit" ? "✓ " : ""}Dri-Fit</span>
                  <span className="mt-1 block text-sm text-muted">Lightweight performance fabric for an active, athletic feel.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPoloMaterial("pin-dot")}
                  aria-pressed={poloMaterial === "pin-dot"}
                  className={`min-h-11 border p-4 text-left transition-colors ${poloMaterial === "pin-dot" ? "border-brand bg-brand/[0.08]" : "border-line hover:border-brand/50"}`}
                >
                  <span className="display text-foreground">{poloMaterial === "pin-dot" ? "✓ " : ""}Pin-Dot</span>
                  <span className="mt-1 block text-sm text-muted">Textured pin-dot fabric for a more elevated polo finish.</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setFlowStep("gear")} className="clip-slant border border-line text-foreground display px-5 py-3 hover:bg-foreground/5">
              Back
            </button>
            {mode === "manual" && (
              <button
                type="button"
                onClick={() => { setStatus("idle"); setMessage(""); setFlowStep("roster"); }}
                disabled={!orderSetupComplete}
                className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-6 py-3 disabled:opacity-50"
              >
                Continue to roster
              </button>
            )}
          </div>
        </section>
      )}

      <CustomerProductionChoice
        rush={rushShipping}
        pieces={submissionQuote.pieces}
        onChange={(rush) => { setRushShipping(rush); setRosterAck(false); }}
        disabled={status === "sending"}
      />

      <CustomerDeliveryChoice
        localPickup={localPickup}
        onChange={setLocalPickup}
        rushShipping={rushShipping}
        name="team-order-delivery-method"
      />

      {/* Manual roster mode */}
      {mode === "manual" && flowStep === "roster" && (
        <>
          {needsPlayerRoster ? (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="display text-xl text-foreground">Roster</h2>
              <span className="text-sm text-muted">{filledRows.length} players</span>
            </div>
            <p className="text-sm text-muted mt-1">A size for each item is all we need - name and number are optional (leave them blank for plain gear with no personalization). Names print in CAPS. <a href={sizeGuideHref} target="_blank" className="text-brand underline underline-offset-2">Open the right size guide ↗</a></p>

            {needsDesign && hasJersey && (
              <div className="mt-3 bg-steel border border-brand/40 p-3">
                <p className="display text-sm text-foreground">This team has {designs.length} designs - pick which one each player gets below.</p>
                <div className="mt-2 flex flex-wrap gap-4">
                  {designs.map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-xs text-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.image} alt={d.label} className="h-12 w-12 object-contain bg-white border border-line rounded" />
                      {d.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <RosterImport
                itemKeys={perPlayerKeys}
                sport={prefill?.sport}
                confirmLabel={undefined}
                onConfirm={(imported: ImportedRow[]) => {
                  const asRows: Row[] = imported.map((r) => ({
                    name: r.name,
                    number: r.number,
                    sizes: r.sizes,
                    notes: r.notes ?? "",
                    design: soleDesign,
                  }));
                  // Replace untouched empty rows; keep anything already typed.
                  setRows((prev) => [
                    ...prev.filter((row) => row.name || row.number || Object.keys(row.sizes).length),
                    ...asRows,
                  ]);
                }}
              />
            </div>

            <div className="mt-4 space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="border border-line p-3 space-y-3">
                  <div className="flex gap-2 items-start">
                    <input name={`player-${i}-name`} aria-label={`Player ${i + 1} name`} className={inputCls} value={row.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Player name" />
                    <input name={`player-${i}-number`} aria-label={`Player ${i + 1} number`} className={`${inputCls} max-w-24`} value={row.number} onChange={(e) => update(i, "number", e.target.value)} placeholder="#" maxLength={4} />
                    <button type="button" onClick={() => removeRow(i)} className="min-h-11 min-w-11 text-muted hover:text-brand px-2 py-2.5" aria-label={`Remove player ${i + 1}`}>✕</button>
                  </div>
                  {needsDesign && hasJersey && (
                    <select
                      className={`${inputCls} ${row.design ? "" : "border-brand/60 text-brand"}`}
                      value={row.design}
                      onChange={(e) => update(i, "design", e.target.value)}
                      aria-label="Which design"
                    >
                      <option value="">Which design?</option>
                      {designs.map((d) => <option key={d.label} value={d.label} className="text-foreground">{d.label}</option>)}
                    </select>
                  )}
                  {perPlayerSizeFields.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {perPlayerSizeFields.map((field) => (
                        <select key={field.key} className={inputCls} value={row.sizes[field.key] ?? ""} onChange={(e) => updateSize(i, field.key, e.target.value)}>
                          <option value="">{field.label} size</option>
                          {field.sizes.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      ))}
                    </div>
                  )}
                  <input name={`player-${i}-notes`} aria-label={`Player ${i + 1} notes`} className={inputCls} value={row.notes} onChange={(e) => update(i, "notes", e.target.value)} placeholder="Notes (optional)" />
                </div>
              ))}
            </div>

            <button onClick={addRow} className="mt-3 clip-slant bg-steel border border-line text-foreground display text-sm px-5 py-2.5 hover:border-brand/50">
              + Add Player
            </button>
          </div>
          ) : (
            <div className="border border-brand/50 bg-steel p-5">
              <p className="display text-xl text-foreground">Team sizes</p>
              <p className="mt-2 text-sm text-muted">This order only has bulk-size gear, so names and player rows are not needed. Enter the total you need in each size below.</p>
            </div>
          )}

          {/* Hats, socks, and other bulk-size gear use team totals, not player names. */}
          {bulkSelected.length > 0 && (
            <div>
              <h2 className="display text-xl text-foreground">Team sizes <span className="text-base text-muted">(order by size)</span></h2>
              <p className="mt-1 text-sm text-muted">Hats and socks aren&apos;t name-specific—just enter how many you need of each size.</p>
              <div className="mt-3 space-y-3">
                {bulkSelected.map((t) => {
                  const total = t.sizes.reduce((a, s) => a + (hatQty[t.key]?.[s] ?? 0), 0);
                  return (
                    <div key={t.key} className="border border-line p-3">
                      <div className="flex items-baseline justify-between">
                        <p className="display text-sm text-foreground">{t.label}</p>
                        <span className="text-sm text-muted">{total} total</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {t.sizes.map((s) => (
                          <label key={s} className="flex items-center gap-2">
                            <span className="text-sm text-muted min-w-[3.5rem]">{s}</span>
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={hatQty[t.key]?.[s] ?? ""}
                              onChange={(e) => setQty(t.key, s, Math.max(0, parseInt(e.target.value) || 0))}
                              placeholder="0"
                              className={`${inputCls} max-w-20`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {status === "error" && <p className="text-sm text-brand">{message}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setFlowStep("details")} className="clip-slant border border-line text-foreground display px-5 py-3 hover:bg-foreground/5">
              Back
            </button>
            <button
              type="button"
              onClick={() => { setRosterAck(false); setDeliveryAck(false); setStatus("idle"); setMessage(""); setFlowStep("review"); }}
              disabled={status === "sending" || !hasApprovedDesign || !orderSetupComplete || !hasEnteredSizes}
              className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors disabled:opacity-60"
            >
              {!hasApprovedDesign ? "Approved design required" : !hasEnteredSizes ? needsPlayerRoster ? "Add a player size to continue" : "Add team sizes to continue" : "Continue to review"}
            </button>
          </div>
          <p className="text-xs text-muted">
            {hasApprovedDesign
              ? prefill?.rush
                ? "No payment now - we'll email your total and required Rush pay-in-full invoice."
                : "No payment now - we'll email your total and 50% deposit invoice."
              : "Need to collect sizes first? Choose “Let players enter their own” above to create a draft roster link."}
          </p>
          <p className="text-xs text-muted">⏱ Working toward a deadline? Order as early as you can and build in a buffer. We push hard to hit every date, but carrier and shipping delays can happen and are outside our control - if your date is firm, tell us before you order and we&apos;ll be straight with you about it.</p>

        </>
      )}

      {mode === "manual" && flowStep === "review" && (
        <section className="border border-brand/50 bg-steel p-5 sm:p-6" aria-labelledby="direct-order-review-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="display text-xs uppercase tracking-[0.16em] text-brand">Final review</p>
              <h2 id="direct-order-review-title" className="display text-2xl text-foreground mt-1">Confirm your team order</h2>
              <p className="mt-2 text-sm text-muted">This exact summary is saved with your order when you submit.</p>
            </div>
            <button type="button" onClick={() => setFlowStep("roster")} disabled={status === "sending"} className="clip-slant border border-line text-foreground display px-4 py-2 hover:bg-foreground/5 disabled:opacity-50">
              Edit roster
            </button>
          </div>

          <div className="mt-5">
            <OrderSpecificationCard spec={submissionSpec} compact />
          </div>

          <label className="mt-4 flex cursor-pointer select-none items-start gap-2.5 border border-line p-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={rosterAck}
              onChange={(event) => setRosterAck(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
            />
            <span>I confirm the material, approved artwork, products, roster, sizes, service level, date, and subtotal above are correct.</span>
          </label>

          <div className="mt-4">
            <DeliveryTimingAcknowledgment
              id="direct-order-delivery-timing-ack"
              checked={deliveryAck}
              onChange={setDeliveryAck}
            />
          </div>

          {status === "error" && <p className="mt-3 text-sm text-brand">{message}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!rosterAck || !deliveryAck || status === "sending"}
              className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-6 py-3 disabled:opacity-50"
            >
              {status === "sending" ? "Submitting…" : "Accept & submit order"}
            </button>
            <button
              type="button"
              onClick={() => setFlowStep("roster")}
              disabled={status === "sending"}
              className="clip-slant border border-line text-foreground display px-5 py-3 hover:bg-foreground/5 disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </section>
      )}

      {/* Player self-entry link mode */}
      {mode === "link" && flowStep === "details" && (
        <div>
          {!links ? (
            <>
              {status === "error" && <p className="text-sm text-brand mb-3">{message}</p>}
              <button onClick={createLink} disabled={status === "sending" || !teamDetailsComplete || !orderSetupComplete} className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors disabled:opacity-60">
                {status === "sending" ? "Creating…" : "Create Roster Link"}
              </button>
              <p className="text-xs text-muted mt-3">Your team and gear choices are saved to this roster link for players to use.</p>
            </>
          ) : (
            <div className="space-y-5">
              <div className="bg-steel border border-line p-5">
                <h3 className="display text-lg text-foreground">Share with your players</h3>
                <p className="text-sm text-muted mt-1">Each player opens this and enters their own name, number, and sizes.</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={links.shareUrl} className="flex-1 bg-ink border border-line px-3 py-2.5 text-sm text-foreground/80" />
                  <button onClick={() => copyLink(links.shareUrl, "share")} className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark">{copied === "share" ? "Copied ✓" : "Copy"}</button>
                </div>
              </div>
              <div className="bg-steel border border-line p-5">
                <h3 className="display text-lg text-foreground">Your manage link (keep private)</h3>
                <p className="text-sm text-muted mt-1">Bookmark this - review the roster as it fills and submit when ready.</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={links.manageUrl} className="flex-1 bg-ink border border-line px-3 py-2.5 text-sm text-foreground/80" />
                  <a href={links.manageUrl} className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark grid place-items-center">Open</a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
