type FocusTarget = { focus: () => void; isConnected?: boolean };

/** Defer focus until React has revealed the destination; keep each inspector's origin. */
export function createEvidenceInspectorFocus(
  afterRender: (work: () => void) => void = work => {
    requestAnimationFrame(work);
  }
) {
  let origin: FocusTarget | null = null;
  const move = (target: () => FocusTarget | null) =>
    afterRender(() => {
      const element = target();
      if (element && element.isConnected !== false) element.focus();
    });
  return {
    open(trigger: FocusTarget | null, destination: () => FocusTarget | null) {
      origin = trigger;
      move(destination);
    },
    close() {
      const target = origin;
      move(() => target);
    },
    move,
  };
}
