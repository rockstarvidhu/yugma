import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = { title: "Brand foundations", robots: { index: false, follow: false } };
const colours = [
  ["Forest", "#2E3A2F", "bg-forest"],
  ["Sand", "#EDE7DB", "bg-sand"],
  ["Sage", "#A7B097", "bg-sage"],
  ["Terracotta", "#A7684F", "bg-terracotta"],
  ["Charcoal", "#1F1F1F", "bg-charcoal"],
];

export default function BrandPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="yugma-brand min-h-svh pb-24">
      <Container>
        <header className="flex flex-wrap items-center justify-between gap-6 border-b border-border py-8">
          <BrandLogo href="/" label="YUGMA home" priority />
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Brand reference · 01</p>
        </header>
        <section className="py-16 sm:py-24" aria-labelledby="intro">
          <SectionHeading id="intro" as="h1" eyebrow="YUGMA / Foundations" title="A considered beginning.">
            <p>The official identity, in its simplest forms. A working reference for the details we carry forward.</p>
          </SectionHeading>
        </section>
        <section aria-labelledby="marks" className="border-t border-border py-12">
          <SectionHeading id="marks" eyebrow="01 / Identity" title="The signature & the symbol." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {(["forest", "sand", "white"] as const).map((tone) => (
              <figure key={tone} className={`flex min-h-80 flex-col items-center justify-between gap-10 border border-border p-8 ${tone === "forest" ? "bg-sand text-forest" : "bg-forest text-sand"}`}>
                <BrandLogo tone={tone} label={`YUGMA ${tone} wordmark`} />
                <BrandLogo variant="emblem" tone={tone} label={`YUGMA ${tone} emblem`} />
                <figcaption className="text-xs uppercase tracking-widest">{tone}</figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(["horizontal", "stacked"] as const).map((variant) => (
              <figure key={variant} className="flex flex-col items-center justify-center gap-6 border border-border p-8">
                <Image src={`/brand/yugma-lockup-${variant}-forest.svg`} alt={`YUGMA ${variant} lockup`} width={variant === "horizontal" ? 1400 : 1100} height={variant === "horizontal" ? 350 : 650} className="h-48 w-full object-contain" />
                <figcaption className="text-xs uppercase tracking-widest">{variant} lockup</figcaption>
              </figure>
            ))}
          </div>
        </section>
        <section aria-labelledby="palette" className="border-t border-border py-12">
          <SectionHeading id="palette" eyebrow="02 / Colour" title="Rooted in nature." />
          <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {colours.map(([name, hex, background]) => <figure key={name}><div className={`h-28 border border-border ${background}`} /><figcaption className="mt-3 text-sm">{name}<span className="mt-1 block text-xs text-muted">{hex}</span></figcaption></figure>)}
          </div>
        </section>
        <section aria-labelledby="type" className="border-t border-border py-12">
          <SectionHeading id="type" eyebrow="03 / Typography" title="An editorial voice." />
          <div className="mt-10 grid gap-12 md:grid-cols-2">
            <div className="space-y-6"><p className="text-xs uppercase tracking-widest">Playfair Display / Headings</p><p className="font-editorial text-4xl leading-tight sm:text-5xl">Together, beautifully.</p><h3 className="font-editorial text-3xl">Every detail matters.</h3><p className="font-editorial text-xl">A moment to remember.</p></div>
            <div className="space-y-6"><p className="text-xs uppercase tracking-widest">Inter / Body & interface</p><p className="text-lg leading-8">Space to breathe. Words chosen with care. An invitation begins with the feeling it leaves behind.</p><p className="text-base leading-7">Body text stays clear and unhurried, with generous line spacing and a comfortable reading measure.</p><p className="text-sm leading-6">Small text / supporting details</p></div>
          </div>
        </section>
        <section aria-labelledby="controls" className="border-t border-border py-12">
          <SectionHeading id="controls" eyebrow="04 / Interface" title="Simple, purposeful gestures."><p>Button specimens: primary, secondary, quiet and disabled. Use Tab to inspect focus states.</p></SectionHeading>
          <div className="mt-10 flex flex-wrap gap-4"><Button>Primary action</Button><Button variant="secondary">Secondary action</Button><Button variant="ghost">Quiet action</Button><Button disabled>Unavailable</Button></div>
        </section>
        <section aria-labelledby="responsive" className="border-t border-border py-12">
          <SectionHeading id="responsive" align="center" eyebrow="05 / Composition" title="Room for what matters."><p>Components adapt to the available space, from a small screen to a wider editorial layout.</p></SectionHeading>
          <div className="mx-auto mt-10 max-w-sm border border-border p-6"><BrandLogo href="/" label="YUGMA home" /><SectionHeading as="h3" className="mt-10" title="A smaller canvas."><p>The same identity, with room to breathe.</p></SectionHeading><Button className="mt-6 w-full" variant="secondary">Full-width specimen</Button></div>
        </section>
      </Container>
    </main>
  );
}
