// ------ Domain Types -------------

export interface Source {
    title: string;
    url: string;
    snippet?: string;
}

export interface SearchResult {
    answer: string;
    sources: Source[];
    followups: string[];
}

export interface HistoryEntry extends SearchResult {
    query: string;
    ts: number;
}

// ---- App State -----------

export interface AppState {
    query: string;
    loading: boolean;
    answer: string;
    sources: Source[];
    followups: string[];
    history: HistoryEntry[];
    error: string | null;
    isCompact: boolean;
}

// ----- Anthropic API -------------

export interface AnthropicMessage {
    role: "user" | "assistant";
    content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
    type: "text" | "tool_use" | "tool_result" | "image" | "document";
    text: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    content?: AnthropicContentBlock[];
}

export interface AnthropicRequest {
    model: string;
    messages: AnthropicMessage[];
    max_tokens?: number;
    system?: string;
    tools?: AnthropicTool[];
}

export interface AnthropicTool {
    type: string;
    name: string;
}

export interface AnthropicResponse {
    id: string;
    type: string;
    role: string;
    content: AnthropicContentBlock[];
    model: string;
    stop_reason: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
    error?: {
        type: string;
        message: string;
    };
}

import type {
    AnthropicRequest,
    AnthropicResponse,
    AnthropicContentBlock,
    SearchResult,
    Source,
} from "../types/index.js";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 2000;

const SYSTEM_PROMPT = `You are CHO AI, a precise and thoughtful AI search engine.
Your task: answer the user's query using web search, then provide a structured response.

Format your response as valid JSON with this exact structure:
{
"answer": "Your comprehensive markdown answer here. Use headers, lists, bold text as appropriate. Be thorough but concise.",
"sources": [{"title": "Page Title", "url": "https://...", "snippet": "Brief relevant excerpt"}],
"followups": ["Related question 1?", "Related question 2?", "Related question 3?"]
}

Guidelines:
- Always search the web for current information
- Provide 3-6 relevant sources
- Write answer in clear markdown
- Generate 3 insightful follow-up questions
- Be factual, cite sources inline using [Source Title](url) format when appropriate
- If query is conversational or opinion-based, still search for relevant info`;

function extractText(content: AnthropicContentBlock[]): string {
  return content
    .map((block) => (block.type === "text" ? block.text ?? "" : ""))
    .filter(Boolean)
    .join("\n");
}

function parseResponse(raw: string): SearchResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as Partial<SearchResult>;
      if (parsed.answer) {
        return {
          answer: parsed.answer,
          sources: (parsed.sources ?? []) as Source[],
          followups: parsed.followups ?? [],
        };
      }
    } catch {
      // fall through to plain-text fallback
    }
  }
  return { answer: raw || "No results found.", sources: [], followups: [] };
}

export async function runSearch(query: string): Promise<SearchResult> {
    const payload: AnthropicRequest = {
        model: MODEL, 
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search"}],
        messages: [{ role" "user, content: query }],
    };

    const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

     const data: AnthropicResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message ?? `HTTP ${response.status}`);
  }

  const rawText = extractText(data.content);
  return parseResponse(rawText);
}

