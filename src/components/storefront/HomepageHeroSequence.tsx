import Image from "next/image";
import { heroFallback } from "@/lib/storefront-hero";
import { storefrontRoutes } from "@/lib/storefront-routes";

export function HomepageHeroSequence({ photo }: { photo?: string }) {
  return (
    <section className="home-moment" id="home" aria-labelledby="hero-heading">
      <div className="home-stage">
        <div className="home-moment-media" aria-hidden="true">
          <Image src={heroFallback} alt="" fill unoptimized />
          {photo && (
            <Image
              className="home-moment-photo"
              src={photo}
              alt=""
              fill
              unoptimized
            />
          )}
        </div>
        <div className="home-moment-shade" aria-hidden="true" />
        <div className="home-moment-copy">
          <h1 id="hero-heading">
            Some moments <br />
            deserve <em>more.</em>
          </h1>
          <p>
            Beautifully crafted digital invitations, made to tell your story.
          </p>
          <a
            className="home-button home-button-light"
            href={storefrontRoutes.collection}
          >
            Explore Templates
          </a>
        </div>
        <a className="home-moment-cue" href={storefrontRoutes.collection}>
          Scroll to discover <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  );
}
