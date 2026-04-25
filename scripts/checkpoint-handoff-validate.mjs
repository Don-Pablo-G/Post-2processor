import { execSync } from "node:child_process";

/**
 * Thin wrapper: handoff payload checks run inside the unified checkpoint:validate pipeline.
 */
function main() {
  process.stdout.write("checkpoint:handoff:validate -> checkpoint:validate (meta + webhook + handoff)\n\n");
  execSync("node ./scripts/checkpoint-validate.mjs", { stdio: "inherit" });
}

main();
