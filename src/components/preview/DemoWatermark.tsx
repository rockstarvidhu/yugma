import "./demo-watermark.css";

/** Presentation only. Future publishing entitlements must be authorized on the server. */
export function DemoWatermark({
  mode = "sample",
}: {
  mode?: "sample" | "personalized";
}) {
  return (
    <aside className="yugma-demo-watermark" aria-label="Demo preview">
      <span className="yugma-demo-watermark__label">
        YUGMA <span aria-hidden="true">•</span> DEMO
      </span>
      <span className="yugma-demo-watermark__note">
        {mode === "personalized" ? "Personalized preview" : "Sample invitation"}
      </span>
      <span className="yugma-demo-badge" aria-hidden="true">
        YUGMA • DEMO
      </span>
    </aside>
  );
}
