const PRESETS = [
    {
        id: "haas-ngc-safe",
        label: "Haas NGC - safe local macros",
        controller: "haas_ngc",
        startAt: 100,
        blacklistedParameters: buildRange(500, 999),
        notes: "Avoids common global/system-style macro ranges in many shop conventions."
    },
    {
        id: "haas-legacy-safe",
        label: "Haas Legacy - safe local macros",
        controller: "haas_legacy",
        startAt: 100,
        blacklistedParameters: buildRange(500, 999),
        notes: "Keeps assignments in #100+ while skipping #500+ persistent blocks."
    },
    {
        id: "fanuc-safe",
        label: "Fanuc - conservative local macros",
        controller: "fanuc",
        startAt: 100,
        blacklistedParameters: [...buildRange(500, 999), ...buildRange(1000, 1999)],
        notes: "Conservative preset to avoid common persistent/system-like regions."
    }
];
export function getParameterReserveProfiles() {
    return PRESETS;
}
function buildRange(from, to) {
    const out = [];
    for (let i = from; i <= to; i += 1)
        out.push(i);
    return out;
}
//# sourceMappingURL=parameterProfiles.js.map