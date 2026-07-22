"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

/**
 * Admin filter bar. Drives URL searchParams (so the server component
 * re-queries the DB on every change) instead of holding filter state
 * client-side — that way the table always renders from a fresh DB read
 * and links are shareable / bookmarkable.
 *
 * The category / status / deleted selects fire on change (server
 * roundtrip); the search input is debounced ~300ms so typing doesn't
 * spam the DB.
 *
 * The search input is uncontrolled (`defaultValue`) and re-mounted via
 * `key={initialSearch}` whenever the URL changes externally, so an
 * outside reset (e.g. another component clearing the filter) flows
 * back into the input without us holding a stale local copy.
 *
 * Filter default-values that collapse back to "no param in URL":
 *   - status === "ALL"   → ?status= omitted
 *   - deleted === "active" → ?deleted= omitted (active is the default)
 * Anything else is serialized as ?key=value.
 */
export default function AdminFilters({
  initialSearch,
  initialCategory,
  initialStatus,
  initialDeleted,
}: {
  initialSearch: string;
  initialCategory: string;
  initialStatus: string;
  initialDeleted: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Debounce: keep a ref to the latest typed value + a timer id so a
  // fast typer doesn't fire one roundtrip per keystroke.
  const latestRef = useRef(initialSearch);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending push if the component unmounts mid-debounce.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function pushParams(next: {
    search?: string;
    category?: string;
    status?: string;
    deleted?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      // Collapse the "no-op" values back to an absent URL param so the
      // dashboard URL stays clean for the common cases.
      const isDefault =
        !v ||
        v === "" ||
        // existing pattern — these selects use "ALL" as the no-filter sentinel
        (k !== "deleted" && v === "ALL") ||
        // the deleted select uses "active" as the default (no-filter) sentinel
        (k === "deleted" && v === "active");
      if (isDefault) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function onSearchChange(value: string) {
    latestRef.current = value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // No-op if the URL already reflects this value (avoids redundant
      // server roundtrips when the input is re-mounted via key={...}).
      if (latestRef.current === initialSearch) return;
      pushParams({ search: latestRef.current });
    }, 300);
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <input
          key={`search-${initialSearch}`}
          type="search"
          name="search"
          defaultValue={initialSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, ID or code…"
          aria-label="Search investments"
          className="block w-full rounded-lg border border-line bg-paper px-3 py-2.5 pl-10 font-sans text-[14px] text-ink shadow-xs placeholder:text-ink-soft/70 transition-colors focus:border-honey focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft"
        >
          <circle
            cx="9"
            cy="9"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M14 14l4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <select
        name="category"
        key={`category-${initialCategory}`}
        defaultValue={initialCategory}
        onChange={(e) => pushParams({ category: e.target.value })}
        aria-label="Filter by category"
        className="rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink shadow-xs transition-colors focus:border-honey focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
      >
        <option value="ALL">All categories</option>
        <option value="SHAREHOLDER">Shareholder</option>
        <option value="PREMIUM">Premium</option>
        <option value="DIRECTOR">Director</option>
      </select>

      <select
        name="status"
        key={`status-${initialStatus}`}
        defaultValue={initialStatus}
        onChange={(e) => pushParams({ status: e.target.value })}
        aria-label="Filter by status"
        className="rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink shadow-xs transition-colors focus:border-honey focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
      >
        <option value="ALL">All statuses</option>
        <option value="PENDING">Pending</option>
        <option value="CONFIRMED">Confirmed</option>
      </select>

      <select
        name="deleted"
        key={`deleted-${initialDeleted}`}
        defaultValue={initialDeleted}
        onChange={(e) => pushParams({ deleted: e.target.value })}
        aria-label="Filter by deleted state"
        className="rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink shadow-xs transition-colors focus:border-honey focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
      >
        <option value="active">Active</option>
        <option value="deleted">Deleted</option>
        <option value="all">All</option>
      </select>
    </div>
  );
}
