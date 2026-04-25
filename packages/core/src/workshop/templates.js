const TEMPLATES = [
    {
        id: "face-basic",
        name: "Facing - basic",
        description: "Quick facing cycle skeleton with safe start.",
        code: `%
O9001 (FACING TEMPLATE)
G90 G17 G40 G49 G80
G54
T1 M6
S2500 M3
G0 G43 H1 Z50.
G0 X0. Y0.
G1 Z2. F300.
X100.
Y50.
X0.
G0 Z100.
M30
%`
    },
    {
        id: "drill-grid",
        name: "Drilling - grid",
        description: "Canned cycle starter for repeated drilling points.",
        code: `%
O9002 (DRILL GRID TEMPLATE)
G90 G17 G40 G49 G80
G54
T5 M6
S1800 M3
G0 G43 H5 Z50.
G99 G83 X0. Y0. Z-15. R2. Q3. F180.
X20. Y0.
X20. Y20.
X0. Y20.
G80
G0 Z100.
M30
%`
    }
];
const DEFAULT_SETTINGS = {
    parameterDefaults: {
        "haas-ngc": {
            presetId: "haas-ngc-safe",
            startAt: 100,
            blacklistedParameters: buildRange(500, 999)
        },
        "haas-legacy": {
            presetId: "haas-legacy-safe",
            startAt: 100,
            blacklistedParameters: buildRange(500, 999)
        },
        fanuc: {
            presetId: "fanuc-safe",
            startAt: 100,
            blacklistedParameters: [...buildRange(500, 999), ...buildRange(1000, 1999)]
        }
    }
};
export function listProgramTemplates() {
    return TEMPLATES;
}
export function exportTemplateLibrary(templates = TEMPLATES) {
    return {
        templates,
        settings: DEFAULT_SETTINGS,
        sourceJson: JSON.stringify({ templates, settings: DEFAULT_SETTINGS }, null, 2)
    };
}
export function importTemplateLibrary(sourceJson) {
    try {
        const parsed = JSON.parse(sourceJson);
        const templates = (parsed.templates ?? []).filter(isValidTemplate);
        const settings = sanitizeSettings(parsed.settings);
        return {
            templates,
            settings,
            sourceJson: JSON.stringify({ templates, settings }, null, 2)
        };
    }
    catch {
        return {
            templates: TEMPLATES,
            settings: DEFAULT_SETTINGS,
            sourceJson: JSON.stringify({ templates: TEMPLATES, settings: DEFAULT_SETTINGS }, null, 2)
        };
    }
}
function isValidTemplate(value) {
    return Boolean(value?.id && value?.name && value?.description && value?.code);
}
function sanitizeSettings(settings) {
    const defaults = settings?.parameterDefaults ?? DEFAULT_SETTINGS?.parameterDefaults ?? {};
    const sanitized = {};
    for (const [profile, value] of Object.entries(defaults)) {
        sanitized[profile] = {
            presetId: value?.presetId,
            startAt: Number.isInteger(value?.startAt) ? value?.startAt : 100,
            blacklistedParameters: (value?.blacklistedParameters ?? [])
                .filter((n) => Number.isInteger(n) && n >= 1)
                .map((n) => Math.trunc(n))
        };
    }
    return { parameterDefaults: sanitized };
}
function buildRange(from, to) {
    const out = [];
    for (let i = from; i <= to; i += 1)
        out.push(i);
    return out;
}
//# sourceMappingURL=templates.js.map