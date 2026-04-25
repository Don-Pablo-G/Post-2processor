export function buildTimelineFindingsExportBundle(input) {
    const headerTxt = [
        "WORKSHOP TIMELINE + FINDINGS",
        `timestamp: ${input.timestampIso}`,
        `controller: ${input.controller}`,
        `subprogramTargetPolicy: ${input.subprogramTargetPolicy ?? "n/a"}`,
        `logSemantics: ${input.logSemantics ?? "n/a"}`,
        `score: ${input.score ?? "n/a"}`,
        ""
    ];
    const headerMd = [
        "# Workshop Timeline + Findings",
        "",
        `- Timestamp: ${input.timestampIso}`,
        `- Controller: ${input.controller}`,
        `- Subprogram target policy: ${input.subprogramTargetPolicy ?? "n/a"}`,
        `- LOG semantics: ${input.logSemantics ?? "n/a"}`,
        `- Score: ${input.score ?? "n/a"}`,
        ""
    ];
    const timelineLines = input.timelineEntries.map((event) => `${eventTag(event.kind)} B${event.blockIndex}: [${event.kind}] ${event.message}`);
    const findingLines = input.findings.map((f) => {
        const block = f.blockIndex !== undefined ? `B${f.blockIndex}` : "B?";
        return `[${f.severity.toUpperCase()}] ${f.code} @ ${block}: ${f.message}`;
    });
    return {
        timelineTxt: [...headerTxt, "TIMELINE", ...(timelineLines.length > 0 ? timelineLines : ["- none"])].join("\n"),
        timelineMarkdown: [
            ...headerMd,
            "## Timeline",
            ...(timelineLines.length > 0 ? timelineLines.map((l) => `- ${l}`) : ["- none"])
        ].join("\n"),
        findingsTxt: [...headerTxt, "FINDINGS", ...(findingLines.length > 0 ? findingLines : ["- none"])].join("\n"),
        findingsMarkdown: [
            ...headerMd,
            "## Findings",
            ...(findingLines.length > 0 ? findingLines.map((l) => `- ${l}`) : ["- none"])
        ].join("\n")
    };
}
function eventTag(kind) {
    if (kind === "alarm" || kind === "message_stop")
        return "[ALARM]";
    if (kind === "subprogram_call" || kind === "subprogram_return" || kind === "subprogram_repeat")
        return "[FLOW]";
    return "[CONTROL]";
}
//# sourceMappingURL=exportBundle.js.map