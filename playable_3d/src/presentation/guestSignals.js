export const GUEST_SIGNAL_LIMITS = Object.freeze({ crisp: 18, retro: 12, tiny: 6 });

const SIGNALS = Object.freeze({
  comfort: Object.freeze({ type: "comfort", label: "Comfort", priority: 5 }),
  drink: Object.freeze({ type: "drink", label: "Drink", priority: 4 }),
  snack: Object.freeze({ type: "snack", label: "Snack", priority: 3 }),
  rest: Object.freeze({ type: "rest", label: "Rest", priority: 2 }),
  wait: Object.freeze({ type: "wait", label: "Long wait", priority: 1 })
});

function descriptor(visitor) {
  if (visitor.state === "resting") return { ...SIGNALS.rest, urgency: 1 };
  if (visitor.toilet > 0.78) return { ...SIGNALS.comfort, urgency: visitor.toilet };
  if (visitor.thirst > 0.76) return { ...SIGNALS.drink, urgency: visitor.thirst };
  if (visitor.hunger > 0.72) return { ...SIGNALS.snack, urgency: visitor.hunger };
  if (visitor.energy < 0.58) return { ...SIGNALS.rest, urgency: 1 - visitor.energy };
  if (visitor.state === "queueing" && visitor.activityRemaining > 36) {
    return { ...SIGNALS.wait, urgency: Math.min(1, visitor.activityRemaining / Math.max(1, visitor.patience ?? 48)) };
  }
  return null;
}

export function guestSignalFor(visitor) {
  const signal = descriptor(visitor);
  return signal ? Object.freeze({ visitorId: visitor.id, ...signal }) : null;
}

export function deriveGuestSignalPlan(visitors, profile = "retro") {
  const limit = GUEST_SIGNAL_LIMITS[profile] ?? GUEST_SIGNAL_LIMITS.retro;
  return Object.freeze(visitors
    .map(guestSignalFor)
    .filter(Boolean)
    .sort((left, right) => right.priority - left.priority
      || right.urgency - left.urgency
      || left.visitorId.localeCompare(right.visitorId))
    .slice(0, limit));
}

export function guestPulseSummary(visitors) {
  const counts = { comfort: 0, drink: 0, snack: 0, rest: 0, wait: 0 };
  for (const visitor of visitors) {
    const signal = guestSignalFor(visitor);
    if (signal) counts[signal.type] += 1;
  }
  return Object.freeze({
    ...counts,
    active: Object.values(counts).reduce((total, value) => total + value, 0),
    total: visitors.length
  });
}
