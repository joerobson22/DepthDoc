import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Code2,
  Columns,
  Layers,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Download,
  Sparkles,
  Users,
  Briefcase,
  Terminal,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  Plus,
  Table,
  HelpCircle,
  Sigma,
  RotateCcw,
  BookCopy,
  FileText,
  ChevronLeft,
  Sun,
  Moon,
  Save,
  FolderOpen,
  Trash2,
  FilePlus2,
  PanelLeftClose,
  PanelLeftOpen,
  FolderSync,
  HardDrive
} from 'lucide-react';

// ============================================================================
// LOCAL DISK (data/ FOLDER) & INDEXEDDB PERSISTENCE HELPERS
// ============================================================================
const IDB_NAME = 'depthdoc-local-store';
const IDB_STORE = 'workspace';
const GUIDE_FILE_NAME = 'multi-altitude-latex-guide.md';

function openWorkspaceDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openWorkspaceDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openWorkspaceDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback silently if storage is restricted
  }
}

function slugifyFileName(title, fallbackId = 'proposal') {
  const clean = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${clean || fallbackId}.md`;
}

async function syncFromDirectoryHandle(dirHandle) {
  const docs = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && name.endsWith('.md')) {
      const file = await handle.getFile();
      const content = await file.text();
      docs.push({
        id: `fs-${name}`,
        fileName: name,
        title: deriveDocumentTitle(content) || name.replace(/\.md$/i, ''),
        content,
        updatedAt: new Date(file.lastModified).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    }
  }
  return docs;
}

async function writeMarkdownToDirectory(dirHandle, fileName, content) {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// KATEX LOADER & DEPTH CONFIGURATION CONSTANTS
// ============================================================================
const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
const KATEX_JS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';

const DEPTH_CONFIG = {
  executive: {
    label: 'Executive Summary',
    shortLabel: 'Exec',
    borderAccent: 'border-l-amber-500',
    headerBg: 'hover:bg-amber-500/[0.04]',
    badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    dotColor: 'bg-amber-500'
  },
  product: {
    label: 'Product & Workflow',
    shortLabel: 'Product',
    borderAccent: 'border-l-emerald-500',
    headerBg: 'hover:bg-emerald-500/[0.04]',
    badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    dotColor: 'bg-emerald-500'
  },
  technical: {
    label: 'Technical Architecture',
    shortLabel: 'Tech',
    borderAccent: 'border-l-blue-500',
    headerBg: 'hover:bg-blue-500/[0.04]',
    badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
    dotColor: 'bg-blue-500'
  },
  'deep-dive': {
    label: 'Deep Dive & Formulas',
    shortLabel: 'Deep Dive',
    borderAccent: 'border-l-purple-500',
    headerBg: 'hover:bg-purple-500/[0.04]',
    badgeBg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
    dotColor: 'bg-purple-500'
  },
  general: {
    label: 'Detail Section',
    shortLabel: 'Details',
    borderAccent: 'border-l-slate-400',
    headerBg: 'hover:bg-slate-500/[0.04]',
    badgeBg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25',
    dotColor: 'bg-slate-400'
  }
};

function useKatexLoader() {
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && !!window.katex);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.katex) {
      setReady(true);
      return;
    }

    if (!document.querySelector('link[data-katex-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = KATEX_CSS_URL;
      link.setAttribute('data-katex-css', 'true');
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[data-katex-js]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setReady(true));
      return;
    }

    const script = document.createElement('script');
    script.src = KATEX_JS_URL;
    script.async = true;
    script.setAttribute('data-katex-js', 'true');
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  return ready;
}

function MathRenderer({ tex, displayMode = false, katexReady }) {
  const html = useMemo(() => {
    if (!katexReady || typeof window === 'undefined' || !window.katex) return null;
    try {
      return window.katex.renderToString(tex.trim(), {
        displayMode,
        throwOnError: false,
        strict: false
      });
    } catch {
      return null;
    }
  }, [tex, displayMode, katexReady]);

  if (displayMode) {
    return (
      <div className="my-3.5 px-4 py-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 overflow-x-auto text-center shadow-2xs">
        {html ? (
          <div
            className="text-slate-900 dark:text-slate-100 text-base sm:text-lg"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <code className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
            $${tex}$$
          </code>
        )}
      </div>
    );
  }

  return html ? (
    <span
      className="inline-block align-baseline px-0.5 text-slate-900 dark:text-slate-100"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <code className="px-1 py-0.5 mx-0.5 text-[0.88em] font-mono rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
      ${tex}$
    </code>
  );
}

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-3.5 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 shadow-2xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
        <span className="font-mono uppercase tracking-wider text-[11px]">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[13px] leading-relaxed font-mono text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInlineMarkdown(text, katexReady) {
  if (!text) return null;
  const tokenRegex =
    /(`[^`\n]+`|\$\$[\s\S]+?\$\$|\$(?!\s)(?:\\.|[^$\\\n])+?(?<!\s)\$(?!\d)|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 text-[0.85em] font-mono rounded bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400 border border-slate-200/70 dark:border-slate-700/70"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
      return (
        <MathRenderer
          key={idx}
          tex={part.slice(2, -2)}
          displayMode={false}
          katexReady={katexReady}
        />
      );
    }

    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const inner = part.slice(1, -1);
      if (/^\d[\d,.\s]*(?:k|m|b)?$/i.test(inner.trim())) {
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      }
      return (
        <MathRenderer
          key={idx}
          tex={inner}
          displayMode={false}
          katexReady={katexReady}
        />
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
          {renderInlineMarkdown(part.slice(2, -2), katexReady)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-slate-800 dark:text-slate-200">
          {renderInlineMarkdown(part.slice(1, -1), katexReady)}
        </em>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-300 dark:decoration-indigo-700 underline-offset-2 hover:text-indigo-500"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

const SAMPLE_PROPOSAL = `# Project Specification: Dynamic Resource & Task Allocator (v2.0)

:::executive[1. Core Vision & Business ROI]
Project managers spend hours acting as human calculators—figuring out who is free, who has the right skills, and who is about to burn out. This tool acts as a smart co-pilot to eliminate manual spreadsheet wrangling.
- **Business Goal:** Cut weekly team allocation, scheduling, and bottleneck analysis time by 80%.
- **Cost Impact:** Zero initial cloud costs via a local-first Python and SQLite architecture.
- **Commercial Potential:** Solves a universal pain point in corporate project management, built from real-world PM insights for easy commercialization.

:::product[Product Workflow & PM Experience]
The PM builds projects using an interactive Gantt-tree, ranks task attributes with sliders, and drags units onto nodes.
- **Visual Gantt-Tree:** Custom canvas where tasks are structured as a dependency tree.
- **Behavioral Tuning:** Natural-language notes on team members are automatically parsed into scalar multipliers that adjust performance predictions.

:::product[Sub-Product: Real-Time Safety Guardrails]
Instant visual validation overlays trigger directly on the Gantt-tree canvas whenever an assignment violates team constraints:
- **Skill Deficit Alerts:** Highlights nodes when assigned proficiency $s_{u,k} < r_{t,k}$.
- **Capacity Threshold Badges:** Warns when weekly utilization $\\rho_u > 0.90$ before overload occurs.
:::

:::technical[System Architecture & Data Flow]
- **Frontend Stack:** React, Vite, TypeScript, Tailwind CSS, custom drag-and-drop canvas (React Flow).
- **Backend API:** Python FastAPI with SQLite persistence layer for lightning-fast local performance.
- **Optimization Engine:** Google OR-Tools (\`CP-SAT\` solver) evaluating multi-objective cost functions.

:::deep-dive[Core Mathematical & Solver Objectives]
The engine minimizes a total Cost Score ($C$) across competing objectives:
$$C = w_1(\\text{Completion Time}) + w_2(\\text{Labor Overrun}) + w_3(\\text{Burnout Variance}) - w_4(\\text{Skill Match})$$
Subject to capacity constraints $\\sum_{t \\in T_u} h_{u,t} \\le H_u^{\\max}$ and DAG precedence $S_j \\ge S_i + D_i$ for all edges $(i, j) \\in E$.
:::
:::
:::

---

:::executive[2. Unit Data & Behavioral Telemetry (The Team)]
Every team member has a digital profile tracking base capacity, skill levels, and qualitative working habits.
- **Core Benefit:** Moves beyond rigid titles to understand actual team strengths and weaknesses.

:::product[PM Profile Management]
- **Static Attributes:** Base weekly hours, hourly cost rate, and 1–5 skill proficiency ratings.
- **Behavioral Notes Box:** A free-form text box where PMs can type observations like *"fast finisher but needs clear specs"* or *"great under pressure"*.

:::product[Sub-Product: NLP Multiplier Calibration Studio]
Translates qualitative manager observations into bounded scalar modifiers $m_u \\in [0.75, 1.25]$ with one-click human override sliders before solver execution.
:::

:::technical[Data Schema & Storage]
- **Table Structure:** Stored locally in SQLite (\`units\` table with JSON columns for skill dictionaries and derived multipliers).

:::deep-dive[Schema Implementation & Effective Velocity]
Effective task velocity scales base skill proficiency by context multipliers:
$$v_{\\text{eff}}(u, t) = \\left(\\frac{1}{|K_t|} \\sum_{k \\in K_t} \\frac{s_{u,k}}{r_{t,k}}\\right) \\cdot \\prod_{m \\in M_u} \\mu_m$$

\`\`\`json
{
  "unit_id": "U-104",
  "name": "Sarah Jenkins",
  "role": "Senior Systems Engineer",
  "weekly_capacity_hours": 40.0,
  "committed_hours": 24.0,
  "skills": {
    "python": 5,
    "database_migration": 4
  },
  "behavioral_notes": "Extremely detail-oriented, but struggles when requirements change mid-stream.",
  "derived_multipliers": {
    "stability_bonus": 1.1,
    "ambiguity_penalty": 0.85
  }
}
\`\`\`
:::
:::
:::`;

const SYNTAX_GUIDE_MD = `# Multi-Altitude & LaTeX Authoring Guide

Use fenced \`:::\` containers to layer your proposal from executive takeaways down to mathematical proofs.

:::executive[1. Top-Level Executive Pillars]
\`:::executive[Title]\` blocks always remain at the top level—opening a new \`:::executive[...]\` automatically closes any prior executive block so pillars stay cleanly separated.

:::product[2. Nested Product & Sub-Product Layers]
\`:::product[Title]\` blocks can contain nested \`:::product[Sub-Product]\` blocks to organize modular features without cluttering the executive summary.

:::technical[3. Technical Architecture & Deep Dives]
Place system architecture inside \`:::technical[Title]\` and equations/code inside \`:::deep-dive[Title]\`.

:::deep-dive[4. Inline & Display LaTeX Formulas]
- **Inline Math:** Wrap expressions in single dollar signs like \`$\\sum \\text{Hours} \\le \\text{Capacity}$\` → $\\sum \\text{Hours} \\le \\text{Capacity}$.
- **Display Math:** Wrap standalone equations in double dollar signs \`$$ ... $$\`:
$$\\mathcal{L}(x, \\lambda) = f(x) + \\sum_{i=1}^{m} \\lambda_i g_i(x)$$
:::
:::
:::
:::`;

// ============================================================================
// RECURSIVE PARSER FOR MULTI-LEVEL MARKDOWN & NESTED ACCORDIONS (WITH CHAR OFFSETS)
// ============================================================================
function buildLineOffsets(lines) {
  const offsets = [];
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const start = pos;
    const end = pos + lines[i].length;
    offsets.push({ start, end });
    pos = end + 1;
  }
  return offsets;
}

function parseDocumentTree(markdown) {
  const normalizedMd = markdown.replace(/\r\n/g, '\n');
  const lines = normalizedMd.split('\n');
  const lineOffsets = buildLineOffsets(lines);
  let nodeCounter = 0;

  const getSpan = (firstLineIdx, lastLineIdx) => {
    if (lines.length === 0) return { startOffset: 0, endOffset: 0 };
    const safeStart = Math.max(0, Math.min(firstLineIdx, lines.length - 1));
    const safeEnd = Math.max(safeStart, Math.min(lastLineIdx, lines.length - 1));
    return {
      startOffset: lineOffsets[safeStart].start,
      endOffset: lineOffsets[safeEnd].end
    };
  };

  function parseBlock(startIndex, stopCondition, context = { insideExecutive: false, productDepth: 0 }) {
    const nodes = [];
    let currentMarkdownLines = [];
    let mdStartLine = null;
    let mdEndLine = null;
    let i = startIndex;
    let inFence = false;
    let fenceMarker = '';

    const flushMarkdown = () => {
      if (currentMarkdownLines.length > 0) {
        if (inFence && fenceMarker) {
          currentMarkdownLines.push(fenceMarker.repeat(3));
          inFence = false;
          fenceMarker = '';
        }
        const text = currentMarkdownLines.join('\n');
        if (text.trim().length > 0 && mdStartLine !== null) {
          const span = getSpan(mdStartLine, mdEndLine ?? mdStartLine);
          nodes.push({
            type: 'markdown',
            id: `md-${nodeCounter++}`,
            content: text,
            startOffset: span.startOffset,
            endOffset: span.endOffset
          });
        }
        currentMarkdownLines = [];
        mdStartLine = null;
        mdEndLine = null;
      }
    };

    const pushMdLine = (lineStr, lineIdx) => {
      if (mdStartLine === null) mdStartLine = lineIdx;
      mdEndLine = lineIdx;
      currentMarkdownLines.push(lineStr);
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
      if (fenceMatch) {
        if (!inFence) {
          inFence = true;
          fenceMarker = fenceMatch[1][0];
        } else if (trimmed.startsWith(fenceMarker.repeat(3))) {
          inFence = false;
          fenceMarker = '';
        }
        pushMdLine(line, i);
        i++;
        continue;
      }

      if (!inFence) {
        if (stopCondition === 'colon' && trimmed === ':::') {
          flushMarkdown();
          return { nodes, nextIndex: i + 1, endLineIndex: i, unwindToRoot: false };
        }
        if (stopCondition === 'details' && /^<\/details\s*>/i.test(trimmed)) {
          flushMarkdown();
          return { nodes, nextIndex: i + 1, endLineIndex: i, unwindToRoot: false };
        }

        const openColonMatch = trimmed.match(
          /^:::(executive|product|technical|deep-dive|accordion|level|details)(?:\[(.*?)\])?\s*$/i
        );
        if (openColonMatch) {
          const rawTag = openColonMatch[1].toLowerCase();
          const depth =
            rawTag === 'accordion' || rawTag === 'level' || rawTag === 'details'
              ? 'general'
              : rawTag;

          if (depth === 'executive' && context.insideExecutive && stopCondition !== null) {
            flushMarkdown();
            return { nodes, nextIndex: i, endLineIndex: i - 1, unwindToRoot: true };
          }

          flushMarkdown();
          const openLineIdx = i;
          const nextProductDepth = depth === 'product' ? context.productDepth + 1 : context.productDepth;
          const defaultLabel =
            depth === 'product' && nextProductDepth > 1
              ? `Sub-Product (L${nextProductDepth})`
              : `${DEPTH_CONFIG[depth]?.label || 'Section'} Details`;

          const title = (openColonMatch[2] && openColonMatch[2].trim()) || defaultLabel;
          const id = `acc-${nodeCounter++}`;

          const childContext = {
            insideExecutive: context.insideExecutive || depth === 'executive',
            productDepth: nextProductDepth
          };

          const childResult = parseBlock(i + 1, 'colon', childContext);
          const span = getSpan(openLineIdx, childResult.endLineIndex);

          nodes.push({
            type: 'accordion',
            id,
            depth,
            productLevel: depth === 'product' ? nextProductDepth : 0,
            title,
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            children: childResult.nodes
          });
          i = childResult.nextIndex;

          if (childResult.unwindToRoot && stopCondition !== null) {
            return { nodes, nextIndex: i, endLineIndex: childResult.endLineIndex, unwindToRoot: true };
          }
          continue;
        }

        if (/^<details(?:\s+open)?>\s*$/i.test(trimmed)) {
          flushMarkdown();
          const openLineIdx = i;
          let title = 'Additional Details';
          let contentStart = i + 1;

          if (contentStart < lines.length) {
            const nextTrimmed = lines[contentStart].trim();
            const summaryInlineMatch = nextTrimmed.match(/^<summary>(.*?)<\/summary>\s*$/i);
            if (summaryInlineMatch) {
              title = summaryInlineMatch[1].trim() || title;
              contentStart++;
            }
          }

          const id = `acc-${nodeCounter++}`;
          const childResult = parseBlock(contentStart, 'details', context);
          const span = getSpan(openLineIdx, childResult.endLineIndex);

          nodes.push({
            type: 'accordion',
            id,
            depth: 'general',
            productLevel: 0,
            title,
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            children: childResult.nodes
          });
          i = childResult.nextIndex;

          if (childResult.unwindToRoot && stopCondition !== null) {
            return { nodes, nextIndex: i, endLineIndex: childResult.endLineIndex, unwindToRoot: true };
          }
          continue;
        }
      }

      pushMdLine(line, i);
      i++;
    }

    flushMarkdown();
    return { nodes, nextIndex: i, endLineIndex: lines.length - 1, unwindToRoot: false };
  }

  return parseBlock(0, null, { insideExecutive: false, productDepth: 0 }).nodes;
}

function collectAccordions(nodes, parentIds = []) {
  let list = [];
  for (const node of nodes) {
    if (node.type === 'accordion') {
      list.push({
        id: node.id,
        depth: node.depth,
        productLevel: node.productLevel || 0,
        title: node.title,
        parentIds
      });
      list = list.concat(collectAccordions(node.children, [...parentIds, node.id]));
    }
  }
  return list;
}

function computeReadingMetrics(
  nodes,
  currentDepth = 'base',
  acc = { base: 0, executive: 0, product: 0, technical: 0, 'deep-dive': 0, general: 0 }
) {
  for (const node of nodes) {
    if (node.type === 'markdown') {
      const words = node.content
        .replace(/[`#*>\-|[\]()$\\{}]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      acc[currentDepth] = (acc[currentDepth] || 0) + words;
    } else if (node.type === 'accordion') {
      computeReadingMetrics(node.children, node.depth, acc);
    }
  }
  return acc;
}

// ============================================================================
// STANDARD MARKDOWN + DISPLAY MATH BLOCK RENDERER (WITH SOURCE SPAN SYNC)
// ============================================================================
function MarkdownContent({
  content,
  katexReady,
  baseStartOffset = 0,
  baseEndOffset = 0,
  onSelectRange,
  onDoubleClickCaret
}) {
  const blocks = useMemo(() => {
    const lines = content.split('\n');
    const lineOffsets = buildLineOffsets(lines);
    const result = [];
    let i = 0;

    const spanForLines = (startLine, endLine) => {
      const s = Math.max(0, Math.min(startLine, lines.length - 1));
      const e = Math.max(s, Math.min(endLine, lines.length - 1));
      return {
        startOffset: baseStartOffset + (lineOffsets[s]?.start ?? 0),
        endOffset: baseStartOffset + (lineOffsets[e]?.end ?? content.length)
      };
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
      if (fenceMatch) {
        const startLine = i;
        const marker = fenceMatch[1][0];
        const lang = fenceMatch[2].trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(marker.repeat(3))) {
          codeLines.push(lines[i]);
          i++;
        }
        const endLine = i < lines.length ? i : lines.length - 1;
        if (i < lines.length) i++;
        result.push({
          type: 'code',
          lang,
          code: codeLines.join('\n'),
          ...spanForLines(startLine, endLine)
        });
        continue;
      }

      if (trimmed.startsWith('$$')) {
        const startLine = i;
        if (trimmed.length > 4 && trimmed.endsWith('$$')) {
          result.push({
            type: 'math',
            tex: trimmed.slice(2, -2).trim(),
            ...spanForLines(startLine, startLine)
          });
          i++;
          continue;
        }
        const mathLines = [];
        const firstLineRest = trimmed.slice(2).trim();
        if (firstLineRest) mathLines.push(firstLineRest);
        i++;
        while (i < lines.length) {
          const curTrim = lines[i].trim();
          if (curTrim.endsWith('$$')) {
            const beforeEnd = curTrim.slice(0, -2).trim();
            if (beforeEnd) mathLines.push(beforeEnd);
            i++;
            break;
          }
          mathLines.push(lines[i]);
          i++;
        }
        const endLine = Math.max(startLine, i - 1);
        result.push({
          type: 'math',
          tex: mathLines.join('\n').trim(),
          ...spanForLines(startLine, endLine)
        });
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        result.push({
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2],
          ...spanForLines(i, i)
        });
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        result.push({ type: 'hr', ...spanForLines(i, i) });
        i++;
        continue;
      }

      if (trimmed.startsWith('>')) {
        const startLine = i;
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        result.push({
          type: 'blockquote',
          text: quoteLines.join(' '),
          ...spanForLines(startLine, i - 1)
        });
        continue;
      }

      if (
        trimmed.includes('|') &&
        i + 1 < lines.length &&
        /^\s*\|?[\s:-]+\|[\s|:-]+\s*$/.test(lines[i + 1])
      ) {
        const startLine = i;
        const parseRow = (rowStr) =>
          rowStr
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim());

        const headers = parseRow(lines[i]);
        const alignRow = parseRow(lines[i + 1]);
        const alignments = alignRow.map((cell) => {
          if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
          if (cell.endsWith(':')) return 'right';
          return 'left';
        });

        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
          rows.push(parseRow(lines[i]));
          i++;
        }
        result.push({
          type: 'table',
          headers,
          alignments,
          rows,
          ...spanForLines(startLine, i - 1)
        });
        continue;
      }

      if (/^[-*+]\s+/.test(trimmed)) {
        const startLine = i;
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const itemRaw = lines[i].trim().replace(/^[-*+]\s+/, '');
          const taskMatch = itemRaw.match(/^\[( |x|X)\]\s+(.*)$/);
          if (taskMatch) {
            items.push({
              isTask: true,
              checked: taskMatch[1].toLowerCase() === 'x',
              text: taskMatch[2]
            });
          } else {
            items.push({ isTask: false, text: itemRaw });
          }
          i++;
        }
        result.push({ type: 'ul', items, ...spanForLines(startLine, i - 1) });
        continue;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        const startLine = i;
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
          i++;
        }
        result.push({ type: 'ol', items, ...spanForLines(startLine, i - 1) });
        continue;
      }

      const startLine = i;
      const paraLines = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^(#{1,4}\s+|```|~~~|\$\$|>|\s*[-*+]\s+|\s*\d+\.\s+|-{3,}$|\*{3,}$)/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i].trim());
        i++;
      }
      if (paraLines.length > 0) {
        result.push({
          type: 'paragraph',
          text: paraLines.join(' '),
          ...spanForLines(startLine, i - 1)
        });
      } else {
        i++;
      }
    }

    return result;
  }, [content, baseStartOffset, baseEndOffset]);

  const handleBlockClick = (e, block) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    e.stopPropagation();
    if (onSelectRange) {
      onSelectRange(block.startOffset, block.endOffset);
    }
  };

  const handleBlockDoubleClick = (e, block) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    e.stopPropagation();
    if (onDoubleClickCaret) {
      onDoubleClickCaret(e, block.startOffset, block.endOffset);
    }
  };

  return (
    <div className="space-y-3.5 text-slate-700 dark:text-slate-300 leading-relaxed">
      {blocks.map((block, idx) => {
        const interactiveProps = {
          'data-src-start': block.startOffset,
          'data-src-end': block.endOffset,
          onClick: (e) => handleBlockClick(e, block),
          onDoubleClick: (e) => handleBlockDoubleClick(e, block),
          title: 'Click to select in editor • Double-click to place cursor at exact spot'
        };

        switch (block.type) {
          case 'math':
            return (
              <div
                key={idx}
                {...interactiveProps}
                className="rounded-xl transition-all hover:ring-2 hover:ring-indigo-400/40 cursor-pointer"
              >
                <MathRenderer
                  tex={block.tex}
                  displayMode={true}
                  katexReady={katexReady}
                />
              </div>
            );

          case 'heading': {
            if (block.level === 1) {
              return (
                <h1
                  key={idx}
                  {...interactiveProps}
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white pt-1 pb-2.5 border-b border-slate-200 dark:border-slate-800 rounded-md hover:bg-indigo-500/[0.04] transition-colors cursor-pointer"
                >
                  {renderInlineMarkdown(block.text, katexReady)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={idx}
                  {...interactiveProps}
                  className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 pt-3 rounded-md hover:bg-indigo-500/[0.04] transition-colors cursor-pointer"
                >
                  {renderInlineMarkdown(block.text, katexReady)}
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3
                  key={idx}
                  {...interactiveProps}
                  className="text-base font-semibold text-slate-800 dark:text-slate-200 pt-2 rounded-md hover:bg-indigo-500/[0.04] transition-colors cursor-pointer"
                >
                  {renderInlineMarkdown(block.text, katexReady)}
                </h3>
              );
            }
            return (
              <h4
                key={idx}
                {...interactiveProps}
                className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 pt-1 rounded-md hover:bg-indigo-500/[0.04] transition-colors cursor-pointer"
              >
                {renderInlineMarkdown(block.text, katexReady)}
              </h4>
            );
          }

          case 'hr':
            return (
              <hr
                key={idx}
                {...interactiveProps}
                className="my-5 border-slate-200 dark:border-slate-800 cursor-pointer"
              />
            );

          case 'blockquote':
            return (
              <blockquote
                key={idx}
                {...interactiveProps}
                className="pl-4 py-2 pr-3 my-3 border-l-4 border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-r-lg text-sm text-slate-700 dark:text-slate-300 hover:ring-2 hover:ring-indigo-400/30 transition-all cursor-pointer"
              >
                {renderInlineMarkdown(block.text, katexReady)}
              </blockquote>
            );

          case 'code':
            return (
              <div
                key={idx}
                {...interactiveProps}
                className="rounded-lg hover:ring-2 hover:ring-indigo-400/40 transition-all cursor-pointer"
              >
                <CodeBlock language={block.lang} code={block.code} />
              </div>
            );

          case 'table':
            return (
              <div
                key={idx}
                {...interactiveProps}
                className="my-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs hover:ring-2 hover:ring-indigo-400/30 transition-all cursor-pointer"
              >
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          style={{ textAlign: block.alignments[hIdx] || 'left' }}
                          className="px-3.5 py-2.5 whitespace-nowrap"
                        >
                          {renderInlineMarkdown(h, katexReady)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950/40">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        {block.headers.map((_, cIdx) => (
                          <td
                            key={cIdx}
                            style={{ textAlign: block.alignments[cIdx] || 'left' }}
                            className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300"
                          >
                            {renderInlineMarkdown(row[cIdx] || '', katexReady)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'ul':
            return (
              <ul
                key={idx}
                {...interactiveProps}
                className="space-y-1.5 pl-5 list-disc marker:text-slate-400 rounded-md hover:bg-indigo-500/[0.03] transition-colors cursor-pointer"
              >
                {block.items.map((item, iIdx) =>
                  item.isTask ? (
                    <li key={iIdx} className="list-none -ml-5 flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        readOnly
                        className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-default"
                      />
                      <span
                        className={
                          item.checked
                            ? 'line-through text-slate-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }
                      >
                        {renderInlineMarkdown(item.text, katexReady)}
                      </span>
                    </li>
                  ) : (
                    <li key={iIdx} className="pl-1">
                      {renderInlineMarkdown(item.text, katexReady)}
                    </li>
                  )
                )}
              </ul>
            );

          case 'ol':
            return (
              <ol
                key={idx}
                {...interactiveProps}
                className="space-y-1.5 pl-5 list-decimal marker:text-slate-500 marker:font-medium rounded-md hover:bg-indigo-500/[0.03] transition-colors cursor-pointer"
              >
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="pl-1">
                    {renderInlineMarkdown(item, katexReady)}
                  </li>
                ))}
              </ol>
            );

          case 'paragraph':
          default:
            return (
              <p
                key={idx}
                {...interactiveProps}
                className="text-[15px] leading-[1.7] text-slate-700 dark:text-slate-300 rounded-md hover:bg-indigo-500/[0.03] transition-colors cursor-pointer"
              >
                {renderInlineMarkdown(block.text, katexReady)}
              </p>
            );
        }
      })}
    </div>
  );
}

// ============================================================================
// INTERACTIVE ACCORDION SECTION COMPONENT (RECURSIVE + EDITOR SYNC)
// ============================================================================
function AccordionNode({
  node,
  expandedIds,
  onToggle,
  katexReady,
  nestingLevel = 0,
  onSelectRange,
  onDoubleClickCaret
}) {
  const isOpen = !!expandedIds[node.id];
  const meta = DEPTH_CONFIG[node.depth] || DEPTH_CONFIG.general;
  const isSubProduct = node.depth === 'product' && (node.productLevel || 1) > 1;
  const badgeText = isSubProduct ? `Product L${node.productLevel}` : meta.shortLabel;

  const nestedCount = useMemo(() => {
    const countChildren = (children) =>
      children.reduce(
        (sum, child) =>
          child.type === 'accordion' ? sum + 1 + countChildren(child.children) : sum,
        0
      );
    return countChildren(node.children);
  }, [node.children]);

  const handleHeaderClick = (e) => {
    e.stopPropagation();
    onToggle(node.id);
    if (onSelectRange) {
      onSelectRange(node.startOffset, node.endOffset);
    }
  };

  const handleHeaderDoubleClick = (e) => {
    e.stopPropagation();
    if (onDoubleClickCaret) {
      onDoubleClickCaret(e, node.startOffset, node.endOffset);
    }
  };

  const handleContainerClick = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    e.stopPropagation();
    if (onSelectRange) {
      onSelectRange(node.startOffset, node.endOffset);
    }
  };

  const handleContainerDoubleClick = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    e.stopPropagation();
    if (onDoubleClickCaret) {
      onDoubleClickCaret(e, node.startOffset, node.endOffset);
    }
  };

  return (
    <div
      data-accordion-node="true"
      data-depth={node.depth}
      data-product-level={node.productLevel || 0}
      data-src-start={node.startOffset}
      data-src-end={node.endOffset}
      onClick={handleContainerClick}
      onDoubleClick={handleContainerDoubleClick}
      className={`my-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-2xs transition-all duration-200 overflow-hidden border-l-4 ${meta.borderAccent} ${
        isSubProduct ? 'ml-1 sm:ml-2 ring-1 ring-emerald-500/15' : ''
      }`}
    >
      <button
        type="button"
        onClick={handleHeaderClick}
        onDoubleClick={handleHeaderDoubleClick}
        aria-expanded={isOpen}
        title="Click to toggle & select full section in Markdown • Double-click to jump caret to exact spot"
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors cursor-pointer select-none ${meta.headerBg}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex-shrink-0 w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-transform duration-200">
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>

          <span
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${meta.badgeBg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
            {badgeText}
          </span>

          <span className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
            {node.title}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isOpen && nestedCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <Layers className="w-3 h-3" />
              +{nestedCount} deeper {nestedCount === 1 ? 'layer' : 'layers'}
            </span>
          )}
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
            {isOpen ? 'Collapse' : 'Expand'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/30">
          <DocumentNodeList
            nodes={node.children}
            expandedIds={expandedIds}
            onToggle={onToggle}
            katexReady={katexReady}
            nestingLevel={nestingLevel + 1}
            onSelectRange={onSelectRange}
            onDoubleClickCaret={onDoubleClickCaret}
          />
        </div>
      )}
    </div>
  );
}

