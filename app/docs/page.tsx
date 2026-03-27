import type { Metadata } from "next";
import Link from "next/link";

import { SiteNav } from "@/components/SiteNav";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getMasterPackDoc,
  getMasterPackDocHref,
  listMasterPackDocsBySection,
} from "@/lib/master-pack-docs";

export const metadata: Metadata = {
  title: "Docs | Tianezha",
  description: "Master-pack product, architecture, module, and implementation docs for Tianezha.",
};

const overviewSlug = ["product-overview"];
const roadmapSlug = ["roadmap"];

export default function TianshiDocsIndexPage() {
  const docsBySection = listMasterPackDocsBySection();
  const summaryDoc = getMasterPackDoc(["product-summary"]);
  const summaryItems =
    summaryDoc?.blocks
      .slice(0, 6)
      .map((block) => ({
        answer: block.paragraphs[0] || block.bullets[0] || "",
        question: block.heading,
      })) || [];

  return (
    <div className="app-shell">
      <SiteNav />

      <section className="panel home-hero-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">Docs</p>
          <h1>The Tianezha master pack now drives the docs surface.</h1>
          <p className="route-summary">
            This docs front door reads directly from the in-repo Tianezha master pack, so
            product truth, architecture, module boundaries, and implementation order stay
            aligned while we build.
          </p>
          <div className="route-badges">
            <StatusBadge tone="success">Master pack linked</StatusBadge>
            <StatusBadge tone="accent">Naming locked</StatusBadge>
            <StatusBadge tone="warning">Tasks visible</StatusBadge>
          </div>
          <div className="home-cta-row">
            <Link
              className="button button-primary home-uniform-button"
              href={getMasterPackDocHref(overviewSlug)}
            >
              Start with Overview
            </Link>
            <Link
              className="button button-secondary home-uniform-button"
              href={getMasterPackDocHref(roadmapSlug)}
            >
              Open the Roadmap
            </Link>
          </div>
        </div>

        <aside className="home-hero-rail">
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">What lives here</p>
              <strong>Docs, modules, rules, and tasks</strong>
              <span>
                The master pack includes product overview, architecture, identity, heartbeat,
                formulas, rewards, Merkle coherence, bots, and the build sequence.
              </span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Fastest path</p>
              <strong>Overview, architecture, then modules</strong>
              <span>
                It is organized so a human or another model can get oriented quickly and
                then drop into the exact box they need.
              </span>
            </div>
          </div>
        </aside>
      </section>

      <section className="panel home-section-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Browse docs</p>
            <h2>Pick a section</h2>
          </div>
        </div>

        <div className="home-card-grid">
          {docsBySection.map((group) => (
            <article key={group.section} className="surface-card">
              <p className="eyebrow">{group.section}</p>
              <h3>{group.docs[0]?.title || group.section}</h3>
              <p>{group.docs.map((doc) => doc.title).join(" | ")}</p>
              <div className="home-copy-stack">
                {group.docs.map((doc) => (
                  <Link key={doc.slug.join("/")} href={getMasterPackDocHref(doc.slug)}>
                    {doc.title}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel home-section-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Summary</p>
            <h2>High-level product read</h2>
          </div>
        </div>

        <div className="home-faq-preview">
          <div className="faq-list">
            {summaryItems.map((item) => (
              <article key={item.question} className="faq-item">
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>

          <div className="home-inline-actions">
            <Link
              className="button button-primary home-uniform-button"
              href={getMasterPackDocHref(summaryDoc?.slug || overviewSlug)}
            >
              Read the Source Doc
            </Link>
          </div>
        </div>
      </section>

      <section className="panel home-section-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Machine docs</p>
            <h2>LLM-readable entry points</h2>
          </div>
        </div>

        <div className="home-inline-actions">
          <Link className="button button-ghost small" href="/llms.txt">
            llms.txt
          </Link>
          <Link className="button button-ghost small" href="/llms-full.txt">
            llms-full.txt
          </Link>
          <Link className="button button-ghost small" href="/install.md">
            install.md
          </Link>
        </div>
      </section>
    </div>
  );
}
