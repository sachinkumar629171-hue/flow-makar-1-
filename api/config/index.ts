import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_PLAN_EXTENSIONS = {
  basic: {
    name: 'Flow Basic Chrome Extension',
    version: '1.8.0',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc',
    fileName: 'flow-basic-extension-v1.8.0.zip',
    description: 'Standard Video Prompt Sync & Studio Launcher for Basic Plan Members.',
    updatedAt: new Date().toISOString(),
    downloadType: 'url',
  },
  ultra: {
    name: 'Flow Ultra VIP Extension',
    version: '3.2.0',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc',
    fileName: 'flow-ultra-vip-extension-v3.2.0.zip',
    description: 'High-Speed 4K Pipeline, Unlimited Prompt Queue & VIP Multi-Session Sync.',
    updatedAt: new Date().toISOString(),
    downloadType: 'url',
  },
};

const DEFAULT_TUTORIAL_CONFIG = {
  desktopVideoUrl: 'https://youtu.be/bNZXy0cAv_o?si=_hgtM9DrSpMS4EhN',
  desktopTitle: 'How to Use Flow on Desktop / PC',
  desktopSubtitle: 'Complete tutorial on setting up the Chrome extension & using Desktop Studio.',
  mobileVideoUrl: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
  mobileTitle: 'How to Use Flow on Mobile (Android & iOS)',
  mobileSubtitle: 'Step-by-step guide on generating AI videos seamlessly from mobile browsers.',
};

