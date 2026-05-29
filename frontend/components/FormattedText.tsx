import React, { useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import Markdown from "react-native-markdown-display";

// Inject KaTeX CSS once into the document head (web only)
// Matches the installed npm version so CSS class names align.
function ensureKaTeXCSS() {
  if (typeof document === "undefined") return;
  const KATEX_VERSION = "0.17.0";
  const id = `katex-css-${KATEX_VERSION}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

type FormattedTextProps = {
  content: string;
  style?: any;
  fontSize?: number;
  color?: string;
};

// ---------------------------------------------------------------------------
// hasLatex – detect whether a string contains any LaTeX math
// ---------------------------------------------------------------------------
function hasLatex(text: string): boolean {
  if (!text) return false;
  return (
    /\$/.test(text) ||
    /\\[()\[\]]/.test(text) ||
    /\\(?:frac|sqrt|sum|int|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|cdot|times|div|pm|infty|partial|nabla|forall|exists|in|notin|subset|cup|cap|equiv|approx|neq|leq|geq|vec|hat|bar|dot|ddot|lim|log|sin|cos|tan)\b/.test(
      text
    )
  );
}

// ---------------------------------------------------------------------------
// escapeHtml – prevent injection when building HTML strings
// ---------------------------------------------------------------------------
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// renderLatexToHTML – converts text with LaTeX delimiters to HTML
// Uses katex.renderToString() so it is fully synchronous (no CDN wait).
// ---------------------------------------------------------------------------
function renderLatexToHTML(text: string, fontSize: number): string {
  if (!text) return "";

  // Import katex only when needed (keeps native bundle clean)
  // On native this function is never called.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const katex = require("katex");

  const delimiters: Array<{
    regex: RegExp;
    display: boolean;
  }> = [
    { regex: /^\$\$([\s\S]*?)\$\$/, display: true },
    { regex: /^\\\[([\s\S]*?)\\\]/, display: true },
    { regex: /^\$([^$\n]+?)\$/, display: false },
    { regex: /^\\\(([\s\S]*?)\\\)/, display: false },
  ];

  let result = "";
  let remaining = text;

  while (remaining.length > 0) {
    let earliestIndex = Infinity;
    let earliestMatch: RegExpExecArray | null = null;
    let earliestDisplay = false;

    for (const delim of delimiters) {
      // Strip the ^ anchor to search anywhere in the string
      const searchRegex = new RegExp(
        delim.regex.source.replace(/^\^/, ""),
        "s"
      );
      const m = searchRegex.exec(remaining);
      if (m && m.index < earliestIndex) {
        earliestIndex = m.index;
        earliestMatch = m;
        earliestDisplay = delim.display;
      }
    }

    if (!earliestMatch) {
      // No math left – append rest as plain text
      result += escapeHtml(remaining);
      break;
    }

    // Text before the match
    if (earliestIndex > 0) {
      result += escapeHtml(remaining.slice(0, earliestIndex));
    }

    // Render math
    try {
      // Use htmlAndMathml: HTML for visual rendering (styled by KaTeX CSS)
      // + MathML for accessibility. CSS is injected via ensureKaTeXCSS().
      result += katex.renderToString(earliestMatch[1], {
        displayMode: earliestDisplay,
        throwOnError: false,
        output: "htmlAndMathml",
      });
    } catch {
      result += escapeHtml(earliestMatch[0]);
    }

    remaining = remaining.slice(earliestIndex + earliestMatch[0].length);
  }

  return result;
}

// ---------------------------------------------------------------------------
// WebLatexRenderer – renders math inline on web using dangerouslySetInnerHTML
// ---------------------------------------------------------------------------
const WebLatexRenderer: React.FC<{
  content: string;
  fontSize: number;
  color: string;
}> = ({ content, fontSize, color }) => {
  // Ensure KaTeX CSS is loaded before first render
  useEffect(() => {
    ensureKaTeXCSS();
  }, []);

  // Also call synchronously so CSS loads even on SSR/first paint
  ensureKaTeXCSS();

  const html = renderLatexToHTML(content, fontSize);

  return (
    <div
      // @ts-ignore – valid on react-native-web
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        fontSize,
        color,
        lineHeight: 1.6,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        wordBreak: "break-word",
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// NativeLatexRenderer – renders math in a self-contained WebView on iOS/Android
// ---------------------------------------------------------------------------
const NativeLatexRenderer: React.FC<{
  content: string;
  fontSize: number;
  color: string;
}> = ({ content, fontSize, color }) => {
  const [height, setHeight] = React.useState(fontSize * 2.5);

  // Lazy import to avoid bundling WebView on web
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require("react-native-webview");

  const safe = escapeHtml(content);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:${fontSize}px;color:${color};line-height:1.6;background:transparent;word-break:break-word;padding:2px 0}
.katex{font-size:1em}.katex-display{overflow-x:auto;overflow-y:hidden}
</style>
</head>
<body>
<div id="c">${safe}</div>
<script>
document.addEventListener('DOMContentLoaded',function(){
  renderMathInElement(document.getElementById('c'),{
    delimiters:[
      {left:'$$',right:'$$',display:true},
      {left:'$',right:'$',display:false},
      {left:'\\\\(',right:'\\\\)',display:false},
      {left:'\\\\[',right:'\\\\]',display:true}
    ],
    throwOnError:false
  });
  window.ReactNativeWebView.postMessage(JSON.stringify({height:document.body.scrollHeight}));
});
</script>
</body>
</html>`;

  return (
    <WebView
      source={{ html }}
      style={{ height, backgroundColor: "transparent" }}
      scrollEnabled={false}
      onMessage={(e: any) => {
        try {
          const { height: h } = JSON.parse(e.nativeEvent.data);
          if (h) setHeight(h + 8);
        } catch (_) {}
      }}
      javaScriptEnabled
    />
  );
};

// ---------------------------------------------------------------------------
// Plain-markdown styles
// ---------------------------------------------------------------------------
function buildMarkdownStyles(fontSize: number, color: string) {
  return StyleSheet.create({
    body: { fontSize, color, lineHeight: fontSize * 1.5 },
    paragraph: { marginTop: 0, marginBottom: 8 },
    heading1: {
      fontSize: fontSize * 1.5,
      fontWeight: "bold" as const,
      color,
      marginTop: 12,
      marginBottom: 8,
    },
    heading2: {
      fontSize: fontSize * 1.3,
      fontWeight: "bold" as const,
      color,
      marginTop: 10,
      marginBottom: 6,
    },
    heading3: {
      fontSize: fontSize * 1.15,
      fontWeight: "600" as const,
      color,
      marginTop: 8,
      marginBottom: 4,
    },
    strong: { fontWeight: "bold" as const },
    em: { fontStyle: "italic" as const },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    code_inline: {
      backgroundColor: "#f3f4f6",
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: fontSize * 0.9,
    },
    code_block: {
      backgroundColor: "#f3f4f6",
      padding: 12,
      borderRadius: 8,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: fontSize * 0.85,
      overflow: "hidden" as const,
    },
    fence: {
      backgroundColor: "#f3f4f6",
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: "#d1d5db",
      paddingLeft: 12,
      marginVertical: 8,
      opacity: 0.85,
    },
    link: { color: "#2563eb", textDecorationLine: "underline" as const },
    table: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6 },
    th: {
      backgroundColor: "#f9fafb",
      padding: 8,
      fontWeight: "600" as const,
    },
    td: { padding: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
    hr: { backgroundColor: "#e5e7eb", height: 1, marginVertical: 12 },
    text: { fontSize, color },
  });
}

// ---------------------------------------------------------------------------
// FormattedText – public export
// ---------------------------------------------------------------------------
const FormattedText = ({
  content,
  style,
  fontSize = 16,
  color = "#111827",
}: FormattedTextProps) => {
  if (!content) return null;

  const containsLatex = hasLatex(content);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, style]}>
        {containsLatex ? (
          <WebLatexRenderer
            content={content}
            fontSize={fontSize}
            color={color}
          />
        ) : (
          <Markdown style={buildMarkdownStyles(fontSize, color)}>
            {content}
          </Markdown>
        )}
      </View>
    );
  }

  // Native
  return (
    <View style={[styles.container, style]}>
      {containsLatex ? (
        <NativeLatexRenderer
          content={content}
          fontSize={fontSize}
          color={color}
        />
      ) : (
        <Markdown style={buildMarkdownStyles(fontSize, color)}>
          {content}
        </Markdown>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default FormattedText;