export function parseMarkdown(md: string): string {
  if (!md) return "";

  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(
      
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

  html = html
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]+?<\/li>)(\n(?!<li>)|$)/g, "<ul>$1</ul>$2");

  const blocks = html.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const b = block.trim();
      if (!b) return "";
      if (/^<(h[123]|ul|ol|li)/.test(b)) return b;
      return "<p>" + b.replace(/\n/g, "<br>") + "</p>";
    })
    .join("");
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/[#*`_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function faviconUrl(url: string): string {
  try {
    const origin = new URL(url).origin;
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
  } catch {
    return "";
  }
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeAttr(s: unknown): string {
  return String(s ?? "")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function relativeTime(ts: number): string {
  const delta = Math.floor((Date.now() - ts) / 1000);
  if (delta < 60) return "just now";
  if (delta < 3600) return `${Math.floor(delta / 60)} min ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)} hr ago`;
  return `${Math.floor(delta / 86400)} days ago`;
}

import { escapeAttr } from "../lib/utils.js";

export interface SearchBarProps {
  query: string;
  loading: boolean;
  isCompact: boolean;
  onSearch: (query: string) => void;
  onQueryChange: (query: string) => void;
}

const EXAMPLE_QUERIES = [
  "Latest AI research breakthroughs",
  "Best programming languages 2025",
  "How does quantum computing work",
  "Climate change solutions today",
];

export function SearchBar(props: SearchBarProps): string {
  const { query, loading, isCompact } = props;

  const logoSvg = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="10" cy="10" r="2.5"/>
    </svg>`;

  const searchIcon = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="10" cy="10" r="7"/>
      <line x1="15" y1="15" x2="21" y2="21"/>
    </svg>`;

  const examplePills = EXAMPLE_QUERIES.map(
    (ex) => `<span class="pill" data-example="${escapeAttr(ex)}">${ex}</span>`
  ).join("");

  const btnContent = loading
    ? `<span class="spin"></span> Searching`
    : `${searchIcon} Search`;

  return `
    <div class="hero ${isCompact ? "compact" : ""}">
      <div class="logo-mark">${logoSvg}</div>
      ${!isCompact ? `<div class="brand">Meridian</div>` : `<div class="brand">Meridian</div>`}
      ${!isCompact ? `<div class="tagline">AI-Powered Search</div>` : ""}

      <div class="search-wrap">
        <div class="search-row">
          <input
            type="text"
            id="search-input"
            placeholder="Ask anything…"
            value="${escapeAttr(query)}"
            ${loading ? "disabled" : ""}
            autocomplete="off"
          />
          <button class="search-btn" id="search-btn" ${loading ? "disabled" : ""}>
            ${btnContent}
          </button>
        </div>
        ${!isCompact ? `<div class="examples">${examplePills}</div>` : ""}
      </div>
    </div>
  `;
}

export function bindSearchBarEvents(props: SearchBarProps): void {
  const input = document.getElementById("search-input") as HTMLInputElement | null;
  const btn = document.getElementById("search-btn") as HTMLButtonElement | null;

  if (input) {
    input.addEventListener("input", (e) => {
      props.onQueryChange((e.target as HTMLInputElement).value);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && props.query.trim() && !props.loading) {
        props.onSearch(props.query.trim());
      }
    });
    if (!props.isCompact) setTimeout(() => input.focus(), 50);
  }

  if (btn) {
    btn.addEventListener("click", () => {
      if (props.query.trim() && !props.loading) props.onSearch(props.query.trim());
    });
  }

  document.querySelectorAll<HTMLElement>(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const ex = pill.dataset.example ?? "";
      props.onQueryChange(ex);
      props.onSearch(ex);
    });
  });
}

import type { Source } from "../types/index.js";
import { parseMarkdown } from "../lib/markdown.js";
import { extractDomain, faviconUrl, escapeAttr, escapeHtml } from "../lib/utils.js";

export interface AnswerBlockProps {
  answer: string;
  sources: Source[];
  followups: string[];
  loading: boolean;
  onFollowup: (query: string) => void;
}

