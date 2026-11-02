export type PlanType = 'basic' | 'ultra' | 'unlimited';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  whatsapp?: string;
  telegram?: string;
  referralCode?: string;
  referredBy?: string;
  plan: PlanType;
  credits: number;
  maxCredits: number;
  usedCredits?: number;
  planDaysLeft: number;
  planExpiresAt?: string;
  planStartedAt?: string;
  role: 'user' | 'admin' | 'reseller';
  createdAt: string;
  avatarColor?: string;
  status: 'active' | 'suspended';
  extensionAccess?: boolean;
  canEditPrompts?: boolean;
  isOnline?: boolean;
  lastActive?: string;
  upgradeRequested?: boolean;
  upgradeRequestedAt?: string;
  resellerId?: string;
  resellerName?: string;
  sessionToken?: string;
}

export interface Reseller {
  id: string;
  portalName: string;
  email: string;
  password: string;
  userLimit: number;
  daysLeft: number;
  expiryDate: string;
  status: 'active' | 'expired' | 'suspended';
  createdAt: string;
  notes?: string;
  apiKey?: string;
  expiresAt?: string; // ISO timestamp for real-time countdown
  sessionId?: string;
}

export interface Generation {
  id: string;
  userId: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  duration: number; // in seconds
  thumbnailUrl: string;
  videoUrl?: string;
  createdAt: string;
  creditsCost: number;
  status: 'completed' | 'generating' | 'failed';
  style?: string;
}

export interface ShowcaseVideo {
  id: string;
  title: string;
  prompt: string;
  author: string;
  authorAvatar: string;
  likes: number;
  views: number;
  thumbnailUrl: string;
  videoUrl?: string;
  tag: string;
  aspectRatio: 'landscape' | 'portrait' | 'square';
}

export interface DeviceSession {
  id: string;
  browser: string;
  os: string;
  location: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface ExtensionConfig {
  name: string;
  version: string;
  downloadUrl: string;
  fileName?: string;
  fileData?: string;
  description: string;
  updatedAt: string;
  downloadType: 'url' | 'file';
}

export interface PlanExtensionsConfig {
  basic: ExtensionConfig;
  ultra: ExtensionConfig;
}

export interface TutorialConfig {
  desktopVideoUrl: string;
  desktopTitle: string;
  desktopSubtitle?: string;
  mobileVideoUrl: string;
  mobileTitle: string;
  mobileSubtitle?: string;
}

export interface HeroItem {
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  buttonText?: string;
  buttonUrl?: string;
}

export interface HeroConfig {
  items: HeroItem[];
  rotationSpeed: number; // in milliseconds
}

export interface TelegramAlertConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  reminderMinutesBefore?: number; // default 20
  missedAlertMinutesAfter?: number; // default 5
  lastTestedAt?: string;
  lastTestSuccess?: boolean;
}

export interface ServerPromptConfig {
  id: string;
  label: string;
  prompt: string;
  lastUpdatedAt?: string;
  updatedBy?: string;
  reminded20MinSent?: boolean;
  missed5MinSent?: boolean;
  missedAlertSentAt?: string;
  wasMissed?: boolean;
}

export interface GenerationCosts {
  image: number;
  video: number;
}

export interface PricingPlan {
  id: string;
  name: string;
  label: string;
  subtitle?: string;
  credits: string;
  videos: string;
  features: string[];
  buttonText: string;
  badge?: string;
  color: 'blue' | 'purple' | 'amber';
}

export interface PricingConfig {
  plans: PricingPlan[];
}

export interface PromptConfig {
  servers: ServerPromptConfig[];
  costs: GenerationCosts;
  promptReminderMinutes?: number;
  telegramAlerts?: TelegramAlertConfig;
  signupEnabled?: boolean;
  signupTelegramEnabled?: boolean;
  signupTelegramUrl?: string;
  resellerContactUrl?: string;
  resellerContactUrlEnabled?: boolean;
  customPlanContactUrl?: string;
  pricing?: PricingConfig;
  headerEmailOpacity?: number; // Opacity percentage for header email (0 to 100)
  headerEmailOpacityCustom?: boolean; // True when explicitly set in admin modal
  server1Prompt?: string;
  server2Prompt?: string;
  websiteFaviconUrl?: string; // Custom browser tab favicon/logo URL
  websiteTitle?: string; // Custom browser tab title
  extensionVersion?: string; // Required extension version signal
  cloudflareEnabled?: boolean; // Option 2 Toggle: Fetch dynamically from Cloudflare Worker
  cloudflareUrl?: string; // Option 2 URL: e.g. https://flowmaker-prompts.sachinkumar23406.workers.dev
  cloudflareLastStatus?: 'online' | 'offline' | 'error';
  cloudflareLastSyncAt?: string;
  dashboardAnnouncement?: {
    enabled: boolean;
    text: string;
    type?: 'info' | 'warning' | 'success';
  };
}


