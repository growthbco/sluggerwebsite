import "server-only";
import { randomUUID, createSign } from "node:crypto";

// Wise payouts: pay the overseas print vendor (Bonans / Zaigham Ali, PKR) from
// our Wise USD balance. Every value below is overridable by env; the defaults
// are this account's real ids (safe, non-secret references - the token and the
// SCA private key are the only secrets, and they live in env only).
const ENV = process.env.WISE_API_ENV || "production";
const BASE = ENV === "sandbox" ? "https://api.wise-sandbox.com" : "https://api.wise.com";
const TOKEN = process.env.WISE_API_TOKEN;
const PROFILE_ID = process.env.WISE_PROFILE_ID || "133827927"; // Slugger Athletics business profile
const DESIGNER_ACCOUNT_ID = Number(process.env.WISE_DESIGNER_ACCOUNT_ID || "1545548356"); // Zaigham Ali, PKR
const TARGET_CURRENCY = process.env.WISE_TARGET_CURRENCY || "PKR";
// Hard ceiling: any single payout over this must be sent by hand in the Wise
// app. Guards against a fat-finger / bad-data payout going out on one click.
export const WISE_MAX_PAYOUT_CENTS = Number(process.env.WISE_MAX_PAYOUT_CENTS || "100000"); // $1,000

export function wiseEnabled(): boolean {
  return Boolean(TOKEN);
}
export function wisePayoutCapCents(): number {
  return WISE_MAX_PAYOUT_CENTS;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...extra };
}

// Wise Strong Customer Authentication over API: a funding call returns 403 with
// a one-time token in the `x-2fa-approval` header; we sign it with our private
// key (RSA-SHA256, base64) and retry with the token + signature. The public key
// half is registered in the Wise account.
function signOneTimeToken(ott: string): string | null {
  const b64 = process.env.WISE_SCA_PRIVATE_KEY;
  if (!b64) return null;
  try {
    const pem = Buffer.from(b64, "base64").toString("utf8");
    const signer = createSign("RSA-SHA256");
    signer.update(ott);
    signer.end();
    return signer.sign(pem, "base64");
  } catch {
    return null;
  }
}

function wiseError(body: unknown): string {
  const b = body as { errors?: { message: string }[]; message?: string } | null;
  if (!b) return "unknown Wise error";
  if (Array.isArray(b.errors) && b.errors.length) return b.errors.map((e) => e.message).join("; ");
  return b.message || String(JSON.stringify(body)).slice(0, 200);
}

type PaymentOption = {
  payIn: string;
  payOut: string;
  disabled?: boolean;
  disabledReason?: { message?: string };
  targetAmount?: number;
  fee?: { total?: number };
};

async function createQuote(sourceAmount: number) {
  const res = await fetch(`${BASE}/v3/profiles/${PROFILE_ID}/quotes`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      sourceCurrency: "USD",
      targetCurrency: TARGET_CURRENCY,
      sourceAmount,
      targetAccount: DESIGNER_ACCOUNT_ID,
      payOut: "BANK_TRANSFER",
      preferredPayIn: "BALANCE",
    }),
  });
  const quote = await res.json();
  return { res, quote };
}

function balanceOption(quote: { paymentOptions?: PaymentOption[] }): PaymentOption | undefined {
  return (quote.paymentOptions || []).find((o) => o.payIn === "BALANCE" && o.payOut === "BANK_TRANSFER");
}

export type PayoutPreview =
  | { ok: true; targetAmount: number; feeUsdCents: number; rate: number; balanceReady: boolean; note?: string }
  | { ok: false; error: string };

/** Quote-only preview (NO money moves) for showing the confirm dialog. */
export async function previewPayout(amountCents: number): Promise<PayoutPreview> {
  if (!wiseEnabled()) return { ok: false, error: "Wise is not configured." };
  const { res, quote } = await createQuote(amountCents / 100);
  if (!res.ok) return { ok: false, error: wiseError(quote) };
  const opt = balanceOption(quote);
  return {
    ok: true,
    targetAmount: opt?.targetAmount ?? 0,
    feeUsdCents: Math.round((opt?.fee?.total ?? 0) * 100),
    rate: quote.rate,
    balanceReady: !opt?.disabled,
    note: opt?.disabled ? opt.disabledReason?.message : undefined,
  };
}

export type PayoutResult =
  | { ok: true; transferId: number; status: string; targetAmount: number; targetCurrency: string; feeUsdCents: number; rate: number }
  | { ok: false; error: string };

/** Full payout: quote -> create transfer -> fund from balance (with SCA).
 *  MONEY MOVES at the funding step only. Caller must gate on the cap + invoice
 *  status BEFORE calling this. */
export async function payDesigner(opts: { amountCents: number; reference: string }): Promise<PayoutResult> {
  if (!wiseEnabled()) return { ok: false, error: "Wise is not configured (no API token)." };
  if (opts.amountCents <= 0) return { ok: false, error: "Amount must be positive." };
  if (opts.amountCents > WISE_MAX_PAYOUT_CENTS) {
    return { ok: false, error: `Over the $${(WISE_MAX_PAYOUT_CENTS / 100).toFixed(0)} Wise limit - pay this one manually in the Wise app.` };
  }

  // 1. Quote
  const { res: qres, quote } = await createQuote(opts.amountCents / 100);
  if (!qres.ok) return { ok: false, error: `Quote failed: ${wiseError(quote)}` };
  const opt = balanceOption(quote);
  if (opt?.disabled) {
    return { ok: false, error: opt.disabledReason?.message || "Your Wise USD balance can't cover this - top it up in Wise and try again." };
  }

  // 2. Create the transfer (no money yet)
  const reference = opts.reference.replace(/[^A-Za-z0-9 .-]/g, "").slice(0, 24) || "Slugger";
  const tres = await fetch(`${BASE}/v1/transfers`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      targetAccount: DESIGNER_ACCOUNT_ID,
      quoteUuid: quote.id,
      customerTransactionId: randomUUID(),
      details: { reference },
    }),
  });
  const transfer = await tres.json();
  if (!tres.ok) return { ok: false, error: `Transfer failed: ${wiseError(transfer)}` };

  // 3. Fund from balance (MONEY MOVES HERE) - with SCA challenge/response
  const fund = (sca: Record<string, string> = {}) =>
    fetch(`${BASE}/v3/profiles/${PROFILE_ID}/transfers/${transfer.id}/payments`, {
      method: "POST",
      headers: headers(sca),
      body: JSON.stringify({ type: "BALANCE" }),
    });

  let fres = await fund();
  const ott = fres.headers.get("x-2fa-approval");
  if (fres.status === 403 && ott) {
    const signature = signOneTimeToken(ott);
    if (!signature) {
      return { ok: false, error: "Wise requires 2FA signing, but the SCA private key isn't set up. Register the public key in Wise and set WISE_SCA_PRIVATE_KEY." };
    }
    fres = await fund({ "x-2fa-approval": ott, "X-Signature": signature });
  }
  const funded = await fres.json().catch(() => ({}));
  if (!fres.ok) return { ok: false, error: `Funding failed: ${wiseError(funded)}` };

  return {
    ok: true,
    transferId: transfer.id,
    status: (funded.status?.value ?? funded.status ?? "processing") as string,
    targetAmount: opt?.targetAmount ?? 0,
    targetCurrency: TARGET_CURRENCY,
    feeUsdCents: Math.round((opt?.fee?.total ?? 0) * 100),
    rate: quote.rate,
  };
}
