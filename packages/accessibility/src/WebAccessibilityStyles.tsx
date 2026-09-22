/** Web-only forced-color and keyboard-focus policy. Native renderers ignore the style element. */
export function ExpoBaseWebAccessibilityStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      :focus-visible { outline: 2px solid Highlight !important; outline-offset: 2px; }
      @media (forced-colors: active) {
        [role="button"], [role="link"], [role="checkbox"], [role="radio"],
        [role="switch"], [role="combobox"], [role="dialog"], [role="menuitem"] {
          forced-color-adjust: auto;
        }
        [aria-selected="true"], [aria-checked="true"], [aria-pressed="true"],
        [aria-expanded="true"] { outline: 2px solid Highlight; outline-offset: -2px; }
        [aria-invalid="true"], [role="alert"] { border-color: Mark !important; }
      }
    ` }} />
  );
}
