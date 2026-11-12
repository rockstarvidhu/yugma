import "./demo-watermark.css";

/** Presentation only. Future publishing entitlements must be authorized on the server. */
export function DemoWatermark() {
  return (
    <aside className="yugma-demo-watermark" aria-label="Demo preview">
      <span>YUGMA DEMO</span>
      <span className="yugma-demo-badge" aria-hidden="true">
        YUGMA DEMO
      </span>
    </aside>
  );
}
