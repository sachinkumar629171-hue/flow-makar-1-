import React, { useState, useEffect, useRef } from 'react';
import { apiUrl } from '../../config/api';
import { 
  Chrome, 
  Search,
  Server, 
  Zap, 
  Image as ImageIcon, 
  Video, 
  Copy, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Save, 
  Code, 
  ExternalLink,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Database,
  Globe,
  Terminal,
  UserCheck,
  UserX,
  Timer,
  RotateCcw,
  History,
  Send,
  Eye,
  EyeOff,
  Bell,
  Radio,
  Sparkles,
  X
} from 'lucide-react';
import { User, ServerPromptConfig, TelegramAlertConfig } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseConfig } from '../../lib/supabase';
import { calculateServerTimeStatus } from '../../lib/promptTimer';
import { formatISTDateTime } from '../../lib/telegramNotifier';

interface ExtensionAdminDataTabProps {
  users: User[];
  onUpdateUserDetails: (userId: string, data: any) => void;
  showToast: (msg: string) => void;
  onOpenPromptServer?: () => void;
}

export const ExtensionAdminDataTab: React.FC<ExtensionAdminDataTabProps> = ({
  users,
  onUpdateUserDetails,
  showToast,
  onOpenPromptServer,
}) => {
  const { promptConfig, updatePromptConfig, planExtensions, updatePlanExtensionConfig, adminCreateUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'basic' | 'ultra'>('all');
  const [accessFilter, setAccessFilter] = useState<'all' | 'allowed' | 'blocked' | 'editors'>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Add User Modal State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('123456');
  const [newUserPlan, setNewUserPlan] = useState<'basic' | 'ultra'>('ultra');
  const [newUserCredits, setNewUserCredits] = useState(45000);
  const [newUserCanEditPrompts, setNewUserCanEditPrompts] = useState(true);
  const [isAddingUser, setIsAddingUser] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      showToast('Please enter name and email.');
      return;
    }
    setIsAddingUser(true);
    const res = await adminCreateUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      password: newUserPassword,
      plan: newUserPlan,
      credits: Number(newUserCredits) || (newUserPlan === 'ultra' ? 45000 : 100),
      canEditPrompts: newUserCanEditPrompts,
    });
    setIsAddingUser(false);
    if (res.success) {
      showToast(`User ${newUserEmail} created successfully with Prompt Editor access!`);
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('123456');
    } else {
      showToast(`Error: ${res.error}`);
    }
  };

  // Dynamic server prompts state synchronized with promptConfig
  const [localServers, setLocalServers] = useState<ServerPromptConfig[]>(() => {
    if (promptConfig?.servers && promptConfig.servers.length > 0) {
      return promptConfig.servers;
    }
    return [
      { id: 'server1', label: 'Server 1', prompt: promptConfig?.server1Prompt || '' },
      { id: 'server2', label: 'Server 2', prompt: promptConfig?.server2Prompt || '' },
    ];
  });

  const [imageCost, setImageCost] = useState(promptConfig?.costs?.image ?? 20);
  const [videoCost, setVideoCost] = useState(promptConfig?.costs?.video ?? 300);
  const [reminderMinutes, setReminderMinutes] = useState<number>(promptConfig?.promptReminderMinutes ?? 120);
  const [isSavingPrompts, setIsSavingPrompts] = useState(false);
  const [savedServerId, setSavedServerId] = useState<string | null>(null);

  const dirtyServersRef = useRef<Set<string>>(new Set());
  const isFocusedRef = useRef<boolean>(false);

  // Telegram Bot State
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(promptConfig?.telegramAlerts?.enabled ?? false);
  const [botToken, setBotToken] = useState<string>(promptConfig?.telegramAlerts?.botToken ?? '');
  const [chatId, setChatId] = useState<string>(promptConfig?.telegramAlerts?.chatId ?? '');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(promptConfig?.telegramAlerts?.reminderMinutesBefore ?? 20);
  const [missedAlertMinutesAfter, setMissedAlertMinutesAfter] = useState<number>(promptConfig?.telegramAlerts?.missedAlertMinutesAfter ?? 5);
  const [showBotToken, setShowBotToken] = useState<boolean>(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState<boolean>(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Website Tab Logo (Favicon) & Branding State
  const [websiteFaviconUrl, setWebsiteFaviconUrl] = useState<string>(promptConfig?.websiteFaviconUrl ?? '');
  const [websiteTitle, setWebsiteTitle] = useState<string>(promptConfig?.websiteTitle ?? '');
  const [extensionVersion, setExtensionVersion] = useState<string>(
    promptConfig?.extensionVersion || planExtensions?.ultra?.version || '3.2.0'
  );
  const [isSavingBranding, setIsSavingBranding] = useState<boolean>(false);
  const [isSavingVersion, setIsSavingVersion] = useState<boolean>(false);

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

  // Live Extension Tester & Simulator
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testEndpoint, setTestEndpoint] = useState<'user' | 'servers' | 'deduct_image' | 'deduct_video'>('user');
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);

  // Live ticker to update countdowns every 10 seconds
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Synchronize local servers whenever promptConfig updates from PromptServerPage or Supabase without overwriting active edits!
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
      setVideoCost(promptConfig.costs.video ?? 300);
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
    if (promptConfig?.websiteFaviconUrl !== undefined && !isFocusedRef.current) {
      setWebsiteFaviconUrl(promptConfig.websiteFaviconUrl ?? '');
    }
    if (promptConfig?.websiteTitle !== undefined && !isFocusedRef.current) {
      setWebsiteTitle(promptConfig.websiteTitle ?? '');
    }
    const currentActiveVer = promptConfig?.extensionVersion || planExtensions?.ultra?.version || '3.2.0';
    if (!isFocusedRef.current) {
      setExtensionVersion(currentActiveVer);
    }
  }, [promptConfig, planExtensions]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Add new server
  const handleAddServer = () => {
    const nextNum = localServers.length + 1;
    const newServer: ServerPromptConfig = {
      id: `server_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
      label: `Server ${nextNum}`,
      prompt: '',
      lastUpdatedAt: new Date().toISOString(),
      updatedBy: 'Admin',
      reminded20MinSent: false,
      missed5MinSent: false,
      wasMissed: false,
    };
    const updated = [...localServers, newServer];
    setLocalServers(updated);
    showToast(`Added ${newServer.label}. Click "Save Live Prompts" to publish.`);
  };

  // Remove server
  const handleRemoveServer = (id: string) => {
    if (localServers.length <= 1) {
      showToast('At least one server prompt must remain configured.');
      return;
    }
    const updated = localServers.filter(s => s.id !== id);
    setLocalServers(updated);
    showToast('Server removed from list. Click "Save Live Prompts" to persist.');
  };

  // Update specific server
  const handleUpdateServer = (id: string, data: Partial<ServerPromptConfig>) => {
    dirtyServersRef.current.add(id);
    setLocalServers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  // Save all server prompts: ONLY modified servers have their timestamp updated!
  const handleSavePromptsAndCosts = async () => {
    setIsSavingPrompts(true);
    dirtyServersRef.current.clear();
    const nowIso = new Date().toISOString();
    const previousServers = promptConfig?.servers || [];

    const updatedServers = localServers.map(s => {
      const prev = previousServers.find(p => p.id === s.id);
      const isPromptChanged = !prev || prev.prompt !== s.prompt;

      if (isPromptChanged) {
        return {
          ...s,
          lastUpdatedAt: nowIso,
          updatedBy: 'Admin',
          reminded20MinSent: false,
          missed5MinSent: false,
          wasMissed: false,
        };
      }
      return {
        ...s,
        lastUpdatedAt: prev?.lastUpdatedAt || s.lastUpdatedAt || nowIso,
        updatedBy: prev?.updatedBy || s.updatedBy || 'Admin',
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
      const trimmedVer = extensionVersion.trim();
      await updatePromptConfig({
        servers: updatedServers,
        costs: {
          image: Number(imageCost) || 20,
          video: Number(videoCost) || 300,
        },
        promptReminderMinutes: Number(reminderMinutes) || 120,
        cloudflareEnabled,
        cloudflareUrl: cloudflareUrl.trim(),
        telegramAlerts: tgAlertConfig,
        server1Prompt: updatedServers[0]?.prompt || '',
        server2Prompt: updatedServers[1]?.prompt || '',
        ...(trimmedVer ? { extensionVersion: trimmedVer } : {}),
      });

      if (trimmedVer && planExtensions?.ultra) {
        updatePlanExtensionConfig('ultra', {
          ...planExtensions.ultra,
          version: trimmedVer,
        });
      }

      showToast(`All ${localServers.length} prompt servers & Option 2 Cloudflare settings saved live!`);
    } catch (err: any) {
      showToast(`Error saving prompts: ${err?.message || 'Failed'}`);
    } finally {
      setIsSavingPrompts(false);
    }
  };

  // Test Cloudflare Worker integration from Admin tab (Direct 100% Pure Client-Side Fetch)
  const handleTestCloudflare = async () => {
    const cleanUrl = cloudflareUrl.trim();
    if (!cleanUrl) {
      setCloudflareTestResult({
        success: false,
        message: 'Please enter a valid Cloudflare Worker URL',
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

      // Update server count/list structure without saving heavy raw cookie payloads
      setLocalServers(prev => {
        let updated = [...prev];
        for (let i = 1; i <= Math.max(prev.length, keysFound.length); i++) {
          const key = `server${i}`;
          if (!updated.find(s => s.id === key || s.label.toLowerCase() === `server ${i}`)) {
            updated.push({
              id: key,
              label: `Server ${i}`,
              prompt: '',
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

  // Save specific server prompt and restart ONLY its timer
  const handleSaveSingleServer = async (serverId: string) => {
    const nowIso = new Date().toISOString();
    const updatedServers = localServers.map(s => 
      s.id === serverId ? { 
        ...s, 
        lastUpdatedAt: nowIso, 
        updatedBy: 'Admin',
        reminded20MinSent: false,
        missed5MinSent: false,
        wasMissed: false 
      } : s
    );
    setLocalServers(updatedServers);
    dirtyServersRef.current.delete(serverId);
    setIsSavingPrompts(true);
    setSavedServerId(serverId);

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
          video: Number(videoCost) || 300,
        },
        promptReminderMinutes: Number(reminderMinutes) || 120,
        telegramAlerts: tgAlertConfig,
        server1Prompt: updatedServers[0]?.prompt || '',
        server2Prompt: updatedServers[1]?.prompt || '',
      });
      const srvObj = updatedServers.find(s => s.id === serverId);
      showToast(`Saved prompt & restarted timer for ${srvObj?.label || 'Server'}!`);
      setTimeout(() => setSavedServerId(null), 3000);
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSavingPrompts(false);
    }
  };

  // Restart individual server timer without modifying prompt
  const handleRestartSingleServerTimer = async (serverId: string) => {
    const nowIso = new Date().toISOString();
    const updatedServers = localServers.map(s => 
      s.id === serverId ? { 
        ...s, 
        lastUpdatedAt: nowIso, 
        updatedBy: 'Admin',
        reminded20MinSent: false,
        missed5MinSent: false,
        wasMissed: false 
      } : s
    );
    setLocalServers(updatedServers);
    setIsSavingPrompts(true);
    try {
      await updatePromptConfig({
        servers: updatedServers,
        costs: {
          image: Number(imageCost) || 20,
          video: Number(videoCost) || 300,
        },
        promptReminderMinutes: Number(reminderMinutes) || 120,
        server1Prompt: updatedServers[0]?.prompt || '',
        server2Prompt: updatedServers[1]?.prompt || '',
      });
      const srvObj = updatedServers.find(s => s.id === serverId);
      showToast(`Timer restarted for ${srvObj?.label || 'Server'}. Reset to ${reminderMinutes}m!`);
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSavingPrompts(false);
    }
  };

  // Test Telegram Bot integration
  const handleTestTelegram = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      showToast('Please enter both Telegram Bot Token and Chat/Channel ID.');
      setTelegramTestResult({
        success: false,
        message: 'Telegram Bot Token and Chat ID are required.',
      });
      return;
    }

    setIsTestingTelegram(true);
    setTelegramTestResult(null);

    try {
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          chatId: chatId.trim(),
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text.includes('404') || text.includes('not found') ? 'API endpoint /api/telegram/test not found. Ensure backend server is running.' : 'Server returned non-JSON response.');
      }
      const data = await response.json();
      if (data.success) {
        showToast('Telegram test alert sent successfully!');
        setTelegramTestResult({
          success: true,
          message: 'Test message delivered to your Telegram Channel/Group in IST format!',
        });
      } else {
        showToast(`Telegram Error: ${data.error || 'Failed'}`);
        setTelegramTestResult({
          success: false,
          message: data.error || 'Failed to send test message. Check Bot Token & Chat ID.',
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

  // Save Website Logo / Favicon & Title Branding
  const handleSaveWebsiteBranding = async () => {
    setIsSavingBranding(true);
    try {
      const v = extensionVersion.trim();
      await updatePromptConfig({
        websiteFaviconUrl: websiteFaviconUrl.trim(),
        websiteTitle: websiteTitle.trim(),
        extensionVersion: v,
      });
      if (planExtensions?.ultra) {
        updatePlanExtensionConfig('ultra', {
          ...planExtensions.ultra,
          version: v,
        });
      }
      try {
        await fetch(apiUrl('/api/config'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptConfig: {
              websiteFaviconUrl: websiteFaviconUrl.trim(),
              websiteTitle: websiteTitle.trim(),
              extensionVersion: v,
            },
            planExtensions: planExtensions ? {
              ...planExtensions,
              ultra: {
                ...(planExtensions.ultra || {}),
                version: v,
              }
            } : undefined
          })
        });
      } catch {}
      showToast('Website Branding & Extension Version signal saved live successfully!');
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSavingBranding(false);
    }
  };

  // Toggle Prompt Editor permission for user
  const handleTogglePromptEditor = (user: User) => {
    const current = Boolean(user.canEditPrompts);
    const updated = !current;
    onUpdateUserDetails(user.id, { canEditPrompts: updated });
    showToast(
      updated 
        ? `Granted Prompt Editor access to ${user.name} (${user.email}). They can now login to Prompt Server and edit prompts!` 
        : `Revoked Prompt Editor access from ${user.name}.`
    );
  };

  // Deduct credits for Image (-20 by default or custom)
  const handleDeductImageCredit = (user: User) => {
    const cost = Number(promptConfig?.costs?.image || imageCost || 20);
    const newCredits = Math.max(0, user.credits - cost);
    onUpdateUserDetails(user.id, { credits: newCredits });
    showToast(`Deducted ${cost} credits (Image generation) from ${user.name}. Remaining: ${newCredits.toLocaleString()}`);
  };

  // Deduct credits for Video (-300 by default or custom)
  const handleDeductVideoCredit = (user: User) => {
    const cost = Number(promptConfig?.costs?.video || videoCost || 300);
    const newCredits = Math.max(0, user.credits - cost);
    onUpdateUserDetails(user.id, { credits: newCredits });
    showToast(`Deducted ${cost} credits (Video generation) from ${user.name}. Remaining: ${newCredits.toLocaleString()}`);
  };

  // Toggle extension access
  const handleToggleExtensionAccess = (user: User) => {
    const currentAccess = user.extensionAccess !== false;
    const newAccess = !currentAccess;
    onUpdateUserDetails(user.id, { extensionAccess: newAccess });
    showToast(newAccess ? `Extension access ENABLED for ${user.name}` : `Extension access BLOCKED for ${user.name}`);
  };

  // Quick adjust days left
  const handleAdjustDays = (user: User, delta: number) => {
    const current = user.planDaysLeft ?? 30;
    const updated = Math.max(0, current + delta);
    onUpdateUserDetails(user.id, { planDaysLeft: updated });
    showToast(`${user.name}'s validity set to ${updated} days.`);
  };

  // Test Extension API
  const handleRunApiTest = async (type: 'user' | 'servers' | 'deduct_image' | 'deduct_video') => {
    setTestEndpoint(type);
    setTestLoading(true);
    setTestResult(null);
    try {
      if (type === 'servers') {
        const res = await fetch('/api/extension/servers');
        const data = await res.json();
        setTestResult({
          request: { method: 'GET', endpoint: '/api/extension/servers' },
          response: data,
          timestamp: new Date().toLocaleTimeString(),
        });
        showToast('GET /api/extension/servers fetched successfully!');
        return;
      }

      if (!testEmail.trim()) {
        showToast('Please enter or select a Gmail ID to test');
        setTestResult({ error: 'Gmail ID is required for this endpoint test.' });
        return;
      }

      const cleanEmail = testEmail.trim();

      if (type === 'user') {
        const res = await fetch(`/api/extension/user?email=${encodeURIComponent(cleanEmail)}`);
        const data = await res.json();
        setTestResult({
          request: { method: 'GET', endpoint: `/api/extension/user?email=${cleanEmail}` },
          response: data,
          timestamp: new Date().toLocaleTimeString(),
        });
        if (data.success) {
          showToast(`User ${data.user.name} checked successfully!`);
        } else {
          showToast(`API Response: ${data.error || 'User not found'}`);
        }
      } else if (type === 'deduct_image' || type === 'deduct_video') {
        const deductType = type === 'deduct_image' ? 'image' : 'video';
        const res = await fetch('/api/extension/deduct-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            type: deductType,
          }),
        });
        const data = await res.json();
        setTestResult({
          request: {
            method: 'POST',
            endpoint: '/api/extension/deduct-credits',
            body: { email: cleanEmail, type: deductType },
          },
          response: data,
          timestamp: new Date().toLocaleTimeString(),
        });
        if (data.success) {
          showToast(`Simulated deduction of ${data.deducted} credits for ${data.action}!`);
          const target = users.find(u => u.email.toLowerCase() === cleanEmail.toLowerCase());
          if (target && data.remainingCredits !== undefined) {
            onUpdateUserDetails(target.id, { credits: data.remainingCredits });
          }
        } else {
          showToast(`Deduction Error: ${data.error || 'Failed'}`);
        }
      }
    } catch (err: any) {
      setTestResult({ error: err.message || 'Network error testing extension API' });
    } finally {
      setTestLoading(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchSearch = 
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchPlan = planFilter === 'all' || u.plan === planFilter;

    const isAllowed = u.extensionAccess !== false;
    const isEditor = Boolean(u.canEditPrompts);

    let matchAccess = true;
    if (accessFilter === 'allowed') matchAccess = isAllowed;
    if (accessFilter === 'blocked') matchAccess = !isAllowed;
    if (accessFilter === 'editors') matchAccess = isEditor;

    return matchSearch && matchPlan && matchAccess;
  });

  const totalUsers = users.length;
  const allowedUsersCount = users.filter(u => u.extensionAccess !== false).length;
  const blockedUsersCount = users.filter(u => u.extensionAccess === false).length;
  const editorUsersCount = users.filter(u => u.canEditPrompts).length;

  const defaultPublicPortal = typeof window !== 'undefined' ? window.location.origin : '';

  const supabaseConfig = getSupabaseConfig();
  const isSupabaseConnected = supabaseConfig.isConnected;

  return (
    <div className="space-y-6 select-text">
      {/* Tab Banner / Intro */}
      <div className="bg-gradient-to-r from-[#121422] to-[#18112b] border border-purple-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
              <Chrome className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Extension Admin Data & Prompt Servers</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Sync Active
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage live prompts, dynamic servers (Add/Delete), credit deduction rates, and grant Prompt Editor access to specific users.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenPromptServer && (
              <button
                onClick={onOpenPromptServer}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-900/30 transition-all cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Open Prompt Server Console</span>
              </button>
            )}
            <button
              onClick={() => setShowCodeSnippet(!showCodeSnippet)}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 rounded-xl text-xs font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer"
            >
              <Code className="w-3.5 h-3.5 text-purple-400" />
              <span>{showCodeSnippet ? 'Hide Extension Docs' : 'Extension API Docs'}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-neutral-800/80">
          <div className="bg-[#0b0c12]/70 rounded-xl p-3 border border-neutral-800/80">
            <span className="text-[10px] font-semibold uppercase text-neutral-400">Total Users</span>
            <div className="text-lg font-bold text-white mt-0.5">{totalUsers}</div>
          </div>
          <div className="bg-[#0b0c12]/70 rounded-xl p-3 border border-neutral-800/80">
            <span className="text-[10px] font-semibold uppercase text-neutral-400">Active Servers</span>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">{localServers.length} Servers</div>
          </div>
          <div className="bg-[#0b0c12]/70 rounded-xl p-3 border border-neutral-800/80">
            <span className="text-[10px] font-semibold uppercase text-neutral-400">Prompt Editors</span>
            <div className="text-lg font-bold text-purple-400 mt-0.5">{editorUsersCount} Users</div>
          </div>
          <div className="bg-[#0b0c12]/70 rounded-xl p-3 border border-neutral-800/80">
            <span className="text-[10px] font-semibold uppercase text-neutral-400">Deduction Cost</span>
            <div className="text-xs font-mono text-purple-300 mt-1 flex items-center gap-2">
              <span className="text-amber-400 font-bold">Image: -{imageCost}</span>
              <span>•</span>
              <span className="text-rose-400 font-bold">Video: -{videoCost}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Website Logo / Tab Favicon & Title Branding */}
      <div className="bg-[#12131c] border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Website Tab Logo & Title (Favicon Branding)</h3>
              <p className="text-xs text-neutral-400">Configure the browser tab logo (favicon) and page title displayed at the top of the browser window.</p>
            </div>
          </div>
          <button
            onClick={handleSaveWebsiteBranding}
            disabled={isSavingBranding}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-950/40 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSavingBranding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Branding</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <span>Website Favicon / Logo URL</span>
              <span className="text-[10px] text-neutral-500 font-normal">(Shown in browser tab above URL)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={websiteFaviconUrl}
                onChange={(e) => setWebsiteFaviconUrl(e.target.value)}
                onFocus={() => { isFocusedRef.current = true; }}
                onBlur={() => { isFocusedRef.current = false; }}
                placeholder="https://example.com/favicon.png or SVG URL"
                className="w-full bg-[#0b0c12] border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
              {websiteFaviconUrl.trim() && (
                <div className="w-10 h-10 rounded-xl bg-[#0b0c12] border border-neutral-700 flex items-center justify-center shrink-0 p-1">
                  <img src={websiteFaviconUrl.trim()} alt="Favicon" className="w-6 h-6 object-contain" onError={(e) => {(e.target as HTMLElement).style.display = 'none';}} />
                </div>
              )}
            </div>
            <p className="text-[11px] text-neutral-500">Supports direct image URLs (PNG, SVG, ICO). Appears in browser tab next to your title.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <span>Website Browser Title</span>
              <span className="text-[10px] text-neutral-500 font-normal">(Tab heading text)</span>
            </label>
            <input
              type="text"
              value={websiteTitle}
              onChange={(e) => setWebsiteTitle(e.target.value)}
              onFocus={() => { isFocusedRef.current = true; }}
              onBlur={() => { isFocusedRef.current = false; }}
              placeholder="Flow - AI Video Creation & Storytelling Platform"
              className="w-full bg-[#0b0c12] border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-neutral-500">The main title text shown on the browser tab and search engine results.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-neutral-800/80">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <span>Required Extension Version Signal</span>
              <span className="text-[10px] text-cyan-400 font-normal">(Sent to browser extension)</span>
            </label>
            <input
              type="text"
              value={extensionVersion}
              onChange={(e) => setExtensionVersion(e.target.value)}
              onFocus={() => { isFocusedRef.current = true; }}
              onBlur={() => { isFocusedRef.current = false; }}
              placeholder="v2.4.1"
              className="w-full bg-[#0b0c12] border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <p className="text-[11px] text-neutral-500">Extensions poll this version signal to know which build version is active & required.</p>
          </div>
        </div>
      </div>

      {/* Code Snippet & Extension Documentation Accordion */}
      {showCodeSnippet && (
        <div className="bg-[#0f1017] border border-purple-500/30 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Browser Extension Integration Guide</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/60 text-purple-300">
                CORS Supported • All Origins Allowed
              </span>
              {isSupabaseConnected ? (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-400" />
                  Supabase Live Synced
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 flex items-center gap-1">
                  <Database className="w-3 h-3 text-amber-400" />
                  Local Database Active
                </span>
              )}
            </div>
          </div>

          <div className="bg-[#141522] border border-cyan-500/40 rounded-xl p-4 space-y-2">
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Extension API Endpoints</span>
                </div>
                <div className="text-[11px] text-neutral-300 space-y-1 font-mono">
                  <p>1. <span className="text-purple-300 font-bold">GET /api/extension/servers</span> - Fetches all server prompts ({localServers.length} servers) & costs.</p>
                  <p>2. <span className="text-cyan-300 font-bold">GET /api/extension/user?email=GMAIL_ID</span> - Fetches plan, credits, validity & server prompts.</p>
                  <p>3. <span className="text-rose-300 font-bold">POST /api/extension/deduct-credits</span> - Deducts credits for generation (body: <code>{`{ email, type: 'image' | 'video' }`}</code>).</p>
                  <p>4. <span className="text-emerald-300 font-bold">POST /api/extension/prompts</span> - Returns live server prompts, online status & required version in a single response.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TELEGRAM BOT NOTIFICATION & EXPIRY ALERTS SETTINGS */}
      <div className="bg-[#10121d] border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-600/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Telegram Bot Alerts & IST Expiry Reminders</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  telegramEnabled && botToken && chatId
                    ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                }`}>
                  {telegramEnabled && botToken && chatId ? 'Bot Active • 25s Poll' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Channel / Group me 20 min pehle reminder, 5 min delay hone par missed update alert, aur delay duration IST me automatically bhejta hai.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={telegramEnabled} 
                onChange={(e) => setTelegramEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              <span className="ml-2 text-xs font-semibold text-neutral-200">
                {telegramEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>

        {/* Telegram Config Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300">Telegram Bot Token</label>
              <button 
                type="button"
                onClick={() => setShowBotToken(!showBotToken)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                {showBotToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showBotToken ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <input 
              type={showBotToken ? "text" : "password"}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="w-full px-3 py-2 bg-[#07080b] border border-neutral-800 rounded-xl text-xs text-neutral-200 font-mono focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[10px] text-neutral-500">
              Obtained from <span className="text-cyan-400">@BotFather</span> on Telegram.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Telegram Channel / Group Chat ID</label>
            <input 
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. -1001234567890 or @your_channel_name"
              className="w-full px-3 py-2 bg-[#07080b] border border-neutral-800 rounded-xl text-xs text-neutral-200 font-mono focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[10px] text-neutral-500">
              Bot must be added as an <strong>Administrator</strong> with post messages permission.
            </p>
          </div>
        </div>

        {/* Telegram Timing Rules & Test Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 bg-[#0b0c14] border border-neutral-800/80 rounded-xl p-3">
          <div className="flex items-center gap-4 text-xs font-mono text-neutral-300 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">Pre-Expiry Reminder:</span>
              <span className="text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                {reminderMinutesBefore}m before
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">Missed Alert:</span>
              <span className="text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                +{missedAlertMinutesAfter}m after expiry (IST)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">Recovery Msg:</span>
              <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                On Next Update
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestTelegram}
              disabled={isTestingTelegram || !botToken || !chatId}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-900/60 hover:bg-cyan-800/80 disabled:opacity-40 text-cyan-200 border border-cyan-700/60 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              {isTestingTelegram ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-300" /> : <Send className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{isTestingTelegram ? 'Sending Test...' : 'Test Telegram Alert'}</span>
            </button>
          </div>
        </div>

        {telegramTestResult && (
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            telegramTestResult.success 
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}>
            {telegramTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{telegramTestResult.message}</span>
          </div>
        )}
      </div>

      {/* OPTION 2: CLOUDFLARE DYNAMIC WORKER RELAY HUB */}
      <div className={`border rounded-2xl p-5 shadow-2xl transition-all space-y-4 ${
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
                Jab <b>Option 2 ON</b> rahega, toh Chrome Extension user requests ko Cloudflare Worker (`server1`, `server2`, `server3`, `server4`...) se live fetch karke serve karega.
              </p>
            </div>
          </div>

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
                    onClick={() => {
                      navigator.clipboard.writeText(cloudflareUrl);
                      showToast('Cloudflare URL copied!');
                    }}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300 transition-colors cursor-pointer"
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

      {/* DYNAMIC SERVER PROMPTS, TIMING CYCLES & DEDUCTION COSTS */}
      <div className="bg-[#12131a] border border-purple-500/30 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              Dynamic Server Prompts & Reminder Timers ({localServers.length} Servers)
            </h3>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAddServer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-purple-300 hover:text-white rounded-xl text-xs font-semibold border border-neutral-700 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>Add New Server</span>
            </button>

            <button
              onClick={handleSavePromptsAndCosts}
              disabled={isSavingPrompts}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-900/30 transition-all cursor-pointer active:scale-95"
            >
              {isSavingPrompts ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSavingPrompts ? 'Saving...' : 'Save All Prompts & Timers'}</span>
            </button>
          </div>
        </div>

        {/* Reminder Cycle Configuration Bar */}
        <div className="bg-[#0b0c12]/90 border border-purple-500/20 rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
              <Timer className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Prompt Refresh Reminder Cycle:</span>
                <span className="text-purple-300 font-mono font-bold bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/60">
                  {reminderMinutes} mins ({Math.round((reminderMinutes / 60) * 10) / 10}h)
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Each server ka timer independent chalega. Jis server ka prompt update hoga, sirf usi ka timer restart hoga.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-black/60 border border-neutral-800 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] text-neutral-400 font-medium">Cycle:</span>
              <input
                type="number"
                min="5"
                max="1440"
                value={reminderMinutes}
                onChange={e => setReminderMinutes(Math.max(1, Number(e.target.value) || 120))}
                className="w-14 bg-transparent text-center font-mono font-bold text-xs text-purple-300 focus:outline-none"
              />
              <span className="text-[10px] text-neutral-500">m</span>
            </div>

            <div className="flex items-center gap-1">
              {[30, 60, 120, 180, 240].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setReminderMinutes(mins)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    reminderMinutes === mins
                      ? 'bg-purple-600 text-white'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800'
                  }`}
                >
                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Grid of Servers with Live Timers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localServers.map((srv, idx) => {
            const timeStatus = calculateServerTimeStatus(srv.lastUpdatedAt, srv.updatedBy, reminderMinutes);
            const isCfActive = Boolean(cloudflareEnabled);

            return (
              <div 
                key={srv.id} 
                className={`p-4 bg-[#0a0b0e] border rounded-xl space-y-2.5 relative group transition-all ${
                  isCfActive
                    ? 'border-emerald-500/30 hover:border-emerald-500/50 bg-gradient-to-b from-[#07130f]/30 to-[#0a0b0e]'
                    : timeStatus.status === 'expired' || timeStatus.status === 'never'
                    ? 'border-rose-500/40 bg-gradient-to-b from-[#140b0f] to-[#0a0b0e]'
                    : timeStatus.status === 'warning'
                    ? 'border-amber-500/40 bg-gradient-to-b from-[#14120b] to-[#0a0b0e]'
                    : 'border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-purple-500' : idx === 1 ? 'bg-indigo-500' : 'bg-cyan-500'}`}></span>
                    <input
                      type="text"
                      value={srv.label}
                      onChange={(e) => handleUpdateServer(srv.id, { label: e.target.value })}
                      className="bg-transparent border-b border-dashed border-neutral-700 text-xs font-bold text-white focus:outline-none focus:border-purple-400 w-28 sm:w-36 py-0.5"
                      placeholder={`Server ${idx + 1}`}
                    />
                    <span className="text-[10px] text-neutral-500 font-mono">
                      ID: {srv.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Live Timing Pill */}
                    {isCfActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>Cloudflare Live Relay</span>
                      </span>
                    ) : timeStatus.status === 'fresh' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>{timeStatus.timeLeftText}</span>
                      </span>
                    ) : timeStatus.status === 'warning' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950/90 border border-amber-500/70 text-amber-200 animate-pulse flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>{timeStatus.timeLeftText}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950/90 border border-rose-500/70 text-rose-200 animate-pulse flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                        <span>{timeStatus.timeLeftText}</span>
                      </span>
                    )}

                    <button
                      onClick={() => handleCopy(srv.prompt, srv.label)}
                      className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                      title={`Copy ${srv.label} prompt`}
                    >
                      {copiedText === srv.label ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    {localServers.length > 1 && (
                      <button
                        onClick={() => handleRemoveServer(srv.id)}
                        className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title={`Delete ${srv.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Timing Info Bar with Progress */}
                <div className="bg-[#07080b] border border-neutral-800/80 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-neutral-400 flex items-center gap-1 truncate">
                      <History className="w-3 h-3 text-purple-400" />
                      {timeStatus.lastUpdatedText}
                      {timeStatus.lastUpdatedExact && <span className="text-neutral-500"> ({timeStatus.lastUpdatedExact})</span>}
                    </span>
                    <span className={`font-bold ${
                      isCfActive
                        ? 'text-emerald-400'
                        : timeStatus.status === 'fresh'
                        ? 'text-emerald-400'
                        : timeStatus.status === 'warning'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}>
                      {isCfActive ? '⚡ Cloudflare Active' : timeStatus.timeLeftText}
                    </span>
                  </div>

                  <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        isCfActive
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                          : timeStatus.status === 'fresh'
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                          : timeStatus.status === 'warning'
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${isCfActive ? 100 : Math.max(3, timeStatus.percentageRemaining)}%` }}
                    />
                  </div>
                </div>

                {/* Prompt Textarea - Always Visible & Editable */}
                <textarea
                  rows={2}
                  value={srv.prompt}
                  onChange={e => handleUpdateServer(srv.id, { prompt: e.target.value })}
                  onFocus={() => { isFocusedRef.current = true; }}
                  onBlur={() => { isFocusedRef.current = false; }}
                  placeholder={`Paste prompt/cookies here for ${srv.label}...`}
                  className="w-full h-16 max-h-24 min-h-[56px] p-2 bg-[#07080b] border border-neutral-800/80 rounded-lg text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500 font-mono leading-relaxed select-text resize-y overflow-y-auto shadow-inner"
                />

                <div className="flex items-center justify-between text-[10px] font-mono pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500">{srv.prompt ? `${srv.prompt.length} characters` : 'Empty prompt'}</span>
                    {isCfActive && (
                      <span className="text-[10px] text-emerald-400/90 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        Option 2 Relay
                      </span>
                    )}
                  </div>
                  
                  {/* Dedicated Single Server Save & Reset Button */}
                  <button
                    onClick={() => handleSaveSingleServer(srv.id)}
                    disabled={isSavingPrompts}
                    className="flex items-center gap-1.5 px-3 py-1 bg-purple-950/70 hover:bg-purple-900 border border-purple-600/50 text-purple-200 hover:text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                    title={`Save only ${srv.label} prompt and restart its timer`}
                  >
                    {savedServerId === srv.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">Saved & Reset!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3 text-purple-400" />
                        <span>Save & Reset {srv.label} Timer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Credit Deduction Rates */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-neutral-800/60 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-neutral-400">Live Credit Deduction Rates:</span>
            
            <div className="flex items-center gap-2">
              <span className="text-neutral-300 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                Image:
              </span>
              <input
                type="number"
                min="0"
                value={imageCost}
                onChange={e => setImageCost(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-[#0a0b0e] border border-neutral-800 rounded-lg text-center font-mono text-white text-xs"
              />
              <span className="text-neutral-500">credits</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-neutral-300 flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-rose-400" />
                Video:
              </span>
              <input
                type="number"
                min="0"
                value={videoCost}
                onChange={e => setVideoCost(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-[#0a0b0e] border border-neutral-800 rounded-lg text-center font-mono text-white text-xs"
              />
              <span className="text-neutral-500">credits</span>
            </div>
          </div>

          <button
            onClick={handleSavePromptsAndCosts}
            disabled={isSavingPrompts}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            {isSavingPrompts ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Live Configuration</span>
          </button>
        </div>
      </div>

      {/* Live Extension API Tester & Simulator */}
      <div className="bg-[#12131a] border border-neutral-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Live Extension API Tester & Simulator</h3>
          </div>
          <span className="text-[11px] text-neutral-400">
            Verify live JSON response returned to Chrome Extension
          </span>
        </div>

        {/* Quick User Picker Pills */}
        <div className="space-y-1.5">
          <div className="text-[11px] text-neutral-400 font-medium flex items-center justify-between">
            <span>Quick Select User to Test:</span>
            <span className="text-[10px] text-neutral-500">Click to fill</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-[#0a0b0e] rounded-xl border border-neutral-900">
            {users.slice(0, 10).map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setTestEmail(u.email);
                  showToast(`Selected ${u.email}`);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                  testEmail === u.email
                    ? 'bg-purple-600 text-white font-semibold shadow-sm'
                    : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-800/60'
                }`}
              >
                <span>{u.name}</span>
                <span className="text-[10px] text-neutral-400">({u.credits.toLocaleString()} cr)</span>
                {u.canEditPrompts && (
                  <span className="px-1 rounded bg-purple-900 text-purple-300 text-[9px]">Editor</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Email Input & Action Buttons */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="Enter or select user Gmail ID to simulate..."
              className="flex-1 px-3.5 py-2.5 bg-[#0a0b0e] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 font-mono select-text"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
            <button
              onClick={() => handleRunApiTest('user')}
              disabled={testLoading}
              className="px-3 py-2 bg-purple-900/40 hover:bg-purple-900/70 border border-purple-700/60 text-purple-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {testLoading && testEndpoint === 'user' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
              <span>1. Check User & Prompts</span>
            </button>

            <button
              onClick={() => handleRunApiTest('servers')}
              disabled={testLoading}
              className="px-3 py-2 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {testLoading && testEndpoint === 'servers' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5 text-cyan-400" />}
              <span>2. Check Server Prompts</span>
            </button>

            <button
              onClick={() => handleRunApiTest('deduct_image')}
              disabled={testLoading}
              className="px-3 py-2 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/60 text-amber-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {testLoading && testEndpoint === 'deduct_image' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 text-amber-400" />}
              <span>3. Deduct Image (-{imageCost})</span>
            </button>

            <button
              onClick={() => handleRunApiTest('deduct_video')}
              disabled={testLoading}
              className="px-3 py-2 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 text-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {testLoading && testEndpoint === 'deduct_video' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5 text-rose-400" />}
              <span>4. Deduct Video (-{videoCost})</span>
            </button>
          </div>
        </div>

        {/* Test Result Box */}
        {testResult && (
          <div className="mt-3 p-3.5 bg-[#0a0b0e] border border-neutral-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                API Simulator Result ({testResult.timestamp})
              </span>
              <button
                onClick={() => setTestResult(null)}
                className="text-neutral-500 hover:text-white text-[11px]"
              >
                Clear
              </button>
            </div>
            <pre className="p-3 bg-black/80 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60 leading-relaxed">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* USER LIST & EXTENSION ACCESS / PROMPT EDITOR MANAGEMENT TABLE */}
      <div className="bg-[#12131a] border border-neutral-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>User Extension & Prompt Editor Permissions ({filteredUsers.length} shown)</span>
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Grant Prompt Editor permissions to 2-3 users so they can login and fill prompts in Prompt Server.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAddUserModal(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add User & Grant Access</span>
            </button>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by Gmail or Name..."
                className="pl-8 pr-3 py-1.5 bg-[#0a0b0e] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 w-48 select-text"
              />
            </div>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-[#0a0b0e] border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Plans</option>
              <option value="ultra">Ultra VIP</option>
              <option value="basic">Basic</option>
            </select>

            {/* Access Filter */}
            <select
              value={accessFilter}
              onChange={e => setAccessFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-[#0a0b0e] border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Users</option>
              <option value="editors">⚡ Prompt Editors Only</option>
              <option value="allowed">Allowed Extension</option>
              <option value="blocked">Blocked Extension</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse select-text">
            <thead>
              <tr className="border-b border-neutral-800/80 bg-[#161724] text-neutral-400 uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-3 px-4">User Details (Gmail & Name)</th>
                <th className="py-3 px-3">Plan</th>
                <th className="py-3 px-3">Days Left</th>
                <th className="py-3 px-3">Credits</th>
                <th className="py-3 px-3 text-center">Prompt Editor Access</th>
                <th className="py-3 px-3 text-center">Extension Access</th>
                <th className="py-3 px-4 text-right">Credit Deductions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    No users match the search/filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const maxCredits = user.maxCredits || (user.plan === 'ultra' ? 45000 : 100);
                  const creditsRemaining = user.credits ?? 0;
                  const daysLeft = user.planDaysLeft ?? 30;
                  const isExtensionAllowed = user.extensionAccess !== false;
                  const isPromptEditor = Boolean(user.canEditPrompts);

                  return (
                    <tr 
                      key={user.id}
                      className="hover:bg-[#161824]/60 transition-colors"
                    >
                      {/* Name & Gmail ID */}
                      <td className="py-3 px-4 select-text">
                        <div className="font-semibold text-white text-xs tracking-tight flex items-center gap-1.5">
                          <span>{user.name}</span>
                          {user.role === 'admin' && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-purple-300/80 font-mono mt-0.5 select-all flex items-center gap-1">
                          <span>{user.email}</span>
                          <button
                            onClick={() => handleCopy(user.email, user.email)}
                            title="Copy Gmail ID"
                            className="text-neutral-500 hover:text-white cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="py-3 px-3 select-text">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                            user.plan === 'ultra'
                              ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                              : 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                          }`}
                        >
                          {user.plan === 'ultra' ? 'Ultra VIP' : 'Basic'}
                        </span>
                      </td>

                      {/* Days Left */}
                      <td className="py-3 px-3 select-text">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                              daysLeft <= 0
                                ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
                                : 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                            }`}
                          >
                            {daysLeft}d left
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleAdjustDays(user, 1)}
                              title="Add 1 day"
                              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleAdjustDays(user, -1)}
                              title="Decrease 1 day"
                              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Credits */}
                      <td className="py-3 px-3 select-text font-mono text-[11px]">
                        <span className="text-emerald-400 font-bold">{creditsRemaining.toLocaleString()}</span>
                        <span className="text-neutral-500"> / {maxCredits.toLocaleString()}</span>
                      </td>

                      {/* PROMPT EDITOR ACCESS TOGGLE */}
                      <td className="py-3 px-3 text-center select-text">
                        <button
                          onClick={() => handleTogglePromptEditor(user)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isPromptEditor
                              ? 'bg-purple-950/80 border-purple-500/60 text-purple-200 hover:bg-purple-900/80 shadow-sm'
                              : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                          }`}
                          title={`Click to ${isPromptEditor ? 'REVOKE' : 'GRANT'} Prompt Server Editor access`}
                        >
                          {isPromptEditor ? (
                            <>
                              <Terminal className="w-3.5 h-3.5 text-purple-400" />
                              <span>Editor Active</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Grant Access</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Extension Access Toggle */}
                      <td className="py-3 px-3 text-center select-text">
                        <button
                          onClick={() => handleToggleExtensionAccess(user)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isExtensionAllowed
                              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                              : 'bg-rose-950/60 border-rose-500/50 text-rose-300 hover:bg-rose-900/60'
                          }`}
                          title={`Click to ${isExtensionAllowed ? 'BLOCK' : 'ALLOW'} extension access`}
                        >
                          {isExtensionAllowed ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Allowed</span>
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                              <span>Blocked</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Live Deduction Buttons */}
                      <td className="py-3 px-4 text-right select-text">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleDeductImageCredit(user)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-950/30 hover:bg-amber-950/60 border border-amber-600/40 hover:border-amber-500 rounded-lg text-[11px] font-semibold text-amber-300 transition-colors cursor-pointer"
                            title={`Deduct ${imageCost} credits for Image generation`}
                          >
                            <ImageIcon className="w-3 h-3 text-amber-400" />
                            <span>-{imageCost}</span>
                          </button>

                          <button
                            onClick={() => handleDeductVideoCredit(user)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-600/40 hover:border-rose-500 rounded-lg text-[11px] font-semibold text-rose-300 transition-colors cursor-pointer"
                            title={`Deduct ${videoCost} credits for Video generation`}
                          >
                            <Video className="w-3 h-3 text-rose-400" />
                            <span>-{videoCost}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD USER & GRANT ACCESS MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#121318] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white">
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold font-display text-white">Add New User & Grant Access</h3>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">User Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="e.g. Sachin Kumar"
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Gmail ID / Email</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="user@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  placeholder="User login password"
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Plan Tier</label>
                  <select
                    value={newUserPlan}
                    onChange={e => {
                      const p = e.target.value as 'basic' | 'ultra';
                      setNewUserPlan(p);
                      setNewUserCredits(p === 'ultra' ? 45000 : 100);
                    }}
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="ultra">Ultra VIP (45k)</option>
                    <option value="basic">Basic (100)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Credits</label>
                  <input
                    type="number"
                    value={newUserCredits}
                    onChange={e => setNewUserCredits(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 p-3 bg-purple-950/30 border border-purple-800/50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUserCanEditPrompts}
                    onChange={e => setNewUserCanEditPrompts(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded bg-[#0b0c0f] border-neutral-700 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-purple-200 block">Grant Prompt Server Editor Access</span>
                    <span className="text-[10.5px] text-neutral-400">Allows user to login and update server prompts in /PromptServer</span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingUser}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  {isAddingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Create User & Grant Access</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