const DEFAULT_PROMPT_CONFIG = {
  servers: [
    {
      id: 'server1',
      label: 'Server 1',
      prompt: '',
    }
  ],
  costs: {
    image: 20,
    video: 30
  },
  signupTelegramUrl: 'https://t.me/google_ultra_veo3_bot',
  resellerContactUrl: 'https://t.me/google_ultra_veo3_bot',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vtdwwhzcyuzmcdkoxmpo.supabase.co';
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHd3aHpjeXV6bWNka294bXBvIiwicm9sZSI6ImFub24iLCJpYXQyMiwiZXhwIjoyMDQ5NTY3ODc5fQ.fake';

  const supabase = supaUrl && supaKey ? createClient(supaUrl, supaKey) : null;

  try {
    if (req.method === 'GET') {
      let promptConfig = DEFAULT_PROMPT_CONFIG;
      let planExtensions = DEFAULT_PLAN_EXTENSIONS;
      let tutorialConfig = DEFAULT_TUTORIAL_CONFIG;

      if (supabase) {
        let hasAppPrompt = false;
        let hasAppExt = false;
        let hasAppTut = false;

        // Try app_config table first
        try {
          const { data: configs } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', ['admin_config_prompts', 'admin_config_extensions', 'admin_config_tutorial']);
          if (configs && Array.isArray(configs)) {
            for (const cfg of configs) {
              if (cfg.key === 'admin_config_prompts' && cfg.value) {
                promptConfig = cfg.value;
                hasAppPrompt = true;
              } else if (cfg.key === 'admin_config_extensions' && cfg.value) {
                planExtensions = cfg.value;
                hasAppExt = true;
              } else if (cfg.key === 'admin_config_tutorial' && cfg.value) {
                tutorialConfig = cfg.value;
                hasAppTut = true;
              }
            }
          }
        } catch {}

        // Only query users table backup rows for missing keys (saves 50%+ Egress!)
        const missingKeys: string[] = [];
        if (!hasAppPrompt) missingKeys.push('admin_config_prompts');
        if (!hasAppExt) missingKeys.push('admin_config_extensions');
        if (!hasAppTut) missingKeys.push('admin_config_tutorial');

        if (missingKeys.length > 0) {
          try {
            const { data: usrRows } = await supabase
              .from('users')
              .select('id, name')
              .in('id', missingKeys);
            if (Array.isArray(usrRows)) {
              for (const row of usrRows) {
                if (!row.name) continue;
                const parsed = typeof row.name === 'string' ? JSON.parse(row.name) : row.name;
                if (row.id === 'admin_config_prompts' && parsed) promptConfig = { ...promptConfig, ...parsed };
                if (row.id === 'admin_config_extensions' && parsed) planExtensions = { ...planExtensions, ...parsed };
                if (row.id === 'admin_config_tutorial' && parsed) tutorialConfig = { ...tutorialConfig, ...parsed };
              }
            }
          } catch {}
        }
      }

      return res.status(200).json({
        planExtensions,
        tutorialConfig,
        promptConfig,
        supabaseConfig: supaUrl && supaKey ? { url: supaUrl, anonKey: supaKey } : undefined,
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { promptConfig, planExtensions, tutorialConfig } = body;

      try {
        (globalThis as any).__meAnnouncementCache = null;
      } catch {}

      if (supabase) {
        if (promptConfig) {
          // Strip heavy prompt blobs (stored in public.servers) so admin_config_prompts stays < 1KB
          const stampedPromptConfig = {
            ...promptConfig,
            server1Prompt: '',
            server2Prompt: '',
            servers: Array.isArray(promptConfig.servers)
              ? promptConfig.servers.map((s: any) => ({
                  id: s.id,
                  label: s.label,
                  prompt: '',
                  lastUpdatedAt: s.lastUpdatedAt,
                  updatedBy: s.updatedBy,
                  reminded20MinSent: s.reminded20MinSent,
                  missed5MinSent: s.missed5MinSent,
                  wasMissed: s.wasMissed,
                }))
              : undefined,
            _updatedAt: Date.now(),
            ...(promptConfig.dashboardAnnouncement
              ? {
                  dashboardAnnouncement: {
                    ...promptConfig.dashboardAnnouncement,
                    enabled: Boolean(promptConfig.dashboardAnnouncement.enabled),
                    updatedAt: Date.now(),
                  },
                }
              : {}),
          };
          try {
            await supabase.from('app_config').upsert({
              key: 'admin_config_prompts',
              value: stampedPromptConfig,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
          } catch {}
          try {
            await supabase.from('users').upsert({
              id: 'admin_config_prompts',
              name: JSON.stringify(stampedPromptConfig),
              email: 'admin_config_prompts@system.local',
              password: 'config_no_login_123',
              plan: 'basic',
              credits: 0,
              max_credits: 0,
              plan_days_left: 0,
              session_token: 'sys_prompts',
              is_online: false,
            }, { onConflict: 'id' });
          } catch {}
        }

        if (planExtensions) {
          const stampedPlanExtensions = {
            ...planExtensions,
            basic: planExtensions.basic ? { ...planExtensions.basic, fileData: undefined } : undefined,
            ultra: planExtensions.ultra ? { ...planExtensions.ultra, fileData: undefined } : undefined,
            _updatedAt: Date.now(),
          };
          try {
            await supabase.from('app_config').upsert({
              key: 'admin_config_extensions',
              value: stampedPlanExtensions,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
          } catch {}
          try {
            await supabase.from('users').upsert({
              id: 'admin_config_extensions',
              name: JSON.stringify(stampedPlanExtensions),
              email: 'admin_config_extensions@system.local',
              password: 'config_no_login_123',
              plan: 'basic',
              credits: 0,
              max_credits: 0,
              plan_days_left: 0,
              session_token: 'sys_config',
              is_online: false,
            }, { onConflict: 'id' });
          } catch {}
        }

        if (tutorialConfig) {
          try {
            await supabase.from('app_config').upsert({
              key: 'admin_config_tutorial',
              value: tutorialConfig,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
          } catch {}
          try {
            await supabase.from('users').upsert({
              id: 'admin_config_tutorial',
              name: JSON.stringify(tutorialConfig),
              email: 'admin_config_tutorial@system.local',
              password: 'config_no_login_123',
              plan: 'basic',
              credits: 0,
              max_credits: 0,
              plan_days_left: 0,
              session_token: 'sys_config',
              is_online: false,
            }, { onConflict: 'id' });
          } catch {}
        }
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('api/config error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
