import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  variant?: "wordmark" | "emblem";
  tone?: "forest" | "sand" | "white";
  className?: string;
  priority?: boolean;
} & (
  | { decorative: true; href?: never; label?: never }
  | { decorative?: false; href?: string; label?: string }
);

export function BrandLogo({ variant = "wordmark", tone = "forest", className = "", priority = false, ...accessibility }: BrandLogoProps) {
  const dimensions = variant === "wordmark" ? { width: 1832, height: 436 } : { width: 763, height: 969 };
  const logo = (
    <Image
      src={`/brand/yugma-${variant}-${tone}.svg`}
      alt={accessibility.decorative ? "" : (accessibility.label ?? "YUGMA")}
      {...dimensions}
      priority={priority}
      className="h-auto w-full"
    />
  );
  const sizing = `${variant === "wordmark" ? "w-40 sm:w-52" : "w-20 sm:w-24"} max-w-full ${className}`;
  return accessibility.href ? (
    <Link href={accessibility.href} className={`inline-block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current ${sizing}`}>
      {logo}
    </Link>
  ) : <span className={`inline-block ${sizing}`}>{logo}</span>;
}
