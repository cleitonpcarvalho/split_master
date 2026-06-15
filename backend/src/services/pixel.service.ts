import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import type {
  IntegrationRow,
  PublicTrackingSettings,
} from "../models/integration.js";

export async function getPublicTrackingSettings(
  quizId: string,
): Promise<PublicTrackingSettings> {
  const { data, error } = await supabaseAdmin
    .from("quiz_integrations")
    .select("id,quiz_id,type,settings,is_active,created_at,updated_at")
    .eq("quiz_id", quizId)
    .eq("is_active", true)
    .in("type", ["pixel_facebook", "gtm", "ga4"])
    .returns<IntegrationRow[]>();

  if (error) {
    throw new AppError(
      `Não foi possível carregar os pixels: ${error.message}`,
    );
  }

  const facebookPixelId = getValidId(data, "pixel_facebook", /^\d{5,30}$/);
  const gtmId = getValidId(data, "gtm", /^GTM-[A-Z0-9]+$/i);
  const ga4Id = getValidId(data, "ga4", /^G-[A-Z0-9]+$/i);

  return {
    facebookPixelId,
    gtmId,
    ga4Id,
    scripts: generateTrackingScripts({ facebookPixelId, gtmId, ga4Id }),
  };
}

export function generateTrackingScripts(settings: {
  facebookPixelId: string | null;
  gtmId: string | null;
  ga4Id: string | null;
}): PublicTrackingSettings["scripts"] {
  return {
    facebook: settings.facebookPixelId
      ? `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${settings.facebookPixelId}');fbq('track','PageView');`
      : null,
    gtm: settings.gtmId
      ? `window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});(function(w,d,s,l,i){var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${settings.gtmId}');`
      : null,
    ga4: settings.ga4Id
      ? `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${settings.ga4Id}');`
      : null,
  };
}

function getValidId(
  integrations: IntegrationRow[],
  type: IntegrationRow["type"],
  pattern: RegExp,
): string | null {
  const row = integrations.find((integration) => integration.type === type);
  const value =
    row && typeof row.settings.pixelId === "string"
      ? row.settings.pixelId.trim()
      : "";

  return pattern.test(value) ? value : null;
}
