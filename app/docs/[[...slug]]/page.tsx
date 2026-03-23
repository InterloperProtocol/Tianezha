import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteNav } from "@/components/SiteNav";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  DEFAULT_GOONCLAW_DOC,
  GOONCLAW_DOCS,
  getGoonclawDoc,
  getGoonclawDocHref,
  getGoonclawDocsBySection,
} from "@/lib/goonclaw-docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return GOONCLAW_DOCS.map((doc) => ({
    slug: doc.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = slug?.length ? getGoonclawDoc(slug) : DEFAULT_GOONCLAW_DOC;

  return doc
    ? {
        title: `${doc.title} | GoonClaw Docs`,
        description: doc.summary,
      }
    : {
        title: "Docs | GoonClaw",
      };
}

export default async function GoonclawDocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;

  if (!slug?.length) {
    redirect(getGoonclawDocHref(DEFAULT_GOONCLAW_DOC.slug));
  }

  const doc = getGoonclawDoc(slug);
  if (!doc) {
    notFound();
  }

  const docsBySection = getGoonclawDocsBySection();

  return (
    <div className="app-shell">
      <SiteNav />

      <div className="docs-layout">
        <aside className="docs-sidebar panel">
          <p className="eyebrow">Docs</p>
          <h2>GoonClaw documentation</h2>
          <p className="site-nav-summary">
            Product docs for operators, builders, and models integrating with the runtime.
          </p>

          <div className="docs-nav">
            {docsBySection.map((group) => (
              <div key={group.section} className="docs-nav-section">
                <span>{group.section}</span>
                {group.docs.map((item) => {
                  const href = getGoonclawDocHref(item.slug);
                  const isActive = item.slug.join("/") === doc.slug.join("/");

                  return (
                    <Link
                      key={href}
                      className={isActive ? "docs-nav-link active" : "docs-nav-link"}
                      href={href}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        <article className="docs-article panel">
          <div className="docs-breadcrumbs">
            <Link href="/docs/introduction/what-is-goonclaw">Docs</Link>
            <span>/</span>
            <span>{doc.section}</span>
          </div>

          <p className="eyebrow">{doc.section}</p>
          <h1>{doc.title}</h1>
          <p className="route-summary">{doc.summary}</p>

          <div className="route-badges">
            {doc.badges.map((badge) => (
              <StatusBadge key={badge}>{badge}</StatusBadge>
            ))}
          </div>

          {doc.blocks.map((block) => (
            <section key={block.id} className="docs-section" id={block.id}>
              <h2>{block.heading}</h2>
              {block.body?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {block.bullets?.length ? (
                <ul>
                  {block.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {block.code ? (
                <pre className="docs-code">
                  <code>{block.code.value}</code>
                </pre>
              ) : null}
              {block.links?.length ? (
                <div className="docs-links">
                  {block.links.map((link) => (
                    <Link key={link.href} href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </article>

        <aside className="docs-toc panel">
          <p className="eyebrow">On this page</p>
          <div className="docs-toc-links">
            {doc.blocks.map((block) => (
              <a key={block.id} className="docs-toc-link" href={`#${block.id}`}>
                {block.heading}
              </a>
            ))}
          </div>

          <div className="docs-links docs-machine-links">
            <Link href="/llms.txt">llms.txt</Link>
            <Link href="/llms-full.txt">llms-full.txt</Link>
            <Link href="/install.md">install.md</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
