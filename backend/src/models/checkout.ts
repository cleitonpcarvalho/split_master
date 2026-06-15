export const checkoutProviders = [
  "hotmart",
  "kiwify",
  "eduzz",
  "stripe",
  "custom",
] as const;

export type CheckoutProvider = (typeof checkoutProviders)[number];

export interface CheckoutConfigRow {
  id: string;
  quiz_id: string;
  provider: CheckoutProvider;
  checkout_url: string;
  url_template: string;
  custom_params: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CheckoutConfig {
  id: string;
  quizId: string;
  provider: CheckoutProvider;
  checkoutUrl: string;
  urlTemplate: string;
  customParams: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const checkoutProviderTemplates: Record<CheckoutProvider, string> = {
  hotmart:
    "{url}?off_name={{name}}&off_email={{email}}&off_phone={{phone}}",
  kiwify:
    "{url}?customer_name={{name}}&customer_email={{email}}&customer_phone={{phone}}",
  eduzz: "{url}?name={{name}}&email={{email}}&phone_number={{phone}}",
  stripe: "{url}?prefilled_email={{email}}",
  custom: "{url}",
};
