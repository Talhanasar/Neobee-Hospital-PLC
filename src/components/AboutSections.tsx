"use client";

/**
 * Five about sections: purpose, location, governance, 50-entrepreneur model, how-to-deposit.
 * Copy is verbatim from the approved prototype (with the spec's bolded callouts).
 *
 * The Bangla phrase in the "purpose" section is intentionally rendered in a
 * dedicated `.font-bn` span so the Noto Sans Bengali fallback applies.
 */
export default function AboutSections() {
  return (
    <div className="prose-section">
      <SectionHeading>Our purpose</SectionHeading>
      <p>
        Commercial, yet humane —{" "}
        <span className="font-bn">কমার্শিয়াল কিন্তু মানবিক।</span> To serve the
        country and its people with whatever means Allah has granted us.
      </p>

      <SectionHeading>Location</SectionHeading>
      <p>
        Two sites have been shortlisted for the hospital — at{" "}
        <b>Panchlaish</b> and <b>beside Chattogram Medical College</b>. Site
        selection is near-final; the project will proceed at one of the two, In
        sha Allah.
      </p>

      <SectionHeading>Governance</SectionHeading>
      <p>
        Discussions with doctors are ongoing on a <b>60:40 basis</b>, with
        doctors being added through continuous exchange of views. The hospital
        will be governed by a combined board of doctors and civilian
        entrepreneurs. Qualified entrepreneurs will be given a place on the
        management committee, with a special salary structure for directors
        until inauguration.
      </p>

      <SectionHeading>The 50-entrepreneur model</SectionHeading>
      <p>
        The project will onboard <b>50 founding partners/entrepreneurs</b>.
        Entry is <b>৳20,00,000</b> (self-invested or raised through
        shareholders), used for the registered bayna of the land. Entrepreneurs
        must be honest and responsible.
      </p>
      <p>
        <b>Entrepreneur benefits:</b> a planned monthly honorarium from
        construction through inauguration; eligibility for the management
        committee; and a <b>৳20,000 share incentive per share</b> — ৳2,00,000
        of bonus shares on a 10-share subscription.
      </p>

      <SectionHeading>How to deposit</SectionHeading>
      <p>
        A bank account in the name of <b>NEOBEE</b> is being opened. Deposits
        are made to the institution&apos;s account only. On deposit, every
        shareholder immediately receives a <b>unique ID</b>, a{" "}
        <b>digital money receipt</b>, and <b>website access</b> — digital
        services delivered in partnership with <b>NeoTech</b>.
      </p>
    </div>
  );
}

/**
 * Small heading with an inline hex bullet accent. Echoes the brand mark
 * without an icon-library dependency.
 */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-6 mb-2.5 flex items-center gap-2.5 font-display text-[16px] font-bold tracking-tight text-ink first:mt-0">
      <svg
        viewBox="0 0 14 16"
        aria-hidden="true"
        className="h-3.5 w-3 flex-none text-honey"
      >
        <polygon
          points="7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5"
          fill="currentColor"
        />
      </svg>
      <span>{children}</span>
    </h2>
  );
}
