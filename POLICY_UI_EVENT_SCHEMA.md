# Policy UI Event Schema

Local desktop UI emits policy-preset interaction events via:

- Browser event name: `cnc:policy-preset-ui`
- Transport: `window.dispatchEvent(new CustomEvent(...))`
- Scope: local only (no network sending by default)

## Payload

```json
{
  "event": "manual_selection_changed",
  "controller": "haas-ngc",
  "preset": "strict",
  "source": "manual",
  "timestampIso": "2026-04-26T19:00:00.000Z"
}
```

### Fields

- `event`: string event id (see list below)
- `controller`: `"haas-ngc" | "haas-legacy" | "fanuc"`
- `preset`: `"strict" | "balanced" | "permissive"`
- `source`: `"saved" | "bootstrap" | "manual"`
- `timestampIso`: ISO-8601 timestamp string

## Emitted Event IDs

- `saved_default_loaded`
- `bootstrap_default_applied`
- `manual_selection_changed`
- `saved_to_template`
- `save_and_run_invoked`
- `reverted_to_controller_default`
- `reverted_to_controller_default_shortcut`

## Integration Notes

- Event emission can be toggled in desktop UI with **Enable local policy UI events**.
- If the toggle is off, no custom events are emitted.
- Consumers should treat unknown `event` values as forward-compatible additions.
