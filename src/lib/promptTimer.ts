// Utility functions for Server Prompt reminder timers, countdowns, and formatting

export interface PromptServerTimeStatus {
  lastUpdatedText: string;
  timeLeftText: string;
  status: 'fresh' | 'warning' | 'expired' | 'never';
  minutesRemaining: number;
  totalIntervalMinutes: number;
  percentageRemaining: number;
  isOverdue: boolean;
  overdueMinutes: number;
  lastUpdatedExact?: string;
  updatedByText?: string;
}

export function calculateServerTimeStatus(
  lastUpdatedAt?: string,
  updatedBy?: string,
  reminderIntervalMinutes: number = 120
): PromptServerTimeStatus {
  const interval = Math.max(1, Number(reminderIntervalMinutes) || 120);

  if (!lastUpdatedAt) {
    return {
      lastUpdatedText: 'Not updated yet',
      timeLeftText: 'Needs initial prompt',
      status: 'never',
      minutesRemaining: 0,
      totalIntervalMinutes: interval,
      percentageRemaining: 0,
      isOverdue: true,
      overdueMinutes: 0,
      updatedByText: updatedBy ? `by ${updatedBy}` : undefined,
    };
  }

  const lastUpdatedTime = new Date(lastUpdatedAt).getTime();
  if (isNaN(lastUpdatedTime)) {
    return {
      lastUpdatedText: 'Not updated yet',
      timeLeftText: 'Needs initial prompt',
      status: 'never',
      minutesRemaining: 0,
      totalIntervalMinutes: interval,
      percentageRemaining: 0,
      isOverdue: true,
      overdueMinutes: 0,
    };
  }

  const now = Date.now();
  const elapsedMs = now - lastUpdatedTime;
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
  const intervalMs = interval * 60 * 1000;
  const expiryTime = lastUpdatedTime + intervalMs;
  const remainingMs = expiryTime - now;
  const remainingMinutes = Math.floor(remainingMs / (60 * 1000));

  // Format Elapsed Text (Kitna time pehle update hua)
  let lastUpdatedText = '';
  if (elapsedMinutes < 1) {
    lastUpdatedText = 'Updated just now';
  } else if (elapsedMinutes < 60) {
    lastUpdatedText = `Updated ${elapsedMinutes}m ago`;
  } else {
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    lastUpdatedText = mins > 0 ? `Updated ${hours}h ${mins}m ago` : `Updated ${hours}h ago`;
  }

  // Format Time Left (Kitna timing bacha hai)
  let timeLeftText = '';
  let status: 'fresh' | 'warning' | 'expired' = 'fresh';
  let percentageRemaining = 100;
  let isOverdue = false;
  let overdueMinutes = 0;

  if (remainingMs <= 0) {
    isOverdue = true;
    overdueMinutes = Math.abs(remainingMinutes);
    status = 'expired';
    percentageRemaining = 0;
    if (overdueMinutes < 1) {
      timeLeftText = 'Expired just now (Update prompt!)';
    } else if (overdueMinutes < 60) {
      timeLeftText = `Overdue by ${overdueMinutes}m (Update prompt!)`;
    } else {
      const hours = Math.floor(overdueMinutes / 60);
      const mins = overdueMinutes % 60;
      timeLeftText = `Overdue by ${hours}h ${mins}m (Update prompt!)`;
    }
  } else {
    const ratio = remainingMs / intervalMs;
    percentageRemaining = Math.max(0, Math.min(100, Math.round(ratio * 100)));

    if (remainingMinutes < 1) {
      timeLeftText = 'Less than 1 min left only!';
      status = 'warning';
    } else if (remainingMinutes < 60) {
      timeLeftText = `${remainingMinutes}m left only`;
      status = remainingMinutes <= 20 ? 'warning' : 'fresh';
    } else {
      const hours = Math.floor(remainingMinutes / 60);
      const mins = remainingMinutes % 60;
      timeLeftText = mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
      status = 'fresh';
    }
  }

  return {
    lastUpdatedText,
    timeLeftText,
    status,
    minutesRemaining: Math.max(0, remainingMinutes),
    totalIntervalMinutes: interval,
    percentageRemaining,
    isOverdue,
    overdueMinutes,
    lastUpdatedExact: new Date(lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    updatedByText: updatedBy ? `by ${updatedBy}` : undefined,
  };
}
