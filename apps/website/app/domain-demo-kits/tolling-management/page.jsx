import Link from "next/link";
import { WebsiteShell, WebsiteSection } from "../../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../../src/metadata.js";
import styles from "./page.module.css";

export const metadata = createWebsiteMetadata({
  title: "Tolling Sales Demo Kit",
  description:
    "A source-backed Tolling Management demo kit with Account 360, customer portal, architecture, DB, proposal, and ROI hypothesis assets.",
  path: "/domain-demo-kits/tolling-management",
  keywords: ["tolling demo", "domain demo kit", "Account 360", "tolling back office", "customer portal"],
});

const proofCards = [
  ["Demo outcome", "Sales-ready in days", "Website, UI previews, one-pager, proposal starter, and demo script."],
  ["Buyer trust", "Source-backed", "Claims map to FHWA, TxDOT, HCTRA, NTTA, FTC, PCI, and NIST references."],
  ["Runtime boundary", "Clear defer list", "No live payment, OCR, toll rating, agency integration, or production data."],
];

const modules = [
  ["Agent Account 360", "Verify identity, explain charges, open disputes, and show eligible safe actions."],
  ["Payments and funds", "Hosted-token placeholder, ledger rows, failed replenishment, refund approval state."],
  ["Cases and disputes", "SLA queue, fake evidence reference, notes, escalation, and resolution path."],
  ["Inventory and fulfillment", "Demo transponder stock, reservation, replacement order, shipment status."],
  ["Notifications", "Consent state, official payment guidance, delivery status, scam-safe support flow."],
  ["Reports", "Demo-only revenue, event, invoice, case SLA, payment failure, and fulfillment metrics."],
];

const accountRows = [
  ["Account", "DEMO-ACCT-1001", "Good standing"],
  ["Plate", "DEMO123", "Tag match confirmed"],
  ["Tag", "TAG-DEMO-0001", "Active"],
  ["Invoice", "INV-DEMO-9001", "Open"],
];

const timeline = [
  "Roadside event captured",
  "Tag and plate matched",
  "Trip built and deduped",
  "Charge explained",
  "Posted or invoiced",
  "Payment, case, and report updated",
];

const roadmap = [
  ["1", "Static demo kit", "Docs, source claims, safe data, scripts, proposal starter."],
  ["2", "Microsite and prototype", "Screenshot-ready back-office and customer portal previews."],
  ["3", "Agency overlay", "Customize policies, scripts, reports, integrations, and brand voice."],
  ["4", "Runtime MVP", "Auth, APIs, audit, payment provider, event intake, and reporting."],
  ["5", "Pilot benchmark", "Compare baseline vs pack-assisted delivery and sales prep."],
];

function DemoHeroVisual() {
  return (
    <div className={styles.heroVisual} aria-label="Tolling demo kit preview">
      <div className={styles.browserBar}>
        <span />
        <span />
        <span />
        <strong>Demo data</strong>
      </div>
      <div className={styles.accountPanel}>
        <div>
          <span className={styles.kicker}>Agent Account 360</span>
          <h2>Jordan Demo</h2>
          <p>Verified caller. One open invoice. One dispute-ready trip. One replacement tag recommendation.</p>
        </div>
        <div className={styles.statusGrid}>
          <span>Balance <strong>$42.75</strong></span>
          <span>Cases <strong>1 open</strong></span>
          <span>Trips <strong>3 recent</strong></span>
          <span>Audit <strong>Ready</strong></span>
        </div>
      </div>
      <div className={styles.actionRail}>
        <span>Explain charge</span>
        <span>Open dispute</span>
        <span>Order tag</span>
        <span>Send official guidance</span>
      </div>
    </div>
  );
}

function PreviewShell({ title, eyebrow, children }) {
  return (
    <article className={styles.previewShell}>
      <div className={styles.previewHeader}>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </article>
  );
}

