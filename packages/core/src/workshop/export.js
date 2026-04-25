export async function exportWorkshopArtifacts(input) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const timestamp = buildTimestamp();
    const safeBase = sanitizeName(input.baseName ?? "program");
    const exportDirectory = path.join(input.baseDirectory, "exports", `${safeBase}_${timestamp}`);
    await fs.mkdir(exportDirectory, { recursive: true });
    const setupTxtPath = path.join(exportDirectory, `${safeBase}_setup.txt`);
    const setupMdPath = path.join(exportDirectory, `${safeBase}_setup.md`);
    const proveoutNcPath = path.join(exportDirectory, `${safeBase}_proveout.nc`);
    const fixtureSummaryTxtPath = path.join(exportDirectory, `${safeBase}_fixtures_summary.txt`);
    const fixtureSummaryMdPath = path.join(exportDirectory, `${safeBase}_fixtures_summary.md`);
    const timelineTxtPath = path.join(exportDirectory, `${safeBase}_timeline.txt`);
    const timelineMdPath = path.join(exportDirectory, `${safeBase}_timeline.md`);
    const findingsTxtPath = path.join(exportDirectory, `${safeBase}_findings.txt`);
    const findingsMdPath = path.join(exportDirectory, `${safeBase}_findings.md`);
    await fs.writeFile(setupTxtPath, input.setupSheetTxt, "utf8");
    await fs.writeFile(setupMdPath, input.setupSheetMarkdown, "utf8");
    await fs.writeFile(proveoutNcPath, input.proveoutCode, "utf8");
    if (input.fixtureSummaryTxt) {
        await fs.writeFile(fixtureSummaryTxtPath, input.fixtureSummaryTxt, "utf8");
    }
    if (input.fixtureSummaryMarkdown) {
        await fs.writeFile(fixtureSummaryMdPath, input.fixtureSummaryMarkdown, "utf8");
    }
    if (input.timelineTxt) {
        await fs.writeFile(timelineTxtPath, input.timelineTxt, "utf8");
    }
    if (input.timelineMarkdown) {
        await fs.writeFile(timelineMdPath, input.timelineMarkdown, "utf8");
    }
    if (input.findingsTxt) {
        await fs.writeFile(findingsTxtPath, input.findingsTxt, "utf8");
    }
    if (input.findingsMarkdown) {
        await fs.writeFile(findingsMdPath, input.findingsMarkdown, "utf8");
    }
    const artifacts = [
        { kind: "setup_txt", path: setupTxtPath },
        { kind: "setup_md", path: setupMdPath },
        { kind: "proveout_nc", path: proveoutNcPath }
    ];
    if (input.fixtureSummaryTxt) {
        artifacts.push({ kind: "fixture_summary_txt", path: fixtureSummaryTxtPath });
    }
    if (input.fixtureSummaryMarkdown) {
        artifacts.push({ kind: "fixture_summary_md", path: fixtureSummaryMdPath });
    }
    if (input.timelineTxt) {
        artifacts.push({ kind: "timeline_txt", path: timelineTxtPath });
    }
    if (input.timelineMarkdown) {
        artifacts.push({ kind: "timeline_md", path: timelineMdPath });
    }
    if (input.findingsTxt) {
        artifacts.push({ kind: "findings_txt", path: findingsTxtPath });
    }
    if (input.findingsMarkdown) {
        artifacts.push({ kind: "findings_md", path: findingsMdPath });
    }
    return {
        exportDirectory,
        artifacts
    };
}
function sanitizeName(value) {
    const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
    return cleaned.length > 0 ? cleaned : "program";
}
function buildTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}
//# sourceMappingURL=export.js.map