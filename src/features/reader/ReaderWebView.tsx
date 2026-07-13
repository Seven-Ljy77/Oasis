import React, { useRef, useEffect } from "react";

interface ReaderWebViewProps {
  html: string;
  baseURL: string;
  mode?: "reader" | "web";
  /** Called when user clicks a link — allows custom navigation handling */
  onActionURL?: (url: string) => void;
}

/**
 * Placeholder WebView component for rendering reader content.
 *
 * In production (Tauri), this would use an iframe with srcdoc or Tauri's
 * createWebview API. For now it renders a styled placeholder that shows
 * formatted article content via a sandboxed iframe.
 */
const ReaderWebView: React.FC<ReaderWebViewProps> = ({
  html,
  baseURL,
  mode = "reader",
  onActionURL,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build a minimal HTML document for the iframe with reader theme variables
  const readerDoc = html
    ? `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #faf9f7;
      --text-primary: #1a1a1a;
      --text-secondary: #6b6b6b;
      --link: #2563eb;
      --blockquote-border: #2563eb;
      --code-bg: #f3f4f6;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1a1a1a;
        --text-primary: #e8e6e3;
        --text-secondary: #989898;
        --link: #6ba0f9;
        --blockquote-border: #6ba0f9;
        --code-bg: #262626;
      }
    }
    body {
      margin: 0;
      padding: 2rem 1.5rem;
      font-family: 'Merriweather', Georgia, serif;
      font-size: 17px;
      line-height: 1.75;
      color: var(--text-primary);
      background: var(--bg);
      max-width: 42rem;
      margin: 0 auto;
    }
    a { color: var(--link); }
    blockquote {
      border-left: 3px solid var(--blockquote-border);
      margin-left: 0;
      padding-left: 1rem;
      color: var(--text-secondary);
    }
    code {
      background: var(--code-bg);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre code {
      display: block;
      padding: 1rem;
      overflow-x: auto;
    }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`
    : null;

  // Web mode: load the original URL directly
  if (mode === "web" && baseURL) {
    return (
      <iframe
        src={baseURL}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin"
        title="Web content"
      />
    );
  }

  // Placeholder content when no HTML is available
  if (!readerDoc) {
    return (
      <div className="flex items-center justify-center h-full bg-reader-bg">
        <div className="text-center text-slate-400">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-slate-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p className="text-sm">Reader content would render here</p>
          <p className="text-xs mt-1">Select an article to begin reading</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={readerDoc}
      className="w-full h-full border-0"
      sandbox="allow-scripts"
      title="Reader content"
      // TODO: intercept link clicks and call onActionURL for external links
    />
  );
};

export default ReaderWebView;