export function AnswerBlock(props: AnswerBlockProps): string {
  const { answer, sources, followups, loading } = props;

  if (loading && !answer) {
    return `
      <div class="answer-block">
        <div class="answer-label">
          <span class="dot"></span>
          Searching the web…
        </div>
        <div class="answer-text" style="color:var(--ink3); font-style:italic;">
          Gathering information from multiple sources…
        </div>
      </div>
    `;
  }

  if (!answer) return "";

  const sourcesHtml = sources.length > 0 ? `
    <div class="sources-section">
      <div class="sources-label">Sources</div>
      <div class="source-chips">
        ${sources.slice(0, 6).map((s) => `
          <a class="source-chip"
             href="${escapeAttr(s.url)}"
             target="_blank"
             rel="noopener"
             title="${escapeAttr(s.title)}">
            <img class="favicon" src="${faviconUrl(s.url)}" alt=""
              onerror="this.style.display='none'" />
            ${escapeHtml(extractDomain(s.url))}
          </a>
        `).join("")}
      </div>
    </div>` : "";

  const followupsHtml = followups.length > 0 ? `
    <div class="followups">
      <div class="followups-label">Ask more</div>
      <div class="followup-btns">
        ${followups.map((f) => `
          <button class="followup-btn" data-followup="${escapeAttr(f)}">
            ${escapeHtml(f)}
          </button>
        `).join("")}
      </div>
    </div>` : "";

  return `
    <div class="answer-block">
      <div class="answer-label">
        <span class="dot done"></span>
        AI Answer
      </div>
      <div class="answer-text">${parseMarkdown(answer)}</div>
      ${sourcesHtml}
      ${followupsHtml}
    </div>
  `;
}

export function bindAnswerBlockEvents(onFollowup: (query: string) => void): void {
  document.querySelectorAll<HTMLButtonElement>(".followup-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.followup ?? "";
      if (q) onFollowup(q);
    });
  });
}

import type { HistoryEntry } from "../types/index.js";
import { escapeHtml } from "../lib/utils.js";
import { stripMarkdown } from "../lib/markdown.js";

export interface HistoryPanelProps {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export function HistoryPanel(props: HistoryPanelProps): string {
  const { history } = props;
  const past = history.slice(1, 4);
  if (past.length === 0) return "";

  const entries = past.map((entry, i) => `
    <div class="history-block" style="cursor:pointer"
      data-history-idx="${i + 1}" role="button" tabindex="0"
      aria-label="Restore search: ${escapeHtml(entry.query)}">
      <div class="history-q">${escapeHtml(entry.query)}</div>
      <div class="history-a">${escapeHtml(stripMarkdown(entry.answer))}</div>
    </div>
  `).join("");

  return `
    <div class="history-panel">
      <div class="history-panel-label">
        Recent searches
        <button class="history-clear" id="clear-history" aria-label="Clear history">
          Clear
        </button>
      </div>
      ${entries}
    </div>
  `;
}

export function bindHistoryPanelEvents(props: HistoryPanelProps): void {
  const { history, onSelect, onClear } = props;

  document.querySelectorAll<HTMLElement>("[data-history-idx]").forEach((el) => {
    const handler = () => {
      const idx = parseInt(el.dataset.historyIdx ?? "0", 10);
      const entry = history[idx];
      if (entry) onSelect(entry);
    };
    el.addEventListener("click", handler);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); }
    });
  });

  document.getElementById("clear-history")?.addEventListener("click", onClear);
}

import type { AppState, HistoryEntry } from "../types/index.js";
import { runSearch } from "../lib/api.js";
import { escapeHtml } from "../lib/utils.js";
import { SearchBar, bindSearchBarEvents } from "./SearchBar.js";
import { AnswerBlock, bindAnswerBlockEvents } from "./AnswerBlock.js";
import { HistoryPanel, bindHistoryPanelEvents } from "./HistoryPanel.js";

const state: AppState = {
  query: "",
  loading: false,
  answer: "",
  sources: [],
  followups: [],
  history: [],
  error: null,
  isCompact: false,
};

type StateUpdate = Partial<AppState>;
type Listener = () => void;
const listeners: Listener[] = [];

function setState(updates: StateUpdate): void {
  Object.assign(state, updates);
  listeners.forEach((fn) => fn());
}

function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

