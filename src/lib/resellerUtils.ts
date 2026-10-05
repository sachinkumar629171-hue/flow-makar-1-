import { Reseller } from '../types';

/**
 * Calculates real-time countdown and active status for a reseller based on real time.
 */
export function calculateResellerExpiry(reseller: Partial<Reseller>): {
  daysLeft: number;
  isExpired: boolean;
  status: 'active' | 'expired' | 'suspended';
  expiryDate: string;
  expiresAt: string;
  timeRemainingText: string;
} {
  const now = Date.now();
  let targetTime: number | null = null;

  if (reseller.expiresAt) {
    const t = new Date(reseller.expiresAt).getTime();
    if (!isNaN(t)) targetTime = t;
  }

  if (!targetTime && reseller.expiryDate && reseller.expiryDate.includes('/')) {
    const parts = reseller.expiryDate.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const t = new Date(year, month, day, 23, 59, 59).getTime();
      if (!isNaN(t)) targetTime = t;
    }
  }

  if (!targetTime) {
    const days = Math.max(0, Number(reseller.daysLeft) || 30);
    const baseTime = reseller.createdAt ? new Date(reseller.createdAt).getTime() : now;
    targetTime = (isNaN(baseTime) ? now : baseTime) + days * 86400000;
  }

  const diffMs = targetTime - now;
  const isExpired = diffMs <= 0;
  const targetDate = new Date(targetTime);
  const formattedExpiry = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${targetDate.getFullYear()}`;
  const isoExpiresAt = targetDate.toISOString();

  let daysLeft = 0;
  let timeRemainingText = 'Expired';

  if (!isExpired) {
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const remHours = totalHours % 24;
    const remMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 1) {
      timeRemainingText = `${days} Days Left`;
    } else if (days === 1) {
      timeRemainingText = `1 Day ${remHours}h Left`;
    } else if (totalHours > 0) {
      timeRemainingText = `${totalHours}h ${remMins}m Left`;
    } else {
      timeRemainingText = `${remMins}m Left`;
    }
  }

  const status: 'active' | 'expired' | 'suspended' = 
    reseller.status === 'suspended' ? 'suspended' : (isExpired ? 'expired' : 'active');

  return {
    daysLeft,
    isExpired,
    status,
    expiryDate: formattedExpiry,
    expiresAt: isoExpiresAt,
    timeRemainingText,
  };
}

/**
 * Ensures every reseller has a permanent, deterministic API key so it is never missing.
 */
export function getOrCreateResellerApiKey(reseller: { id: string; apiKey?: string; api_key?: string; portalName?: string; portal_name?: string; email?: string }): string {
  const existing = (reseller.apiKey || (reseller as any).api_key || '').toString().trim();
  if (existing) return existing;
  const cleanId = (reseller.id || '').replace(/[^a-zA-Z0-9]/g, '');
  const cleanName = ((reseller.portalName || (reseller as any).portal_name || reseller.email || 'res') as string)
    .substring(0, 6)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  let hex = '';
  for (let i = 0; i < cleanName.length; i++) {
    hex += cleanName.charCodeAt(i).toString(16);
  }
  return `flw_res_${cleanId}_${hex || 'key'}`;
}
