"use client";

import Script from "next/script";

import type { PublicQuiz } from "@/lib/api";

export function TrackingScripts({
  tracking,
}: {
  tracking: PublicQuiz["tracking"];
}) {
  return (
    <>
      {tracking.scripts.facebook && (
        <Script
          id="split-master-facebook-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: tracking.scripts.facebook }}
        />
      )}
      {tracking.scripts.gtm && (
        <Script
          id="split-master-gtm"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: tracking.scripts.gtm }}
        />
      )}
      {tracking.ga4Id && (
        <Script
          id="split-master-ga4-library"
          src={`https://www.googletagmanager.com/gtag/js?id=${tracking.ga4Id}`}
          strategy="afterInteractive"
        />
      )}
      {tracking.scripts.ga4 && (
        <Script
          id="split-master-ga4"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: tracking.scripts.ga4 }}
        />
      )}
    </>
  );
}
