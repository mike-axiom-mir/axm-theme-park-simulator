import { WorldRenderer as BaseWorldRenderer } from "./worldRenderer.js";
import {
  deriveGuestBodyLanguage, describeGuestBodyLanguage
} from "../presentation/guestBodyLanguage.js";

function visitorPhase(visitorId) {
  const text = String(visitorId ?? "guest");
  let value = 0;
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0;
  return (value % 997) / 997 * Math.PI * 2;
}

function applyGuestBodyLanguage(model, visitor, time) {
  const parts = model?.userData?.personParts ?? {};
  const [armLeft, armRight] = model?.userData?.arms ?? [];
  if (!parts.torso || !parts.head) return;

  // Base animation owns locomotion, service gestures and the seated pose. Reset
  // only the additive torso/head rotations that this presentation layer owns.
  parts.torso.rotation.x = 0;
  parts.torso.rotation.z = 0;
  parts.head.rotation.x = 0;
  parts.head.rotation.z = 0;

  const descriptor = deriveGuestBodyLanguage(visitor);
  const amount = descriptor.intensity;
  const phase = visitorPhase(visitor.id);

  if (descriptor.pose === "impatient") {
    const shift = Math.sin(time * 4.4 + phase);
    parts.torso.rotation.z = shift * 0.035 * amount;
    parts.head.rotation.z = -shift * 0.12 * amount;
    if (armLeft && armRight) {
      armLeft.rotation.x = -0.12 - shift * 0.18 * amount;
      armRight.rotation.x = -0.12 + shift * 0.18 * amount;
    }
  } else if (descriptor.pose === "tired") {
    const breath = Math.sin(time * 1.7 + phase);
    parts.torso.rotation.x = 0.12 + 0.12 * amount;
    parts.head.rotation.x = 0.12 + 0.16 * amount;
    parts.head.position.y -= 0.04 + 0.06 * amount + breath * 0.012;
    if (armLeft && armRight) {
      armLeft.rotation.x = 0.13 + breath * 0.025;
      armRight.rotation.x = 0.13 - breath * 0.025;
    }
  } else if (descriptor.pose === "disappointed") {
    parts.torso.rotation.x = 0.05 + 0.06 * amount;
    parts.head.rotation.x = 0.12 + 0.12 * amount;
    parts.head.rotation.z = Math.sin(time * 1.15 + phase) * 0.025 * amount;
    if (armLeft && armRight) {
      armLeft.rotation.x = 0.08;
      armRight.rotation.x = 0.08;
    }
  }

  model.userData.guestBodyLanguage = descriptor;
}

/**
 * Presentation-only extension. Authoritative visitor state remains owned by the
 * base renderer's state reference and simulation; this class only alters meshes
 * and emits an explanatory UI message when a guest is explicitly selected.
 */
export class WorldRenderer extends BaseWorldRenderer {
  selectVisitor(visitorId) {
    super.selectVisitor(visitorId);
    if (!visitorId || !this.state) return;
    const visitor = this.state.visitors.find((item) => item.id === visitorId);
    if (!visitor) return;
    const cue = describeGuestBodyLanguage(visitor);
    const strength = cue.pose === "neutral" ? "" : ` · ${cue.strength}%`;
    this.callbacks.onWorldMessage?.(`Body language: ${cue.label} · ${cue.reason}${strength}`);
  }

  syncVisitors(time) {
    super.syncVisitors(time);
    if (!this.state) return;
    for (const visitor of this.state.visitors.slice(0, 90)) {
      const model = this.visitorModels.get(visitor.id);
      if (!model?.visible) continue;
      applyGuestBodyLanguage(model, visitor, time);
    }
  }
}
