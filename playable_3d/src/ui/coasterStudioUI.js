import {
  COASTER_DECORATIONS, COASTER_STUDIO_LIMITS,
  addCoasterDecoration, addTrackNode, coasterDesignMetrics, createCoasterDesign,
  deserializeCoasterDesign, removeCoasterDecoration, removeTrackNode,
  serializeCoasterDesign, setCoasterStyle, updateCoasterDecoration, updateTrackNode
} from "../core/coasterStudio.js";

const DRAFT_KEY = "axm-theme-park-coaster-studio-v1-draft";
const GRID = COASTER_STUDIO_LIMITS.gridSize;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function safeStorage(callback, fallback = null) {
  try { return callback(); } catch { return fallback; }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(value) {
  return String(value || "coaster").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "coaster";
}

function injectStyles() {
  if (document.getElementById("coaster-studio-styles")) return;
  const style = document.createElement("style");
  style.id = "coaster-studio-styles";
  style.textContent = `
    #coaster-studio-dialog { width:min(1120px,calc(100vw - 24px)); max-width:none; padding:0; border:1px solid rgba(238,219,177,.2); border-radius:12px; background:#101820; color:#f2ead9; }
    #coaster-studio-dialog::backdrop { background:rgba(3,7,11,.78); }
    .coaster-studio-shell { display:grid; grid-template-columns:minmax(420px,1.6fr) minmax(290px,.8fr); min-height:min(720px,calc(100vh - 40px)); }
    .coaster-studio-stage { position:relative; min-height:520px; padding:14px; background:radial-gradient(circle at 50% 45%,#20313c,#0b1118 74%); }
    #coaster-studio-canvas { width:100%; height:100%; min-height:500px; display:block; border:1px solid rgba(238,219,177,.18); border-radius:9px; background:#101b22; touch-action:none; cursor:crosshair; image-rendering:pixelated; }
    .coaster-studio-toolbar { position:absolute; left:26px; top:25px; display:flex; flex-wrap:wrap; gap:5px; z-index:2; }
    .coaster-studio-toolbar button.active { background:#f0c766; color:#17140b; }
    .coaster-studio-sidebar { position:relative; overflow:auto; padding:18px; border-left:1px solid rgba(238,219,177,.16); background:#111820; }
    .coaster-studio-sidebar h2 { margin:0 36px 3px 0; font-size:21px; }
    .coaster-studio-sidebar h3 { margin:18px 0 8px; font-size:12px; color:#f0c766; text-transform:uppercase; letter-spacing:.12em; }
    .coaster-studio-sidebar label { display:grid; gap:5px; margin:8px 0; font-size:11px; color:#aeb6ba; }
    .coaster-studio-sidebar input[type=text], .coaster-studio-sidebar input[type=number] { width:100%; padding:8px; color:#f2ead9; background:#0b1118; border:1px solid rgba(238,219,177,.18); border-radius:6px; }
    .coaster-style-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .coaster-style-grid input[type=color] { width:100%; min-height:36px; border:0; background:transparent; }
    .coaster-metrics { display:grid; grid-template-columns:repeat(2,1fr); gap:6px; }
    .coaster-metric { padding:8px; border:1px solid rgba(238,219,177,.15); border-radius:7px; background:rgba(255,255,255,.03); }
    .coaster-metric small { display:block; font-size:9px; color:#9ea7ad; }
    .coaster-metric b { font-size:14px; }
    .coaster-editor-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .coaster-decoration-tools { display:flex; flex-wrap:wrap; gap:5px; }
    .coaster-decoration-tools button.active { border-color:#f0c766; color:#f0c766; }
    .coaster-selected-card { padding:10px; border:1px solid rgba(101,190,209,.3); border-radius:7px; background:rgba(101,190,209,.06); }
    .coaster-studio-actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:16px; }
    .coaster-studio-actions .full { grid-column:1/-1; }
    .coaster-studio-help { font-size:10px; line-height:1.5; color:#9ea7ad; }
    .coaster-studio-close { position:absolute; right:10px; top:10px; width:32px; height:32px; padding:0; z-index:3; }
    @media (max-width:820px) { .coaster-studio-shell { grid-template-columns:1fr; } .coaster-studio-sidebar { border-left:0; border-top:1px solid rgba(238,219,177,.16); } #coaster-studio-canvas { min-height:410px; } }
  `;
  document.head.appendChild(style);
}

function createMarkup() {
  const dialog = document.createElement("dialog");
  dialog.id = "coaster-studio-dialog";
  dialog.innerHTML = `
    <div class="coaster-studio-shell">
      <section class="coaster-studio-stage">
        <div class="coaster-studio-toolbar">
          <button data-studio-mode="track" class="active" type="button">Track nodes</button>
          <button data-studio-mode="decorate" type="button">Decorate</button>
          <button data-studio-fit type="button">Reset view</button>
        </div>
        <canvas id="coaster-studio-canvas" width="760" height="620" aria-label="Coaster Studio plan editor"></canvas>
      </section>
      <aside class="coaster-studio-sidebar">
        <button class="coaster-studio-close" data-studio-close type="button">×</button>
        <p class="eyebrow">Coaster Studio · design draft</p>
        <h2>Shape it, then style it.</h2>
        <p class="coaster-studio-help">Track geometry and decorations live in a portable design file. Decoration placement is visual/style data and does not silently change ride physics.</p>
        <label>Name <input data-studio-name type="text" maxlength="48"></label>
        <div class="coaster-style-grid">
          <label>Track <input data-style="trackColor" type="color"></label>
          <label>Supports <input data-style="supportColor" type="color"></label>
          <label>Train <input data-style="trainColor" type="color"></label>
          <label>Accent <input data-style="accentColor" type="color"></label>
        </div>
        <h3>Design evidence</h3>
        <div class="coaster-metrics" data-studio-metrics></div>
        <h3>Selected track node</h3>
        <div class="coaster-selected-card" data-node-editor></div>
        <h3>Decorations</h3>
        <div class="coaster-decoration-tools" data-decoration-tools></div>
        <div class="coaster-selected-card" data-decoration-editor></div>
        <h3>Portable design</h3>
        <div class="coaster-studio-actions">
          <button data-studio-new type="button">New design</button>
          <button data-studio-export type="button">Export JSON</button>
          <label class="button-like full">Import design<input data-studio-import type="file" accept="application/json,.json" hidden></label>
        </div>
        <p class="coaster-studio-help">Track mode: click empty space to add a node; drag an existing node to reshape the circuit. Decoration mode: choose a decoration, click to place it, or click an existing decoration to edit/remove it.</p>
      </aside>
    </div>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

export class CoasterStudioUI {
  constructor({ onMessage = () => {} } = {}) {
    injectStyles();
    this.onMessage = onMessage;
    this.dialog = createMarkup();
    this.canvas = this.dialog.querySelector("#coaster-studio-canvas");
    this.context = this.canvas.getContext("2d");
    this.mode = "track";
    this.decorationType = "tree";
    this.selectedNodeId = null;
    this.selectedDecorationId = null;
    this.draggingNode = false;
    this.design = this.restoreDraft() ?? createCoasterDesign();
    this.selectedNodeId = this.design.nodes[0]?.id ?? null;
    this.bind();
    this.render();
  }

  restoreDraft() {
    const text = safeStorage(() => localStorage.getItem(DRAFT_KEY));
    if (!text) return null;
    try { return deserializeCoasterDesign(text); } catch { return null; }
  }

  persistDraft() {
    try {
      const text = serializeCoasterDesign(this.design);
      safeStorage(() => localStorage.setItem(DRAFT_KEY, text));
    } catch {
      // In-progress short/invalid layouts remain editable but are not persisted as verified drafts.
    }
  }

  open() {
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  bind() {
    this.dialog.querySelector("[data-studio-close]").addEventListener("click", () => this.close());
    this.dialog.querySelectorAll("[data-studio-mode]").forEach((button) => button.addEventListener("click", () => {
      this.mode = button.dataset.studioMode;
      this.dialog.querySelectorAll("[data-studio-mode]").forEach((item) => item.classList.toggle("active", item === button));
      this.render();
    }));
    this.dialog.querySelector("[data-studio-fit]").addEventListener("click", () => this.renderCanvas());
    this.dialog.querySelector("[data-studio-name]").addEventListener("change", (event) => {
      this.design = setCoasterStyle(this.design, { name: event.target.value });
      this.changed();
    });
    this.dialog.querySelectorAll("[data-style]").forEach((input) => input.addEventListener("input", () => {
      this.design = setCoasterStyle(this.design, { [input.dataset.style]: input.value });
      this.changed({ controls: false });
    }));
    this.dialog.querySelector("[data-studio-new]").addEventListener("click", () => {
      this.design = createCoasterDesign({ name: "New Custom Coaster", seed: `draft-${Date.now()}` });
      this.selectedNodeId = this.design.nodes[0]?.id ?? null;
      this.selectedDecorationId = null;
      this.changed();
      this.onMessage("Coaster Studio: new editable design created.");
    });
    this.dialog.querySelector("[data-studio-export]").addEventListener("click", () => {
      try {
        const text = serializeCoasterDesign(this.design);
        downloadText(`${slug(this.design.name)}.coaster.json`, text);
        this.onMessage(`Coaster Studio: exported ${this.design.name}.`);
      } catch (error) {
        this.onMessage(error.message);
      }
    });
    this.dialog.querySelector("[data-studio-import]").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          this.design = deserializeCoasterDesign(String(reader.result));
          this.selectedNodeId = this.design.nodes[0]?.id ?? null;
          this.selectedDecorationId = null;
          this.changed();
          this.onMessage(`Coaster Studio: imported ${this.design.name}.`);
        } catch (error) {
          this.onMessage(error.message);
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    });

    this.canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    addEventListener("pointerup", () => { this.draggingNode = false; });
  }

  pointFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
    const padding = 42;
    const usableW = this.canvas.width - padding * 2;
    const usableH = this.canvas.height - padding * 2;
    return {
      x: clamp((x - padding) / usableW * GRID, 0, GRID),
      z: clamp((y - padding) / usableH * GRID, 0, GRID)
    };
  }

  canvasPoint(x, z) {
    const padding = 42;
    return {
      x: padding + x / GRID * (this.canvas.width - padding * 2),
      y: padding + z / GRID * (this.canvas.height - padding * 2)
    };
  }

  nearestNode(point, radius = 1.2) {
    return this.design.nodes
      .map((node) => ({ node, distance: Math.hypot(node.x - point.x, node.z - point.z) }))
      .sort((a, b) => a.distance - b.distance)[0]?.distance <= radius
      ? this.design.nodes
        .map((node) => ({ node, distance: Math.hypot(node.x - point.x, node.z - point.z) }))
        .sort((a, b) => a.distance - b.distance)[0].node
      : null;
  }

  nearestDecoration(point, radius = 1.25) {
    const sorted = this.design.decorations
      .map((item) => ({ item, distance: Math.hypot(item.x - point.x, item.z - point.z) }))
      .sort((a, b) => a.distance - b.distance);
    return sorted[0]?.distance <= radius ? sorted[0].item : null;
  }

  pointerDown(event) {
    const point = this.pointFromEvent(event);
    if (this.mode === "track") {
      const existing = this.nearestNode(point);
      if (existing) {
        this.selectedNodeId = existing.id;
        this.selectedDecorationId = null;
        this.draggingNode = true;
        this.canvas.setPointerCapture?.(event.pointerId);
      } else {
        const selected = this.design.nodes.find((node) => node.id === this.selectedNodeId);
        this.design = addTrackNode(this.design, {
          x: point.x,
          z: point.z,
          height: selected?.height ?? 2,
          bank: selected?.bank ?? 0
        }, selected?.id ?? null);
        this.selectedNodeId = this.design.nodes.find((node) => node.id.startsWith("node-")
          && !this.design.nodes.slice(0, -1).some((other) => other.id === node.id))?.id
          ?? this.design.nodes.at(-1)?.id ?? null;
        this.selectedDecorationId = null;
        this.changed();
      }
    } else {
      const existing = this.nearestDecoration(point);
      if (existing) {
        this.selectedDecorationId = existing.id;
        this.selectedNodeId = null;
        this.render();
      } else {
        this.design = addCoasterDecoration(this.design, this.decorationType, point);
        this.selectedDecorationId = this.design.decorations.at(-1)?.id ?? null;
        this.selectedNodeId = null;
        this.changed();
      }
    }
  }

  pointerMove(event) {
    if (!this.draggingNode || !this.selectedNodeId || this.mode !== "track") return;
    const point = this.pointFromEvent(event);
    this.design = updateTrackNode(this.design, this.selectedNodeId, point);
    this.changed({ controls: false });
  }

  changed({ controls = true } = {}) {
    this.persistDraft();
    this.renderCanvas();
    this.renderMetrics();
    if (controls) this.renderControls();
  }

  render() {
    this.dialog.querySelector("[data-studio-name]").value = this.design.name;
    this.dialog.querySelectorAll("[data-style]").forEach((input) => { input.value = this.design.style[input.dataset.style]; });
    this.renderDecorationTools();
    this.renderControls();
    this.renderMetrics();
    this.renderCanvas();
  }

  renderMetrics() {
    const metrics = coasterDesignMetrics(this.design);
    const container = this.dialog.querySelector("[data-studio-metrics]");
    const values = [
      ["Track", `${metrics.trackLength}m`],
      ["Highest", `${metrics.maxHeight}m`],
      ["Biggest drop", `${metrics.maxDrop}m`],
      ["Avg bank", `${metrics.averageBank}°`],
      ["Track nodes", metrics.nodeCount],
      ["Decor", metrics.decorationCount],
      ["Intensity est.", Math.round(metrics.intensityEstimate * 100)]
    ];
    container.innerHTML = values.map(([label, value]) => `<div class="coaster-metric"><small>${label}</small><b>${value}</b></div>`).join("");
  }

  renderDecorationTools() {
    const container = this.dialog.querySelector("[data-decoration-tools]");
    container.innerHTML = Object.values(COASTER_DECORATIONS).map((item) => `
      <button data-decor-type="${item.id}" class="${this.decorationType === item.id ? "active" : ""}" type="button">${item.icon} ${item.label}</button>
    `).join("");
    container.querySelectorAll("[data-decor-type]").forEach((button) => button.addEventListener("click", () => {
      this.decorationType = button.dataset.decorType;
      this.mode = "decorate";
      this.dialog.querySelectorAll("[data-studio-mode]").forEach((item) => item.classList.toggle("active", item.dataset.studioMode === "decorate"));
      this.renderDecorationTools();
    }));
  }

  renderControls() {
    const nodeEditor = this.dialog.querySelector("[data-node-editor]");
    const node = this.design.nodes.find((item) => item.id === this.selectedNodeId);
    if (!node) {
      nodeEditor.innerHTML = `<small>Select a track node to edit height and banking.</small>`;
    } else {
      nodeEditor.innerHTML = `
        <b>${node.id}</b>
        <div class="coaster-editor-row">
          <label>Height <input data-node-height type="range" min="0" max="${COASTER_STUDIO_LIMITS.maxHeight}" step="0.5" value="${node.height}"><span>${node.height}m</span></label>
          <label>Bank <input data-node-bank type="range" min="-${COASTER_STUDIO_LIMITS.maxBank}" max="${COASTER_STUDIO_LIMITS.maxBank}" step="2" value="${node.bank}"><span>${node.bank}°</span></label>
        </div>
        <button data-node-remove type="button" ${this.design.nodes.length <= COASTER_STUDIO_LIMITS.minNodes ? "disabled" : ""}>Remove node</button>
      `;
      const height = nodeEditor.querySelector("[data-node-height]");
      const bank = nodeEditor.querySelector("[data-node-bank]");
      const update = () => {
        this.design = updateTrackNode(this.design, node.id, { height: height.value, bank: bank.value });
        height.nextElementSibling.textContent = `${height.value}m`;
        bank.nextElementSibling.textContent = `${bank.value}°`;
        this.changed({ controls: false });
      };
      height.addEventListener("input", update);
      bank.addEventListener("input", update);
      nodeEditor.querySelector("[data-node-remove]")?.addEventListener("click", () => {
        this.design = removeTrackNode(this.design, node.id);
        this.selectedNodeId = this.design.nodes[0]?.id ?? null;
        this.changed();
      });
    }

    const decorEditor = this.dialog.querySelector("[data-decoration-editor]");
    const decoration = this.design.decorations.find((item) => item.id === this.selectedDecorationId);
    if (!decoration) {
      decorEditor.innerHTML = `<small>Choose a decoration above, then click the plan to place it.</small>`;
    } else {
      const meta = COASTER_DECORATIONS[decoration.type];
      decorEditor.innerHTML = `
        <b>${meta.icon} ${meta.label}</b>
        <div class="coaster-editor-row">
          <label>Rotate <input data-decor-rotation type="range" min="0" max="355" step="5" value="${decoration.rotation}"><span>${decoration.rotation}°</span></label>
          <label>Scale <input data-decor-scale type="range" min="0.5" max="2" step="0.1" value="${decoration.scale}"><span>${decoration.scale}×</span></label>
        </div>
        <button data-decor-remove type="button">Remove decoration</button>
      `;
      const rotation = decorEditor.querySelector("[data-decor-rotation]");
      const scale = decorEditor.querySelector("[data-decor-scale]");
      const update = () => {
        this.design = updateCoasterDecoration(this.design, decoration.id, { rotation: rotation.value, scale: scale.value });
        rotation.nextElementSibling.textContent = `${rotation.value}°`;
        scale.nextElementSibling.textContent = `${scale.value}×`;
        this.changed({ controls: false });
      };
      rotation.addEventListener("input", update);
      scale.addEventListener("input", update);
      decorEditor.querySelector("[data-decor-remove]").addEventListener("click", () => {
        this.design = removeCoasterDecoration(this.design, decoration.id);
        this.selectedDecorationId = null;
        this.changed();
      });
    }
  }

  drawDecoration(item) {
    const ctx = this.context;
    const point = this.canvasPoint(item.x, item.z);
    const meta = COASTER_DECORATIONS[item.type];
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(item.rotation / 180 * Math.PI);
    ctx.scale(item.scale, item.scale);
    ctx.font = "20px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = item.id === this.selectedDecorationId ? this.design.style.accentColor : "#d9d2b8";
    ctx.fillText(meta.icon, 0, 0);
    ctx.restore();
  }

  renderCanvas() {
    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#101b22";
    ctx.fillRect(0, 0, width, height);

    const padding = 42;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    ctx.strokeStyle = "rgba(220,231,232,.08)";
    ctx.lineWidth = 1;
    for (let value = 0; value <= GRID; value += 2) {
      const x = padding + value / GRID * usableW;
      const y = padding + value / GRID * usableH;
      ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, height - padding); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
    }

    for (const item of this.design.decorations) this.drawDecoration(item);

    const points = this.design.nodes.map((node) => this.canvasPoint(node.x, node.z));
    if (points.length) {
      ctx.strokeStyle = this.design.style.supportColor;
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.48;
      ctx.beginPath();
      ctx.moveTo(points[0].x + 5, points[0].y + 6);
      for (const point of points.slice(1)) ctx.lineTo(point.x + 5, point.y + 6);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = this.design.style.trackColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.closePath();
      ctx.stroke();

      this.design.nodes.forEach((node, index) => {
        const point = points[index];
        const selected = node.id === this.selectedNodeId;
        ctx.beginPath();
        ctx.arc(point.x, point.y, selected ? 8 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = selected ? this.design.style.accentColor : this.design.style.trainColor;
        ctx.fill();
        ctx.font = "10px system-ui";
        ctx.fillStyle = "#f2ead9";
        ctx.fillText(`${node.height}m`, point.x + 9, point.y - 7);
      });
    }

    ctx.fillStyle = "rgba(242,234,217,.72)";
    ctx.font = "11px system-ui";
    ctx.fillText(`${this.design.name} · ${this.mode === "track" ? "track editing" : `${COASTER_DECORATIONS[this.decorationType].label} placement`}`, padding, 22);
  }
}
