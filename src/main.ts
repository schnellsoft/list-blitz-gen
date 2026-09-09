import { cacheApiAvailable, clearBoardCache, loadBoard, readStrategy, writeStrategy } from "./load-board.ts";
import type { BoardData, Listing, LoadSource, Strategy } from "./types.ts";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

let board: BoardData | null = null;
let source: LoadSource | null = null;
let durationMs = 0;
let strategy: Strategy = readStrategy();
let query = "";
let category = "All";
let errorMessage = "";
let loading = true;
let backgroundNote = "";

function uniqueCategories(listings: Listing[]): string[] {
  return [...new Set(listings.map((item) => item.category))].sort();
}

function visibleListings(): Listing[] {
  if (!board) return [];
  const needle = query.trim().toLowerCase();
  return board.listings.filter((item) => {
    const inCategory = category === "All" || item.category === category;
    if (!inCategory) return false;
    if (!needle) return true;
    const hay = `${item.title} ${item.summary} ${item.place} ${item.category}`.toLowerCase();
    return hay.includes(needle);
  });
}

function sourceLabel(value: LoadSource | null): string {
  if (value === "cache") return "Cache API";
  if (value === "memory") return "Memory";
  if (value === "network") return "Network";
  return "…";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderListing(item: Listing): string {
  const posted = dateFmt.format(new Date(`${item.posted}T12:00:00`));
  return `
    <li class="card">
      <article>
        <header class="card-head">
          <p class="stamp">${escapeHtml(item.category)}</p>
          <time datetime="${escapeHtml(item.posted)}">${posted}</time>
        </header>
        <h2>${escapeHtml(item.title)}</h2>
        <p class="summary">${escapeHtml(item.summary)}</p>
        <p class="place">${escapeHtml(item.place)}</p>
      </article>
    </li>
  `;
}

function renderList(): string {
  if (loading && !board) {
    return `
      <ul class="board" aria-busy="true">
        ${Array.from({ length: 6 }, () => `<li class="card skeleton" aria-hidden="true"></li>`).join("")}
      </ul>
    `;
  }

  if (errorMessage && !board) {
    return `
      <div class="state error" role="alert">
        <p>${escapeHtml(errorMessage)}</p>
        <button type="button" data-action="reload">Try again</button>
      </div>
    `;
  }

  const items = visibleListings();
  if (items.length === 0) {
    return `
      <div class="state empty">
        <p>No notices match that filter. Clear search or pick another category.</p>
      </div>
    `;
  }

  return `<ul class="board">${items.map(renderListing).join("")}</ul>`;
}

function render(): void {
  const categories = board ? ["All", ...uniqueCategories(board.listings)] : ["All"];
  const updated = board ? timeFmt.format(new Date(board.updated)) : "—";
  const count = board ? visibleListings().length : 0;
  const total = board?.listings.length ?? 0;
  const harbor = board?.harbor ?? "Port Meridian";

  app.innerHTML = `
    <a class="skip" href="#notices">Skip to notices</a>
    <div class="shell">
      <header class="mast">
        <p class="eyebrow">Notice board</p>
        <h1>Harbor Board</h1>
        <p class="lede">
          JSON is fetched once, stored with the Cache API, then painted as a real HTML list.
          Later visits skip the network.
        </p>
        <dl class="meta">
          <div>
            <dt>Harbor</dt>
            <dd>${escapeHtml(harbor)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd><span class="pill pill-${source ?? "wait"}">${escapeHtml(sourceLabel(source))}</span></dd>
          </div>
          <div>
            <dt>Read</dt>
            <dd>${loading && !board ? "…" : `${durationMs.toFixed(1)} ms`}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>${escapeHtml(updated)}</dd>
          </div>
        </dl>
        ${backgroundNote ? `<p class="banner" role="status">${escapeHtml(backgroundNote)}</p>` : ""}
        ${!cacheApiAvailable() ? `<p class="banner warn" role="status">This origin has no Cache API. The list is kept in memory for this tab only.</p>` : ""}
      </header>

      <section class="controls" aria-label="Board controls">
        <label class="search">
          <span>Search notices</span>
          <input type="search" name="q" placeholder="Ferry, tide, cat…" value="${escapeHtml(query)}" />
        </label>
        <fieldset class="strategy">
          <legend>After the first fetch</legend>
          <label>
            <input type="radio" name="strategy" value="swr" ${strategy === "swr" ? "checked" : ""} />
            Stale-while-revalidate
          </label>
          <label>
            <input type="radio" name="strategy" value="cache-first" ${strategy === "cache-first" ? "checked" : ""} />
            Cache-first only
          </label>
        </fieldset>
        <div class="actions">
          <button type="button" data-action="reload">Read again</button>
          <button type="button" class="ghost" data-action="first-visit">Simulate first visit</button>
        </div>
      </section>

      <nav class="cats" aria-label="Categories">
        ${categories
          .map(
            (name) => `
              <button type="button" class="${name === category ? "on" : ""}" data-cat="${escapeHtml(name)}">
                ${escapeHtml(name)}
              </button>
            `,
          )
          .join("")}
      </nav>

      <p class="count" id="notices-label">
        ${board ? `${count} of ${total} notices` : "Loading notices"}
      </p>
      <div id="notices">${renderList()}</div>

      <aside class="why">
        <h2>Why this is fast</h2>
        <ol>
          <li><strong>Cache API</strong> stores the JSON <code>Response</code> after the first fetch. Repeat visits read disk, not the network.</li>
          <li><strong>Stale-while-revalidate</strong> paints the cached list immediately, then refreshes in the background if the file changed.</li>
          <li><strong>Cache-first</strong> never hits the network again — the “only first time” behavior you asked for.</li>
        </ol>
        <p>
          Faster still, if the list is known at build time: inline it in the HTML
          (<code>&lt;script type="application/json"&gt;</code>) or render the
          <code>&lt;ul&gt;</code> on the server. No fetch at all.
          Use IndexedDB when the list is large enough to query. Skip <code>localStorage</code> — it is synchronous and string-only.
        </p>
      </aside>
    </div>
  `;

  bind();
}

function bind(): void {
  const search = app.querySelector<HTMLInputElement>("input[name=q]");
  search?.addEventListener("input", () => {
    query = search.value;
    const notices = app.querySelector("#notices");
    const count = app.querySelector(".count");
    if (notices) notices.innerHTML = renderList();
    if (count && board) {
      count.textContent = `${visibleListings().length} of ${board.listings.length} notices`;
    }
    bindRetry();
  });

  app.querySelectorAll<HTMLInputElement>("input[name=strategy]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.value === "cache-first" || input.value === "swr") {
        strategy = input.value;
        writeStrategy(strategy);
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-cat]").forEach((button) => {
    button.addEventListener("click", () => {
      category = button.dataset.cat ?? "All";
      render();
    });
  });

  app.querySelector("[data-action=reload]")?.addEventListener("click", () => {
    void refresh();
  });
  app.querySelector("[data-action=first-visit]")?.addEventListener("click", () => {
    void simulateFirstVisit();
  });
  bindRetry();
}

function bindRetry(): void {
  app.querySelector("#notices [data-action=reload]")?.addEventListener("click", () => {
    void refresh();
  });
}

async function refresh(): Promise<void> {
  loading = true;
  errorMessage = "";
  backgroundNote = "";
  render();
  try {
    const result = await loadBoard(strategy);
    board = result.data;
    source = result.source;
    durationMs = result.durationMs;
    loading = false;
    render();
    if (result.background) {
      const next = await result.background;
      if (next && JSON.stringify(next) !== JSON.stringify(board)) {
        board = next;
        backgroundNote = "Background fetch found a newer board and replaced the list.";
        render();
      } else if (next) {
        backgroundNote = "Background fetch confirmed the cached board is current.";
        const banner = app.querySelector(".banner");
        if (!banner) render();
        else banner.textContent = backgroundNote;
      }
    }
  } catch (error) {
    loading = false;
    errorMessage = error instanceof Error ? error.message : "Could not load the board.";
    render();
  }
}

async function simulateFirstVisit(): Promise<void> {
  await clearBoardCache();
  board = null;
  source = null;
  durationMs = 0;
  backgroundNote = "";
  await refresh();
}

void refresh();
