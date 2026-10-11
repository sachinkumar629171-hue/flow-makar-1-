import { ExtensionConfig, PlanType } from '../types';
import { apiUrl } from '../config/api';

/**
 * Transforms Google Drive / Dropbox share links to direct downloadable stream URLs
 */
export function formatDownloadUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // 1. Google Drive direct link conversion
  // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // or https://drive.google.com/open?id=FILE_ID
  const driveMatch1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const driveMatch2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const fileId = driveMatch1 ? driveMatch1[1] : (driveMatch2 ? driveMatch2[1] : null);

  if (fileId && (url.includes('drive.google.com') || url.includes('docs.google.com'))) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  // 2. Dropbox share link conversion (dl=0 -> dl=1)
  if (url.includes('dropbox.com') && url.includes('dl=0')) {
    return url.replace('dl=0', 'dl=1');
  }

  return url;
}

/**
 * Triggers robust download for extensions across all browsers (Desktop, Mobile, Base64, Server & External URLs)
 */
export function triggerExtensionDownload(config: ExtensionConfig, plan: PlanType = 'basic') {
  if (!config) return;

  const defaultFileName = config.fileName || (plan === 'ultra' ? 'flow-ultra-extension.zip' : 'flow-basic-extension.zip');

  // Case 1: Uploaded File (Base64 data URL)
  if (config.downloadType === 'file' && config.fileData && config.fileData.startsWith('data:')) {
    try {
      // Convert data URL to Blob for reliable large file download on Chrome / Mobile
      const parts = config.fileData.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/zip';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(blobUrl);
      }, 1500);
      return;
    } catch (e) {
      console.warn('Blob conversion fallback to direct link:', e);
    }
  }

  // Case 2: Server API endpoint or Direct URL
  let targetUrl = config.downloadUrl?.trim() || 'https://drive.google.com/uc?export=download&id=1ow7jqVhIgJZiJfXw9AsYMTNw_AzPZLwc';

  // If it's a URL type, just open the exact link provided by the admin directly
  if (config.downloadType === 'url' && targetUrl) {
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    window.open(targetUrl, '_blank');
    return;
  }
  
  if (!targetUrl && config.downloadType === 'file') {
    targetUrl = apiUrl(`/api/extensions/download/${plan}`);
  }

  if (targetUrl) {
    // If it's a relative URL, prepend server base
    if (targetUrl.startsWith('/api/')) {
      targetUrl = apiUrl(targetUrl);
    } else {
      targetUrl = formatDownloadUrl(targetUrl);
    }

    const isDirectDownload = 
      targetUrl.toLowerCase().endsWith('.zip') || 
      targetUrl.toLowerCase().endsWith('.crx') || 
      targetUrl.toLowerCase().endsWith('.tar.gz') ||
      targetUrl.includes('/download') ||
      targetUrl.includes('drive.google.com/uc') ||
      targetUrl.includes('dropbox.com') ||
      targetUrl.includes('/api/extensions/download');

    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = targetUrl;
    link.target = isDirectDownload ? '_self' : '_blank';
    link.rel = 'noopener noreferrer';
    
    if (isDirectDownload) {
      link.download = defaultFileName;
    }

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 1000);
    return;
  }

  // Fallback: If nothing else, hit central server plan download
  const serverFallback = apiUrl(`/api/extensions/download/${plan}`);
  window.open(serverFallback, '_blank');
}

