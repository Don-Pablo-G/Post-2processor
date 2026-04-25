import { simpleFormat } from "./formatter/simpleFormatter.js";
import { simpleLint } from "./lints/simpleLint.js";
import { simpleParameterize } from "./parameterizer/suggest.js";
import { simpleParse } from "./parser/simpleParser.js";
import { simpleSimulate } from "./simulator/simpleSimulator.js";
import { buildToolingReport } from "./tooling/report.js";
import { analyzeProgram as analyzeProgramInternal } from "./workshop/advisor.js";
import { exportWorkshopArtifacts } from "./workshop/export.js";
import { buildTimelineFindingsExportBundle as buildTimelineFindingsExportBundleInternal } from "./workshop/exportBundle.js";
import { getParameterReserveProfiles } from "./workshop/parameterProfiles.js";
import { applyProveoutMarkers, buildProveoutProgram, removeProveoutMarkers } from "./workshop/proveout.js";
import { runJobCheckWorkflow } from "./workshop/runJobCheck.js";
import { analyzeShopFixtures as analyzeShopFixturesInternal, applyShopFixtureAutoFixes as applyShopFixtureAutoFixesInternal, importShopFixture as importShopFixtureInternal, previewShopFixtureAutoFixes as previewShopFixtureAutoFixesInternal, restoreShopFixtureManifestBackup as restoreShopFixtureManifestBackupInternal, runShopRegressionTests as runShopRegressionTestsInternal, validateShopFixturesManifest as validateShopFixturesManifestInternal } from "./workshop/shopFixtures.js";
import { generateSetupSheet } from "./workshop/setupSheet.js";
import { exportTemplateLibrary, importTemplateLibrary, listProgramTemplates } from "./workshop/templates.js";
export function parse(code, profile) {
    return simpleParse(code, profile.id);
}
export function format(ast, profile, style) {
    return simpleFormat(ast, { ...profile.defaultFormatStyle, ...style });
}
export function parameterize(ast, options) {
    return simpleParameterize(ast, options);
}
export function simulate(ast, initialState, limits) {
    return simpleSimulate(ast, initialState, limits);
}
export function lint(ast, profile) {
    const commonIssues = simpleLint(ast);
    const profileIssues = profile.validateAst ? profile.validateAst(ast) : [];
    return [...commonIssues, ...profileIssues];
}
export function toolingReport(ast, initialState, options) {
    return buildToolingReport(ast, initialState, options);
}
export function analyzeProgram(ast, initialState, options) {
    return analyzeProgramInternal(ast, initialState, options);
}
export function getProgramTemplates() {
    return listProgramTemplates();
}
export function getTemplateLibrary() {
    return exportTemplateLibrary();
}
export function parseTemplateLibrary(sourceJson) {
    return importTemplateLibrary(sourceJson);
}
export function parameterReserveProfiles() {
    return getParameterReserveProfiles();
}
export function buildSetupSheet(ast, initialState) {
    return generateSetupSheet(ast, initialState);
}
export function proveoutProgram(ast, initialState) {
    return buildProveoutProgram(ast, initialState);
}
export function applyProveout(code, markerLines) {
    return applyProveoutMarkers(code, markerLines);
}
export function removeProveout(code) {
    return removeProveoutMarkers(code);
}
export async function exportWorkshopFiles(input) {
    return exportWorkshopArtifacts(input);
}
export function buildTimelineFindingsExportBundle(input) {
    return buildTimelineFindingsExportBundleInternal(input);
}
export async function runJobCheck(input) {
    return runJobCheckWorkflow(input);
}
export async function importShopFixture(input) {
    return importShopFixtureInternal(input);
}
export async function validateShopFixturesManifest(input) {
    return validateShopFixturesManifestInternal(input);
}
export async function runShopRegressionTests(input) {
    return runShopRegressionTestsInternal(input);
}
export async function analyzeShopFixtureHealth(input) {
    return analyzeShopFixturesInternal(input);
}
export async function previewShopFixtureAutoFixes(input) {
    return previewShopFixtureAutoFixesInternal(input);
}
export async function applyShopFixtureAutoFixes(input) {
    return applyShopFixtureAutoFixesInternal(input);
}
export async function restoreShopFixtureManifestBackup(input) {
    return restoreShopFixtureManifestBackupInternal(input);
}
//# sourceMappingURL=api.js.map