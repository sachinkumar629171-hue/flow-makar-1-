import { User } from '../types';

/**
 * Checks if a user is genuinely Live / Online in real-time.
 * Strictly verifies that the user is currently active or has pinged within the heartbeat window.
 */
export function isUserLive(
  user: User | null | undefined, 
  currentUserId?: string, 
  currentUserEmail?: string
): boolean {
  if (!user) return false;

  // The active logged-in user viewing the dashboard is live
  if (currentUserId && user.id === currentUserId) return true;
  if (currentUserEmail && user.email && user.email.toLowerCase() === currentUserEmail.toLowerCase()) return true;

  // Real-time verification: User is ONLY LIVE if they have sent a request/heartbeat within the last 2 minutes (120,000 ms)
  if (user.lastActive) {
    if (typeof user.lastActive === 'string' && user.lastActive.toLowerCase().includes('now')) return true;
    const time = new Date(user.lastActive).getTime();
    if (!isNaN(time)) {
      const diffMs = Date.now() - time;
      return diffMs < 120000 && diffMs >= -60000;
    }
  }

  return false;
}

/**
 * Returns human-readable relative active time for a user
 */
export function formatUserLastActive(
  user: User | null | undefined, 
  currentUserId?: string, 
  currentUserEmail?: string
): string {
  if (!user) return 'Offline';
  if (isUserLive(user, currentUserId, currentUserEmail)) return 'LIVE NOW';
  if (!user.lastActive) return 'Offline';
  if (typeof user.lastActive === 'string' && user.lastActive.toLowerCase().includes('now')) return 'Active just now';

  const time = new Date(user.lastActive).getTime();
  if (isNaN(time)) return user.lastActive || 'Offline';

  const diffMs = Math.max(0, Date.now() - time);
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Active just now';
  if (diffMins < 60) return `Active ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Active ${diffDays}d ago`;
}

// Memory cache for user plan expiry times to guarantee real-time non-freezing ticking
const userExpiryCache = new Map<string, { daysLeft: number; expiryMs: number; setAt: number }>();

/**
 * Gets or initializes a persistent expiry timestamp for a user so countdowns continuously tick down.
 */
