/**
 * Helper to extract a YouTube embed URL from various YouTube formats
 */
export function getYouTubeEmbedUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // If already an embed URL
  if (trimmed.includes('youtube.com/embed/')) {
    const parts = trimmed.split('youtube.com/embed/');
    const id = parts[1]?.split('?')[0]?.split('&')[0];
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
  }

  // Check for standard match: youtu.be/ID or youtube.com/watch?v=ID or shorts/ID
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );

  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`;
  }

  // If user pasted just the 11 character ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/${trimmed}?rel=0&modestbranding=1`;
  }

  return trimmed;
}

export function getYouTubeVideoId(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return '';
}