async function doSearch(query: string): Promise<void> {
  setState({ query, loading: true, answer: "", sources: [], followups: [], error: null, isCompact: true });
  try {
    const result = await runSearch(query);
    const entry: HistoryEntry = { query, ...result, ts: Date.now() };
    setState({
      loading: false,
      answer: result.answer,
      sources: result.sources,
      followups: result.followups,
      history: [entry, ...state.history].slice(0, 10),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    setState({ loading: false, error: message });
  }
}

function restoreHistory(entry: HistoryEntry): void {
  setState({ query: entry.query, answer: entry.answer, sources: entry.sources, followups: entry.followups, error: null, isCompact: true });
}

function renderApp(rootEl: HTMLElement): void {
  const { query, loading, answer, sources, followups, history, error, isCompact } = state;

  const errorHtml = error ? `<div class="error-block">⚠ ${escapeHtml(error)}</div>` : "";
  const emptyHtml = !answer && !loading && history.length === 0 ? `
    <div class="empty-state">
      <p style="font-size:2rem;margin-bottom:.5rem">search</p>
      <p style="font-weight:500;color:var(--ink2);margin-bottom:.25rem">Start searching</p>
      <p>Type a question or choose an example above</p>
    </div>` : "";

  rootEl.innerHTML = `
    ${SearchBar({ query, loading, isCompact, onSearch: doSearch, onQueryChange: (q) => setState({ query: q }) })}
    <div class="results-area">
      ${errorHtml}
      ${AnswerBlock({ answer, sources, followups, loading, onFollowup: doSearch })}
      ${HistoryPanel({ history, onSelect: restoreHistory, onClear: () => setState({ history: [] }) })}
      ${emptyHtml}
    </div>
  `;

  bindSearchBarEvents({ query, loading, isCompact, onSearch: doSearch, onQueryChange: (q) => setState({ query: q }) });
  bindAnswerBlockEvents(doSearch);
  bindHistoryPanelEvents({ history, onSelect: restoreHistory, onClear: () => setState({ history: [] }) });
}

export function mountApp(rootEl: HTMLElement): void {
  subscribe(() => renderApp(rootEl));
  renderApp(rootEl);
}

import { mountApp } from "./components/App.js";

function main(): void {
  const root = document.getElementById("root");
  if (!root) {
    console.error("[CHO AI]");
  ("Could not find #root element.");
    return;
  }
  mountApp(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

import * as http from "http";
import type { IncomingMessage, ServerResponse } from "http";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

if (!API_KEY) {
  console.error("[Meridian API] Missing ANTHROPIC_API_KEY environment variable.");
  process.exit(1);
}

interface SearchRequest { query: string; }

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function handleSearch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: SearchRequest;
  try {
    body = JSON.parse(await readBody(req)) as SearchRequest;
  } catch {
    json(res, 400, { error: "Invalid JSON body" }); return;
  }

  if (!body.query?.trim()) {
    json(res, 400, { error: "Missing query field" }); return;
  }

  const systemPrompt = `You are CHO AI, a precise AI search engine.
Return ONLY valid JSON:
{ "answer": "Markdown answer", "sources": [{"title":"...","url":"https://...","snippet":"..."}], "followups": ["Q1?","Q2?","Q3?"] }`;

  try {
    const upstream = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: body.query }],
      }),
    });

    const data = await upstream.json() as { content?: Array<{ type: string; text?: string }>; error?: { message: string } };
    if (!upstream.ok) { json(res, upstream.status, { error: data.error?.message ?? "API error" }); return; }

    const rawText = (data.content ?? []).map((b) => (b.type === "text" ? b.text ?? "" : "")).join("\n");
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try { json(res, 200, JSON.parse(match[0])); return; } catch { /* fall through */ }
    }
    json(res, 200, { answer: rawText, sources: [], followups: [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    json(res, 500, { error: message });
  }
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "POST" && req.url === "/api/search") { await handleSearch(req, res); return; }
  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => console.log(`[Meridian API] Listening on http://localhost:${PORT}`));

import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

