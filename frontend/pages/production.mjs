import { escapeHtml, formatTime, routeFor } from "../lib/core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading, statusBadge } from "../ui/components.mjs";

function safeImageSource(value) {
  const source = String(value || "").trim();
  return /^(data:image\/|https:\/\/|http:\/\/127\.0\.0\.1|http:\/\/localhost)/i.test(source) ? source : "";
}

function sceneCard(scene) {
  const start = formatTime(scene.start);
  const end = formatTime(scene.end);
  const imageSource = safeImageSource(scene.imageDataUrl || scene.imageUrl);
  const imageState = scene.imageStatus === "in_progress"
    ? `<small class="storyboard-image-state">Generating image…</small>`
    : scene.imageError
      ? `<small class="storyboard-image-state is-error">${escapeHtml(scene.imageError)}</small>`
      : scene.imagePrompt
        ? `<small class="storyboard-image-state">${escapeHtml(scene.imagePrompt)}</small>`
        : "";
  return `<article class="storyboard-preview-card">
    <header>
      <div><span>${start} — ${end}</span><strong>${escapeHtml(scene.label || `Scene ${String(scene.number).padStart(2, "0")}`)}</strong></div>
      <small>${escapeHtml(scene.duration)}s</small>
    </header>
    <div class="storyboard-preview-body">
      <figure class="storyboard-frame" role="img" aria-label="Visual preview for ${escapeHtml(scene.caption)}">
        ${imageSource
          ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(scene.caption)}">`
          : `<span>${scene.imageStatus === "in_progress" ? "Generating…" : "Visual Preview"}</span><i style="--scene:${scene.number}"></i>`}
      </figure>
      <dl class="storyboard-notes">
        <div><dt>🎙 Narration</dt><dd>“${escapeHtml(scene.narration)}”</dd></div>
        <div><dt>🎥 Visual</dt><dd>${escapeHtml(scene.visual)}</dd></div>
        <div><dt>🖼 Image Prompt</dt><dd>${imageState || "Ready for AI image generation"}</dd></div>
        <div><dt>📝 Caption</dt><dd>“${escapeHtml(scene.caption)}”</dd></div>
        <div><dt>🔍 Suggested B-roll</dt><dd>“${escapeHtml(scene.searchQuery)}”</dd></div>
        <div><dt>Transition</dt><dd>${escapeHtml(scene.transition)}</dd></div>
      </dl>
    </div>
  </article>`;
}

function timeline(project) {
  const total = Number(project.duration) || project.storyboard.at(-1)?.end || 60;
  return `<section class="storyboard-timeline" aria-label="Storyboard timeline">
    <div class="section-bar"><div><p class="eyebrow">Timeline</p><h2>${project.storyboard.length} scenes across ${formatTime(total)}</h2></div><span>${escapeHtml(project.format)}</span></div>
    <ol>${project.storyboard.map((scene) => {
      const width = Math.max(6, Math.min(100, (Number(scene.duration) / total) * 100));
      return `<li style="--scene:${scene.number};--width:${width}%"><span>${String(scene.number).padStart(2, "0")}</span><strong>${escapeHtml(scene.caption)}</strong><small>${formatTime(scene.start)}–${formatTime(scene.end)}</small></li>`;
    }).join("")}</ol>
  </section>`;
}

export function renderProduction(project) {
  const backToScript = `<a class="button button-secondary" href="${routeFor("script", project.id)}">← Back to script</a>`;
  if (project.error) {
    return `${pageHeading("Storyboard Agent", "Storyboard preview paused.", "The approved script remains saved.", backToScript)}${errorNotice(project.error, "retry-storyboard", "Storyboard Agent")}`;
  }
  if (!project.storyboard.length) {
    return `${pageHeading("Storyboard Agent", "Building the storyboard preview.", "This stage turns narration into timed scenes, visual direction, captions, and B-roll search cues.", backToScript)}${loadingPanel("Storyboard Agent", "Generating storyboard preview…")}`;
  }
  const imageButtonLabel = project.imagePreviewStatus === "failed" ? "Retry key images" : project.imagePreviewStatus === "in_progress" ? "Generate key images again" : "Generate key images";
  return `${pageHeading("Preview Storyboard", "Storyboard ready.", "No MP4 is rendered here. This board is the final artifact: the decisions an AI production team would hand to an editor or presenter.", `<div class="button-row production-actions"><a class="button button-secondary" href="${routeFor("script", project.id)}">← Back to script</a><button class="button button-secondary" type="button" data-action="regenerate-storyboard">${icon("retry")}Regenerate</button><button class="image-inline-action" type="button" data-action="generate-storyboard-images">${icon("spark", 16)}${imageButtonLabel}</button></div>`)}
    <section class="storyboard-hero-panel">
      <div><p class="eyebrow">Storyboard</p><h2>${escapeHtml(project.title)}</h2><p>${project.storyboard.length} timed scenes showing narration, visual intent, captions, transitions, and suggested B-roll.</p></div>
      ${statusBadge("under_review")}
    </section>
    ${timeline(project)}
    <section class="storyboard-preview-grid" aria-label="Storyboard preview scenes">${project.storyboard.map(sceneCard).join("")}</section>`;
}
