"use client";

import { useActionState, useState } from "react";
import { ITEM_TYPES } from "@/lib/order-items";
import {
  createManualOrderAction,
  type ManualOrderActionState,
} from "@/app/admin/team-order/new/actions";

const INITIAL_STATE: ManualOrderActionState = {};
const INPUT = "mt-1 w-full border border-line bg-ink px-3 py-2.5 text-foreground focus:border-brand focus:outline-none";

function ErrorText({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <p className="mt-1 text-xs text-red-400">{errors[0]}</p> : null;
}

export function AdminManualOrderForm() {
  const [state, action, pending] = useActionState(createManualOrderAction, INITIAL_STATE);
  const [serviceLevel, setServiceLevel] = useState("standard");
  const [promised, setPromised] = useState(false);

  return (
    <form action={action} className="space-y-6">
      {state.error ? (
        <div role="alert" className="border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {state.error}
        </div>
      ) : null}

      <section className="rounded-xl border border-line bg-steel p-5">
        <h2 className="display text-xl text-foreground">Customer and order</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted">Team name <span className="text-brand">*</span>
            <input name="teamName" required className={INPUT} />
            <ErrorText errors={state.fieldErrors?.teamName} />
          </label>
          <label className="text-sm text-muted">Contact name <span className="text-brand">*</span>
            <input name="contactName" required className={INPUT} />
            <ErrorText errors={state.fieldErrors?.contactName} />
          </label>
          <label className="text-sm text-muted">Contact email <span className="text-brand">*</span>
            <input name="contactEmail" type="email" required className={INPUT} />
            <ErrorText errors={state.fieldErrors?.contactEmail} />
          </label>
          <label className="text-sm text-muted">Contact phone
            <input name="contactPhone" type="tel" className={INPUT} />
          </label>
          <label className="text-sm text-muted">Sport
            <input name="sport" className={INPUT} placeholder="Baseball, softball, cheer…" />
          </label>
          <label className="flex items-center gap-2 self-end border border-line px-3 py-2.5 text-sm text-foreground">
            <input name="localPickup" type="checkbox" className="accent-brand" />
            Local pickup in Ocala
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm text-muted">Items <span className="text-brand">*</span></legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ITEM_TYPES.map((item) => (
              <label key={item.key} className="flex items-center gap-2 border border-line px-3 py-2 text-sm text-foreground">
                <input name="items" value={item.key} type="checkbox" defaultChecked={item.key === "jersey"} className="accent-brand" />
                {item.label}
              </label>
            ))}
          </div>
          <ErrorText errors={state.fieldErrors?.items} />
        </fieldset>
      </section>

      <section className="rounded-xl border-2 border-brand/60 bg-brand/[0.05] p-5">
        <p className="text-xs display uppercase tracking-[0.16em] text-brand">Required for every manual order</p>
        <h2 className="display text-xl text-foreground mt-1">Timeline facts</h2>
        <p className="mt-1 text-sm text-muted">These fields control what the admin timeline says. The requested date is not treated as a promise.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted">Production start date <span className="text-brand">*</span>
            <input name="productionStartDate" type="date" required className={INPUT} />
            <p className="mt-1 text-xs text-muted">The date you consider approval, roster, and payment requirements satisfied.</p>
            <ErrorText errors={state.fieldErrors?.productionStartDate} />
          </label>
          <label className="text-sm text-muted">Service level <span className="text-brand">*</span>
            <select name="serviceLevel" required value={serviceLevel} onChange={(event) => setServiceLevel(event.target.value)} className={INPUT}>
              <option value="standard">Standard · 3 weeks</option>
              <option value="rush">Rush · 2 weeks · $100</option>
              <option value="priority">Priority · 1 week · manual premium</option>
            </select>
            <ErrorText errors={state.fieldErrors?.serviceLevel} />
          </label>
          <label className="text-sm text-muted">Customer requested in-hand date <span className="text-brand">*</span>
            <input name="requestedInHandDate" type="date" required className={INPUT} />
            <ErrorText errors={state.fieldErrors?.requestedInHandDate} />
          </label>
          {serviceLevel === "priority" ? (
            <label className="text-sm text-muted">One-week Priority premium <span className="text-brand">*</span>
              <span className="mt-1 flex border border-line bg-ink focus-within:border-brand">
                <span className="px-3 py-2.5 text-muted">$</span>
                <input name="priorityFeeDollars" type="number" min="1" step="0.01" required className="w-full bg-transparent py-2.5 pr-3 text-foreground focus:outline-none" />
              </span>
              <ErrorText errors={state.fieldErrors?.priorityFeeCents} />
            </label>
          ) : (
            <input name="priorityFeeDollars" type="hidden" value="0" />
          )}
          <label className="text-sm text-muted">Did you promise the customer a date? <span className="text-brand">*</span>
            <select name="customerDatePromised" required value={promised ? "yes" : "no"} onChange={(event) => setPromised(event.target.value === "yes")} className={INPUT}>
              <option value="no">No · requested date only</option>
              <option value="yes">Yes · I made a commitment</option>
            </select>
          </label>
          {promised ? (
            <label className="text-sm text-muted">Date promised to customer <span className="text-brand">*</span>
              <input name="promisedInHandDate" type="date" required className={INPUT} />
              <ErrorText errors={state.fieldErrors?.promisedInHandDate} />
            </label>
          ) : (
            <input name="promisedInHandDate" type="hidden" value="" />
          )}
        </div>
      </section>

      <label className="block text-sm text-muted">Internal order notes
        <textarea name="specialInstructions" rows={4} className={INPUT} placeholder="What was ordered, payment context, artwork location, or anything this manual entry bypassed…" />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="max-w-xl text-xs text-muted">The order will be marked in production and labeled Manual entry. You can add its roster, pricing, artwork, and payment details from the order page.</p>
        <button type="submit" disabled={pending} className="clip-slant bg-brand px-6 py-3 display text-on-brand hover:bg-brand-dark disabled:opacity-50">
          {pending ? "Creating…" : "Create manual order"}
        </button>
      </div>
    </form>
  );
}
