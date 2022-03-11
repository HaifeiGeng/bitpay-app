export enum ClaimCodeType {
  barcode = 'barcode',
  code = 'code',
  link = 'link',
}

export interface CheckoutPageCssSelectors {
  orderTotal: string[];
  claimCodeInput: string[];
  pinInput: string[];
}

export interface GiftCardDiscount {
  code: string;
  type: 'flatrate' | 'percentage';
  amount: number;
}

export interface GiftCardActivationFee {
  amountRange: {
    min: number;
    max: number;
  };
  fee: number;
  type: 'fixed' | 'percentage';
}

export interface CommonCardConfig {
  activationFees?: GiftCardActivationFee[];
  allowedPhoneCountries?: string[];
  brandColor?: string;
  cardImage: string;
  cssSelectors?: CheckoutPageCssSelectors;
  currency: string;
  defaultClaimCodeType: ClaimCodeType;
  description: string;
  discounts?: GiftCardDiscount[];
  displayName: string;
  emailRequired: boolean;
  featured?: boolean;
  hidden?: boolean;
  hidePin?: boolean;
  icon: string;
  integersOnly?: boolean;
  logo: string;
  logoBackgroundColor: string;
  minAmount?: number;
  maxAmount?: number;
  mobilePaymentsSupported?: boolean;
  phoneRequired?: boolean;
  printRequired?: boolean;
  redeemButtonText?: string;
  redeemInstructions?: string;
  redeemUrl?: string;
  supportedUrls?: string[];
  terms: string;
  website: string;
  tags?: string[];
}

export interface CardConfig extends CommonCardConfig {
  name: string;
  supportedAmounts?: number[];
}

export interface UnsoldGiftCard {
  amount: number;
  currency: string;
  name: string;
  discounts?: GiftCardDiscount[];
  invoiceId: string;
  clientId: string;
  accessKey: string;
}

export interface GiftCardBalanceEntry {
  date: string;
  amount: number;
}

export interface GiftCard extends UnsoldGiftCard {
  accessKey: string;
  archived: boolean;
  barcodeData?: string;
  barcodeFormat?: string;
  barcodeImage?: string;
  claimCode: string;
  claimLink?: string;
  date: string;
  displayName: string;
  pin?: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILURE' | 'UNREDEEMED';
  clientId: string;
  totalDiscount?: number;
  balanceHistory?: GiftCardBalanceEntry[];
  invoice: Invoice;
  userEid?: string;
}

export type GiftCardSaveParams = Partial<{
  error: string;
  status: string;
  remove: boolean;
}>;

export interface ApiCard extends CommonCardConfig {
  amount?: number;
  type: 'fixed' | 'range';
}

export interface GiftCardInvoiceParams {
  brand: string;
  currency: string;
  amount: number;
  clientId: string;
  discounts: string[];
  email?: string;
  phone?: string;
  transactionCurrency: string;
}

export interface GiftCardOrder {
  accessKey: string;
  invoiceId: string;
  invoice: Invoice;
  totalDiscount?: number;
}

export interface GiftCardRedeemParams {
  accessKey: string;
  clientId: string;
  invoiceId: string;
}

export interface GiftCardInvoiceMessage {
  data: {status: 'closed' | 'paid' | 'confirmed' | 'complete'};
}

export type ApiCardConfig = ApiCard[];

export interface AvailableCardMap {
  [cardName: string]: ApiCardConfig;
}

export interface CardConfigMap {
  [cardName: string]: CardConfig;
}

export interface InvoiceMinerFee {
  satoshisPerByte: number;
  totalFee: number;
}

export interface Invoice {
  id: string;
  url: string;
  exchangeRates: any;
  minerFees: {[currency: string]: InvoiceMinerFee};
  paymentTotals: {[currency: string]: number};
  paymentDisplayTotals: {[currency: string]: string};
  amountPaid: number;
  displayAmountPaid: string;
  nonPayProPaymentReceived?: boolean;
  transactionCurrency: string;
  status: 'new' | 'paid' | 'confirmed' | 'complete' | 'expired' | 'invalid';
}

export interface PhoneCountryInfo {
  phoneCountryCode: string;
  countryIsoCode: string;
}

export interface DirectoryDiscount {
  type: 'flatrate' | 'percentage' | 'custom';
  amount?: number;
  currency?: string;
  value?: string;
}

export interface DirectIntegrationApiObject {
  displayName: string;
  caption: string;
  cta?: {
    displayText: string;
    link: string;
  };
  icon: string;
  link: string;
  displayLink: string;
  tags: string[];
  domains: string[];
  discount?: DirectoryDiscount;
  theme: string;
  instructions: string;
}

export interface GiftCardCuration {
  displayName: string;
  giftCards: CardConfig[];
}

export interface Category {
  displayName: string;
  emoji: string;
  icon: string;
  tags: string[];
}

export interface CurationMap {
  [curationName: string]: GiftCardCuration;
}
export interface CategoryMap {
  [categoryName: string]: Category;
}

export interface DirectIntegrationMap {
  [integrationName: string]: DirectIntegrationApiObject;
}

export interface CategoriesAndCurations {
  curated: CurationMap;
  categories: CategoryMap;
}
