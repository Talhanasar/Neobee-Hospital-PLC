'use client';

import * as React from 'react';

/** Deep-linked About section handler: scrolls the requested section
    into view and flashes it briefly (honey tint) once on mount. The
    class is applied straight to the section node, so the server page
    needs no shared state. */
export default function SecFlash({ sec, valid }: { sec: string | undefined; valid: readonly string[] }) {
  React.useEffect(() => {
    if (!sec || !valid.includes(sec)) return;
    const id = `about-${sec}`;
    const t1 = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('sec-flash');
      const t2 = window.setTimeout(() => el.classList.remove('sec-flash'), 2400);
      return () => window.clearTimeout(t2);
    }, 400);
    return () => window.clearTimeout(t1);
    // Runs once per mount; sec/valid are stable for the page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
