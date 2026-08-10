import LegalPageLayout from './LegalPageLayout';

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" updated="August 10, 2026">
      <p>
        These terms govern your use of MySchoolPortal, a school management platform. By creating an account
        or using the platform, you agree to these terms on behalf of yourself and, if you're signing up a
        school, on behalf of that school.
      </p>

      <Section title="1. The service">
        <p>
          MySchoolPortal provides tools for schools to manage students, classes, staff, attendance, exam
          results, fees, timetables, homework, and announcements. It is administrative software — it does not
          process payments directly; fee payment happens between the school and parent through the channels
          (Mobile Money, bank transfer) the school displays, and the platform simply records what's reported.
        </p>
      </Section>

      <Section title="2. Accounts">
        <p>
          Whoever creates a school account must be authorized to act on that school's behalf. You're
          responsible for the accuracy of the information you enter and for keeping your login credentials
          confidential. Staff and guardian accounts created by a school admin come with a temporary password
          that must be changed on first login.
        </p>
      </Section>

      <Section title="3. Subscriptions and billing">
        <ul className="list-disc pl-5 space-y-1">
          <li>New schools get a 14-day free trial with no payment required upfront.</li>
          <li>After the trial, subscriptions are billed on a recurring monthly basis.</li>
          <li>
            We'll email a reminder a few days before your billing period ends. If payment isn't arranged by
            the end of that period, the account is marked past due and you'll have a 7-day grace period to
            pay before sign-in is disabled.
          </li>
          <li>
            A locked account can be restored once payment is confirmed with your platform administrator.
          </li>
          <li>You can cancel at any time; your data remains accessible for the remainder of the paid period.</li>
        </ul>
      </Section>

      <Section title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use the platform for any unlawful purpose, or to store data you don't have the right to store.</li>
          <li>Attempt to access another school's data, or probe/bypass the platform's security or tenant isolation.</li>
          <li>Scrape, resell, or redistribute the platform or the data within it outside its intended use.</li>
          <li>Use the demo account for anything other than evaluating the platform.</li>
        </ul>
      </Section>

      <Section title="5. Your data">
        <p>
          Your school owns the data it enters into MySchoolPortal. We process it only to provide the service,
          as described in our{' '}
          <a href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>
          . You're responsible for having the appropriate basis (e.g. parental awareness) to store student and
          guardian information in the system.
        </p>
      </Section>

      <Section title="6. Availability and changes">
        <p>
          We aim to keep MySchoolPortal available and reliable, but the service is provided "as is" without
          guarantee of uninterrupted availability. Features may be added, changed, or removed over time; we'll
          make a reasonable effort to communicate significant changes in advance.
        </p>
      </Section>

      <Section title="7. Limitation of liability">
        <p>
          To the fullest extent permitted by law, MySchoolPortal is not liable for indirect, incidental, or
          consequential damages arising from use of the platform, including data loss, service interruption,
          or disputes over fee payments made outside the platform. Nothing here limits liability that can't be
          limited under applicable law.
        </p>
      </Section>

      <Section title="8. Suspension and termination">
        <p>
          We may suspend or terminate an account that violates these terms, engages in abuse, or has an
          unresolved billing issue beyond the grace period described above. A school can request closure of
          its account and deletion of its data at any time by contacting us.
        </p>
      </Section>

      <Section title="9. Governing law">
        <p>These terms are governed by the laws of Ghana.</p>
      </Section>

      <Section title="10. Changes to these terms">
        <p>
          If we make material changes to these terms, we'll update the date at the top of this page and, for
          significant changes, notify school admins by email.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
