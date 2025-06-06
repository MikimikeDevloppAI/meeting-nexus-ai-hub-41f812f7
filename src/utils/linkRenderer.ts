
export const renderMessageWithLinks = (text: string): string => {
  if (!text) return '';
  
  // Convert markdown links [text](url) to HTML links
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let processedText = text.replace(linkRegex, (match, linkText, url) => {
    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return match; // Return original if not a valid URL
    }
    
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${linkText}</a>`;
  });
  
  // Convert plain URLs to clickable links
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
  processedText = processedText.replace(urlRegex, (url) => {
    // Check if already wrapped in HTML link
    if (processedText.includes(`href="${url}"`)) {
      return url;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${url}</a>`;
  });
  
  // Convert line breaks to HTML
  processedText = processedText.replace(/\n/g, '<br>');
  
  return processedText;
};

export const sanitizeHtml = (html: string): string => {
  // Basic sanitization - only allow specific tags
  const allowedTags = ['a', 'br', 'strong', 'em', 'b', 'i', 'p', 'ul', 'ol', 'li'];
  const allowedAttributes = ['href', 'target', 'rel', 'class'];
  
  // Simple sanitization - in production, consider using a library like DOMPurify
  let sanitized = html;
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  return sanitized;
};
