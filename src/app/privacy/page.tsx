import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — School Manager",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to home
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-zinc-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: [insert date before publishing]</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-700">
        <p>
          <strong>[Insert legal entity/operator name]</strong> (&quot;we&quot;, &quot;us&quot;)
          operates School Manager, a school management platform used by schools
          (&quot;Customer Schools&quot;) to manage students, staff, fees, and communication with
          parents. This policy explains what data we process, why, and the rights available to
          you under the Nigeria Data Protection Act 2023 (NDPA) and the Nigeria Data Protection
          Commission&apos;s (NDPC) General Application and Implementation Directive.
        </p>

        <Section title="Who this applies to">
          <p>This policy covers three groups of people whose data passes through the platform:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>School staff</strong> (proprietors, delegated admins, teachers, and
              non-teaching staff) who hold a login to manage their school.
            </li>
            <li>
              <strong>Parents/guardians</strong> who hold a parent portal login, or who receive
              SMS/WhatsApp reminders and payment links without one.
            </li>
            <li>
              <strong>Students</strong>, whose records (attendance, results, fees, behavior,
              documents) are entered and managed by their school&apos;s staff.
            </li>
          </ul>
        </Section>

        <Section title="Our role vs. the school's role">
          <p>
            Each Customer School is the <strong>data controller</strong> for its own students&apos;,
            parents&apos;, and staff&apos;s personal data — they decide what to record and who has
            access. We act as the <strong>data processor</strong>: we provide the platform each
            school uses to store and manage that data, under instructions from that school. If you
            are a parent or student, questions about your specific records should go to your
            child&apos;s school in the first instance; we do not decide what a school records
            about you.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Account data</strong>: name, email, phone number, and password (hashed by our
              authentication provider — we never see or store plaintext passwords).
            </li>
            <li>
              <strong>Student records</strong>: name, date of birth, class, parent/guardian contact
              details, attendance, academic results, behavior incidents, custom fields a school
              defines, and any documents (e.g. birth certificates, medical records) a school
              chooses to upload.
            </li>
            <li>
              <strong>Financial records</strong>: fee amounts, payment history, and — for online
              payments — a transaction reference from our payment processor (we do not store card
              numbers ourselves).
            </li>
            <li>
              <strong>Communications</strong>: the content of SMS/WhatsApp reminders and in-app
              notices sent through the platform.
            </li>
            <li>
              <strong>Usage data</strong>: basic technical logs (sign-in timestamps, error logs)
              needed to operate and secure the platform.
            </li>
          </ul>
        </Section>

        <Section title="Why we process it">
          <p>
            Solely to provide the platform&apos;s functionality to the school that entered the
            data: enrolling and tracking students, recording attendance and results, billing and
            collecting fees, sending the communications a school requests, and securing accounts.
            We do not sell personal data, and we do not use student or parent data for advertising.
          </p>
        </Section>

        <Section title="Third parties we share data with">
          <p>Limited data is shared with the specific service that needs it to do its job:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase</strong> — our database and authentication provider. All school
              data is stored here, isolated per school by database-level access rules so one
              school can never see another&apos;s data.
            </li>
            <li>
              <strong>Paystack</strong> — processes online fee payments. Payment card details are
              handled entirely by Paystack; we only receive a payment reference and status.
            </li>
            <li>
              <strong>SMSLive247</strong> — delivers SMS reminders on a school&apos;s behalf. Only the
              recipient&apos;s phone number and message text are shared, per message sent.
            </li>
            <li>
              <strong>An AI provider (via OpenRouter)</strong> — powers the optional AI Assistant.
              A staff member&apos;s question and the data their own account can already access may
              be sent to generate a response; this feature is opt-in per query and every response
              is scoped by the same access rules as the rest of the platform.
            </li>
            <li>
              <strong>Vercel</strong> — hosts the application itself.
            </li>
          </ul>
          <p>We do not sell or rent personal data to third parties for their own marketing.</p>
        </Section>

        <Section title="Data retention">
          <p>
            We retain data for as long as a school&apos;s account is active, plus a reasonable
            period after closure to allow data export or legally required recordkeeping. A school
            can request deletion of a student&apos;s or staff member&apos;s records at any time
            through the platform or by contacting us directly.
          </p>
        </Section>

        <Section title="Your rights under the NDPA">
          <p>Subject to verification of identity and coordination with the relevant school, you may:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Request access to the personal data we hold about you.</li>
            <li>Request correction of inaccurate or incomplete data.</li>
            <li>Request erasure or restriction of processing, where applicable.</li>
            <li>Object to certain processing, and request data portability.</li>
            <li>Lodge a complaint with the Nigeria Data Protection Commission (NDPC).</li>
          </ul>
        </Section>

        <Section title="Security">
          <p>
            Access to school data is restricted by database-level row-level security tied to each
            person&apos;s account and role, so a user can only reach the data their role permits.
            Sensitive uploads are stored in access-controlled, non-public storage. We encourage
            every school to use strong passwords and to promptly remove staff accounts that no
            longer need access.
          </p>
        </Section>

        <Section title="Data breach notification">
          <p>
            In the event of a security incident affecting personal data, we will notify affected
            Customer Schools without undue delay, and support them in meeting their own NDPA
            notification obligations to the NDPC and affected individuals where required.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            Questions about this policy, or requests relating to your personal data, can be sent
            to <strong>[insert contact email]</strong>. If your question concerns a specific
            student&apos;s or parent&apos;s records, please contact that student&apos;s school
            directly — they control that data.
          </p>
        </Section>

        <p className="text-xs text-zinc-400">
          This page is a starting template reflecting how the platform technically handles data.
          Have it reviewed by qualified legal counsel before relying on it as your school&apos;s
          or company&apos;s official privacy policy, and fill in the bracketed placeholders above.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
