import type { ReactNode } from "react";

type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  id?: string;
  className?: string;
};

export function SectionHeading({ title, eyebrow, children, as: Heading = "h2", align = "left", id, className = "" }: SectionHeadingProps) {
  return (
    <div className={`${align === "center" ? "mx-auto text-center" : "text-left"} max-w-2xl ${className}`}>
      {eyebrow && <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted">{eyebrow}</p>}
      <Heading id={id} className="font-editorial text-3xl leading-tight text-heading sm:text-4xl">{title}</Heading>
      {children && <div className="mt-5 text-base leading-7 text-muted">{children}</div>}
    </div>
  );
}
