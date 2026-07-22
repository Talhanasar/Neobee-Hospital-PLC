"use client";

import { useState, type FormEvent } from "react";

/**
 * Public verify form. Submits as a plain GET so the result is server-rendered
 * at `/verify?q=…` and the URL is shareable/bookmarkable. The page component
 * reads `q` from the search params and runs the actual DB lookup — this
 * component is intentionally dumb and has no direct DB access.
 *
 *   - Controlled input so we can uppercase the value before navigating
 *     (the prototype's `extractCode` uppercases its input).
 *   - On submit we strip whitespace, then `router.push` to the search-param
 *     URL so the resulting page is fully shareable.
 */
export default function VerifyForm({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState<string>(defaultValue);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    // Use `q` as the canonical param name; `code` is also accepted by the
    // page (per spec) but `q` is what the form posts.
    const url = `/verify?q=${encodeURIComponent(trimmed)}`;
    // Full navigation (not router.push) so the URL bar reflects the lookup
    // and the result is shareable / reloadable.
    window.location.assign(url);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2.5 sm:flex-row"
      autoComplete="off"
    >
      <label htmlFor="verify-q" className="sr-only">
        Verification code or unique ID
      </label>
      <input
        id="verify-q"
        name="q"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="NB-XXXXXX or NEO-0001"
        autoCapitalize="characters"
        spellCheck={false}
        className="flex-1 rounded-lg border border-line bg-paper px-3.5 py-3 font-mono text-[15px] tracking-[0.06em] text-ink placeholder:text-ink-soft/70 focus:border-honey focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-honey"
      />
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 font-display text-[14px] font-bold tracking-tight text-paper shadow-sm transition-colors hover:bg-[#100E07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
      >
        Check
      </button>
    </form>
  );
}