function DocumentNodeList({
  nodes,
  expandedIds,
  onToggle,
  katexReady,
  nestingLevel = 0,
  onSelectRange,
  onDoubleClickCaret
}) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => {
        if (node.type === 'markdown') {
          return (
            <MarkdownContent
              key={node.id}
              content={node.content}
              katexReady={katexReady}
              baseStartOffset={node.startOffset}
              baseEndOffset={node.endOffset}
              onSelectRange={onSelectRange}
              onDoubleClickCaret={onDoubleClickCaret}
            />
          );
        }
        if (node.type === 'accordion') {
          return (
            <AccordionNode
              key={node.id}
              node={node}
              expandedIds={expandedIds}
              onToggle={onToggle}
              katexReady={katexReady}
              nestingLevel={nestingLevel}
              onSelectRange={onSelectRange}
              onDoubleClickCaret={onDoubleClickCaret}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

// ============================================================================
// SELF-CONTAINED FULL-PROJECT HTML EXPORTER
// ============================================================================
function generateStandaloneHtml(markdownText, initialDark = false) {
  const escapedMarkdown = markdownText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="en"${initialDark ? ' class="dark"' : ''}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DepthDoc — Multi-Level Markdown Proposal Studio</title>
  <link rel="stylesheet" href="${KATEX_CSS_URL}" crossorigin="anonymous" />
  <script defer src="${KATEX_JS_URL}" crossorigin="anonymous" onload="renderApp()"></script>
  <style>
    :root {
      --bg-app: #f8fafc;
      --bg-surface: #ffffff;
      --bg-topbar: rgba(255, 255, 255, 0.96);
      --bg-subtle: #f1f5f9;
      --bg-editor-bar: #f8fafc;
      --bg-acc-body: rgba(248, 250, 252, 0.55);
      --bg-canvas: rgba(241, 245, 249, 0.72);
      --border-color: #e2e8f0;
      --border-subtle: #f1f5f9;
      --border-strong: #cbd5e1;
      --text-main: #0f172a;
      --text-body: #334155;
      --text-editor: #1e293b;
      --text-muted: #64748b;
      --text-faint: #94a3b8;
      --indigo: #4f46e5;
      --indigo-soft: #eef2ff;
      --indigo-border: #c7d2fe;
      --amber: #f59e0b;
      --amber-text: #b45309;
      --amber-soft: rgba(245, 158, 11, 0.1);
      --amber-border: rgba(245, 158, 11, 0.3);
      --emerald: #10b981;
      --emerald-text: #047857;
      --emerald-soft: rgba(16, 185, 129, 0.1);
      --emerald-border: rgba(16, 185, 129, 0.3);
      --blue: #3b82f6;
      --blue-text: #1d4ed8;
      --blue-soft: rgba(59, 130, 246, 0.1);
      --blue-border: rgba(59, 130, 246, 0.3);
      --purple: #a855f7;
      --purple-text: #7e22ce;
      --purple-soft: rgba(168, 85, 247, 0.1);
      --purple-border: rgba(168, 85, 247, 0.3);
      --slate-soft: rgba(100, 116, 139, 0.1);
      --slate-border: rgba(100, 116, 139, 0.3);
      --shadow-xs: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
      --shadow-sm: 0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.04);
      --shadow-book: 0 18px 40px -15px rgba(15, 23, 42, 0.13), 0 4px 12px -4px rgba(15, 23, 42, 0.05);
    }

    html.dark {
      --bg-app: #020617;
      --bg-surface: #0f172a;
      --bg-topbar: rgba(15, 23, 42, 0.95);
      --bg-subtle: #1e293b;
      --bg-editor-bar: #0f172a;
      --bg-acc-body: rgba(2, 6, 23, 0.35);
      --bg-canvas: #020617;
      --border-color: #1e293b;
      --border-subtle: #1e293b;
      --border-strong: #334155;
      --text-main: #f8fafc;
      --text-body: #cbd5e1;
      --text-editor: #e2e8f0;
      --text-muted: #94a3b8;
      --text-faint: #64748b;
      --indigo: #818cf8;
      --indigo-soft: rgba(49, 46, 129, 0.45);
      --indigo-border: #3730a3;
      --amber-text: #fcd34d;
      --emerald-text: #6ee7b7;
      --blue-text: #93c5fd;
      --purple-text: #d8b4fe;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg-app);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 30;
      background: var(--bg-topbar);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-color);
      box-shadow: var(--shadow-xs);
    }
    .topbar-inner {
      max-width: 1600px;
      margin: 0 auto;
      padding: 10px 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-xs);
    }
    .brand-title { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
    .brand-pill {
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      background: var(--indigo-soft);
      color: var(--indigo);
      border: 1px solid var(--indigo-border);
    }
    .segmented {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      background: var(--bg-subtle);
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
    }
    .seg-btn {
      border: none;
      background: transparent;
      color: var(--text-body);
      font-size: 12px;
      font-weight: 600;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .seg-btn:hover { color: var(--text-main); background: rgba(148, 163, 184, 0.14); }
    .seg-btn.active { background: var(--bg-surface); color: var(--text-main); box-shadow: var(--shadow-xs); }
    .seg-btn.active.exec { color: var(--amber-text); box-shadow: 0 0 0 1px var(--amber-border), var(--shadow-xs); }
    .seg-btn.active.prod { color: var(--emerald-text); box-shadow: 0 0 0 1px var(--emerald-border), var(--shadow-xs); }
    .seg-btn.active.eng { color: var(--blue-text); box-shadow: 0 0 0 1px var(--blue-border), var(--shadow-xs); }
    .seg-btn.active.spread { color: var(--indigo); }
    .divider-v { width: 1px; height: 16px; background: var(--border-strong); margin: 0 2px; }

    .workspace {
      flex: 1;
      display: flex;
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;
    }
    .docs-sidebar {
      width: 240px;
      flex-shrink: 0;
      border-right: 1px solid var(--border-color);
      background: var(--bg-editor-bar);
      display: flex;
      flex-direction: column;
    }
    .docs-sidebar-head {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .docs-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .doc-item {
      width: 100%;
      text-align: left;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-body);
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 12px;
      transition: all 0.14s ease;
    }
    .doc-item:hover { background: var(--bg-subtle); color: var(--text-main); }
    .doc-item.active {
      background: var(--bg-surface);
      color: var(--indigo);
      border-color: var(--indigo-border);
      font-weight: 600;
      box-shadow: var(--shadow-xs);
    }
    .doc-item-meta { font-size: 10px; color: var(--text-faint); font-weight: 400; margin-top: 2px; }
    .writer-pane {
      flex: 1;
      min-width: 340px;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border-color);
      background: var(--bg-surface);
    }
    .writer-toolbar {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-editor-bar);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .insert-group { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
    .ins-btn {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .ins-exec { background: var(--amber-soft); color: var(--amber-text); border: 1px solid var(--amber-border); }
    .ins-prod { background: var(--emerald-soft); color: var(--emerald-text); border: 1px solid var(--emerald-border); }
    .ins-tech { background: var(--blue-soft); color: var(--blue-text); border: 1px solid var(--blue-border); }
    .ins-deep { background: var(--purple-soft); color: var(--purple-text); border: 1px solid var(--purple-border); }
    .icon-tool-btn {
      border: none;
      background: transparent;
      color: var(--text-muted);
      padding: 5px 7px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    .icon-tool-btn:hover { background: var(--bg-subtle); color: var(--text-main); }
    .editor-textarea {
      flex: 1;
      width: 100%;
      min-height: calc(100vh - 140px);
      padding: 18px 20px;
      border: none;
      resize: none;
      outline: none;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      line-height: 1.65;
      color: var(--text-editor);
      background: var(--bg-surface);
    }
    .writer-footer {
      padding: 8px 16px;
      border-top: 1px solid var(--border-color);
      background: var(--bg-editor-bar);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
    }
    .preview-pane {
      flex: 1.2;
      overflow-y: auto;
      background: var(--bg-canvas);
      height: calc(100vh - 55px);
    }
    .preview-pane.full-height { height: auto; min-height: calc(100vh - 55px); }
    .single-container { max-width: 820px; margin: 0 auto; padding: 28px 24px 48px; }
    .single-container.wide { max-width: 920px; }
    .status-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 14px;
    }
    .paper-card {
      background: var(--bg-surface);
      border-radius: 16px;
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-sm);
      padding: 32px 38px;
    }
    .spread-container { max-width: 1520px; margin: 0 auto; padding: 24px 28px 48px; }
    .spread-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
    .folio-page {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      box-shadow: var(--shadow-book);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 760px;
    }
    .folio-body { padding: 32px 36px; }
    .folio-footer {
      padding: 12px 28px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: var(--text-faint);
    }
    .acc-card {
      margin: 16px 0;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      border-left-width: 4px;
      background: var(--bg-surface);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
    }
    .acc-card.executive { border-left-color: var(--amber); }
    .acc-card.product { border-left-color: var(--emerald); }
    .acc-card.technical { border-left-color: var(--blue); }
    .acc-card.deep-dive { border-left-color: var(--purple); }
    .acc-card.general { border-left-color: var(--text-faint); }
    .acc-header {
      width: 100%;
      border: none;
      background: transparent;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      text-align: left;
      cursor: pointer;
    }
    .acc-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .acc-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      border: 1px solid transparent;
    }
    .acc-badge.executive { background: var(--amber-soft); color: var(--amber-text); border-color: var(--amber-border); }
    .acc-badge.product { background: var(--emerald-soft); color: var(--emerald-text); border-color: var(--emerald-border); }
    .acc-badge.technical { background: var(--blue-soft); color: var(--blue-text); border-color: var(--blue-border); }
    .acc-badge.deep-dive { background: var(--purple-soft); color: var(--purple-text); border-color: var(--purple-border); }
    .acc-badge.general { background: var(--slate-soft); color: var(--text-body); border-color: var(--slate-border); }
    .acc-title { font-weight: 600; font-size: 15px; color: var(--text-main); }
    .acc-body { padding: 10px 20px 18px; border-top: 1px solid var(--border-subtle); background: var(--bg-acc-body); }
    .acc-card.collapsed > .acc-body { display: none; }
    .md-block { border-radius: 6px; cursor: pointer; }
    .md-block:hover { background: rgba(79, 70, 229, 0.045); }
    h1.doc-h1 { font-size: 26px; font-weight: 800; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); }
    h2.doc-h2 { font-size: 19px; font-weight: 700; margin: 18px 0 8px; }
    h3.doc-h3 { font-size: 16px; font-weight: 700; margin: 14px 0 6px; }
    p.doc-p { font-size: 15px; line-height: 1.7; color: var(--text-body); margin: 10px 0; }
    ul.doc-ul, ol.doc-ol { margin: 10px 0; padding-left: 22px; color: var(--text-body); font-size: 15px; line-height: 1.65; }
    hr.doc-hr { border: 0; border-top: 1px solid var(--border-color); margin: 22px 0; }
    code.inline-code { padding: 2px 6px; font-size: 0.85em; font-family: monospace; border-radius: 5px; background: var(--bg-subtle); color: #ec4899; }
    .math-display-box { margin: 14px 0; padding: 14px 18px; border-radius: 12px; background: var(--bg-editor-bar); border: 1px solid var(--border-color); overflow-x: auto; text-align: center; }
    .code-card { margin: 14px 0; border-radius: 10px; overflow: hidden; border: 1px solid #1e293b; background: #0d1117; }
    .code-card-head { display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; background: #0f172a; color: #94a3b8; font-size: 11px; font-family: monospace; }
    .code-card pre { margin: 0; padding: 14px; overflow-x: auto; font-family: monospace; font-size: 13px; color: #e2e8f0; }
    .theme-btn { border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-body); width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .hidden { display: none !important; }
    @media (max-width: 1024px) {
      .workspace { flex-direction: column; }
      .docs-sidebar, .writer-pane { width: 100%; border-right: none; border-bottom: 1px solid var(--border-color); }
      .spread-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        </div>
        <span class="brand-title">DepthDoc</span>
        <span class="brand-pill">Multi-Altitude + LaTeX Math</span>
      </div>

      <div class="segmented">
        <button type="button" class="seg-btn" data-preset="executive" onclick="setPreset('executive')">Executive</button>
        <button type="button" class="seg-btn" data-preset="product" onclick="setPreset('product')">Product / PM</button>
        <button type="button" class="seg-btn active eng" data-preset="engineer" onclick="setPreset('engineer')">Engineer</button>
        <span class="divider-v"></span>
        <button type="button" class="seg-btn" onclick="expandAll(true)">Expand All</button>
        <button type="button" class="seg-btn" onclick="expandAll(false)">Collapse All</button>
      </div>

      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="seg-btn" style="background:var(--indigo);color:#fff" onclick="saveCurrentDoc()">Save</button>
        <div class="segmented">
          <button type="button" id="view-writer" class="seg-btn active" onclick="setView('writer')">Writer</button>
          <button type="button" id="view-reader" class="seg-btn" onclick="setView('reader')">Single Page</button>
          <button type="button" id="view-spread" class="seg-btn" onclick="setView('spread')">2-Page Preview</button>
        </div>
        <button type="button" id="theme-toggle" class="theme-btn" onclick="toggleTheme()" title="Toggle Light / Dark Mode">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </button>
      </div>
    </div>
  </header>

  <main class="workspace">
    <aside id="docs-sidebar" class="docs-sidebar">
      <div class="docs-sidebar-head">
        <span>Saved Files</span>
        <button type="button" class="icon-tool-btn" onclick="createNewDoc()" title="New Markdown Document">+ New</button>
      </div>
      <div id="docs-list" class="docs-list"></div>
    </aside>

    <section id="writer-pane" class="writer-pane">
      <div class="writer-toolbar">
        <div class="insert-group">
          <button type="button" class="ins-btn ins-exec" onclick="insertSection('exec')">+ Exec</button>
          <button type="button" class="ins-btn ins-prod" onclick="insertSection('product')">+ Product</button>
          <button type="button" class="ins-btn ins-tech" onclick="insertSection('tech')">+ Tech</button>
          <button type="button" class="ins-btn ins-deep" onclick="insertSection('deep')">+ Deep Dive</button>
        </div>
        <div class="insert-group">
          <button type="button" class="icon-tool-btn" onclick="insertSection('math')">Σ Formula</button>
          <button type="button" class="icon-tool-btn" onclick="insertSection('code')">&lt;/&gt; Code</button>
        </div>
      </div>
      <textarea id="md-editor" class="editor-textarea" spellcheck="false">${escapedMarkdown}</textarea>
      <div class="writer-footer">
        <span>Click any preview section to select its Markdown</span>
        <span id="layer-counter">0/0 layers open</span>
      </div>
    </section>

    <section id="preview-pane" class="preview-pane">
      <div id="single-stage" class="single-container">
        <div class="status-strip">
          <span id="single-status">Viewing all detail layers</span>
          <button type="button" id="back-to-writer-btn" class="icon-tool-btn hidden" style="color:var(--indigo)" onclick="setView('writer')">Back to Writer →</button>
        </div>
        <article id="preview-root" class="paper-card"></article>
      </div>
      <div class="spread-container hidden" id="spread-stage">
        <div class="status-strip">
          <span id="spread-status" style="font-weight:600;color:var(--indigo)">2-Page Side-by-Side Spread Preview</span>
          <div style="display:flex;gap:8px;align-items:center">
            <button type="button" id="prev-spread" class="seg-btn" style="background:var(--bg-surface);border:1px solid var(--border-color)" onclick="moveSpread(-1)">← Prev</button>
            <button type="button" id="next-spread" class="seg-btn" style="background:var(--bg-surface);border:1px solid var(--border-color)" onclick="moveSpread(1)">Next →</button>
            <button type="button" class="icon-tool-btn" style="color:var(--indigo)" onclick="setView('writer')">Back to Writer →</button>
          </div>
        </div>
        <div class="spread-grid">
          <article class="folio-page">
            <div id="spread-left" class="folio-body"></div>
            <footer class="folio-footer"><span>DepthDoc Specification</span><span id="left-page-label">Page 1</span></footer>
          </article>
          <article class="folio-page">
            <div id="spread-right" class="folio-body"></div>
            <footer class="folio-footer"><span>Multi-Level Interactive View</span><span id="right-page-label">Page 2</span></footer>
          </article>
        </div>
      </div>
    </section>
  </main>

  <script>
    function toggleTheme() { document.documentElement.classList.toggle('dark'); }
    const editor = document.getElementById('md-editor');
    let expandedMap = {};
    let currentView = 'writer';
    let spreadIdx = 0;
    let spreadPages = [];
    let savedDocs = [
      { id: 'doc-1', title: 'Dynamic Resource & Task Allocator (v2.0)', content: editor.value, updatedAt: 'Saved' }
    ];
    let activeDocId = 'doc-1';

    function escHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderKatex(tex, displayMode) {
      if (window.katex) {
        try {
          const rendered = window.katex.renderToString(tex.trim(), { displayMode, throwOnError: false, strict: false });
          return displayMode ? '<div class="math-display-box">' + rendered + '</div>' : rendered;
        } catch (e) {}
      }
      return displayMode ? '<div class="math-display-box"><code>$$' + escHtml(tex) + '$$</code></div>' : '<code class="inline-code">$' + escHtml(tex) + '$</code>';
    }

    function extractDocTitle(md) {
      const m = md.match(/^#\\s+(.+)$/m);
      return m ? m[1].replace(/^Project Specification:\\s*/i, '').trim() : 'Untitled Proposal';
    }

    function renderSidebar() {
      const list = document.getElementById('docs-list');
      if (!list) return;
      list.innerHTML = savedDocs.map(d =>
        '<button type="button" class="doc-item' + (d.id === activeDocId ? ' active' : '') + '" onclick="openDoc(\\'' + d.id + '\\')">' +
        '<div style="min-width:0;overflow:hidden"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(d.title) + '</div>' +
        '<div class="doc-item-meta">' + escHtml(d.updatedAt) + '</div></div></button>'
      ).join('');
    }

    function saveCurrentDoc() {
      const idx = savedDocs.findIndex(d => d.id === activeDocId);
      const title = extractDocTitle(editor.value);
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (idx !== -1) {
        savedDocs[idx] = { ...savedDocs[idx], title, content: editor.value, updatedAt: 'Saved ' + stamp };
      } else {
        const id = 'doc-' + Date.now();
        savedDocs.unshift({ id, title, content: editor.value, updatedAt: 'Saved ' + stamp });
        activeDocId = id;
      }
      renderSidebar();
    }

    function openDoc(id) {
      const found = savedDocs.find(d => d.id === id);
      if (!found) return;
      activeDocId = found.id;
      editor.value = found.content;
      renderSidebar();
      renderApp();
    }

    function createNewDoc() {
      const id = 'doc-' + Date.now();
      const template = '# New Proposal Draft\\n\\n:::executive[1. Executive Summary]\\nKey strategic goals and expected ROI.\\n:::\\n';
      savedDocs.unshift({ id, title: 'New Proposal Draft', content: template, updatedAt: 'Draft' });
      activeDocId = id;
      editor.value = template;
      renderSidebar();
      renderApp();
    }

    function buildOffsets(lines) {
      const out = [];
      let p = 0;
      for (let i = 0; i < lines.length; i++) {
        out.push({ start: p, end: p + lines[i].length });
        p += lines[i].length + 1;
      }
      return out;
    }

    function parseTree(md) {
      const lines = md.replace(/\\r\\n/g, '\\n').split('\\n');
      const offsets = buildOffsets(lines);
      let counter = 0;

      function span(s, e) {
        if (!lines.length) return { start: 0, end: 0 };
        const a = Math.max(0, Math.min(s, lines.length - 1));
        const b = Math.max(a, Math.min(e, lines.length - 1));
        return { start: offsets[a].start, end: offsets[b].end };
      }

      function walk(idx, stop, ctx) {
        const nodes = [];
        let mdLines = [];
        let mdS = null, mdE = null;
        let i = idx;
        let inFence = false;

        function flush() {
          if (mdLines.length && mdS !== null) {
            const text = mdLines.join('\\n');
            if (text.trim()) {
              const sp = span(mdS, mdE);
              nodes.push({ type: 'md', id: 'm-' + (counter++), text, start: sp.start, end: sp.end });
            }
          }
          mdLines = []; mdS = null; mdE = null;
        }

        while (i < lines.length) {
          const line = lines[i];
          const tr = line.trim();
          if (/^(\`{3,}|~{3,})/.test(tr)) {
            inFence = !inFence;
            if (mdS === null) mdS = i;
            mdE = i;
            mdLines.push(line);
            i++;
            continue;
          }
          if (!inFence) {
            if (stop === 'colon' && tr === ':::') {
              flush();
              return { nodes, next: i + 1, endLine: i, unwind: false };
            }
            const m = tr.match(/^:::(executive|product|technical|deep-dive|accordion)(?:\\[(.*?)\\])?\\s*$/i);
            if (m) {
              const raw = m[1].toLowerCase();
              const depth = raw === 'accordion' ? 'general' : raw;
              if (depth === 'executive' && ctx.inExec && stop !== null) {
                flush();
                return { nodes, next: i, endLine: i - 1, unwind: true };
              }
              flush();
              const openLine = i;
              const pLevel = depth === 'product' ? ctx.pLevel + 1 : ctx.pLevel;
              const title = (m[2] && m[2].trim()) || depth.toUpperCase();
              const id = 'a-' + (counter++);
              const res = walk(i + 1, 'colon', { inExec: ctx.inExec || depth === 'executive', pLevel });
              const sp = span(openLine, res.endLine);
              nodes.push({ type: 'acc', id, depth, pLevel: depth === 'product' ? pLevel : 0, title, start: sp.start, end: sp.end, children: res.nodes });
              i = res.next;
              if (res.unwind && stop !== null) return { nodes, next: i, endLine: res.endLine, unwind: true };
              continue;
            }
          }
          if (mdS === null) mdS = i;
          mdE = i;
          mdLines.push(line);
          i++;
        }
        flush();
        return { nodes, next: i, endLine: lines.length - 1, unwind: false };
      }
      return walk(0, null, { inExec: false, pLevel: 0 }).nodes;
    }

    function renderInline(text) {
      const tokenRe = /(\`[^\`\\n]+\`|\\$\\$[\\s\\S]+?\\$\\$|\\$(?!\\s)(?:\\\\.|[^$\\\\\\n])+?(?<!\\s)\\$(?!\\d)|\\*\\*[^*\\n]+?\\*\\*|\\*[^*\\n]+?\\*)/g;
      return text.split(tokenRe).map(part => {
        if (!part) return '';
        if (part.startsWith('\`') && part.endsWith('\`') && part.length > 2) {
          return '<code class="inline-code">' + escHtml(part.slice(1, -1)) + '</code>';
        }
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          return renderKatex(part.slice(2, -2), false);
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const inner = part.slice(1, -1);
          if (/^\\d[\\d,.\\s]*(?:k|m|b)?$/i.test(inner.trim())) return escHtml(part);
          return renderKatex(inner, false);
        }
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return '<strong>' + renderInline(part.slice(2, -2)) + '</strong>';
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return '<em>' + renderInline(part.slice(1, -1)) + '</em>';
        }
        return escHtml(part);
      }).join('');
    }

    function renderMdChunk(text, baseStart, baseEnd) {
      const lines = text.split('\\n');
      let html = '';
      let i = 0;
      while (i < lines.length) {
        const tr = lines[i].trim();
        if (!tr) { i++; continue; }
        if (tr.startsWith('\`\`\`')) {
          const lang = tr.slice(3).trim() || 'code';
          const codeLines = [];
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('\`\`\`')) { codeLines.push(lines[i]); i++; }
          if (i < lines.length) i++;
          html += '<div class="code-card md-block" data-start="' + baseStart + '" data-end="' + baseEnd + '"><div class="code-card-head"><span>' + escHtml(lang) + '</span></div><pre><code>' + escHtml(codeLines.join('\\n')) + '</code></pre></div>';
          continue;
        }
        if (tr.startsWith('$$') && tr.endsWith('$$') && tr.length > 4) {
          html += '<div class="md-block" data-start="' + baseStart + '" data-end="' + baseEnd + '">' + renderKatex(tr.slice(2, -2), true) + '</div>';
          i++; continue;
        }
        const hm = tr.match(/^(#{1,3})\\s+(.+)$/);
        if (hm) {
          const lvl = hm[1].length;
          html += '<h' + lvl + ' class="doc-h' + lvl + ' md-block" data-start="' + baseStart + '" data-end="' + baseEnd + '">' + renderInline(hm[2]) + '</h' + lvl + '>';
          i++; continue;
        }
        if (/^-{3,}$/.test(tr)) {
          html += '<hr class="doc-hr" />';
          i++; continue;
        }
        if (/^[-*+]\\s+/.test(tr)) {
          const items = [];
          while (i < lines.length && /^\\s*[-*+]\\s+/.test(lines[i])) {
            items.push('<li>' + renderInline(lines[i].trim().replace(/^[-*+]\\s+/, '')) + '</li>');
            i++;
          }
          html += '<ul class="doc-ul md-block" data-start="' + baseStart + '" data-end="' + baseEnd + '">' + items.join('') + '</ul>';
          continue;
        }
        html += '<p class="doc-p md-block" data-start="' + baseStart + '" data-end="' + baseEnd + '">' + renderInline(tr) + '</p>';
        i++;
      }
      return html;
    }

    function renderNodes(nodes) {
      return nodes.map(n => {
        if (n.type === 'md') return renderMdChunk(n.text, n.start, n.end);
        const isOpen = expandedMap[n.id] !== false;
        const badge = n.depth === 'product' && n.pLevel > 1 ? 'Product L' + n.pLevel : n.depth;
        return '<div class="acc-card ' + n.depth + (isOpen ? '' : ' collapsed') + '">' +
          '<button type="button" class="acc-header" onclick="toggleAcc(event,\\'' + n.id + '\\',' + n.start + ',' + n.end + ')">' +
          '<div class="acc-left"><span class="acc-badge ' + n.depth + '">' + escHtml(badge) + '</span>' +
          '<span class="acc-title">' + escHtml(n.title) + '</span></div>' +
          '<span style="font-size:12px;color:var(--text-faint)">' + (isOpen ? 'Collapse' : 'Expand') + '</span></button>' +
          '<div class="acc-body">' + renderNodes(n.children) + '</div></div>';
      }).join('');
    }

    function selectEditorSpan(start, end) {
      if (currentView !== 'writer') return;
      editor.focus();
      editor.setSelectionRange(start, end);
    }

    function toggleAcc(e, id, start, end) {
      e.stopPropagation();
      expandedMap[id] = !(expandedMap[id] !== false);
      renderApp();
      selectEditorSpan(start, end);
    }

    function collectAccs(nodes, parents = []) {
      let out = [];
      nodes.forEach(n => {
        if (n.type === 'acc') {
          out.push({ id: n.id, depth: n.depth, parents });
          out = out.concat(collectAccs(n.children, [...parents, n.id]));
        }
      });
      return out;
    }

    function setPreset(mode) {
      document.querySelectorAll('[data-preset]').forEach(b => {
        b.classList.remove('active', 'exec', 'prod', 'eng');
        if (b.dataset.preset === mode) {
          b.classList.add('active', mode === 'executive' ? 'exec' : mode === 'product' ? 'prod' : 'eng');
        }
      });
      const accs = collectAccs(parseTree(editor.value));
      expandedMap = {};
      accs.forEach(a => {
        if (mode === 'engineer') expandedMap[a.id] = true;
        else if (mode === 'product') {
          if (a.depth === 'executive' || a.depth === 'product' || a.depth === 'general') {
            expandedMap[a.id] = true;
            a.parents.forEach(p => expandedMap[p] = true);
          } else expandedMap[a.id] = false;
        } else {
          expandedMap[a.id] = a.depth === 'executive';
        }
      });
      renderApp();
    }

    function expandAll(open) {
      collectAccs(parseTree(editor.value)).forEach(a => expandedMap[a.id] = open);
      renderApp();
    }

    function setView(mode) {
      currentView = mode;
      ['writer', 'reader', 'spread'].forEach(v => {
        document.getElementById('view-' + v).classList.toggle('active', v === mode);
      });
      document.getElementById('view-spread').classList.toggle('spread', mode === 'spread');
      document.getElementById('writer-pane').classList.toggle('hidden', mode !== 'writer');
      document.getElementById('preview-pane').classList.toggle('full-height', mode !== 'writer');
      document.getElementById('single-stage').classList.toggle('hidden', mode === 'spread');
      document.getElementById('spread-stage').classList.toggle('hidden', mode !== 'spread');
      document.getElementById('single-stage').classList.toggle('wide', mode === 'reader');
      document.getElementById('back-to-writer-btn').classList.toggle('hidden', mode !== 'reader');
      spreadIdx = 0;
      renderApp();
    }

    function moveSpread(delta) {
      const maxS = Math.max(0, Math.ceil(spreadPages.length / 2) - 1);
      spreadIdx = Math.min(maxS, Math.max(0, spreadIdx + delta));
      renderSpread();
    }

    function renderSpread() {
      const l = spreadIdx * 2, r = l + 1;
      document.getElementById('spread-left').innerHTML = renderNodes(spreadPages[l] || []);
      document.getElementById('spread-right').innerHTML = spreadPages[r] ? renderNodes(spreadPages[r]) : '<p style="color:#94a3b8;text-align:center;padding:80px 0;font-style:italic">End of Proposal Document</p>';
      const total = Math.max(2, spreadPages.length);
      document.getElementById('left-page-label').textContent = 'Page ' + (l + 1) + ' of ' + total;
      document.getElementById('right-page-label').textContent = 'Page ' + (r + 1) + ' of ' + total;
      document.getElementById('spread-status').textContent = '2-Page Side-by-Side Spread Preview • Pages ' + (l + 1) + ' – ' + Math.min(r + 1, total) + ' of ' + total;
      document.getElementById('prev-spread').disabled = spreadIdx <= 0;
      document.getElementById('next-spread').disabled = spreadIdx >= Math.max(0, Math.ceil(spreadPages.length / 2) - 1);
    }

    function insertSection(kind) {
      const map = {
        exec: '\\n\\n:::executive[Executive Pillar: Strategic Value]\\nSummarize business impact, ROI, and timeline.\\n:::\\n',
        product: '\\n\\n:::product[Product Workflow]\\nDescribe user flows and rollout.\\n:::\\n',
        tech: '\\n\\n:::technical[Technical Architecture]\\nDetail services, APIs, and data flow.\\n:::\\n',
        deep: '\\n\\n:::deep-dive[Deep Dive: Mathematical Formulation]\\n$$\\\\min_x \\\\sum_{i=1}^n c_i x_i$$\\n:::\\n',
        math: '\\n\\n$$C = w_1(\\\\text{Time}) + w_2(\\\\text{Overrun})$$\\n',
        code: '\\n\\n\`\`\`python\\ndef solve():\\n    return True\\n\`\`\`\\n'
      };
      const snip = map[kind] || '';
      const pos = editor.selectionStart;
      editor.value = editor.value.slice(0, pos) + snip + editor.value.slice(editor.selectionEnd);
      editor.focus();
      renderApp();
    }

    function renderApp() {
      const ast = parseTree(editor.value);
      const accs = collectAccs(ast);
      const openCnt = accs.filter(a => expandedMap[a.id] !== false).length;
      document.getElementById('layer-counter').textContent = openCnt + '/' + accs.length + ' layers open';
      document.getElementById('single-status').textContent = 'Viewing ' + openCnt + ' of ' + accs.length + ' detail layers expanded';

      if (currentView === 'spread') {
        const pages = [];
        let cur = [], w = 0;
        ast.forEach(n => {
          const nw = Math.max(140, n.end - n.start);
          if (cur.length && w + nw > 1450) { pages.push(cur); cur = []; w = 0; }
          cur.push(n); w += nw;
        });
        if (cur.length) pages.push(cur);
        if (pages.length === 1 && pages[0].length > 1) {
          const mid = Math.ceil(pages[0].length / 2);
          spreadPages = [pages[0].slice(0, mid), pages[0].slice(mid)];
        } else {
          spreadPages = pages;
        }
        renderSpread();
      } else {
        const root = document.getElementById('preview-root');
        root.innerHTML = renderNodes(ast);
        root.querySelectorAll('.md-block').forEach(el => {
          el.onclick = (e) => {
            e.stopPropagation();
            selectEditorSpan(Number(el.dataset.start), Number(el.dataset.end));
          };
        });
      }
    }

    editor.addEventListener('input', renderApp);
    renderSidebar();
    renderApp();
  </script>
</body>
</html>`;
}

// ============================================================================
// HELPER TO DERIVE CLEAN DOCUMENT TITLE FROM MARKDOWN
// ============================================================================
function deriveDocumentTitle(mdText) {
  const headingMatch = mdText.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1].trim()) {
    return headingMatch[1].replace(/^Project Specification:\s*/i, '').trim();
  }
  const firstLine = mdText
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 42) : 'Untitled Proposal';
}

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  const katexReady = useKatexLoader();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const defaultDocs = useMemo(
    () => [
      {
        id: 'doc-initial-1',
        fileName: 'dynamic-resource-task-allocator-v2.md',
        title: 'Dynamic Resource & Task Allocator (v2.0)',
        content: SAMPLE_PROPOSAL,
        updatedAt: 'Default Spec'
      },
      {
        id: 'doc-initial-2',
        fileName: 'multi-altitude-latex-guide.md',
        title: 'Multi-Altitude & LaTeX Authoring Guide',
        content: SYNTAX_GUIDE_MD,
        updatedAt: 'Template'
      }
    ],
    []
  );
  const [savedDocs, setSavedDocs] = useState(defaultDocs);
  const [activeDocId, setActiveDocId] = useState('doc-initial-1');
  const [dataDirHandle, setDataDirHandle] = useState(null);
  const [hasViteDiskApi, setHasViteDiskApi] = useState(false);
  const [folderStatus, setFolderStatus] = useState('Browser Disk Cache'); // 'Disk: data/' | 'Linked: data/' | 'Browser Disk Cache'
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [markdown, setMarkdown] = useState(SAMPLE_PROPOSAL);
  const [viewMode, setViewMode] = useState('writer'); // 'writer' | 'reader' | 'spread' | 'guide'
  const [activePreset, setActivePreset] = useState('engineer');
  const [expandedIds, setExpandedIds] = useState({});
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [copiedMd, setCopiedMd] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const textareaRef = useRef(null);
  const previewContainerRef = useRef(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  // Restore saved files from Vite data/ API (first), linked directory handle, or IndexedDB on startup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Try local Vite dev server `/api/files` backed by `.gitignore`d `data/` directory
      try {
        const res = await fetch('/api/files');
        if (res.ok) {
          const payload = await res.json();
          if (!cancelled && Array.isArray(payload.files)) {
            setHasViteDiskApi(true);
            setFolderStatus('Disk: data/');
            let diskFiles = payload.files.map((f) => ({
              id: `disk-${f.fileName}`,
              fileName: f.fileName,
              title: deriveDocumentTitle(f.content) || f.fileName.replace(/\.md$/i, ''),
              content: f.content,
              updatedAt: new Date(f.mtimeMs || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })
            }));

            // Seed default proposal into data/ if only the standalone guide file exists on first boot
            if (!diskFiles.some((d) => d.fileName !== GUIDE_FILE_NAME)) {
              const seedFile = 'dynamic-resource-task-allocator-v2.md';
              await fetch('/api/files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: seedFile, content: SAMPLE_PROPOSAL })
              });
              diskFiles = [
                {
                  id: `disk-${seedFile}`,
                  fileName: seedFile,
                  title: deriveDocumentTitle(SAMPLE_PROPOSAL),
                  content: SAMPLE_PROPOSAL,
                  updatedAt: 'Saved'
                },
                ...diskFiles
              ];
            }

            const storedActiveId = await idbGet('activeDocId');
            const chosen =
              diskFiles.find((d) => d.id === storedActiveId) ||
              diskFiles.find((d) => d.fileName !== GUIDE_FILE_NAME) ||
              diskFiles[0];

            setSavedDocs(diskFiles);
            if (chosen) {
              setActiveDocId(chosen.id);
              setMarkdown(chosen.content);
            }
            setHydrated(true);
            return;
          }
        }
      } catch {
        // Not running behind Vite dev server middleware; fall back to File System Access API / IndexedDB
      }

      const storedDocs = await idbGet('savedDocs');
      const storedActiveId = await idbGet('activeDocId');
      const storedHandle = await idbGet('dataDirHandle');

      if (cancelled) return;

      if (storedHandle) {
        setDataDirHandle(storedHandle);
        try {
          const perm = await storedHandle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            const diskDocs = await syncFromDirectoryHandle(storedHandle);
            setFolderStatus(`Linked: ${storedHandle.name}/`);
            if (diskDocs.length > 0) {
              setSavedDocs(diskDocs);
              const chosen =
                diskDocs.find((d) => d.id === storedActiveId) || diskDocs[0];
              setActiveDocId(chosen.id);
              setMarkdown(chosen.content);
              setHydrated(true);
              return;
            }
          } else {
            setFolderStatus(`Reconnect ${storedHandle.name}/`);
          }
        } catch {
          setFolderStatus('Browser Disk Cache');
        }
      }

      if (Array.isArray(storedDocs) && storedDocs.length > 0) {
        setSavedDocs(storedDocs);
        const chosen =
          storedDocs.find((d) => d.id === storedActiveId) || storedDocs[0];
        setActiveDocId(chosen.id);
        setMarkdown(chosen.content);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Automatically mirror savedDocs & activeDocId to IndexedDB so startup always restores them
  useEffect(() => {
    if (!hydrated) return;
    idbSet('savedDocs', savedDocs);
    idbSet('activeDocId', activeDocId);
  }, [savedDocs, activeDocId, hydrated]);

  const handleLinkDataFolder = async () => {
    // Reconnect previously stored handle if permission just needs re-granting
    if (dataDirHandle && folderStatus.startsWith('Reconnect')) {
      try {
        const perm = await dataDirHandle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          const diskDocs = await syncFromDirectoryHandle(dataDirHandle);
          setFolderStatus(`Linked: ${dataDirHandle.name}/`);
          if (diskDocs.length > 0) {
            setSavedDocs(diskDocs);
            setActiveDocId(diskDocs[0].id);
            setMarkdown(diskDocs[0].content);
          } else {
            // Seed current workspace files into the newly linked folder
            for (const doc of savedDocs) {
              const fname = doc.fileName || slugifyFileName(doc.title, doc.id);
              await writeMarkdownToDirectory(dataDirHandle, fname, doc.content);
            }
          }
          triggerToast(`Synced with local ${dataDirHandle.name}/ folder`);
          return;
        }
      } catch {
        // Fall through to directory picker
      }
    }

    if (typeof window === 'undefined' || !window.showDirectoryPicker) {
      triggerToast('Browser saved locally via IndexedDB (Directory Picker requires Chrome/Edge)');
      return;
    }

    try {
      const pickedHandle = await window.showDirectoryPicker({
        id: 'depthdoc-data-folder',
        mode: 'readwrite',
        startIn: 'documents'
      });
      await idbSet('dataDirHandle', pickedHandle);
      setDataDirHandle(pickedHandle);
      setFolderStatus(`Linked: ${pickedHandle.name}/`);

      const existingDiskDocs = await syncFromDirectoryHandle(pickedHandle);
      if (existingDiskDocs.length > 0) {
        setSavedDocs(existingDiskDocs);
        setActiveDocId(existingDiskDocs[0].id);
        setMarkdown(existingDiskDocs[0].content);
        triggerToast(`Loaded ${existingDiskDocs.length} file(s) from ${pickedHandle.name}/`);
      } else {
        const seeded = [];
        for (const doc of savedDocs) {
          const fname = doc.fileName || slugifyFileName(doc.title, doc.id);
          await writeMarkdownToDirectory(pickedHandle, fname, doc.content);
          seeded.push({ ...doc, id: `fs-${fname}`, fileName: fname });
        }
        setSavedDocs(seeded);
        if (seeded[0]) setActiveDocId(seeded[0].id);
        triggerToast(`Saved workspace .md files into ${pickedHandle.name}/`);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        triggerToast('Could not open local folder; keeping local browser persistence');
      }
    }
  };

  const activeSavedDoc = useMemo(
    () => savedDocs.find((d) => d.id === activeDocId) || null,
    [savedDocs, activeDocId]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!activeSavedDoc) return true;
    return activeSavedDoc.content !== markdown;
  }, [activeSavedDoc, markdown]);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2600);
  };

  const handleSaveCurrentDocument = async () => {
    const title = deriveDocumentTitle(markdown);
    const timeStamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    const targetFileName =
      activeSavedDoc?.fileName || slugifyFileName(title, `proposal-${Date.now()}`);

    let wroteToFolder = false;
    if (hasViteDiskApi) {
      try {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: targetFileName, content: markdown })
        });
        if (res.ok) {
          wroteToFolder = true;
          setFolderStatus('Disk: data/');
        }
      } catch {
        // Fallback below
      }
    } else if (dataDirHandle) {
      wroteToFolder = await writeMarkdownToDirectory(
        dataDirHandle,
        targetFileName,
        markdown
      );
      if (wroteToFolder) {
        setFolderStatus(`Linked: ${dataDirHandle.name}/`);
      }
    }

    if (activeSavedDoc) {
      setSavedDocs((prev) =>
        prev.map((doc) =>
          doc.id === activeDocId
            ? {
                ...doc,
                fileName: targetFileName,
                title,
                content: markdown,
                updatedAt: `Saved ${timeStamp}`
              }
            : doc
        )
      );
    } else {
      const newId = hasViteDiskApi
        ? `disk-${targetFileName}`
        : dataDirHandle
        ? `fs-${targetFileName}`
        : `doc-${Date.now()}`;
      setSavedDocs((prev) => [
        {
          id: newId,
          fileName: targetFileName,
          title,
          content: markdown,
          updatedAt: `Saved ${timeStamp}`
        },
        ...prev
      ]);
      setActiveDocId(newId);
    }

    triggerToast(
      wroteToFolder
        ? `Saved data/${targetFileName} to local disk`
        : `Saved "${title}" (persisted locally for startup)`
    );
  };

  const handleSelectSavedDoc = async (doc) => {
    let latestContent = doc.content;
    // Re-read fresh file contents from data/ on click so external edits load immediately into the HTML preview
    if (hasViteDiskApi && doc.fileName) {
      try {
        const res = await fetch('/api/files');
        if (res.ok) {
          const payload = await res.json();
          const fresh = payload.files?.find((f) => f.fileName === doc.fileName);
          if (fresh) {
            latestContent = fresh.content;
            setSavedDocs((prev) =>
              prev.map((d) =>
                d.id === doc.id
                  ? {
                      ...d,
                      title: deriveDocumentTitle(fresh.content) || d.title,
                      content: fresh.content
                    }
                  : d
              )
            );
          }
        }
      } catch {
        // Use cached content if fetch fails
      }
    }
    setActiveDocId(doc.id);
    setMarkdown(latestContent);
    if (viewMode === 'guide') {
      setViewMode('writer');
    }
    triggerToast(`Loaded ${doc.fileName || doc.title}`);
  };

  const handleCreateNewDoc = async () => {
    const stampId = Date.now();
    const fileName = `proposal-draft-${String(stampId).slice(-4)}.md`;
    const newId = hasViteDiskApi
      ? `disk-${fileName}`
      : dataDirHandle
      ? `fs-${fileName}`
      : `doc-${stampId}`;
    const starterContent = `# New Proposal Draft\n\n:::executive[1. Executive Summary]\nOutline the core business objective, timeline, and expected ROI.\n:::\n\n:::product[Product Scope & User Experience]\nDescribe the user workflow and key deliverables.\n:::\n\n:::technical[Technical Architecture]\nDetail system components, APIs, and constraints.\n:::\n`;
    const newDoc = {
      id: newId,
      fileName,
      title: 'New Proposal Draft',
      content: starterContent,
      updatedAt: 'New Draft'
    };
    if (hasViteDiskApi) {
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, content: starterContent })
      });
    } else if (dataDirHandle) {
      await writeMarkdownToDirectory(dataDirHandle, fileName, starterContent);
    }
    setSavedDocs((prev) => [newDoc, ...prev]);
    setActiveDocId(newId);
    setMarkdown(starterContent);
    if (viewMode === 'guide') {
      setViewMode('writer');
    }
    triggerToast(`Created data/${fileName}`);
  };

  const handleDeleteSavedDoc = async (e, docId) => {
    e.stopPropagation();
    if (savedDocs.length <= 1) {
      triggerToast('At least one saved document must remain');
      return;
    }
    const target = savedDocs.find((d) => d.id === docId);
    if (hasViteDiskApi && target?.fileName) {
      try {
        await fetch('/api/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: target.fileName })
        });
      } catch {
        // Ignore
      }
    } else if (dataDirHandle && target?.fileName) {
      try {
        await dataDirHandle.removeEntry(target.fileName);
      } catch {
        // Ignore if file was already removed externally
      }
    }
    const remaining = savedDocs.filter((d) => d.id !== docId);
    setSavedDocs(remaining);
    if (docId === activeDocId && remaining.length > 0) {
      setActiveDocId(remaining[0].id);
      setMarkdown(remaining[0].content);
    }
    triggerToast('Removed saved file');
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveCurrentDocument();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const activeSource = useMemo(() => {
    if (viewMode === 'guide') {
      const guideDoc = savedDocs.find((d) => d.fileName === GUIDE_FILE_NAME);
      return guideDoc ? guideDoc.content : SYNTAX_GUIDE_MD;
    }
    return markdown;
  }, [viewMode, savedDocs, markdown]);
  const ast = useMemo(() => parseDocumentTree(activeSource), [activeSource]);
  const allAccordions = useMemo(() => collectAccordions(ast), [ast]);
  const readingMetrics = useMemo(() => computeReadingMetrics(ast), [ast]);

  const handleSelectMarkdownRange = (startOffset, endOffset) => {
    if (viewMode === 'guide') return;
    const applySelection = () => {
      const el = textareaRef.current;
      if (!el) return;
      const safeStart = Math.max(0, Math.min(startOffset, markdown.length));
      const safeEnd = Math.max(safeStart, Math.min(endOffset, markdown.length));
      el.focus();
      el.setSelectionRange(safeStart, safeEnd);

      const linesBefore = markdown.slice(0, safeStart).split('\n').length;
      const approxLineHeight = 21.125;
      el.scrollTop = Math.max(0, (linesBefore - 4) * approxLineHeight);
    };

    if (viewMode !== 'writer') {
      setViewMode('writer');
      setTimeout(applySelection, 30);
    } else {
      applySelection();
    }
  };

  const handleDoubleClickCaret = (event, startOffset, endOffset) => {
    if (viewMode === 'guide') return;
    const safeStart = Math.max(0, Math.min(startOffset, markdown.length));
    const safeEnd = Math.max(safeStart, Math.min(endOffset, markdown.length));
    const sectionSlice = markdown.slice(safeStart, safeEnd);

    let targetCaret = safeStart;
    const domSel = typeof window !== 'undefined' ? window.getSelection() : null;
    const selectedWord = domSel && domSel.toString().trim();

    if (selectedWord && selectedWord.length >= 1) {
      const wordIdx = sectionSlice.indexOf(selectedWord);
      if (wordIdx !== -1) {
        targetCaret = safeStart + wordIdx;
      }
    } else if (event?.currentTarget) {
      const rawText = (event.currentTarget.innerText || '').trim();
      const firstLine = rawText.split('\n')[0]?.trim();
      if (firstLine && firstLine.length >= 2) {
        const probe = firstLine.slice(0, 24);
        const relIdx = sectionSlice.indexOf(probe);
        if (relIdx !== -1) {
          targetCaret = safeStart + relIdx;
        }
      }
    }

    const applyCaret = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(targetCaret, targetCaret);
      const linesBefore = markdown.slice(0, targetCaret).split('\n').length;
      const approxLineHeight = 21.125;
      el.scrollTop = Math.max(0, (linesBefore - 5) * approxLineHeight);
    };

    if (viewMode !== 'writer') {
      setViewMode('writer');
      setTimeout(applyCaret, 30);
    } else {
      applyCaret();
    }
  };

  const spreadPages = useMemo(() => {
    const estimateNodeWeight = (node) => {
      if (node.type === 'markdown') {
        return Math.max(140, node.content.length);
      }
      const isOpen = !!expandedIds[node.id];
      if (!isOpen) return 150;
      const childrenWeight = node.children.reduce((acc, child) => acc + estimateNodeWeight(child), 0);
      return 180 + childrenWeight;
    };

    const weights = ast.map(estimateNodeWeight);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const targetPerPage = Math.max(
      950,
      Math.ceil(totalWeight / Math.max(2, Math.ceil(totalWeight / 1600)))
    );

    const pages = [];
    let currentPage = [];
    let currentWeight = 0;

    ast.forEach((node, idx) => {
      if (currentPage.length > 0 && currentWeight + weights[idx] > targetPerPage) {
        pages.push(currentPage);
        currentPage = [];
        currentWeight = 0;
      }
      currentPage.push(node);
      currentWeight += weights[idx];
    });
    if (currentPage.length > 0) pages.push(currentPage);

    if (pages.length === 1 && pages[0].length > 1) {
      const mid = Math.ceil(pages[0].length / 2);
      return [pages[0].slice(0, mid), pages[0].slice(mid)];
    }

    return pages;
  }, [ast, expandedIds]);

  const maxSpreadIndex = Math.max(0, Math.ceil(spreadPages.length / 2) - 1);
  const safeSpreadIndex = Math.min(spreadIndex, maxSpreadIndex);

  const applyAudiencePreset = (preset, targetAccordions = allAccordions) => {
    setActivePreset(preset);
    const nextExpanded = {};

    if (preset === 'engineer') {
      targetAccordions.forEach((acc) => {
        nextExpanded[acc.id] = true;
      });
    } else if (preset === 'product') {
      targetAccordions.forEach((acc) => {
        if (acc.depth === 'executive' || acc.depth === 'product' || acc.depth === 'general') {
          nextExpanded[acc.id] = true;
          acc.parentIds.forEach((pid) => {
            nextExpanded[pid] = true;
          });
        }
      });
    } else if (preset === 'executive') {
      targetAccordions.forEach((acc) => {
        if (acc.depth === 'executive') {
          nextExpanded[acc.id] = true;
          acc.parentIds.forEach((pid) => {
            nextExpanded[pid] = true;
          });
        }
      });
    }

    setExpandedIds(nextExpanded);
  };

  useEffect(() => {
    if (viewMode === 'guide') {
      const allOpen = {};
      allAccordions.forEach((a) => {
        allOpen[a.id] = true;
      });
      setExpandedIds(allOpen);
    } else if (activePreset !== 'custom') {
      applyAudiencePreset(activePreset, allAccordions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, ast.length]);

  const handleToggleSingle = (id) => {
    setActivePreset('custom');
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleExpandAll = () => {
    setActivePreset('engineer');
    const next = {};
    allAccordions.forEach((acc) => {
      next[acc.id] = true;
    });
    setExpandedIds(next);
  };

  const handleCollapseAll = () => {
    setActivePreset('custom');
    setExpandedIds({});
  };

  const insertSnippet = (snippet, newBlockDepth = null) => {
    const el = textareaRef.current;
    if (!el) {
      setMarkdown((prev) => `${prev}\n\n${snippet}`);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = markdown.slice(0, start);
    const after = markdown.slice(end);
    const prefix = before.length > 0 && !before.endsWith('\n\n') ? '\n\n' : '';
    const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';

    const updated = `${before}${prefix}${snippet}${suffix}${after}`;
    setMarkdown(updated);

    if (newBlockDepth) {
      setTimeout(() => {
        const freshAst = parseDocumentTree(updated);
        const freshAccs = collectAccordions(freshAst);
        const newest = freshAccs[freshAccs.length - 1];
        if (newest) {
          setExpandedIds((prev) => ({ ...prev, [newest.id]: true }));
        }
      }, 30);
    }

    setTimeout(() => {
      el.focus();
      const cursorPos = start + prefix.length + snippet.length;
      el.setSelectionRange(cursorPos, cursorPos);
    }, 10);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdown);
    setCopiedMd(true);
    triggerToast('Raw Markdown copied to clipboard');
    setTimeout(() => setCopiedMd(false), 1800);
  };

  const handleResetSample = () => {
    setMarkdown(SAMPLE_PROPOSAL);
    setViewMode('writer');
    applyAudiencePreset('engineer', collectAccordions(parseDocumentTree(SAMPLE_PROPOSAL)));
    triggerToast('Loaded Resource & Task Allocator (v2.0) spec');
  };

  const handleExportHtml = () => {
    const htmlDoc = generateStandaloneHtml(markdown, darkMode);
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proposal-interactive.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('Exported self-contained DepthDoc studio');
  };

  const readingTimeStats = useMemo(() => {
    const baseWords = readingMetrics.base || 0;
    const execWords = baseWords + (readingMetrics.executive || 0);
    const pmWords = execWords + (readingMetrics.product || 0) + (readingMetrics.general || 0);
    const engWords = pmWords + (readingMetrics.technical || 0) + (readingMetrics['deep-dive'] || 0);

    const toMins = (w) => Math.max(1, Math.round(w / 220));
    return {
      exec: { words: execWords, mins: toMins(execWords) },
      pm: { words: pmWords, mins: toMins(pmWords) },
      eng: { words: engWords, mins: toMins(engWords) }
    };
  }, [readingMetrics]);

  const openCount = useMemo(
    () => allAccordions.filter((a) => expandedIds[a.id]).length,
    [allAccordions, expandedIds]
  );

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/20 transition-colors">
        {/* =====================================================================
            TOP-LEVEL GLOBAL AUDIENCE & VIEW CONTROL BAR
           ===================================================================== */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            {/* Sidebar Toggle, Brand & Document Title */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title={sidebarOpen ? 'Hide Saved Files Sidebar' : 'Show Saved Files Sidebar'}
                aria-label={sidebarOpen ? 'Hide Saved Files Sidebar' : 'Show Saved Files Sidebar'}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4" />
                )}
              </button>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
                  DepthDoc
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                  Multi-Altitude + LaTeX Math
                </span>
              </div>
            </div>

            {/* Global Audience Depth Presets */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <span className="hidden xl:flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Audience Depth:
              </span>

              <button
                type="button"
                onClick={() => applyAudiencePreset('executive')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activePreset === 'executive'
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Show only high-level Executive summaries"
              >
                <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                <span>Executive</span>
                <span className="hidden sm:inline text-[11px] opacity-75">(High-Level)</span>
              </button>

              <button
                type="button"
                onClick={() => applyAudiencePreset('product')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activePreset === 'product'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Show Executive + Product & Rollout details"
              >
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                <span>Product / PM</span>
                <span className="hidden sm:inline text-[11px] opacity-75">(Balanced)</span>
              </button>

              <button
                type="button"
                onClick={() => applyAudiencePreset('engineer')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activePreset === 'engineer'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Expand all technical architecture, math & deep-dive specs"
              >
                <Terminal className="w-3.5 h-3.5 text-blue-500" />
                <span>Engineer</span>
                <span className="hidden sm:inline text-[11px] opacity-75">(All Details)</span>
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

              <button
                type="button"
                onClick={handleExpandAll}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Expand all collapsible layers"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Expand All</span>
              </button>

              <button
                type="button"
                onClick={handleCollapseAll}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Collapse all collapsible layers"
              >
                <ChevronsDownUp className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Collapse All</span>
              </button>
            </div>

            {/* Right Controls: Save, View Modes (Writer / Single Reader / 2-Page Side-by-Side) & Export */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLinkDataFolder}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                  folderStatus.startsWith('Linked:') || folderStatus.startsWith('Disk:')
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20'
                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                }`}
                title="Select or sync local data/ folder (.gitignored)"
              >
                {folderStatus.startsWith('Linked:') || folderStatus.startsWith('Disk:') ? (
                  <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <FolderSync className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                )}
                <span>
                  {folderStatus.startsWith('Linked:') || folderStatus.startsWith('Disk:')
                    ? folderStatus
                    : 'data/ Folder'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleSaveCurrentDocument}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  hasUnsavedChanges
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white ring-2 ring-indigo-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
                title="Save current Markdown file to data/ and sidebar (Ctrl+S / Cmd+S)"
              >
                {hasUnsavedChanges ? (
                  <Save className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{hasUnsavedChanges ? 'Save File' : 'Saved'}</span>
              </button>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setViewMode('writer')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'writer'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Default Split-Pane Writer (Editor + Live Preview)"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Writer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('reader')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'reader'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Single-Page Editorial Reader"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Single Page</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSpreadIndex(0);
                    setViewMode('spread');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'spread'
                      ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Full 2-Page Side-by-Side Book Spread Previewer"
                >
                  <BookCopy className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">2-Page Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('guide')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'guide'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Hierarchy & LaTeX Syntax Guide"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Guide</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Copy Raw Markdown"
              >
                {copiedMd ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copy MD</span>
              </button>

              <button
                type="button"
                onClick={handleExportHtml}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white shadow-2xs transition-colors cursor-pointer"
                title="Download standalone interactive HTML project with all styles, KaTeX math, and 2-page spread toggle"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export HTML</span>
              </button>

              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-amber-300 transition-colors cursor-pointer"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* =====================================================================
            MAIN WORKSPACE AREA (SIDEBAR + WRITER SPLIT, SINGLE READER, OR 2-PAGE SPREAD)
           ===================================================================== */}
        <main className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto overflow-hidden">
          {/* FAR-LEFT SIDEBAR: SAVED MARKDOWN FILES NAVIGATOR */}
          {sidebarOpen && (
            <aside className="w-full lg:w-64 flex-shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80">
              <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Saved Files ({savedDocs.length})</span>
                </div>
                <button
                  type="button"
                  onClick={handleCreateNewDoc}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                  title="Create a new Markdown document"
                >
                  <FilePlus2 className="w-3 h-3" />
                  <span>New</span>
                </button>
              </div>

              {/* Local data/ Folder Sync Banner */}
              <div className="px-2.5 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40">
                <button
                  type="button"
                  onClick={handleLinkDataFolder}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                    folderStatus.startsWith('Linked:') || folderStatus.startsWith('Disk:')
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                  title="Local data/ folder persistence (.gitignored)"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {folderStatus.startsWith('Linked:') || folderStatus.startsWith('Disk:') ? (
                      <HardDrive className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <FolderSync className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {folderStatus.startsWith('Linked:') || folderStatus.startsWith('Disk:')
                        ? folderStatus
                        : folderStatus.startsWith('Reconnect')
                        ? folderStatus
                        : 'Link data/ Folder'}
                    </span>
                  </span>
                  <span className="text-[10px] opacity-75 flex-shrink-0">
                    {folderStatus.startsWith('Linked:') || folderStatus.startsWith('Disk:')
                      ? '.gitignored'
                      : 'Sync'}
                  </span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-48 lg:max-h-[calc(100vh-148px)]">
                {savedDocs.map((doc) => {
                  const isActive = doc.id === activeDocId;
                  const isDirty = isActive && hasUnsavedChanges;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectSavedDoc(doc)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectSavedDoc(doc);
                        }
                      }}
                      className={`group w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-white dark:bg-slate-800/90 border-indigo-200 dark:border-indigo-700/70 shadow-2xs'
                          : 'border-transparent hover:bg-white/70 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <FileText
                          className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                            isActive
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div
                            className={`text-xs truncate ${
                              isActive
                                ? 'font-semibold text-indigo-700 dark:text-indigo-300'
                                : 'font-medium text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {doc.title}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            <span>{doc.updatedAt}</span>
                            {isDirty && (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                • Unsaved
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {savedDocs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedDoc(e, doc.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all cursor-pointer flex-shrink-0"
                          title="Delete saved file"
                          aria-label={`Delete ${doc.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* LEFT PANE: MARKDOWN EDITOR WITH SYNTAX & FORMULA HELPER TOOLBAR */}
          {viewMode === 'writer' && (
            <section className="flex-1 min-w-0 lg:max-w-[44%] flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
                    Insert:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(
                        `:::executive[Executive Pillar: Business Impact]\nSummarize key ROI, timeline, and high-level strategic value here.\n:::`,
                        'executive'
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 transition-colors cursor-pointer"
                    title="Insert Top-Level Executive Pillar"
                  >
                    <Plus className="w-3 h-3" />
                    Exec
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(
                        `:::product[Product Flow & Rollout Plan]\nDetail user experience changes and rollout milestones.\n\n:::product[Sub-Product: Module Specification]\nDetail nested sub-product behavior or validation rules.\n:::\n:::`,
                        'product'
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer"
                    title="Insert Product Block (supports nested Sub-Products)"
                  >
                    <Plus className="w-3 h-3" />
                    Product
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(
                        `:::technical[System Architecture & API Specs]\nDescribe service topology, data contracts, and performance SLAs.\n:::`,
                        'technical'
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 border border-blue-500/20 transition-colors cursor-pointer"
                    title="Insert Technical Architecture Block"
                  >
                    <Plus className="w-3 h-3" />
                    Tech
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(
                        `:::deep-dive[Deep Dive: Mathematical & Solver Model]\n$$\\min_{x} \\sum_{i=1}^{n} c_i x_i \\quad \\text{s.t.} \\quad \\sum_{i=1}^{n} a_{ij} x_i \\le b_j$$\n:::`,
                        'deep-dive'
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 transition-colors cursor-pointer"
                    title="Insert Deep-Dive Math/Code Block"
                  >
                    <Plus className="w-3 h-3" />
                    Deep Dive
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(
                        `$$C = w_1(\\text{Completion Time}) + w_2(\\text{Labor Overrun}) - w_3(\\text{Skill Match})$$`
                      )
                    }
                    className="p-1.5 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Insert LaTeX Display Formula ($$ ... $$)"
                  >
                    <Sigma className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(
                        `| Metric | Baseline | Target |\n| :--- | :---: | :---: |\n| Allocation Time | 4.5 hrs/wk | 0.8 hrs/wk |\n| Overload Incidents | 18% | < 2% |`
                      )
                    }
                    className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Insert Markdown Table"
                  >
                    <Table className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(
                        `\`\`\`python\ndef solve_allocation(tasks, units):\n    return optimize_cp_sat(tasks, units)\n\`\`\``
                      )
                    }
                    className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Insert Code Block"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSample}
                    className="p-1.5 rounded text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Reset to Resource & Task Allocator (v2.0) Spec"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                spellCheck={false}
                placeholder="Write your multi-level proposal in Markdown using :::executive[Title], :::product[Title], :::technical[Title], :::deep-dive[Title], and LaTeX formulas ($...$ or $$...$$)..."
                className="flex-1 w-full min-h-[360px] lg:min-h-[calc(100vh-145px)] p-4 sm:p-5 font-mono text-[13px] leading-relaxed bg-transparent text-slate-800 dark:text-slate-200 resize-none focus:outline-none selection:bg-indigo-500/20"
              />

              <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                    <Clock className="w-3 h-3 text-indigo-500" />
                    Est. Read Time:
                  </span>
                  <span>
                    <strong className="text-amber-600 dark:text-amber-400">Exec:</strong> ~
                    {readingTimeStats.exec.mins}m
                  </span>
                  <span>
                    <strong className="text-emerald-600 dark:text-emerald-400">PM:</strong> ~
                    {readingTimeStats.pm.mins}m
                  </span>
                  <span>
                    <strong className="text-blue-600 dark:text-blue-400">Eng:</strong> ~
                    {readingTimeStats.eng.mins}m
                  </span>
                </div>
                <div>
                  <span>
                    {openCount}/{allAccordions.length} layers open
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* RIGHT PANE: EDITORIAL MULTI-LEVEL DOCUMENT RENDERER */}
          <section
            className={`flex-1 overflow-y-auto bg-slate-100/70 dark:bg-slate-950 ${
              viewMode === 'writer' ? 'lg:h-[calc(100vh-57px)]' : 'min-h-[calc(100vh-57px)]'
            }`}
          >
            {viewMode === 'spread' && (
              <div ref={previewContainerRef} className="hidden" aria-hidden="true">
                <DocumentNodeList
                  nodes={ast}
                  expandedIds={expandedIds}
                  onToggle={handleToggleSingle}
                  katexReady={katexReady}
                />
              </div>
            )}

            {viewMode === 'spread' ? (
              <div className="max-w-[1520px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 font-semibold">
                      <BookCopy className="w-3.5 h-3.5" />
                      2-Page Side-by-Side Spread Preview
                    </span>
                    <span className="font-medium">
                      Pages {safeSpreadIndex * 2 + 1} –{' '}
                      {Math.min(safeSpreadIndex * 2 + 2, Math.max(2, spreadPages.length))} of{' '}
                      {Math.max(2, spreadPages.length)}
                    </span>
                    <span className="hidden md:inline text-slate-400">
                      • {openCount}/{allAccordions.length} layers open
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {spreadPages.length > 2 && (
                      <div className="flex items-center gap-1.5 mr-2">
                        <button
                          type="button"
                          disabled={safeSpreadIndex <= 0}
                          onClick={() => setSpreadIndex((p) => Math.max(0, p - 1))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 font-semibold cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Prev Spread
                        </button>
                        <button
                          type="button"
                          disabled={safeSpreadIndex >= maxSpreadIndex}
                          onClick={() => setSpreadIndex((p) => Math.min(maxSpreadIndex, p + 1))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 font-semibold cursor-pointer"
                        >
                          Next Spread
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setViewMode('writer')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      Back to Writer →
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                  <article className="bg-white dark:bg-slate-900/95 rounded-2xl lg:rounded-r-md border border-slate-200/90 dark:border-slate-800 shadow-[0_18px_40px_-15px_rgba(15,23,42,0.12)] flex flex-col justify-between min-h-[760px]">
                    <div className="p-6 sm:p-9">
                      <DocumentNodeList
                        nodes={spreadPages[safeSpreadIndex * 2] || []}
                        expandedIds={expandedIds}
                        onToggle={handleToggleSingle}
                        katexReady={katexReady}
                        onSelectRange={handleSelectMarkdownRange}
                        onDoubleClickCaret={handleDoubleClickCaret}
                      />
                    </div>
                    <footer className="px-7 py-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>DepthDoc Specification</span>
                      <span>
                        Page {safeSpreadIndex * 2 + 1} of {Math.max(2, spreadPages.length)}
                      </span>
                    </footer>
                  </article>

                  <article className="bg-white dark:bg-slate-900/95 rounded-2xl lg:rounded-l-md border border-slate-200/90 dark:border-slate-800 shadow-[0_18px_40px_-15px_rgba(15,23,42,0.12)] flex flex-col justify-between min-h-[760px]">
                    <div className="p-6 sm:p-9">
                      {spreadPages[safeSpreadIndex * 2 + 1] ? (
                        <DocumentNodeList
                          nodes={spreadPages[safeSpreadIndex * 2 + 1]}
                          expandedIds={expandedIds}
                          onToggle={handleToggleSingle}
                          katexReady={katexReady}
                          onSelectRange={handleSelectMarkdownRange}
                          onDoubleClickCaret={handleDoubleClickCaret}
                        />
                      ) : (
                        <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 p-8">
                          <BookOpen className="w-8 h-8 mb-2 opacity-40" />
                          <p className="text-xs font-medium">End of Proposal Document</p>
                        </div>
                      )}
                    </div>
                    <footer className="px-7 py-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Multi-Level Interactive View</span>
                      <span>
                        Page {safeSpreadIndex * 2 + 2} of {Math.max(2, spreadPages.length)}
                      </span>
                    </footer>
                  </article>
                </div>
              </div>
            ) : (
              <div
                className={`mx-auto px-4 sm:px-8 py-6 sm:py-9 transition-all ${
                  viewMode === 'writer' ? 'max-w-3xl' : 'max-w-4xl'
                }`}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      {viewMode === 'guide'
                        ? 'Interactive Hierarchy & LaTeX Reference'
                        : `Viewing ${openCount} of ${allAccordions.length} detail layers expanded`}
                    </span>
                  </div>
                  {viewMode === 'reader' && (
                    <button
                      type="button"
                      onClick={() => setViewMode('writer')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                    >
                      Back to Writer →
                    </button>
                  )}
                </div>

                <article
                  ref={previewContainerRef}
                  className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 sm:p-10"
                >
                  <DocumentNodeList
                    nodes={ast}
                    expandedIds={expandedIds}
                    onToggle={handleToggleSingle}
                    katexReady={katexReady}
                    onSelectRange={handleSelectMarkdownRange}
                    onDoubleClickCaret={handleDoubleClickCaret}
                  />
                </article>
              </div>
            )}
          </section>
        </main>

        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium shadow-lg border border-slate-700 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}