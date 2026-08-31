/**
 * Shared client-side navigation for the /online-ordering single-page
 * app. Makes the browser's Back/Forward buttons work the way a user
 * expects inside a multi-step flow — one step backward at a time,
 * eventually back to service selection, then off the page — rather
 * than immediately leaving the page, which is what happens by default
 * when a "page" is really just DOM sections toggled with `hidden` and
 * no History API involvement at all.
 *
 * One page-level owner (online-ordering.astro) calls
 * `initOrderingNavigation()` once, supplying the function that actually
 * shows/hides the right view for a given state. Every calculator
 * (Furniture/Appliance/General Junk Removal, and every service built on
 * this pattern going forward) calls `navigateOrdering()` when the
 * customer moves to a new step, and calls `goBackOneStep()` for its
 * Back button — never manipulates `history` directly, and never needs
 * its own popstate listener.
 */

export interface OrderingState {
  /** "selection" | "quote" | a calculator section's id (e.g. "furniture-calculator"). */
  view: string;
  /** Step number within that view's wizard, if it has one. */
  step?: number;
  /** The clicked ordering-option key, when relevant (e.g. the quote-request view uses this to restore its per-service heading/body on popstate). */
  key?: string;
  /** The clicked ordering-option's display title, for the same reason. */
  title?: string;
}

type ApplyStateFn = (state: OrderingState) => void;

let applyStateFn: ApplyStateFn | null = null;

function buildUrl(state: OrderingState): string {
  const url = new URL(window.location.href);
  url.searchParams.set("view", state.view);
  if (state.step !== undefined) {
    url.searchParams.set("step", String(state.step));
  } else {
    url.searchParams.delete("step");
  }
  return url.toString();
}

function readStateFromUrl(): OrderingState | null {
  const url = new URL(window.location.href);
  const view = url.searchParams.get("view");
  if (!view) return null;
  const step = url.searchParams.get("step");
  return { view, step: step ? Number(step) : undefined };
}

/**
 * Registers the page's state-applying function, establishes the
 * initial history entry (so pressing Back from the very first view
 * leaves the page, as expected, rather than doing nothing), and wires
 * up the single `popstate` listener every subsequent Back/Forward press
 * runs through.
 */
export function initOrderingNavigation(apply: ApplyStateFn): void {
  applyStateFn = apply;

  const initial = readStateFromUrl() ?? { view: "selection" };
  history.replaceState(initial, "", buildUrl(initial));
  apply(initial);

  window.addEventListener("popstate", (event) => {
    const state = (event.state as OrderingState | null) ?? readStateFromUrl() ?? { view: "selection" };
    applyStateFn?.(state);
  });
}

/**
 * Moves forward to a new view/step — selecting a service, or advancing
 * a wizard step. Pushes a real history entry, so the browser's Back
 * button can undo exactly this transition later.
 */
export function navigateOrdering(state: OrderingState): void {
  history.pushState(state, "", buildUrl(state));
  applyStateFn?.(state);
}

/**
 * For every "Back" affordance in the UI — a wizard's own Back button,
 * or a quote view's "Back to Services" link. Always goes through the
 * same history the browser's native Back button uses, so in-app Back
 * buttons and the browser's Back button are perfectly interchangeable
 * and never fall out of sync with each other.
 */
export function goBackOneStep(): void {
  history.back();
}