export default function TollingDemoKitPage() {
  return (
    <WebsiteShell
      eyebrow="Domain Demo Kit / Tolling Management"
      title={
        <>
          Tolling demo assets your team can show{" "}
          <span className="website-highlight">before the full platform exists.</span>
        </>
      }
      description="A source-backed sales/demo package for tolling software teams: polished microsite, back-office prototype, customer portal preview, architecture, DB draft, demo data, scripts, proposal starter, and ROI hypothesis."
      actions={[
        { label: "View kit", href: "#demo-kit", primary: true },
        { label: "See Account 360", href: "#account-360" },
        { label: "Book demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "services", "benchmark", "security", "docs", "book-demo"]}
      accent="teal"
      heroVariant="immersive"
      aside={<DemoHeroVisual />}
    >
      <section className="website-proof-strip" aria-label="Tolling demo kit proof">
        {proofCards.map(([label, value, body]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{body}</p>
          </div>
        ))}
      </section>

      <WebsiteSection
        eyebrow="Problem"
        title="Selling tolling software needs more than generic SaaS screens."
        description="Agencies and operators need to see how a team thinks about roadside events, accounts, tags, plates, invoices, payments, disputes, fulfillment, reporting, and policy variation before funding implementation."
      >
        <div className={styles.problemGrid}>
          {[
            ["Sales friction", "Small vendors spend weeks creating screenshots, diagrams, and proposal material before a buyer commits."],
            ["Domain burden", "Every call repeats the same tolling basics unless the team has reusable domain memory."],
            ["Trust gap", "A polished page without payment, audit, scam-safety, and agency overlay boundaries will not satisfy technical buyers."],
          ].map(([title, body]) => (
            <article key={title}>
              <span className={styles.kicker}>{title}</span>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Solution"
        title="The Domain Demo Kit turns tolling memory into sales-ready assets."
        description="The output supports discovery calls, RFP starts, design partner reviews, technical due diligence, and implementation planning."
      >
        <div className={styles.solutionGrid} id="demo-kit">
          {[
            "Executive one-pager",
            "Buyer personas",
            "Website copy",
            "UI prototype spec",
            "Architecture and DB drafts",
            "Safe demo data",
            "Demo scripts",
            "Proposal starter",
            "ROI hypothesis",
            "Source claims register",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Back office"
        title="A module showcase built for tolling operations."
        description="Each module is demo-ready now and maps to a later runtime owner."
      >
        <div className={styles.moduleGrid}>
          {modules.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Primary screen"
        title="Agent Account 360 is the first screenshot."
        description="The demo centers on a call-center workflow because it compresses account, trips, invoices, cases, payments, tags, notifications, and audit into one buyer-visible surface."
      >
        <div className={styles.prototypeGrid} id="account-360">
          <PreviewShell eyebrow="Back-office prototype" title="Agent Account 360">
            <div className={styles.identityBlock}>
              <div>
                <strong>Jordan Demo</strong>
                <span>Verified caller / Demo data</span>
              </div>
              <span className={styles.badgeGood}>Allowed actions loaded</span>
            </div>
            <div className={styles.rowList}>
              {accountRows.map(([label, value, status]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <em>{status}</em>
                </div>
              ))}
            </div>
            <div className={styles.actionGrid}>
              <button type="button">Explain charge</button>
              <button type="button">Open dispute</button>
              <button type="button">Order tag</button>
              <button type="button">Add case note</button>
            </div>
          </PreviewShell>

          <PreviewShell eyebrow="Customer portal" title="Pay bill and dispute preview">
            <div className={styles.portalTopline}>
              <span>Open invoice</span>
              <strong>INV-DEMO-9001</strong>
              <em>$12.65 demo amount</em>
            </div>
            <ol className={styles.portalSteps}>
              <li>Review trips and invoice lines</li>
              <li>Continue to hosted payment placeholder</li>
              <li>Open dispute with fake evidence reference</li>
              <li>Track case status and notification preference</li>
            </ol>
            <p className={styles.safetyNote}>No raw card fields, production PII, or actual plate values appear in the demo.</p>
          </PreviewShell>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Roadside to back office"
        title="Show the tolling workflow end to end."
        description="The flow is intentionally high level for sales, but it gives technical buyers enough structure to discuss service ownership and failure modes."
      >
        <div className={styles.timeline}>
          {timeline.map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Architecture and DB"
        title="Technical previews that support due diligence."
        description="These are sales/demo drafts. They mark what is available now and what needs runtime implementation later."
      >
        <div className={styles.archGrid}>
          <PreviewShell eyebrow="Service map" title="MVP boundary">
            <div className={styles.serviceMap}>
              {["Roadside intake", "Trip builder", "Rating", "Account", "Payment", "Case", "Inventory", "Notification", "Reporting", "Audit"].map(
                (service) => (
                  <span key={service}>{service}</span>
                ),
              )}
            </div>
          </PreviewShell>
          <PreviewShell eyebrow="Postgres draft" title="Core entities">
            <div className={styles.entityCloud}>
              {["accounts", "vehicles", "plates", "transponders", "trips", "charges", "invoices", "payments", "cases", "audit_logs"].map(
                (entity) => (
                  <span key={entity}>{entity}</span>
                ),
              )}
            </div>
          </PreviewShell>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Security and ROI"
        title="Trust language stays careful by design."
        description="The demo uses fake records, source-backed claims, and measured-ROI language only after benchmark evidence exists."
      >
        <div className={styles.trustGrid}>
          <article>
            <span className={styles.kicker}>Payment safety</span>
            <h3>Hosted-token assumption</h3>
            <p>Bill-pay previews never collect raw card data. The runtime plan uses a payment provider through hosted or tokenized flows.</p>
          </article>
          <article>
            <span className={styles.kicker}>Privacy</span>
            <h3>Plates, trips, and evidence are sensitive</h3>
            <p>The demo uses fake identifiers and models audit boundaries for staff actions that affect money, evidence, notices, disputes, or account status.</p>
          </article>
          <article>
            <span className={styles.kicker}>ROI</span>
            <h3>Designed to measure</h3>
            <p>Pilot benchmarks can compare time to prototype, token use, duplicate work, missed requirements, docs alignment, and support workflow coverage.</p>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Implementation roadmap"
        title="Start with sales proof, then earn runtime scope."
        description="This keeps the sales MVP useful without overpromising production functionality."
      >
        <div className={styles.roadmap}>
          {roadmap.map(([step, title, body]) => (
            <article key={step}>
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <section className="website-cta-band">
        <div>
          <p className="website-section-eyebrow">Next step</p>
          <h2>Use the Tolling Demo Kit to run a focused buyer conversation.</h2>
          <p>
            Show the Account 360 preview first, then customize the agency overlay for the buyer's policies,
            integrations, and rollout constraints.
          </p>
        </div>
        <div className="website-actions">
          <Link className="primary" href="/book-demo">Book demo</Link>
          <Link href="/docs/v1/getting-started">Try CLI</Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
