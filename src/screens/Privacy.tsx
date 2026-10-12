import { Link } from 'react-router-dom';

/** Plain-language privacy page. Reachable signed in or out at /privacy. */
export default function Privacy() {
  return (
    <div className="app">
      <div className="screen no-tabs stack" style={{ gap: 14 }}>
        <div className="head">
          <span className="lbl brass">Hold the Line</span>
          <h1 className="title">Privacy</h1>
          <span className="xs muted">Last updated October 2026</span>
        </div>

        <Section title="What we keep">
          Your email, the name and phone number you enter, your sobriety dates, check-ins, pledges, evening
          debriefs, workbook answers, urges, workout notes, and your settings. If you turn on push, we keep the
          address your phone gives us for notifications. If you connect a calendar, we keep a sign-in token for it,
          encrypted.
        </Section>
        <Section title="Who can see it">
          Only you — unless you link a sponsor. A sponsor sees only what your sponsor permissions allow (streaks,
          check-ins, milestones, and journal notes only if you turn that on). You can change or revoke this any
          time under Sponsor.
        </Section>
        <Section title="Usage and errors">
          We record simple usage events (for example “checked in” or “opened a field brief”) and app errors, tied
          to your account, so the app can be fixed and improved. We don't sell data, run ads, or share it with
          anyone for marketing.
        </Section>
        <Section title="Where it lives">
          Data is stored with Supabase (database and sign-in) and the app is hosted on Netlify. Live scores come
          from a public sports feed and receive nothing about you. A nightly backup is kept privately for 30 days.
        </Section>
        <Section title="Your controls">
          Export everything as a CSV from Settings → Export my data. Delete your account from Settings → Delete
          account; that removes your data right away, and it drops out of backups within 30 days.
        </Section>
        <Section title="Not medical care">
          Hold the Line is a support tool, not treatment. If you're in danger or crisis, call or text 988
          (Suicide &amp; Crisis Lifeline) or 911.
        </Section>
        <Section title="Questions">
          Email <a href="mailto:caseyob24@gmail.com">caseyob24@gmail.com</a>.
        </Section>

        <Link className="btn dashed full" to="/">Back</Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ gap: 6 }}>
      <span className="lbl">{title}</span>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{children}</p>
    </section>
  );
}
