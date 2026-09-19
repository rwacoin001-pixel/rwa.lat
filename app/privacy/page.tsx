import type { Metadata } from 'next'
import LegalPage, { Section } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy — RWA.LAT',
  description: 'How RWA.LAT collects, uses, stores, and protects personal information.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage badge="Legal" title="Privacy Policy" updated="September 18, 2026">
      <div className="space-y-10 text-sm leading-7 text-[#929aa6] sm:text-[15px]">
        <Section n="1" title="Who We Are">
          <p>
            RWA.LAT (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the RWA.LAT platform available at{' '}
            <a href="https://rwa.lat" className="text-[#2fe6bf] hover:underline">
              https://rwa.lat
            </a>{' '}
            and related applications and services (the &ldquo;Service&rdquo;). This Privacy Policy explains what
            personal information we collect, how we use and share it, and the choices available to you.
          </p>
          <p>
            By creating an account or otherwise using the Service, you acknowledge that you have read and understood
            this Privacy Policy.
          </p>
        </Section>

        <Section n="2" title="Information We Collect">
          <p>We collect the following categories of information:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="text-[#f5f7f8]">Information you provide.</span> Email address (used for account
              registration and sign-in), wallet addresses you connect, a display name if you choose one, community
              content you post, and any communications you send to us (such as support requests).
            </li>
            <li>
              <span className="text-[#f5f7f8]">Identity verification information.</span> Where required by applicable
              law or to access certain features, we — or our third-party verification providers — may collect identity
              data such as your name, date of birth, government-issued identification documents, and biometric
              information (for example, a selfie or liveness check).
            </li>
            <li>
              <span className="text-[#f5f7f8]">Information collected automatically.</span> Log and usage data such as
              IP address, device and browser type, operating system, pages viewed, and interactions with the Service,
              collected through cookies, local storage, and similar technologies.
            </li>
            <li>
              <span className="text-[#f5f7f8]">Blockchain information.</span> Public blockchain data associated with
              wallet addresses you use with the Service. Blockchain records are public by nature — we do not control
              them and cannot delete them.
            </li>
          </ul>
        </Section>

        <Section n="3" title="How We Use Information">
          <ul className="list-disc space-y-2 pl-5">
            <li>To provide, operate, maintain, and improve the Service, including AI-assisted analytics and portfolio features;</li>
            <li>To create and secure your account, authenticate you, and verify your identity where required;</li>
            <li>To detect, prevent, and address fraud, abuse, security incidents, and prohibited activity;</li>
            <li>To comply with applicable legal and regulatory obligations, including Know Your Customer (KYC), anti-money-laundering (AML), and sanctions screening requirements;</li>
            <li>To communicate with you — for example, account verification emails, service notices, security alerts, and responses to your support requests;</li>
            <li>To understand how the Service is used and to develop new features; and</li>
            <li>To create aggregated or de-identified statistics that we may use for analytics and reporting.</li>
          </ul>
        </Section>

        <Section n="4" title="How We Share Information">
          <p>
            We do not sell your personal information. We share information only in the following circumstances:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="text-[#f5f7f8]">Service providers.</span> We use trusted third parties to help operate
              the Service, including cloud hosting and infrastructure providers, managed database providers, email
              delivery providers, identity verification providers (for KYC), cloud storage providers, and analytics
              providers. These providers process information on our behalf under contractual obligations.
            </li>
            <li>
              <span className="text-[#f5f7f8]">Legal requirements.</span> We may disclose information if required to
              do so by law, regulation, legal process, or governmental request, or if we believe disclosure is
              necessary to protect the rights, property, or safety of RWA.LAT, our users, or the public.
            </li>
            <li>
              <span className="text-[#f5f7f8]">Business transfers.</span> If we are involved in a merger, acquisition,
              financing, or sale of assets, information may be transferred as part of that transaction, subject to
              this Privacy Policy.
            </li>
            <li>
              <span className="text-[#f5f7f8]">With your direction or consent.</span> We may share information when you
              instruct us to or otherwise consent to it.
            </li>
          </ul>
        </Section>

        <Section n="5" title="Cookies and Local Storage">
          <p>
            We use cookies and similar technologies (including browser local storage) to keep you signed in
            (essential session cookies), remember your preferences, and understand how the Service is used. Essential
            cookies are required for the Service to function and cannot be disabled through the Service. You can
            control non-essential cookies through your browser settings; blocking essential cookies may prevent you
            from signing in or using core features.
          </p>
        </Section>

        <Section n="6" title="Data Retention">
          <p>
            We retain personal information for as long as necessary to provide the Service, comply with our legal
            obligations, resolve disputes, and enforce our agreements. Identity verification records are kept for the
            periods required by applicable law. When information is no longer needed, we delete it or anonymize it.
          </p>
        </Section>

        <Section n="7" title="Security">
          <p>
            We take reasonable technical and organizational measures designed to protect personal information,
            including encryption in transit and access controls on our systems. However, no method of transmission or
            storage is completely secure, and we cannot guarantee absolute security. You are responsible for keeping
            your account credentials and wallet access secure.
          </p>
        </Section>

        <Section n="8" title="International Transfers">
          <p>
            We and our service providers may process and store information in countries other than the one in which
            you live. Where we transfer personal information across borders, we take steps designed to ensure it
            receives an adequate level of protection consistent with this Privacy Policy and applicable law.
          </p>
        </Section>

        <Section n="9" title="Your Rights and Choices">
          <p>
            Depending on where you live, you may have rights regarding your personal information, including the right
            to: access a copy of your information; correct inaccurate information; request deletion; restrict or object
            to certain processing; receive your information in a portable format; and withdraw consent where
            processing is based on consent.
          </p>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:support@rwa.lat" className="text-[#2fe6bf] hover:underline">
              support@rwa.lat
            </a>
            . We may need to verify your identity before fulfilling a request. You may also have the right to lodge a
            complaint with your local data protection authority.
          </p>
        </Section>

        <Section n="10" title="Children">
          <p>
            The Service is not directed to, and is not intended for use by, anyone under the age of 18. We do not
            knowingly collect personal information from children. If you believe a minor has provided us with personal
            information, please contact us and we will take appropriate steps to delete it.
          </p>
        </Section>

        <Section n="11" title="Changes to This Privacy Policy">
          <p>
            We may update this Privacy Policy from time to time. When we do, we will revise the &ldquo;Effective
            date&rdquo; above and, for material changes, provide additional notice (for example, by email or through
            the Service). We encourage you to review this page periodically.
          </p>
        </Section>

        <Section n="12" title="Contact Us">
          <p>
            If you have questions or concerns about this Privacy Policy or our handling of your personal information,
            contact us at{' '}
            <a href="mailto:support@rwa.lat" className="text-[#2fe6bf] hover:underline">
              support@rwa.lat
            </a>
            .
          </p>
        </Section>
      </div>
    </LegalPage>
  )
}
