import { WorldRenderer as FestivalTechStyleWorldRenderer } from "./festivalTechStyleWorldRenderer.js";

function christmasSnowVisual(root) {
  let visual = null;
  root?.traverse?.((item) => {
    if (!visual && item.name === "christmas-snowglow") visual = item;
  });
  return visual;
}

function collectSnowflakes(visual) {
  const flakes = [];
  for (const child of visual?.children ?? []) {
    if (!child?.isMesh || child.geometry?.type !== "OctahedronGeometry") continue;
    if (Math.hypot(child.position.x, child.position.z) < 1) continue;
    if (child.userData.snowMotionIndex === undefined) {
      child.userData.snowMotionIndex = flakes.length;
      child.userData.snowBaseX = child.position.x;
    }
    flakes.push(child);
  }
  return flakes;
}

/**
 * Final motion-integrity guard for the seasonal/technology presentation layer.
 * Snowglow's first source pass contains a tiny additive sideways nudge. This
 * guard runs after that presentation update and anchors each flake back to a
 * deterministic time-based position, preventing frame-rate-dependent drift while
 * preserving the underlying renderer as a separately inspectable repair seam.
 */
export class WorldRenderer extends FestivalTechStyleWorldRenderer {
  syncStyleSuperpowers() {
    super.syncStyleSuperpowers();
    this.refreshChristmasSnowAnchors();
  }

  refreshChristmasSnowAnchors() {
    for (const root of this.stylePowerRoots?.values?.() ?? []) {
      if (root.userData.power?.themeId !== "christmas") continue;
      collectSnowflakes(christmasSnowVisual(root));
    }
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const root of this.stylePowerRoots?.values?.() ?? []) {
      if (root.userData.power?.themeId !== "christmas") continue;
      const flakes = collectSnowflakes(christmasSnowVisual(root));
      flakes.forEach((flake, index) => {
        const baseX = Number(flake.userData.snowBaseX) || 0;
        flake.position.x = baseX + Math.sin(time * 0.7 + index) * 0.045;
      });
    }
  }

  getVisualHealth() {
    return Object.freeze({
      ...super.getVisualHealth(),
      seasonalMotionGuard: Object.freeze({
        christmasSnowAnchored: true,
        timeBased: true
      })
    });
  }
}
