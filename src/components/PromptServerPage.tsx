import React, { useState, useEffect } from 'react';
import { apiUrl } from '../config/api';
import { 
  X, 
  Save, 
  Server, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Copy, 
  Check, 
  Video, 
  ShieldCheck, 
  Sparkles,
  Clock,
  RotateCcw,
  Timer,
  AlertTriangle,
  History,
  Send,
  Bell,
  Eye,
  EyeOff,
  Radio,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ServerPromptConfig, TelegramAlertConfig } from '../types';
import { calculateServerTimeStatus } from '../lib/promptTimer';
import { formatISTDateTime, sendTelegramNotification, generateTestAlertMessage, generateRecoveryMessage } from '../lib/telegramNotifier';

interface PromptServerPageProps {
  onBack: () => void;
}

export const PromptServerPage: React.FC<PromptServerPageProps> = ({ onBack }) => {
  const { currentUser, promptConfig, updatePromptConfig, isAdmin, updateUserCredits } = useAuth();
  
  const isUltra = currentUser?.plan === 'ultra';
  const canEdit = isAdmin || Boolean(currentUser?.canEditPrompts);
  const hasAccess = canEdit;

  const dirtyServersRef = React.useRef<Set<string>>(new Set());
  const isFocusedRef = React.useRef<boolean>(false);

  const [localServers, setLocalServers] = useState<ServerPromptConfig[]>(() => {
    if (promptConfig?.servers && promptConfig.servers.length > 0) {
      return promptConfig.servers;
    }
    return [
      { id: 'server1', label: 'Server 1', prompt: promptConfig?.server1Prompt || '', lastUpdatedAt: new Date().toISOString() },
      { id: 'server2', label: 'Server 2', prompt: promptConfig?.server2Prompt || '', lastUpdatedAt: new Date().toISOString() },
    ];
  });

  const [imageCost, setImageCost] = useState<number>(promptConfig?.costs?.image ?? 20);
  const [videoCost, setVideoCost] = useState<number>(promptConfig?.costs?.video ?? 30);
  const [reminderMinutes, setReminderMinutes] = useState<number>(promptConfig?.promptReminderMinutes ?? 120);
  
  // Option 2: Cloudflare Dynamic Worker Relay State
  const [cloudflareEnabled, setCloudflareEnabled] = useState<boolean>(promptConfig?.cloudflareEnabled ?? false);
  const [cloudflareUrl, setCloudflareUrl] = useState<string>(promptConfig?.cloudflareUrl || 'https://flowmaker-prompts.sachinkumar23406.workers.dev');
  const [isTestingCloudflare, setIsTestingCloudflare] = useState<boolean>(false);
  const [cloudflareTestResult, setCloudflareTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    serversFound?: string[];
    updatedAt?: string;
  } | null>(null);

  // Telegram Bot State
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(promptConfig?.telegramAlerts?.enabled ?? false);
  const [botToken, setBotToken] = useState<string>(promptConfig?.telegramAlerts?.botToken ?? '');
  const [chatId, setChatId] = useState<string>(promptConfig?.telegramAlerts?.chatId ?? '');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(promptConfig?.telegramAlerts?.reminderMinutesBefore ?? 20);
  const [missedAlertMinutesAfter, setMissedAlertMinutesAfter] = useState<number>(promptConfig?.telegramAlerts?.missedAlertMinutesAfter ?? 5);
  const [showBotToken, setShowBotToken] = useState<boolean>(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState<boolean>(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showManualPrompts, setShowManualPrompts] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedServerId, setSavedServerId] = useState<string | null>(null);
  
  // Live ticker to update countdown every 10 seconds
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Sync state if promptConfig loads or changes from another source, without overwriting active edits!
  useEffect(() => {
    if (promptConfig?.servers && promptConfig.servers.length > 0) {
      setLocalServers(prev => {
        return promptConfig.servers.map(remoteSrv => {
          if (dirtyServersRef.current.has(remoteSrv.id)) {
            const local = prev.find(l => l.id === remoteSrv.id);
            return local || remoteSrv;
          }
          return remoteSrv;
        });
      });
    }
    if (promptConfig?.costs && !isFocusedRef.current) {
      setImageCost(promptConfig.costs.image ?? 20);
      setVideoCost(promptConfig.costs.video ?? 30);
    }
    if (promptConfig?.promptReminderMinutes !== undefined && !isFocusedRef.current) {
      setReminderMinutes(promptConfig.promptReminderMinutes);
    }
    if (promptConfig?.cloudflareEnabled !== undefined && !isFocusedRef.current) {
      setCloudflareEnabled(promptConfig.cloudflareEnabled);
    }
    if (promptConfig?.cloudflareUrl && !isFocusedRef.current) {
      setCloudflareUrl(promptConfig.cloudflareUrl);
    }
    if (promptConfig?.telegramAlerts && !isFocusedRef.current) {
      setTelegramEnabled(promptConfig.telegramAlerts.enabled ?? false);
      setBotToken(promptConfig.telegramAlerts.botToken ?? '');
      setChatId(promptConfig.telegramAlerts.chatId ?? '');
      setReminderMinutesBefore(promptConfig.telegramAlerts.reminderMinutesBefore ?? 20);
      setMissedAlertMinutesAfter(promptConfig.telegramAlerts.missedAlertMinutesAfter ?? 5);
    }
  }, [promptConfig]);

  // Test Cloudflare Worker integration (Direct 100% Pure Client-Side Fetch)
  const handleTestCloudflare = async () => {
    const cleanUrl = cloudflareUrl.trim();
    if (!cleanUrl) {
      setCloudflareTestResult({
        success: false,
        message: 'Please enter a valid Cloudflare Worker URL (e.g. https://flowmaker-prompts.sachinkumar23406.workers.dev)',
      });
      return;
    }

    setIsTestingCloudflare(true);
    setCloudflareTestResult(null);

    const startTime = Date.now();

    try {
      const urlWithTimestamp = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const res = await fetch(urlWithTimestamp);

      if (!res.ok) {
        throw new Error(`Cloudflare Worker returned HTTP ${res.status}: ${res.statusText}`);
      }

      const cfData = await res.json();
      const latencyMs = Date.now() - startTime;
      const keysFound = Object.keys(cfData).filter(k => k.startsWith('server') && Boolean(cfData[k]));

      setCloudflareTestResult({
        success: true,
        message: `Live Connection Successful! Found ${keysFound.length} active server keys (${keysFound.join(', ')}).`,
        latencyMs,
        serversFound: keysFound,
        updatedAt: cfData.updatedAt || new Date().toISOString(),
      });

      // Automatically sync latest prompts from Cloudflare into local server boxes
      setLocalServers(prev => {
        let updated = [...prev];
        updated = updated.map((srv, idx) => {
          const keyNum = idx + 1;
          const cfKey = `server${keyNum}`;
          if (cfData[cfKey] !== undefined && cfData[cfKey] !== '') {
            const promptVal = typeof cfData[cfKey] === 'object' ? JSON.stringify(cfData[cfKey]) : String(cfData[cfKey]);
            return { ...srv, prompt: promptVal, lastUpdatedAt: cfData.updatedAt || new Date().toISOString() };
          }
          return srv;
        });

        for (let i = 1; i <= 8; i++) {
          const key = `server${i}`;
          if (cfData[key] && !updated.find(s => s.id === key || s.label.toLowerCase() === `server ${i}`)) {
            const promptVal = typeof cfData[key] === 'object' ? JSON.stringify(cfData[key]) : String(cfData[key]);
            updated.push({
              id: key,
              label: `Server ${i}`,
              prompt: promptVal,
              lastUpdatedAt: cfData.updatedAt || new Date().toISOString(),
              updatedBy: 'Cloudflare Worker',
            });
          }
        }
        return updated;
      });
    } catch (err: any) {
      setCloudflareTestResult({
        success: false,
        message: `Connection Error: ${err?.message || 'Failed to reach Cloudflare Worker'}`,
      });
    } finally {
      setIsTestingCloudflare(false);
    }
  };

  // SMART GLOBAL SAVE: Only servers whose prompt was actually modified get their timer restarted!
  const handleSaveAll = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    dirtyServersRef.current.clear();
    const nowIso = new Date().toISOString();
    const updaterName = currentUser?.name || currentUser?.email?.split('@')[0] || (isAdmin ? 'Admin' : 'Prompt Editor');

    const previousServers = promptConfig?.servers || [];
    const updatedServers = localServers.map(s => {
      const prev = previousServers.find(p => p.id === s.id);
      const isPromptChanged = !prev || prev.prompt !== s.prompt;

      if (isPromptChanged) {
        return {
          ...s,
          lastUpdatedAt: nowIso,
          updatedBy: updaterName,
          reminded20MinSent: false,
          missed5MinSent: false,
          wasMissed: false,
        };
      }
      // If unchanged, retain original timestamp and alerts status!
      return {
        ...s,
        lastUpdatedAt: prev?.lastUpdatedAt || s.lastUpdatedAt || nowIso,
        updatedBy: prev?.updatedBy || s.updatedBy || updaterName,
        reminded20MinSent: prev?.reminded20MinSent,
        missed5MinSent: prev?.missed5MinSent,
        wasMissed: prev?.wasMissed,
      };
    });

    setLocalServers(updatedServers);

    const tgAlertConfig: TelegramAlertConfig = {
      enabled: telegramEnabled,
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      reminderMinutesBefore: Number(reminderMinutesBefore) || 20,
      missedAlertMinutesAfter: Number(missedAlertMinutesAfter) || 5,
    };

    try {
      await updatePromptConfig({
        servers: updatedServers,
        costs: {
          image: Number(imageCost) || 20,
          video: Number(videoCost) || 30,
        },
        promptReminderMinutes: Number(reminderMinutes) || 120,
        cloudflareEnabled,
        cloudflareUrl: cloudflareUrl.trim(),
        telegramAlerts: tgAlertConfig,
        server1Prompt: updatedServers[0]?.prompt || '',
        server2Prompt: updatedServers[1]?.prompt || '',
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error saving prompt config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // EXCLUSIVE INDIVIDUAL SERVER SAVE: Only updates & resets timestamp for target server!
  const handleSaveSingleServer = async (serverId: string) => {
    if (!canEdit) return;
    const nowIso = new Date().toISOString();
    const updaterName = currentUser?.name || currentUser?.email?.split('@')[0] || (isAdmin ? 'Admin' : 'Prompt Editor');
    const previousServers = promptConfig?.servers || [];
    const prevServer = previousServers.find(p => p.id === serverId);

    const updatedServers = localServers.map(s => {
      if (s.id === serverId) {
        return {
          ...s,
          lastUpdatedAt: nowIso,
          updatedBy: updaterName,
          reminded20MinSent: false,
          missed5MinSent: false,
          wasMissed: false,
        };
      }
      return s;
    });

    setLocalServers(updatedServers);
    dirtyServersRef.current.delete(serverId);
    setIsSaving(true);
    setSavedServerId(serverId);

    const tgAlertConfig: TelegramAlertConfig = {
      enabled: telegramEnabled,
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      reminderMinutesBefore: Number(reminderMinutesBefore) || 20,
      missedAlertMinutesAfter: Number(missedAlertMinutesAfter) || 5,
    };

    // If server was overdue/missed, send Recovery notification to Telegram channel
    if (tgAlertConfig.enabled && tgAlertConfig.botToken && tgAlertConfig.chatId && prevServer?.wasMissed) {
      const oldLastUpdatedMs = new Date(prevServer.lastUpdatedAt || Date.now()).getTime();
      const cycleMinutes = Number(reminderMinutes) || 120;
      const oldExpiryTime = oldLastUpdatedMs + cycleMinutes * 60 * 1000;
      const delayMinutes = Math.max(1, Math.floor((Date.now() - oldExpiryTime) / 60000));
      const targetServer = updatedServers.find(s => s.id === serverId);
      const recoveryMsg = generateRecoveryMessage(
        targetServer?.label || 'Server',
        serverId,
        delayMinutes,
        updaterName,
        cycleMinutes
      );
      sendTelegramNotification(tgAlertConfig.botToken, tgAlertConfig.chatId, recoveryMsg).catch(() => {});
    }

    try {
      await updatePromptConfig({
        servers: updatedServers,
        costs: {
          image: Number(imageCost) || 20,
          video: Number(videoCost) || 30,
        },
        promptReminderMinutes: Number(reminderMinutes) || 120,
        telegramAlerts: tgAlertConfig,
        server1Prompt: updatedServers[0]?.prompt || '',
        server2Prompt: updatedServers[1]?.prompt || '',
      });
      setTimeout(() => setSavedServerId(null), 3000);
    } catch (err) {
      console.error('Error saving server:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Test Telegram Bot integration (Direct + Serverless with full diagnostics)
  const handleTestTelegram = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setTelegramTestResult({
        success: false,
        message: 'Please fill both Telegram Bot Token and Chat/Channel ID before testing.',
      });
      return;
    }

    setIsTestingTelegram(true);
    setTelegramTestResult(null);

    try {
      const testMsg = generateTestAlertMessage();
      const result = await sendTelegramNotification(botToken.trim(), chatId.trim(), testMsg);

      if (result.success) {
        setTelegramTestResult({
          success: true,
          message: 'Success! Test message delivered to your Telegram Channel/Group in IST format.',
        });
      } else {
        setTelegramTestResult({
          success: false,
          message: result.error || 'Failed to send test message. Check Bot Token & Chat ID.',
        });
      }
    } catch (err: any) {
      setTelegramTestResult({
        success: false,
        message: err?.message || 'Network error testing Telegram Bot.',
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const addServer = () => {
    if (!canEdit) return;
    const nextNum = localServers.length + 1;
    const newServer: ServerPromptConfig = {
      id: `server_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
      label: `Server ${nextNum}`,
      prompt: '',
      lastUpdatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Admin',
      reminded20MinSent: false,
      missed5MinSent: false,
      wasMissed: false,
    };
    setLocalServers([...localServers, newServer]);
  };

  const removeServer = (id: string) => {
    if (!canEdit || localServers.length <= 1) return;
    setLocalServers(localServers.filter(s => s.id !== id));
  };

  const updateServer = (id: string, data: Partial<ServerPromptConfig>) => {
    if (!canEdit) return;
    dirtyServersRef.current.add(id);
    setLocalServers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center p-6 text-center">
        <div className="space-y-4 max-w-md bg-[#121318] border border-neutral-800 p-8 rounded-3xl shadow-2xl">
          <div className="p-4 bg-rose-500/10 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
            <X className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Access Restricted</h1>
          <p className="text-neutral-400 text-sm">
            This Prompt Server dashboard is only accessible to authorized Prompt Editors and Administrators.
          </p>
          <button 
            onClick={onBack} 
            className="px-6 py-2.5 bg-neutral-800 text-white text-sm font-semibold rounded-xl hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            Go Back to Studio
          </button>
        </div>
      </div>
    );
  }

  // Calculate global summary metrics
  const activeInterval = Number(reminderMinutes) || 120;
  const serverStatuses = localServers.map(s => calculateServerTimeStatus(s.lastUpdatedAt, s.updatedBy, activeInterval));
  const expiredCount = serverStatuses.filter(st => st.status === 'expired' || st.status === 'never').length;
  const warningCount = serverStatuses.filter(st => st.status === 'warning').length;
  const freshCount = serverStatuses.filter(st => st.status === 'fresh').length;
  const currentIst = formatISTDateTime(new Date());

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-neutral-900 bg-[#08090d]/90 backdrop-blur-xl px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-white/5 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Back to Studio"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <Terminal className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white leading-tight">Prompt Server Console</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  Live Sync
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800">
                  IST: {currentIst.timeStr}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-medium">
                {isAdmin ? '👑 Super Admin Control' : canEdit ? '⚡ Authorized Prompt Editor' : '🌟 Ultra Member Access'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canEdit && (
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-lg shadow-purple-900/30 active:scale-95 cursor-pointer"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveSuccess ? 'Changes Saved!' : 'Save & Sync All'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* User Status Header */}
        <div className="bg-[#121318] border border-neutral-800 rounded-2xl p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {currentUser?.name?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-white text-base truncate max-w-[240px]">
                {currentUser?.name || currentUser?.email?.split('@')[0]}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${isUltra ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                  {isUltra ? 'Flow Ultra' : 'Flow Basic'}
                </span>
                {isAdmin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-wider">
                    Admin
                  </span>
                )}
                {canEdit && !isAdmin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Prompt Editor Access
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-0.5">Credits</p>
              <p className="text-lg font-black text-white">{currentUser?.credits?.toLocaleString() || 0}</p>
            </div>
            <div className="w-px h-8 bg-neutral-800" />
            <div className="text-center">
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-0.5">Indian Time (IST)</p>
              <p className="text-sm font-mono font-bold text-cyan-300">{currentIst.timeStr}</p>
            </div>
          </div>
        </div>

        {/* TELEGRAM BOT NOTIFICATIONS & CHANNEL ALERTS CARD (ONLY IN ADMIN) */}
        {isAdmin && (
          <div className="bg-gradient-to-r from-[#0e1628] via-[#101426] to-[#121320] border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Telegram Channel / Group Alert Bot</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${telegramEnabled && botToken && chatId ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}>
                    {telegramEnabled && botToken && chatId ? '● Alerts Active' : '○ Not Configured'}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-0.5">
                  20 minutes pehle reminder, 5 minutes overdue hone par Indian Time alert, aur update hone par delay duration message automatically bhejega.
                </p>
              </div>
            </div>

            {canEdit && (
              <label className="flex items-center gap-2.5 cursor-pointer bg-black/40 px-3 py-1.5 rounded-xl border border-neutral-800 self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={e => setTelegramEnabled(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-white">Enable Telegram Alerts</span>
              </label>
            )}
          </div>

          {/* Telegram Inputs & Configuration */}
          {canEdit && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bot Token */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span>Telegram Bot API Token:</span>
                    <a 
                      href="https://t.me/BotFather" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <span>Get from @BotFather</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </label>
                  <div className="relative">
                    <input
                      type={showBotToken ? 'text' : 'password'}
                      value={botToken}
                      onChange={e => setBotToken(e.target.value)}
                      placeholder="e.g. 7123456789:AAHxyzABCdef123..."
                      className="w-full bg-[#080b12] border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs font-mono text-cyan-200 focus:outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBotToken(!showBotToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Chat ID / Channel Username */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span>Telegram Channel / Group Chat ID:</span>
                    <span className="text-[10px] text-neutral-400 font-mono">e.g. -1001234567890 or @channel</span>
                  </label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={e => setChatId(e.target.value)}
                    placeholder="e.g. -1001928374651 or @my_prompt_channel"
                    className="w-full bg-[#080b12] border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs font-mono text-cyan-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Timing Threshold Settings & Test Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-4 flex-wrap text-xs text-neutral-300">
                  <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-neutral-800">
                    <span>⏳ Reminder Threshold:</span>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={reminderMinutesBefore}
                      onChange={e => setReminderMinutesBefore(Number(e.target.value) || 20)}
                      className="w-12 bg-black border border-cyan-500/40 rounded px-1.5 py-0.5 text-center font-bold text-cyan-300 text-xs"
                    />
                    <span className="text-neutral-400 text-[11px]">mins before</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-neutral-800">
                    <span>🚨 Missed Alert Threshold:</span>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={missedAlertMinutesAfter}
                      onChange={e => setMissedAlertMinutesAfter(Number(e.target.value) || 5)}
                      className="w-12 bg-black border border-rose-500/40 rounded px-1.5 py-0.5 text-center font-bold text-rose-300 text-xs"
                    />
                    <span className="text-neutral-400 text-[11px]">mins overdue</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={isTestingTelegram || !botToken || !chatId}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-900/40 cursor-pointer active:scale-95 shrink-0"
                >
                  {isTestingTelegram ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Test Telegram Alert</span>
                </button>
              </div>

              {/* Test Result Message */}
              {telegramTestResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 font-mono ${telegramTestResult.success ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200' : 'bg-rose-950/80 border border-rose-500 text-rose-200'}`}>
                  {telegramTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
                  <span>{telegramTestResult.message}</span>
                </div>
              )}

              {/* Quick Telegram Channel Setup Guide */}
              <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-3 text-[11px] text-neutral-300 space-y-1.5">
                <p className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Channel Setup Steps (Zaroori Settings):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-neutral-400 pt-1">
                  <div className="bg-[#080b12] p-2 rounded-lg border border-neutral-800">
                    <b className="text-white">1. Bot Token:</b> Telegram pe <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-cyan-400 underline">@BotFather</a> se bot banayein aur API Token paste karein.
                  </div>
                  <div className="bg-[#080b12] p-2 rounded-lg border border-neutral-800">
                    <b className="text-white">2. Admin Rights:</b> Apne Channel / Group me Bot ko <b>Administrator</b> banayein aur <i>"Post Messages"</i> ON karein.
                  </div>
                  <div className="bg-[#080b12] p-2 rounded-lg border border-neutral-800">
                    <b className="text-white">3. Channel ID:</b> Public channel ka username (<code>@mychannel</code>) ya private channel ka ID (<code>-100...</code>) daalein.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* OPTION 2: CLOUDFLARE DYNAMIC WORKER RELAY HUB */}
        {isAdmin && (
          <div className={`border rounded-2xl p-5 sm:p-6 shadow-2xl transition-all space-y-4 ${
            cloudflareEnabled 
              ? 'bg-gradient-to-r from-[#0d1c24] via-[#0f172a] to-[#131127] border-emerald-500/50 shadow-emerald-950/20' 
              : 'bg-[#10121a] border-neutral-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-4">
              <div className="flex items-start gap-3.5">
                <div className={`p-3 rounded-xl border shrink-0 mt-0.5 ${
                  cloudflareEnabled 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}>
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white tracking-tight">Option 2: Cloudflare Dynamic Server Relay</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1 ${
                      cloudflareEnabled 
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60' 
                        : 'bg-neutral-900 text-neutral-400 border-neutral-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cloudflareEnabled ? 'bg-emerald-400 animate-ping' : 'bg-neutral-500'}`}></span>
                      {cloudflareEnabled ? '● Option 2 ON (Live Cloudflare Relay Active)' : '○ Option 2 OFF (Option 1 Admin Local Active)'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                    Jab <b>Option 2 ON</b> rahega, toh Chrome Extensions live prompts seedha aapke Cloudflare Worker URL se dynamic fetch karengi. Aapke jitne servers wahan configured hain (`server1`, `server2`, `server3`...), automatically dynamically link ho jayenge!
                  </p>
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                  <label className="relative inline-flex items-center cursor-pointer bg-black/50 px-3.5 py-2 rounded-xl border border-neutral-700 hover:border-neutral-600 transition-all">
                    <input
                      type="checkbox"
                      checked={cloudflareEnabled}
                      onChange={e => setCloudflareEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[10px] after:left-[16px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span className="ml-3 text-xs font-bold text-white">
                      {cloudflareEnabled ? 'OPTION 2 ON' : 'OPTION 2 OFF'}
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Cloudflare URL Configuration & Test Action */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cloudflare Worker Live Endpoint URL (Saved to Supabase):</span>
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">Real-time sync to all extensions</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={cloudflareUrl}
                      onChange={e => setCloudflareUrl(e.target.value)}
                      placeholder="https://flowmaker-prompts.YOUR-SUBDOMAIN.workers.dev"
                      className="w-full bg-[#080c14] border border-neutral-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-300 focus:outline-none pr-24"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(cloudflareUrl)}
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300 transition-colors"
                        title="Copy URL"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-end pt-5 sm:pt-0">
                  <button
                    type="button"
                    onClick={handleTestCloudflare}
                    disabled={isTestingCloudflare || !cloudflareUrl.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-95"
                  >
                    {isTestingCloudflare ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Radio className="w-4 h-4" />
                    )}
                    <span>Test & Sync Live Prompts</span>
                  </button>
                </div>
              </div>

              {/* Cloudflare Test Result Banner */}
              {cloudflareTestResult && (
                <div className={`p-3.5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono ${
                  cloudflareTestResult.success 
                    ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200' 
                    : 'bg-rose-950/80 border border-rose-500 text-rose-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {cloudflareTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
                    <span>{cloudflareTestResult.message}</span>
                  </div>
                  {cloudflareTestResult.latencyMs !== undefined && (
                    <div className="flex items-center gap-3 text-[11px] text-emerald-400">
                      <span>⚡ Latency: {cloudflareTestResult.latencyMs}ms</span>
                      {cloudflareTestResult.updatedAt && (
                        <span>🕒 Updated: {new Date(cloudflareTestResult.updatedAt).toLocaleTimeString()}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROMPT REMINDER & TIMING CONFIGURATION BANNER */}
        <div className="bg-gradient-to-r from-[#141525] via-[#151128] to-[#121320] border border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-purple-600/20 border border-purple-500/30 rounded-xl text-purple-300 shrink-0 mt-0.5">
                <Timer className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">Server Prompts & Auto-Countdown</h3>
                  <span className="px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/60 text-[10px] font-mono font-bold">
                    Cycle: {reminderMinutes} mins ({Math.round((reminderMinutes / 60) * 10) / 10}h)
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  Server 1 aur Server 2 ke prompts directly portal se sync hote hain. Har server ka countdown independent update hota hai.
                </p>
              </div>
            </div>

            {canEdit && (
              <div className="bg-[#0b0c12]/90 border border-purple-500/30 rounded-xl p-3 space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    Set Reminder Cycle:
                  </span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      value={reminderMinutes}
                      onChange={e => setReminderMinutes(Math.max(1, Number(e.target.value) || 120))}
                      className="w-16 px-2 py-1 bg-black border border-purple-500/50 rounded-lg text-center font-bold text-purple-300 text-xs focus:outline-none focus:border-purple-400"
                    />
                    <span className="text-[11px] text-neutral-400">mins</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic List of Servers */}
        <div className="grid gap-5">
              {localServers.map((server, index) => {
                const timeStatus = calculateServerTimeStatus(server.lastUpdatedAt, server.updatedBy, activeInterval);
                const isThisServerSaving = isSaving && savedServerId === server.id;

                return (
                  <div 
                    key={server.id} 
                    className={`bg-[#121318] border rounded-2xl p-5 sm:p-6 transition-all shadow-xl space-y-4 relative ${
                      timeStatus.status === 'expired' || timeStatus.status === 'never'
                        ? 'border-rose-500/40 bg-gradient-to-b from-[#181119] to-[#121318]'
                        : timeStatus.status === 'warning'
                        ? 'border-amber-500/40 bg-gradient-to-b from-[#181611] to-[#121318]'
                        : 'border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
                      <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                        <div className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-purple-400 shrink-0">
                          <Server className="w-4 h-4" />
                        </div>
                        {canEdit ? (
                          <input
                            type="text"
                            value={server.label}
                            onChange={(e) => updateServer(server.id, { label: e.target.value })}
                            placeholder={`Server ${index + 1}`}
                            className="bg-neutral-900/80 border border-neutral-700/60 focus:border-purple-500 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-bold text-white w-28 sm:w-36 focus:outline-none shrink-0"
                          />
                        ) : (
                          <span className="text-xs sm:text-sm font-bold text-white shrink-0">{server.label}</span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/50 text-neutral-400 border border-neutral-800 shrink-0">
                          ID: {server.id}
                        </span>
                      </div>

                      <div className="flex-1 min-w-[200px] max-w-full lg:max-w-md xl:max-w-lg">
                        {cloudflareEnabled ? (
                          <div className="bg-[#070b14] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-mono flex items-center justify-between gap-2">
                            <span className="text-emerald-400 font-bold flex items-center gap-1.5 truncate">
                              <Radio className="w-3.5 h-3.5 shrink-0" />
                              <span>Live Streamed from Cloudflare Worker</span>
                            </span>
                            <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-600/40 shrink-0">
                              Real-Time 24/7
                            </span>
                          </div>
                        ) : canEdit ? (
                          <div className="relative">
                            <textarea
                              value={server.prompt}
                              onChange={(e) => updateServer(server.id, { prompt: e.target.value })}
                              onFocus={() => { isFocusedRef.current = true; }}
                              onBlur={() => { isFocusedRef.current = false; }}
                              placeholder={`Paste prompt for ${server.label}...`}
                              rows={2}
                              className="w-full h-12 max-h-12 min-h-[48px] bg-[#07080c] border border-neutral-800 focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none transition-colors resize-none leading-tight placeholder:text-neutral-600 shadow-inner overflow-y-auto"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-12 max-h-12 min-h-[48px] overflow-y-auto bg-[#07080c] border border-neutral-800 rounded-xl px-3 py-1.5 text-xs font-mono text-neutral-400 select-none">
                            <p className="leading-tight whitespace-pre-wrap">{server.prompt || 'No prompt configured.'}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                        {canEdit && (
                          <button
                            onClick={() => handleSaveSingleServer(server.id)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl border border-purple-400/40 transition-all cursor-pointer active:scale-95 shadow-md shadow-purple-950 shrink-0"
                          >
                            {isThisServerSaving ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : savedServerId === server.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            <span>{savedServerId === server.id ? 'Saved!' : `Save ${server.label}`}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

        {/* Generate Cost Overview Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Image Generation Cost</h4>
                  <p className="text-xs text-neutral-500">Deducted per image created</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  {canEdit ? (
                    <input
                      type="number"
                      min="1"
                      value={imageCost}
                      onChange={e => setImageCost(Number(e.target.value) || 0)}
                      className="w-16 px-2 py-1 bg-black/60 border border-blue-500/40 rounded-lg text-right font-black text-blue-400 text-lg focus:outline-none focus:border-blue-400"
                    />
                  ) : (
                    <span className="text-xl font-black text-blue-400">{imageCost}</span>
                  )}
                  <span className="text-xs text-neutral-400 font-medium">credits</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <Video className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Video Generation Cost</h4>
                  <p className="text-xs text-neutral-500">Deducted per video created</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  {canEdit ? (
                    <input
                      type="number"
                      min="1"
                      value={videoCost}
                      onChange={e => setVideoCost(Number(e.target.value) || 0)}
                      className="w-16 px-2 py-1 bg-black/60 border border-purple-500/40 rounded-lg text-right font-black text-purple-400 text-lg focus:outline-none focus:border-purple-400"
                    />
                  ) : (
                    <span className="text-xl font-black text-purple-400">{videoCost}</span>
                  )}
                  <span className="text-xs text-neutral-400 font-medium">credits</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Save Bar */}
        {canEdit && (
          <div className="sticky bottom-6 z-30 bg-[#121318]/95 backdrop-blur-md border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Saving will sync prompts across servers. Each server maintains its own independent countdown.
              </span>
            </div>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-lg shadow-purple-900/30 cursor-pointer active:scale-95 shrink-0 w-full sm:w-auto justify-center"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveSuccess ? 'Changes Saved!' : 'Save & Sync All'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
