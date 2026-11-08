import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

interface StaticSeoRoute {
  path: string;
  title: string;
  description: string;
  heading: string;
}

const SEO_ROUTES: StaticSeoRoute[] = [
  {
    path: '/login',
    title: 'Google Flow Login — Member Sign In | FlowMaker AI (Flow Ultra, ChatGPT Plus, Super Grok & Muse AI)',
    description: 'Sign in to FlowMaker AI (flowmakerai.site) to access Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI via our extension-based platform.',
    heading: 'Google Flow Login — Member Sign In (FlowMaker AI)',
  },
  {
    path: '/register',
    title: 'Register Account — FlowMaker AI | Google Flow Ultra, ChatGPT Plus, Super Grok & Muse AI',
    description: 'Create your FlowMaker AI account for extension-based access to Google Flow Ultra (AI video generator), ChatGPT Plus, Super Grok, and Muse AI.',
    heading: 'Register New Account — FlowMaker AI Extension Platform',
  },
  {
    path: '/signup',
    title: 'Sign Up — FlowMaker AI | Google Flow Maker Free & Ultra Extension Platform',
    description: 'Join FlowMaker AI (flowmakerai.site) to use Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI with our Chrome Extension.',
    heading: 'Sign Up — FlowMaker AI (Google Flow Ultra, ChatGPT Plus, Super Grok & Muse AI)',
  },
  {
    path: '/reseller',
    title: 'Reseller Portal Login — FlowMaker AI | Official Flow Ultra Reseller Panel',
    description: 'Official FlowMaker AI Reseller Portal. Log in to create and manage member accounts for Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI.',
    heading: 'Official FlowMaker AI Reseller Portal Login',
  },
  {
    path: '/pricing',
    title: 'Pricing & Plans — FlowMaker AI | Google Flow Ultra, ChatGPT Plus, Super Grok & Muse AI',
    description: 'Explore FlowMaker AI membership plans and pricing for extension-based access to Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI.',
    heading: 'Pricing & Membership Plans — FlowMaker AI (Basic, Ultra & Unlimited)',
  },
  {
    path: '/dashboard',
    title: 'Member Dashboard — FlowMaker AI | Google Flow Ultra, ChatGPT Plus, Super Grok & Muse AI',
    description: 'FlowMaker AI Member Dashboard to launch Google Flow Ultra, ChatGPT Plus, Super Grok, and Muse AI extension tools.',
    heading: 'Member Dashboard — FlowMaker AI Extension Studio',
  },
];

function seoPrerenderRoutesPlugin(): Plugin {
  return {
    name: 'seo-prerender-routes',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const baseIndexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(baseIndexPath)) return;

      const baseHtml = fs.readFileSync(baseIndexPath, 'utf-8');

      for (const route of SEO_ROUTES) {
        const canonicalUrl = `https://www.flowmakerai.site${route.path}`;
        let routeHtml = baseHtml
          .replace(/<title>[\s\S]*?<\/title>/i, `<title>${route.title}</title>`)
          .replace(
            /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="description" content="${route.description}" />`
          )
          .replace(
            /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
            `<link rel="canonical" href="${canonicalUrl}" />`
          )
          .replace(
            /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:url" content="${canonicalUrl}" />`
          )
          .replace(
            /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:title" content="${route.title}" />`
          )
          .replace(
            /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:description" content="${route.description}" />`
          )
          .replace(
            /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:title" content="${route.title}" />`
          )
          .replace(
            /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:description" content="${route.description}" />`
          )
          .replace(
            /<h1>[\s\S]*?<\/h1>/i,
            `<h1>${route.heading}</h1>`
          );

        const routeFolder = path.join(distDir, route.path.replace(/^\//, ''));
        fs.mkdirSync(routeFolder, { recursive: true });
        fs.writeFileSync(path.join(routeFolder, 'index.html'), routeHtml, 'utf-8');
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), seoPrerenderRoutesPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
