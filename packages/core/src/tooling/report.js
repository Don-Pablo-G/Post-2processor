import { simpleSimulate } from "../simulator/simpleSimulator.js";
export function buildToolingReport(ast, initialState, options) {
    const autoSelectToolComments = options?.autoSelectToolComments ?? true;
    const simulation = simpleSimulate(ast, initialState, {
        maxSteps: 200000,
        maxLoopIterations: 10000,
        rapidRateMmPerMin: options?.rapidRateMmPerMin
    });
    const tools = new Map();
    const warnings = [...simulation.warnings];
    warnings.push(...collectDStyleWarnings(ast, options));
    let activeTool = null;
    let currentOrientation = { a: 0, b: 0, c: 0 };
    let currentWorkOffset = "UNKNOWN";
    const workOffsetsSeen = new Set();
    const toolCommentCandidates = collectToolCommentCandidates(ast);
    const pendingToolComp = new Map();
    let programLowestZ = Number.POSITIVE_INFINITY;
    for (const entry of simulation.trace) {
        const code = cleanCode(entry.raw).toUpperCase();
        const words = parseWords(code);
        const vars = entry.variableSnapshot;
        currentOrientation = updateOrientation(currentOrientation, words, vars);
        currentWorkOffset = detectWorkOffset(words, vars) ?? currentWorkOffset;
        workOffsetsSeen.add(currentWorkOffset);
        const toolInBlock = getLastValue(words, "T", vars);
        if (toolInBlock !== null)
            activeTool = Math.trunc(toolInBlock);
        const hOffset = getLastValue(words, "H", vars);
        const dOffset = getLastValue(words, "D", vars);
        const hOffsetParameter = getLastParameterRef(words, "H");
        const dOffsetParameter = getLastParameterRef(words, "D");
        if (activeTool !== null && (hOffset !== null || dOffset !== null || hOffsetParameter || dOffsetParameter)) {
            const comp = pendingToolComp.get(activeTool) ?? {};
            if (hOffset !== null)
                comp.hOffset = Math.trunc(hOffset);
            if (dOffset !== null)
                comp.dOffset = Math.trunc(dOffset);
            if (hOffsetParameter)
                comp.hOffsetParameter = hOffsetParameter;
            if (dOffsetParameter)
                comp.dOffsetParameter = dOffsetParameter;
            pendingToolComp.set(activeTool, comp);
        }
        const z = getLastValue(words, "Z", vars);
        if (z !== null) {
            programLowestZ = Math.min(programLowestZ, z);
            if (activeTool !== null) {
                const existing = tools.get(activeTool);
                if (!existing) {
                    const pending = pendingToolComp.get(activeTool);
                    tools.set(activeTool, {
                        toolNumber: activeTool,
                        firstSeenBlock: entry.blockIndex,
                        hOffset: pending?.hOffset ?? (hOffset !== null ? Math.trunc(hOffset) : undefined),
                        hOffsetParameter: pending?.hOffsetParameter ?? hOffsetParameter,
                        dOffset: pending?.dOffset ?? (dOffset !== null ? Math.trunc(dOffset) : undefined),
                        dOffsetParameter: pending?.dOffsetParameter ?? dOffsetParameter,
                        toolCommentCandidates: toolCommentCandidates.get(activeTool) ?? [],
                        selectedToolComment: pickSelectedToolComment(options?.toolCommentSelections?.[activeTool], toolCommentCandidates.get(activeTool) ?? [], autoSelectToolComments),
                        workOffsetsUsed: [currentWorkOffset],
                        lowestZ: z,
                        orientationAtLowestZ: currentOrientation
                    });
                }
                else if (z < existing.lowestZ) {
                    existing.lowestZ = z;
                    existing.orientationAtLowestZ = currentOrientation;
                    if (hOffset !== null)
                        existing.hOffset = Math.trunc(hOffset);
                    if (dOffset !== null)
                        existing.dOffset = Math.trunc(dOffset);
                    if (hOffsetParameter)
                        existing.hOffsetParameter = existing.hOffsetParameter ?? hOffsetParameter;
                    if (dOffsetParameter)
                        existing.dOffsetParameter = existing.dOffsetParameter ?? dOffsetParameter;
                    if (!existing.workOffsetsUsed.includes(currentWorkOffset))
                        existing.workOffsetsUsed.push(currentWorkOffset);
                }
                else {
                    if (hOffset !== null)
                        existing.hOffset = existing.hOffset ?? Math.trunc(hOffset);
                    if (dOffset !== null)
                        existing.dOffset = existing.dOffset ?? Math.trunc(dOffset);
                    if (hOffsetParameter)
                        existing.hOffsetParameter = existing.hOffsetParameter ?? hOffsetParameter;
                    if (dOffsetParameter)
                        existing.dOffsetParameter = existing.dOffsetParameter ?? dOffsetParameter;
                    if (!existing.workOffsetsUsed.includes(currentWorkOffset))
                        existing.workOffsetsUsed.push(currentWorkOffset);
                }
            }
        }
    }
    if (!Number.isFinite(programLowestZ)) {
        programLowestZ = 0;
        warnings.push("No Z words found in executed path.");
    }
    const list = Array.from(tools.values()).sort((a, b) => a.toolNumber - b.toolNumber);
    if (options?.fiveAxis?.enabled && options.fiveAxis.machine === "umc") {
        const gauge = options.fiveAxis.holderGaugeLengthMm ?? 100;
        const safety = options.fiveAxis.safetyClearanceMm ?? 10;
        for (const tool of list) {
            const tilt = combinedTiltRadians(tool.orientationAtLowestZ);
            const projected = Math.max(0.2, Math.cos(tilt));
            tool.estimatedStickoutMm = Math.max(0, Math.abs(tool.lowestZ) + safety) / projected + gauge;
        }
    }
    const setupInstructions = buildSetupInstructions(list, Array.from(workOffsetsSeen).sort(), options);
    return {
        tools: list,
        programLowestZ,
        workOffsetsSeen: Array.from(workOffsetsSeen).sort(),
        setupInstructions,
        warnings,
        printable80mm: render80mmReport(list, programLowestZ, Array.from(workOffsetsSeen).sort(), setupInstructions, warnings, options)
    };
}
function collectDStyleWarnings(ast, options) {
    const issues = [];
    const style = options?.dOffsetCallStyle ?? "haas_g43_d_with_h_only";
    ast.blocks.forEach((block, index) => {
        const code = cleanCode(block.raw).toUpperCase();
        const words = parseWords(code);
        const hasD = words.some((w) => w.letter === "D");
        const hasG43 = /\bG\s*43\b/.test(code);
        const hasG41orG42 = /\bG\s*4[12]\b/.test(code);
        const hasG40 = /\bG\s*40\b/.test(code);
        const hasH = words.some((w) => w.letter === "H");
        const dValue = getLastValue(words, "D", {});
        if (style === "haas_g43_d_with_h_only") {
            if (hasD && !(hasG43 && hasH)) {
                issues.push(`D offset call outside G43 H block at block ${index}: "${block.raw.trim()}"`);
            }
            if (hasG41orG42 && hasD) {
                issues.push(`Haas style expects no D on G41/G42 at block ${index}: "${block.raw.trim()}"`);
            }
            if (hasG43 && hasH && !hasD) {
                issues.push(`Haas style expects D on G43 H line at block ${index}: "${block.raw.trim()}"`);
            }
            return;
        }
        // fanuc_wear_on_g41_g42_with_g40_d00
        if (hasG43 && hasD) {
            issues.push(`Fanuc style expects no D on G43 H line at block ${index}: "${block.raw.trim()}"`);
        }
        if (hasG41orG42 && !hasD) {
            issues.push(`Fanuc style expects D on G41/G42 line at block ${index}: "${block.raw.trim()}"`);
        }
        if (hasG40 && (!hasD || (dValue !== null && Math.trunc(dValue) !== 0))) {
            issues.push(`Fanuc style expects G40 with D00 at block ${index}: "${block.raw.trim()}"`);
        }
    });
    return issues;
}
function cleanCode(raw) {
    return raw.replace(/\([^)]*\)/g, "").replace(/;.*$/g, "").trim();
}
function parseWords(code) {
    return Array.from(code.matchAll(/([A-Z])\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+|\#\d+|\[[^\]]+\]))/g)).map((m) => ({ letter: m[1], value: m[2] }));
}
function evalNumeric(token, vars) {
    if (/^#\d+$/.test(token))
        return vars[token] ?? 0;
    if (/^[+\-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(token))
        return Number(token);
    return Number.NaN;
}
function getLastValue(words, letter, vars) {
    const match = words.filter((w) => w.letter === letter).at(-1);
    if (!match)
        return null;
    const value = evalNumeric(match.value, vars);
    return Number.isFinite(value) ? value : null;
}
function getLastParameterRef(words, letter) {
    const match = words.filter((w) => w.letter === letter).at(-1);
    if (!match)
        return undefined;
    const value = match.value.trim();
    const direct = value.match(/^(#\d+)$/);
    if (direct)
        return direct[1];
    const bracketed = value.match(/^\[\s*(#\d+)\s*\]$/);
    if (bracketed)
        return bracketed[1];
    return undefined;
}
function detectWorkOffset(words, vars) {
    const gValues = words
        .filter((w) => w.letter === "G")
        .map((w) => Math.trunc(evalNumeric(w.value, vars)))
        .filter((v) => Number.isFinite(v));
    const standard = gValues.find((g) => g >= 54 && g <= 59);
    if (standard !== undefined)
        return `G${standard}`;
    const g154 = gValues.find((g) => g === 154);
    if (g154 !== undefined) {
        const p = getLastValue(words, "P", vars);
        if (p !== null)
            return `G154 P${Math.trunc(p)}`;
        return "G154";
    }
    return null;
}
function updateOrientation(base, words, vars) {
    const a = getLastValue(words, "A", vars);
    const b = getLastValue(words, "B", vars);
    const c = getLastValue(words, "C", vars);
    return {
        a: a ?? base.a,
        b: b ?? base.b,
        c: c ?? base.c
    };
}
function combinedTiltRadians(orientation) {
    if (!orientation)
        return 0;
    const b = (orientation.b * Math.PI) / 180;
    const c = (orientation.c * Math.PI) / 180;
    return Math.sqrt(b * b + c * c);
}
function render80mmReport(tools, programLowestZ, workOffsetsSeen, setupInstructions, warnings, options) {
    const width = 42;
    const lines = [];
    lines.push(center("SETTER REPORT", width));
    lines.push("-".repeat(width));
    lines.push(pad(`PROGRAM LOWEST Z: ${programLowestZ.toFixed(3)} mm`, width));
    lines.push(pad(`TOOLS: ${tools.length}`, width));
    lines.push(pad(`WCS: ${workOffsetsSeen.join(", ") || "UNKNOWN"}`, width));
    if (options?.fiveAxis?.enabled)
        lines.push(pad(`MODE: ${options.fiveAxis.machine.toUpperCase()}`, width));
    lines.push("-".repeat(width));
    lines.push(pad("TOOL H/D PARAMS   WCS       LOWEST Z", width));
    lines.push("-".repeat(width));
    for (const tool of tools) {
        if (tool.selectedToolComment) {
            lines.push(pad(`T${tool.toolNumber} NAME: ${tool.selectedToolComment}`, width));
        }
        const toolStr = `T${tool.toolNumber}`.padEnd(4, " ");
        const hRef = tool.hOffsetParameter ?? (tool.hOffset !== undefined ? `H${tool.hOffset}` : "H-");
        const dRef = tool.dOffsetParameter ?? (tool.dOffset !== undefined ? `D${tool.dOffset}` : "D-");
        const hdStr = `${hRef}/${dRef}`.padEnd(13, " ");
        const wcs = (tool.workOffsetsUsed[0] ?? "UNK").padEnd(9, " ");
        const zStr = `${tool.lowestZ.toFixed(3)}`.padEnd(10, " ");
        lines.push(pad(`${toolStr}${hdStr}${wcs}${zStr}`, width));
        if (tool.estimatedStickoutMm) {
            lines.push(pad(`     STICKOUT TARGET: ${tool.estimatedStickoutMm.toFixed(2)} mm`, width));
        }
    }
    if (setupInstructions.length > 0) {
        lines.push("-".repeat(width));
        lines.push(pad("SETUP STEPS:", width));
        for (const line of setupInstructions.slice(0, 12)) {
            lines.push(pad(`- ${line}`, width));
        }
    }
    if (warnings.length > 0) {
        lines.push("-".repeat(width));
        lines.push(pad("WARNINGS:", width));
        for (const warning of warnings.slice(0, 5)) {
            lines.push(pad(`- ${warning}`, width));
        }
    }
    lines.push("-".repeat(width));
    lines.push(center("END OF REPORT", width));
    return lines.join("\n");
}
function collectToolCommentCandidates(ast) {
    const byTool = new Map();
    let orderCounter = 0;
    ast.blocks.forEach((block, index) => {
        const code = cleanCode(block.raw).toUpperCase();
        const tMatch = code.match(/\bT\s*(\d+)/);
        if (!tMatch)
            return;
        const toolNumber = Number(tMatch[1]);
        const scored = byTool.get(toolNumber) ?? [];
        const windowStart = Math.max(0, index - 2);
        const windowEnd = Math.min(ast.blocks.length - 1, index + 1);
        for (let i = windowStart; i <= windowEnd; i += 1) {
            const raw = ast.blocks[i].raw;
            const relative = i - index;
            const baseScore = relative === 0 ? 0 : relative === -1 ? 1 : relative === -2 ? 2 : 3;
            for (const c of extractComments(raw)) {
                if (looksLikeToolName(c)) {
                    scored.push({ comment: c, score: baseScore, order: orderCounter });
                    orderCounter += 1;
                }
            }
        }
        byTool.set(toolNumber, scored);
    });
    const result = new Map();
    for (const [tool, list] of byTool.entries()) {
        const dedup = new Map();
        for (const item of list) {
            const key = item.comment.toUpperCase();
            const existing = dedup.get(key);
            if (!existing || item.score < existing.score || (item.score === existing.score && item.order < existing.order)) {
                dedup.set(key, { score: item.score, order: item.order });
            }
        }
        const ordered = Array.from(dedup.entries())
            .sort((a, b) => a[1].score - b[1].score || a[1].order - b[1].order)
            .map(([comment]) => comment)
            .slice(0, 8);
        result.set(tool, ordered);
    }
    return result;
}
function extractComments(raw) {
    const comments = [];
    for (const m of raw.matchAll(/\(([^)]{1,120})\)/g)) {
        comments.push(m[1].trim());
    }
    const semicolon = raw.match(/;(.+)$/);
    if (semicolon)
        comments.push(semicolon[1].trim());
    return comments;
}
function looksLikeToolName(comment) {
    const upper = comment.toUpperCase();
    if (upper.includes("OPTIONAL STOP"))
        return false;
    if (/^M0?1$/.test(upper))
        return false;
    if (/^(CHECK|VERIFY|NOTE)\b/.test(upper))
        return false;
    return comment.length >= 2;
}
function pickSelectedToolComment(explicitSelection, candidates, autoSelectEnabled) {
    if (explicitSelection && explicitSelection.trim().length > 0)
        return explicitSelection;
    if (!autoSelectEnabled)
        return undefined;
    return candidates[0];
}
function buildSetupInstructions(tools, workOffsetsSeen, options) {
    if (options?.includeSetupInstructions === false)
        return [];
    const lines = [];
    lines.push(`Verify work offsets: ${workOffsetsSeen.join(", ") || "UNKNOWN"}.`);
    for (const tool of tools) {
        const hTarget = tool.hOffset ?? tool.toolNumber;
        const hRef = tool.hOffsetParameter ?? `H${hTarget}`;
        const dRef = tool.dOffsetParameter ?? (tool.dOffset !== undefined ? `D${tool.dOffset}` : "D<set>");
        const stickout = tool.estimatedStickoutMm
            ? `Target stickout ${tool.estimatedStickoutMm.toFixed(2)} mm.`
            : `Set protrusion to safely reach Z${tool.lowestZ.toFixed(3)}.`;
        lines.push(`Load T${tool.toolNumber}; verify ${hRef} and ${dRef}. ${stickout}`);
    }
    if (options?.fiveAxis?.enabled && options.fiveAxis.machine === "umc") {
        lines.push("On UMC, verify B/C orientation clearances before first cut.");
    }
    lines.push("Run dry cycle with feed override <=25% before production.");
    return lines;
}
function pad(value, width) {
    return value.length >= width ? value.slice(0, width) : value.padEnd(width, " ");
}
function center(value, width) {
    if (value.length >= width)
        return value.slice(0, width);
    const left = Math.floor((width - value.length) / 2);
    const right = width - value.length - left;
    return `${" ".repeat(left)}${value}${" ".repeat(right)}`;
}
//# sourceMappingURL=report.js.map