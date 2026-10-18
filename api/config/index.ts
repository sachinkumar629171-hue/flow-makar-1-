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
        // Try app_config table
        try {
          const { data: configs } = await supabase.from('app_config').select('*');
          if (configs && Array.isArray(configs)) {
            for (const cfg of configs) {
              if (cfg.key === 'admin_config_prompts' && cfg.value) promptConfig = cfg.value;
              else if (cfg.key === 'admin_config_extensions' && cfg.value) planExtensions = cfg.value;
              else if (cfg.key === 'admin_config_tutorial' && cfg.value) tutorialConfig = cfg.value;
            }
          }
        } catch {}

        // Fallback: check users table backup rows
        try {
          const { data: promptRow } = await supabase.from('users').select('name').eq('id', 'admin_config_prompts').maybeSingle();
          if (promptRow?.name) {
            const parsed = JSON.parse(promptRow.name);
            if (parsed && typeof parsed === 'object') promptConfig = { ...promptConfig, ...parsed };
          }
        } catch {}

        try {
          const { data: extRow } = await supabase.from('users').select('name').eq('id', 'admin_config_extensions').maybeSingle();
          if (extRow?.name) {
            const parsed = JSON.parse(extRow.name);
            if (parsed && typeof parsed === 'object') planExtensions = { ...planExtensions, ...parsed };
          }
        } catch {}

        try {
          const { data: tutRow } = await supabase.from('users').select('name').eq('id', 'admin_config_tutorial').maybeSingle();
          if (tutRow?.name) {
            const parsed = JSON.parse(tutRow.name);
            if (parsed && typeof parsed === 'object') tutorialConfig = { ...tutorialConfig, ...parsed };
          }
        } catch {}
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

      if (supabase) {
        if (promptConfig) {
          try {
            await supabase.from('app_config').upsert({
              key: 'admin_config_prompts',
              value: promptConfig,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
          } catch {}
          try {
            await supabase.from('users').upsert({
              id: 'admin_config_prompts',
              name: JSON.stringify(promptConfig),
              email: 'admin_config_prompts@system.local',
              role: 'system_config',
            }, { onConflict: 'id' });
          } catch {}
        }

        if (planExtensions) {
          try {
            await supabase.from('app_config').upsert({
              key: 'admin_config_extensions',
              value: planExtensions,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });
          } catch {}
          try {
            await supabase.from('users').upsert({
              id: 'admin_config_extensions',
              name: JSON.stringify(planExtensions),
              email: 'admin_config_extensions@system.local',
              role: 'system_config',
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
              role: 'system_config',
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
