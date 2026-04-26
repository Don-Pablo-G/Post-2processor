import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const fixturesRoot = path.join(root, "packages", "test-fixtures");
const baselinesDir = path.join(fixturesRoot, "shop-regressions", "baselines");
const coreDistPath = path.join(root, "packages", "core", "dist", "src", "index.node.js");
const haasProfileDistPath = path.join(root, "packages", "profiles", "haas-ngc", "dist", "index.js");

function fail(message) {
  throw new Error(message);
}

async function ensureFileExists(filePath, hint) {
  try {
    await access(filePath);
  } catch {
    fail(`${hint}: ${path.relative(root, filePath)}`);
  }
}

function normalizeSummary(summary) {
  return {
    fixture: summary.fixture,
    controllerMode: summary.controllerMode,
    lintIssueCount: summary.lintIssueCount,
    lintIssues: summary.lintIssues,
    simulation: {
      halted: summary.simulation.halted,
      steps: summary.simulation.steps,
      estimatedCycleTimeSeconds: Number(summary.simulation.estimatedCycleTimeSeconds.toFixed(6)),
      warningCount: summary.simulation.warningCount,
      warnings: summary.simulation.warnings,
      alarmCount: summary.simulation.alarmCount,
      alarms: summary.simulation.alarms
    }
  };
}

function computeSummary(core, profile, source, fixtureRelPath, controllerMode) {
  const ast = core.parse(source, profile);
  const lintIssues = core.lint(ast, profile);
  const sim = core.simulate(ast, {}, { maxSteps: 3000, maxLoopIterations: 300, controllerMode });
  return normalizeSummary({
    fixture: fixtureRelPath,
    controllerMode,
    lintIssueCount: lintIssues.length,
    lintIssues: lintIssues.map((i) => ({ severity: i.severity, message: i.message })),
    simulation: {
      halted: sim.state.halted,
      steps: sim.state.steps,
      estimatedCycleTimeSeconds: sim.estimatedCycleTimeSeconds,
      warningCount: sim.warnings.length,
      warnings: sim.warnings,
      alarmCount: sim.alarms.length,
      alarms: sim.alarms
    }
  });
}

function modeFromController(value) {
  if (value === "haas-ngc" || value === "haas-legacy" || value === "fanuc") return value;
  fail(`Unsupported controller mode in baseline: ${String(value)}`);
}

async function main() {
  await ensureFileExists(coreDistPath, "Missing built core entry. Run npm run build first");
  await ensureFileExists(haasProfileDistPath, "Missing built Haas profile entry. Run npm run build first");

  const core = await import(pathToFileURL(coreDistPath).href);
  const haasProfilePkg = await import(pathToFileURL(haasProfileDistPath).href);
  const profile = haasProfilePkg.haasNgcProfile;
  if (!profile) fail("Failed to load haasNgcProfile from built profile package.");

  const entries = await readdir(baselinesDir, { withFileTypes: true });
  const baselineFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".baseline.json"))
    .map((entry) => path.join(baselinesDir, entry.name))
    .sort();
  if (baselineFiles.length === 0) fail("No baseline files found.");

  const driftMessages = [];
  for (const baselineFile of baselineFiles) {
    const baselineRaw = await readFile(baselineFile, "utf8");
    const baseline = JSON.parse(baselineRaw);
    if (!baseline.fixture || typeof baseline.fixture !== "string") {
      fail(`Baseline missing fixture field: ${path.relative(root, baselineFile)}`);
    }
    const controllerMode = modeFromController(baseline.controllerMode);
    const fixturePath = path.join(fixturesRoot, baseline.fixture);
    await ensureFileExists(fixturePath, "Fixture referenced by baseline not found");
    const source = await readFile(fixturePath, "utf8");
    const actual = computeSummary(core, profile, source, baseline.fixture, controllerMode);
    const expected = normalizeSummary(baseline);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      driftMessages.push(
        `${path.relative(root, baselineFile)} drifted (rerun smoke and refresh baseline JSON if change is intentional).`
      );
    }
  }

  if (driftMessages.length > 0) {
    process.stderr.write("Shop regression baseline drift detected:\n");
    for (const message of driftMessages) process.stderr.write(`- ${message}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Shop regression baselines verified (${baselineFiles.length} snapshots).\n`);
}

main().catch((error) => {
  process.stderr.write(`Shop regression baseline check failed: ${error.message}\n`);
  process.exitCode = 1;
});
