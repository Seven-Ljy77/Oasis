import React, { useEffect, useMemo, useRef } from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import { openInBrowser } from "@/lib/ipc";

interface ReaderWebViewProps {
  html: string;
  baseURL: string;
  mode?: "reader" | "web";
  loading?: boolean;
  onActionURL?: (url: string) => void;
}

/** Injected into the reader iframe to support "select → translate" */
const SELECT_TRANSLATE_SCRIPT = `
<script>
(function(){
  let btn = null;
  function hideBtn(){ if(btn){ btn.remove(); btn = null; } }
  document.addEventListener('mouseup', function(e){
    setTimeout(function(){
      hideBtn();
      var sel = window.getSelection();
      var text = (sel && sel.toString().trim()) || '';
      if (!text || text.length > 500) return;
      var range = sel.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      if (!rect || (rect.width===0 && rect.height===0)) return;
      btn = document.createElement('button');
      btn.textContent = '译';
      btn.style.cssText = 'position:absolute;z-index:9999;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:13px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);';
      btn.style.left = (rect.right + 4) + 'px';
      btn.style.top = (rect.top + window.scrollY - 4) + 'px';
      btn.onmousedown = function(ev){ ev.stopPropagation(); ev.preventDefault(); };
      btn.onclick = function(ev){
        ev.stopPropagation();
        window.parent.postMessage({ type:'oasis-word-translate', text: text }, '*');
        hideBtn();
      };
      document.body.appendChild(btn);
    }, 10);
  });
  document.addEventListener('mousedown', function(e){
    if (btn && e.target !== btn) hideBtn();
  });
})();
<\/script>`;

const ReaderWebView: React.FC<ReaderWebViewProps> = ({
  html,
  baseURL,
  mode = "reader",
  loading = false,
  onActionURL,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inject the selection-translate script before </body>
  const injectedHtml = useMemo(() => {
    if (!html) return html;
    return html.replace("</body>", SELECT_TRANSLATE_SCRIPT + "</body>");
  }, [html]);

  useEffect(() => {
    if (mode !== "reader") return;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const payload = event.data;
      if (
        !payload ||
        typeof payload !== "object" ||
        !("type" in payload) ||
        !("url" in payload) ||
        payload.type !== "oasis-open-link" ||
        typeof payload.url !== "string"
      ) {
        return;
      }

      if (onActionURL) {
        onActionURL(payload.url);
      } else {
        void openInBrowser(payload.url).catch((error) => {
          console.error("Failed to open reader link:", error);
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [mode, onActionURL]);

  // Web mode: load the original URL directly
  if (mode === "web" && baseURL) {
    return (
      <iframe src={baseURL} className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin" title="Web content" />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-reader-bg">
        <div className="text-center text-slate-400">
          <svg className="animate-spin w-10 h-10 mx-auto mb-3 text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex items-center justify-center h-full bg-reader-bg">
        <div className="text-center text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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
      srcDoc={injectedHtml}
      onLoad={() => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        const state = useReaderStore.getState();
        for (const segment of state.translationSegments) {
          if (!segment.translated_text) continue;
          iframe.contentWindow.postMessage(
            {
              type: "oasis-translation",
              orderIndex: segment.order_index,
              text: segment.translated_text,
              showOriginal: state.translationBilingual,
            },
            "*",
          );
        }
      }}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin"
      title="Reader content"
    />
  );
};

export default ReaderWebView;
