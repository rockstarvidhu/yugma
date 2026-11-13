import "./demo-watermark.css";

/** Presentation only. Future publishing entitlements must be authorized on the server. */
export function DemoWatermark() {
  return (
    <aside className="yugma-demo-watermark" aria-label="Demo preview">
      <span className="yugma-demo-watermark__label">
        YUGMA <span aria-hidden="true">•</span> DEMO
      </span>
      <span className="yugma-demo-watermark__note">Sample invitation</span>
      <span className="yugma-demo-badge" aria-hidden="true">
        YUGMA • DEMO
      </span>
    </aside>
  );
}
