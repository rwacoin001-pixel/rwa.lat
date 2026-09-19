import type { Metadata } from 'next'
import LegalPage, { Section, RiskNote } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service — RWA.LAT',
  description: 'The terms governing your use of the RWA.LAT platform.',
}

export default function TermsOfServicePage() {
  return (
    <LegalPage badge="Legal" title="Terms of Service" updated="September 18, 2026">
      <div className="space-y-10 text-sm leading-7 text-[#929aa6] sm:text-[15px]">
        <Section n="1" title="Acceptance of These Terms">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the RWA.LAT platform at{' '}
            <a href="https://rwa.lat" className="text-[#2fe6bf] hover:underline">
              https://rwa.lat
            </a>{' '}
            and related applications and services (the &ldquo;Service&rdquo;). By accessing or using the Service, you
            agree to be bound by these Terms. If you do not agree, you must not use the Service.
          </p>
        </Section>

        <Section n="2" title="Eligibility">
          <ul className="list-disc space-y-2 pl-5">
            <li>You must be at least 18 years old and legally capable of entering into binding contracts;</li>
            <li>You must not be located in, or a resident of, any jurisdiction subject to comprehensive sanctions, or otherwise prohibited from using the Service under applicable law;</li>
            <li>You are responsible for ensuring that your use of the Service complies with the laws and regulations applicable to you.</li>
          </ul>
        </Section>

        <Section n="3" title="About the Service">
          <p>
            RWA.LAT provides technology that allows users to explore information about tokenized real-world assets,
            market data, and AI-assisted analysis and portfolio tools, as well as community features. The Service is
            evolving: features may be added, changed, limited, or suspended over time, and some features may not be
            available in all jurisdictions or to all users.
          </p>
          <p>
            We do not provide securities, brokerage, banking, or custodial services, and nothing on the Service
            constitutes an offer or solicitation to buy or sell any financial instrument, unless expressly stated
            otherwise in separate, applicable terms.
          </p>
        </Section>

        <Section n="4" title="Your Account">
          <ul className="list-disc space-y-2 pl-5">
            <li>You must provide accurate information when creating an account and keep it up to date;</li>
            <li>You are responsible for maintaining the security of your account, session credentials, and connected wallets, and for all activity that occurs through your account;</li>
            <li>You must promptly notify us of any unauthorized access or use of your account; and</li>
            <li>Accounts are personal to you. You may not sell, transfer, or share access to your account with third parties.</li>
          </ul>
        </Section>

        <Section n="5" title="Digital Assets and Investment Risk">
          <RiskNote>
            <p className="text-sm font-medium leading-6">
              Digital assets and tokenized real-world assets are highly speculative and volatile. You may lose the
              entire value of your assets. Nothing in the Service is a guarantee of performance, liquidity, or returns.
            </p>
          </RiskNote>
          <ul className="list-disc space-y-2 pl-5">
            <li>Prices of digital assets can fluctuate dramatically and may decline to zero;</li>
            <li>Digital assets are generally not insured by any government or deposit protection scheme;</li>
            <li>Markets may be illiquid, and you may be unable to buy or sell assets when desired;</li>
            <li>Blockchain networks, custodial arrangements, and smart contracts carry technological and counterparty risks; and</li>
            <li>The regulatory treatment of digital assets is uncertain in many jurisdictions and may change.</li>
          </ul>
          <p>You use the Service at your own discretion and bear all consequences of your decisions.</p>
        </Section>

        <Section n="6" title="No Investment, Legal, or Tax Advice">
          <p>
            The Service provides information and tools — including AI-generated analyses — for informational purposes
            only. Nothing on the Service constitutes investment, legal, financial, or tax advice, or a recommendation
            to buy, sell, or hold any asset. You should conduct your own research and consult qualified professionals
            before making financial decisions.
          </p>
        </Section>

        <Section n="7" title="Acceptable Use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Use the Service in violation of any applicable law or regulation, or to facilitate fraud or market manipulation;</li>
            <li>Interfere with, disrupt, or attempt to gain unauthorized access to the Service, its systems, or other users&rsquo; accounts;</li>
            <li>Scrape, copy, or extract data from the Service at scale without our prior written consent;</li>
            <li>Infringe the rights of RWA.LAT or any third party, including intellectual property rights;</li>
            <li>Circumvent geographic or access restrictions, including by providing false eligibility information; or</li>
            <li>Use the Service to transmit unlawful, harmful, or misleading content.</li>
          </ul>
        </Section>

        <Section n="8" title="Fees">
          <p>
            Certain features of the Service may be subject to fees, which will be disclosed to you before you incur
            them. You are responsible for any network or transaction fees charged by third-party networks when you
            interact with blockchain protocols through or in connection with the Service.
          </p>
        </Section>

        <Section n="9" title="Intellectual Property">
          <p>
            The Service, including its software, design, trademarks, and content provided by us (excluding your content
            and third-party content), is owned by RWA.LAT or its licensors and is protected by applicable intellectual
            property laws. You are granted a limited, non-exclusive, non-transferable, revocable license to use the
            Service in accordance with these Terms.
          </p>
          <p>
            You retain ownership of content you submit (such as community posts). By submitting content, you grant us a
            worldwide, non-exclusive, royalty-free license to host, use, reproduce, and display that content to the
            extent necessary to operate, provide, and improve the Service.
          </p>
        </Section>

        <Section n="10" title="Third-Party Services and Links">
          <p>
            The Service may integrate with or link to third-party services (such as wallet providers, identity
            verification providers, and market data sources). We are not responsible for the content, performance, or
            practices of third-party services, and your use of them may be subject to their own terms.
          </p>
        </Section>

        <Section n="11" title="Disclaimers">
          <p>
            To the maximum extent permitted by law, the Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, whether express, implied, or statutory, including
            warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant
            that the Service will be uninterrupted, error-free, secure, or accurate.
          </p>
        </Section>

        <Section n="12" title="Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, RWA.LAT and its affiliates shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data,
            assets, or goodwill, arising out of or related to your use of the Service. Our aggregate liability for all
            claims relating to the Service shall not exceed the greater of (a) the amounts you paid for the Service
            during the twelve (12) months preceding the event giving rise to the claim, or (b) USD 100.
          </p>
        </Section>

        <Section n="13" title="Indemnification">
          <p>
            You agree to indemnify and hold harmless RWA.LAT and its affiliates from and against any claims, damages,
            liabilities, and expenses (including reasonable legal fees) arising from your use of the Service, your
            violation of these Terms, or your violation of any rights of a third party.
          </p>
        </Section>

        <Section n="14" title="Suspension and Termination">
          <p>
            We may suspend or terminate your access to the Service at any time, including if we reasonably believe you
            have violated these Terms, pose a security or legal risk, or if required by law. You may stop using the
            Service at any time. Sections that by their nature should survive termination — including intellectual
            property, disclaimers, limitation of liability, and indemnification — will survive.
          </p>
        </Section>

        <Section n="15" title="Changes to These Terms">
          <p>
            We may update these Terms from time to time. When we do, we will revise the &ldquo;Effective date&rdquo;
            above and, for material changes, provide additional notice. Your continued use of the Service after
            updated Terms take effect constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section n="16" title="Governing Law and Dispute Resolution">
          <p>
            These Terms are governed by the laws of the jurisdiction in which the RWA.LAT platform operator is
            organized, without regard to conflict-of-law principles. Before commencing any formal proceeding, you and
            RWA.LAT agree to attempt in good faith to resolve any dispute through informal negotiation. Subject to the
            foregoing, the courts located in that jurisdiction shall have exclusive jurisdiction over disputes arising
            from these Terms, unless mandatory protections in your country of residence provide otherwise.
          </p>
        </Section>

        <Section n="17" title="Contact">
          <p>
            For questions about these Terms, contact us at{' '}
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
