import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";
import "./studio.css";

export function StudioShell({
  title,
  children,
  back,
}: {
  title: string;
  children: ReactNode;
  back?: ReactNode;
}) {
  return (
    <main className="yugma-brand studio-shell">
      <Container className="studio-container">
        <header className="studio-header">
          <BrandLogo tone="forest" className="w-28" />
          {back}
        </header>
        <h1 className="font-editorial studio-heading">{title}</h1>
        {children}
      </Container>
    </main>
  );
}

export function StudioUnavailable({ children }: { children: ReactNode }) {
  return (
    <StudioShell title="Private Studio">
      <p role="alert">{children}</p>
      <Link className="studio-link" href="/studio" prefetch={false}>
        Back to Studio
      </Link>
    </StudioShell>
  );
}
