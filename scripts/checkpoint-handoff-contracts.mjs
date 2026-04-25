import { execSync } from "node:child_process";

/**
 * Thin wrapper: handoff schema is emitted by the unified checkpoint:contracts pipeline.
 */
function main() {
  process.stdout.write("checkpoint:handoff:contracts -> checkpoint:contracts (includes handoff-meta schema)\n\n");
  execSync("node ./scripts/checkpoint-contracts.mjs", { stdio: "inherit" });
}

main();
