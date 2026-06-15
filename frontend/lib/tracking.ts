interface TrackingWindow extends Window {
  fbq?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

export function trackLeadCaptured(): void {
  const win = window as TrackingWindow;
  win.fbq?.("track", "Lead");
  win.dataLayer?.push({ event: "split_master_lead" });
  win.gtag?.("event", "generate_lead");
}

export function trackCheckoutPurchase(metadata: Record<string, unknown>): void {
  const win = window as TrackingWindow;
  win.fbq?.("track", "Purchase", metadata);
  win.dataLayer?.push({ event: "split_master_purchase", ...metadata });
  win.gtag?.("event", "purchase", metadata);
}
