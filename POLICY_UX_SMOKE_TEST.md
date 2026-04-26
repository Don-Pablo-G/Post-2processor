# Policy UX Smoke Test

Use this quick checklist after policy-preset UI changes in `apps/desktop`.

## Preconditions

- Run desktop app (`npm run dev`) in Node-capable runtime.
- Start with no unsaved local edits in UI state.

## Checklist

1. **Controller bootstrap defaults**
   - Load Haas-style code -> preset auto-resolves to `balanced` when no saved default exists.
   - Load Fanuc-style code -> preset auto-resolves to `strict` when no saved default exists.

2. **Preset source badge and helper**
   - Verify source label shows one of `saved | bootstrap | manual`.
   - Hover info icon (`ⓘ`) and confirm source meanings are shown.
   - When source is `manual`, badge uses highlighted styling.

3. **Save/revert actions**
   - Change preset manually -> unsaved override panel appears.
   - Click **Save this preset as default** -> source becomes `saved`.
   - Click **Revert to controller default preset** -> source becomes `bootstrap` and preset matches controller default.

4. **Save + run workflow**
   - With unsaved override active, click **Save preset and run Job Check**.
   - Confirm preset is persisted and Job Check result updates.

5. **Keyboard shortcuts**
   - Press `Ctrl+Shift+R` (outside input fields) -> revert to controller default.
   - Press `Ctrl+Shift+J` with unsaved override active -> save + run.
   - Verify shortcuts do not trigger while typing in input/textarea/select.

6. **Drift warning**
   - Keep manual override active.
   - Change code so detected controller changes (e.g., Haas -> Fanuc).
   - Confirm drift warning appears with previous -> next controller.

7. **Policy context copy/export**
   - Click **Copy policy context** and verify clipboard text includes preset/source/controller.
   - Export artifacts and verify:
     - export status includes `preset`, `source`, and `controller`,
     - timeline/findings headers include `policyPreset` and `policyPresetSource`,
     - setup sheet includes a **Policy Context** section.

8. **Events toggle**
   - Turn off **Enable local policy UI events**.
   - Repeat one preset action and verify no local policy events are emitted.
   - Turn it back on and verify events resume.

## Pass Criteria

- All checks complete without runtime errors.
- No regressions in `npm run verify`.
