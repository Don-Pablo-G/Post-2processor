# Policy UI Event Schema

Local desktop UI emits policy-preset interaction events via:

- Browser event name: `cnc:policy-preset-ui`
- Transport: `window.dispatchEvent(new CustomEvent(...))`
- Scope: local only (no network sending by default)

## Payload

```json
{
  "schemaVersion": 1,
  "event": "manual_selection_changed",
  "controller": "haas-ngc",
  "preset": "strict",
  "source": "manual",
  "timestampIso": "2026-04-26T19:00:00.000Z"
}
```

### Fields

- `event`: string event id (see list below)
- `schemaVersion`: numeric payload schema version (`1` currently)
- `controller`: `"haas-ngc" | "haas-legacy" | "fanuc"`
- `preset`: `"strict" | "balanced" | "permissive"`
- `source`: `"saved" | "bootstrap" | "manual"`
- `timestampIso`: ISO-8601 timestamp string

## Emitted Event IDs

Events are emitted from `apps/desktop/src/App.tsx` via `recordPolicyPresetTransition` (same payload shape as above). Grouped by intent; treat any unknown `event` string as forward-compatible.

### Preset lifecycle

- `saved_default_loaded` — persisted UI defaults included a saved policy preset for the controller.
- `bootstrap_default_applied` — controller bootstrap default preset applied (e.g. fresh session / template path).
- `manual_selection_changed` — operator changed the preset dropdown.
- `saved_to_template` — preset (and related prefs) written into template JSON.
- `save_and_run_invoked` — save-and-run Job Check shortcut or button path invoked.
- `reverted_to_controller_default` — revert to controller default via UI control.
- `reverted_to_controller_default_shortcut` — same as revert, via Ctrl+Shift+R when not blocked by lock/typing context.

### Clipboard / operator handoff (Job Check panel)

- `job_check_status_copied` — copied Job Check status line (includes telemetry line in UI; this event marks the action).
- `job_check_findings_summary_copied` — copied status plus findings counts / top codes.
- `operator_handoff_bundle_copied` — copied broader handoff bundle (status, findings, export, drift).
- `machine_safe_startup_brief_copied` — copied machine-safe startup brief.
- `first_cut_risk_brief_copied` — copied first-cut risk brief only.
- `first_cut_risk_brief_with_policy_copied` — copied risk brief plus policy context line.
- `first_cut_risk_brief_with_job_check_copied` — copied Job Check status line plus risk brief block.

## Integration Notes

- Event emission can be toggled in desktop UI with **Enable local policy UI events**.
- If the toggle is off, no custom events are emitted.
- Consumers should treat unknown `event` values as forward-compatible additions.

## Migration Note

- Current payloads include `schemaVersion: 1`.
- If you consumed older payloads, treat missing `schemaVersion` as version `0` and continue parsing shared fields (`event`, `controller`, `preset`, `source`, `timestampIso`).
- Consumers should ignore unknown fields to remain forward-compatible with future schema updates.
