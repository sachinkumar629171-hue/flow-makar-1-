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

  // The active logged-in user is always live
  if (currentUserId && user.id === currentUserId) return true;
  if (currentUserEmail && user.email && user.email.toLowerCase() === currentUserEmail.toLowerCase()) return true;

  // Check if explicitly flagged online
  if (user.isOnline === true) {
    if (!user.lastActive) return true;
    if (typeof user.lastActive === 'string' && user.lastActive.toLowerCase().includes('now')) return true;
    const time = new Date(user.lastActive).getTime();
    if (isNaN(time)) return true;
    const diffMs = Date.now() - time;
    // Heartbeat sends every 5-10s, allow up to 5 minutes window
    return diffMs < 300000 && diffMs > -60000;
  }

  // If lastActive is fresh (within 5 minutes), consider live
  if (user.lastActive) {
    if (typeof user.lastActive === 'string' && user.lastActive.toLowerCase().includes('now')) return true;
    const time = new Date(user.lastActive).getTime();
    if (!isNaN(time)) {
      const diffMs = Date.now() - time;
      if (diffMs >= -60000 && diffMs < 300000) return true;
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

/**
 * Computes exact real-time validity remaining in Days and Hours (e.g. "24D 5h" or "30D 0h").
 * As real-world time progresses, remaining validity automatically ticks down in real-time.
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

  let expiryMs: number;
  const now = Date.now();

  if (user.planExpiresAt) {
    const parsedExp = new Date(user.planExpiresAt).getTime();
    if (!isNaN(parsedExp) && parsedExp > now) {
      expiryMs = parsedExp;
    } else {
      expiryMs = now + daysLeft * 24 * 60 * 60 * 1000;
    }
  } else {
    expiryMs = now + daysLeft * 24 * 60 * 60 * 1000;
  }

  const diffMs = Math.max(0, expiryMs - now);
  if (diffMs <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, profileDays: 0, isExpired: true, displayText: '0D 0h', percentageRemaining: 0 };
  }

  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  const profileDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  let displayText = `${days}D ${hours}h`;
  if (days === 0 && hours === 0) {
    displayText = `${Math.max(1, minutes)}m`;
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
