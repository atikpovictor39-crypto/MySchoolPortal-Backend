import LegalPageLayout from './LegalPageLayout';

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="August 10, 2026">
      <p>
        MySchoolPortal ("we", "us") is a school management platform for schools in Ghana and beyond. This
        policy explains what information we collect through the platform, why, and how it's protected. It
        applies to school administrators, teachers, and parents/guardians who use MySchoolPortal, and to the
        information schools enter about their students.
      </p>

      <Section title="Information we collect">
        <p>We collect only what's needed to run the school management features you use:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>School accounts:</strong> school name, contact email and phone, address, logo, and the
            Mobile Money/bank details a school chooses to display to parents for fee payment.
          </li>
          <li>
            <strong>Staff accounts (admins, teachers):</strong> name, email, phone, and a securely hashed
            password — we never store passwords in plain text.
          </li>
          <li>
            <strong>Parent/guardian accounts:</strong> name, email, phone, and relationship to the student(s)
            they're linked to.
          </li>
          <li>
            <strong>Student records:</strong> entered by school staff — name, date of birth, gender,
            admission number, class, attendance, exam results, and homework/timetable assignments. Students
            do not sign themselves up; this information is provided and managed by the school.
          </li>
          <li>
            <strong>Fee and payment records:</strong> invoice amounts, due dates, and payment claims parents
            submit (amount, method, date, reference). MySchoolPortal does not process card payments and never
            collects card numbers, bank login credentials, or Mobile Money PINs — payments happen directly
            between parent and school, and the platform only records what either side reports.
          </li>
          <li>
            <strong>Usage information:</strong> login timestamps and a log of key actions (e.g. a payment
            recorded, a leave request approved) for the school's own audit trail.
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul className="list-disc pl-5 space-y-1">
          <li>To provide the features you sign up for — attendance, results, fees, timetables, and so on.</li>
          <li>
            To send account-related emails: welcome messages, email verification codes, password resets, and
            subscription billing notices.
          </li>
          <li>To keep the platform secure — detecting suspicious activity, enforcing tenant data isolation.</li>
          <li>To respond to support requests sent to the contact email below.</li>
        </ul>
        <p>We do not sell personal information, and we do not use it for advertising.</p>
      </Section>

      <Section title="Who can see what">
        <p>
          Every school's data is isolated from every other school's — school staff only ever see their own
          school's records. Within a school: admins and teachers see student, class, and fee data relevant to
          their role; parents only see information about their own linked children, never other families'.
        </p>
      </Section>

      <Section title="Where data is stored">
        <p>
          Data is stored with Supabase (PostgreSQL hosted on AWS infrastructure) and the application itself
          runs on Vercel. This means data may be processed and stored outside Ghana. We use industry-standard
          providers with encryption in transit (HTTPS) and at rest.
        </p>
      </Section>

      <Section title="Third-party services we use">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Supabase</strong> — database hosting.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting.
          </li>
          <li>
            <strong>Resend</strong> — sends transactional emails (verification codes, password resets, billing
            notices) on our behalf.
          </li>
        </ul>
        <p>We don't use third-party advertising or analytics trackers on MySchoolPortal.</p>
      </Section>

      <Section title="Data retention">
        <p>
          We keep account and student data for as long as the school's account is active. If a school closes
          its account or asks us to delete its data, we'll do so within a reasonable time, except where we're
          required to keep certain records (e.g. billing history) for legal or accounting purposes.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can ask us to access, correct, or delete the personal information we hold about you or your
          school by emailing the address below. School admins can also directly edit or remove most records
          (students, staff, fees) from within the portal itself.
        </p>
      </Section>

      <Section title="Children's information">
        <p>
          MySchoolPortal is used by schools and parents to manage records about students, some of whom are
          children. Student information is provided and controlled by the school and, where linked, the
          student's parent/guardian — students do not create their own accounts or submit their own data.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we make material changes to this policy, we'll update the date at the top of this page and, for
          significant changes, notify school admins by email.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
