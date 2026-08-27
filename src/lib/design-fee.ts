// Design is FREE. The old $35 design fee was retired (Aug 2026): with AI
// generation, a mockup is one click, so there's nothing to gate. This constant
// stays exported (many UI spots branch on it) and is permanently true - design
// is always free to start, no Stripe charge, designer pipeline kicks in on
// submit. The env var is no longer read.
export const DESIGN_FEE_WAIVED = true;
