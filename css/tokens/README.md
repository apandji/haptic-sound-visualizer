# SAIL Color System

Color tokens extracted from the [SAIL Pattern Library](https://apandji.github.io/haptic-sound-visualizer/).

## Usage

Load `colors.css` before other styles:

```html
<link rel="stylesheet" href="css/tokens/colors.css">
```

Then use CSS variables in your styles:

```css
.card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

.error-message {
  color: var(--color-error);
  background: var(--color-error-bg);
  border-left: 3px solid var(--color-error);
}
```

## Token Reference

| Category | Variables |
|----------|-----------|
| **Grayscale** | `--color-gray-0` → `--color-gray-975`, `--color-white` |
| **Backgrounds** | `--color-bg-page`, `--color-bg-surface`, `--color-bg-surface-alt`, `--color-bg-hover` |
| **Text** | `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-text-heading` |
| **Borders** | `--color-border`, `--color-border-strong`, `--color-border-subtle`, `--color-border-focus` |
| **Status** | `--color-success`, `--color-warning`, `--color-error`, `--color-error-alt` |

## Migration

To migrate existing hardcoded colors:
- `#333` → `var(--color-text-primary)` or `var(--color-gray-100)`
- `#666` → `var(--color-text-secondary)` or `var(--color-gray-200)`
- `#999` → `var(--color-text-tertiary)` or `var(--color-gray-300)`
- `#e0e0e0` → `var(--color-border)` or `var(--color-gray-700)`
- `#fafafa` → `var(--color-bg-page)` or `var(--color-gray-975)`
- `#fff` / `#ffffff` → `var(--color-bg-surface)` or `var(--color-white)`
- `#d32f2f` → `var(--color-error)`
