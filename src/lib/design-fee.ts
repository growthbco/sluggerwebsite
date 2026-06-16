// Promo flag: when true, the $35 design fee is waived for EVERYONE (campaign
// mode) — no Stripe charge, the designer pipeline kicks in immediately on
// submit. Flip via env NEXT_PUBLIC_DESIGN_FEE_WAIVED (read on both client and
// server). Set to "false"/unset to restore normal $35-to-start behavior. The
// returning-customer auto-waiver works regardless of this flag.
export const DESIGN_FEE_WAIVED = process.env.NEXT_PUBLIC_DESIGN_FEE_WAIVED === "true";