export function getOrInitUserExpiryMs(user: User): number {
  const now = Date.now();
  const daysLeft = typeof user.planDaysLeft === 'number' ? Math.max(0, user.planDaysLeft) : 30;
  if (daysLeft <= 0 || user.status === 'suspended') {
    return now;
  }

  // 1. If explicit planExpiresAt is provided on user object, respect it
  if (user.planExpiresAt) {
    const parsedExp = new Date(user.planExpiresAt).getTime();
    if (!isNaN(parsedExp)) {
      userExpiryCache.set(user.id, { daysLeft, expiryMs: parsedExp, setAt: now });
      return parsedExp;
    }
  }

  // 2. Check memory cache
  const cached = userExpiryCache.get(user.id);
  if (cached && cached.daysLeft === daysLeft) {
    return cached.expiryMs;
  }

  // 3. Check localStorage persistent cache
  try {
    const storageKey = `flowmaker_user_expiry_${user.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed.expiryMs === 'number' && parsed.daysLeft === daysLeft) {
        userExpiryCache.set(user.id, { daysLeft, expiryMs: parsed.expiryMs, setAt: parsed.setAt || now });
        return parsed.expiryMs;
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  // 4. Derive from createdAt timestamp if present and valid
  let calculatedExpiryMs: number;
  if (user.createdAt) {
    const createdMs = new Date(user.createdAt).getTime();
    if (!isNaN(createdMs) && createdMs <= now && (now - createdMs) < (daysLeft * 86400000)) {
      calculatedExpiryMs = createdMs + (daysLeft * 86400000);
    } else {
      calculatedExpiryMs = now + (daysLeft * 86400000);
    }
  } else {
    calculatedExpiryMs = now + (daysLeft * 86400000);
  }

  // Save to memory cache & localStorage
  userExpiryCache.set(user.id, { daysLeft, expiryMs: calculatedExpiryMs, setAt: now });
  try {
    localStorage.setItem(`flowmaker_user_expiry_${user.id}`, JSON.stringify({
      daysLeft,
      expiryMs: calculatedExpiryMs,
      setAt: now
    }));
  } catch {
    // Ignore storage quota errors
  }

  return calculatedExpiryMs;
}

/**
 * Updates or resets the expiry timestamp when admin/reseller changes a user's validity.
 */
export function setUserExpiryMs(userId: string, newDays: number, exactExpiryMs?: number) {
  const now = Date.now();
  const safeDays = Math.max(0, newDays);
  const expiryMs = exactExpiryMs || (now + safeDays * 86400000);
  userExpiryCache.set(userId, { daysLeft: safeDays, expiryMs, setAt: now });
  try {
    localStorage.setItem(`flowmaker_user_expiry_${userId}`, JSON.stringify({
      daysLeft: safeDays,
      expiryMs,
      setAt: now
    }));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Computes exact real-time validity remaining in Days, Hours, and Minutes (e.g. "24D 23h", "24D 4h", "5h 30m").
 * As real-world time progresses, remaining validity automatically and continuously ticks down in real-time.
 */
export function getUserValidityTime(user: User | null | undefined): {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  profileDays: number;
  isExpired: boolean;
  displayText: string;
  percentageRemaining: number;
} {
  if (!user) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, profileDays: 0, isExpired: true, displayText: '0D 0h', percentageRemaining: 0 };
  }

  // Admin user has lifetime access (100% full line)
  if (user.role === 'admin' || (user.email && (user.email.toLowerCase() === 'sachinxexplore@gmail.com' || user.email.toLowerCase() === 'sachinkumar629171@gmail.com'))) {
    return { totalMs: Infinity, days: 999, hours: 0, minutes: 0, profileDays: 999, isExpired: false, displayText: 'Lifetime', percentageRemaining: 100 };
  }

  const daysLeft = typeof user.planDaysLeft === 'number' ? Math.max(0, user.planDaysLeft) : 30;
  if (daysLeft <= 0 || user.status === 'suspended') {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, profileDays: 0, isExpired: true, displayText: '0D 0h', percentageRemaining: 0 };
  }

  const now = Date.now();
  const expiryMs = getOrInitUserExpiryMs(user);
  const diffMs = Math.max(0, expiryMs - now);

  if (diffMs <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, profileDays: 0, isExpired: true, displayText: '0D 0h', percentageRemaining: 0 };
  }

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const profileDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

  let displayText = `${days}D ${hours}h`;
  if (days === 0) {
    if (hours === 0) {
      displayText = `${Math.max(1, minutes)}m`;
    } else {
      displayText = `${hours}h ${minutes}m`;
    }
  }

  const totalDurationMs = Math.max(daysLeft, 30) * 24 * 60 * 60 * 1000;
  const percentageRemaining = Math.min(100, Math.max(0, (diffMs / (totalDurationMs || 1)) * 100));

  return {
    totalMs: diffMs,
    days,
    hours,
    minutes,
    profileDays,
    isExpired: false,
    displayText,
    percentageRemaining,
  };
}

/**
 * Computes exact credit statistics: Total Given (Mila), Total Used (Use Kiya), and Remaining (Bacha)
 */
export function getUserCreditStats(user: User | null | undefined): {
  totalAllocated: number;
  totalUsed: number;
  remaining: number;
  percentageUsed: number;
  percentageRemaining: number;
} {
  if (!user) {
    return {
      totalAllocated: 0,
      totalUsed: 0,
      remaining: 0,
      percentageUsed: 0,
      percentageRemaining: 0,
    };
  }

  const planDefault = user.plan === 'ultra' ? 45000 : 100;
  const remaining = typeof user.credits === 'number' ? Math.max(0, user.credits) : 0;
  
  // Total allocated limit
  let totalAllocated = typeof user.maxCredits === 'number' && user.maxCredits > 0 
    ? user.maxCredits 
    : Math.max(remaining, planDefault);

  // If remaining is somehow higher than maxCredits, scale totalAllocated up
  if (remaining > totalAllocated) {
    totalAllocated = remaining;
  }

  // Total used credits
  let totalUsed = typeof user.usedCredits === 'number' && user.usedCredits >= 0
    ? user.usedCredits
    : Math.max(0, totalAllocated - remaining);

  const percentageUsed = totalAllocated > 0 ? Math.min(100, Math.max(0, (totalUsed / totalAllocated) * 100)) : 0;
  const percentageRemaining = totalAllocated > 0 ? Math.min(100, Math.max(0, (remaining / totalAllocated) * 100)) : 0;

  return {
    totalAllocated,
    totalUsed,
    remaining,
    percentageUsed,
    percentageRemaining,
  };
}
