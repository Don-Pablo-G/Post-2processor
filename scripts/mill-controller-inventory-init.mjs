import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const template = path.join(root, "config", "mill-controller-inventory.template.json");
const local = path.join(root, "mill-controller-inventory.local.json");

function main() {
  if (!existsSync(template)) {
    process.stderr.write(`Missing template: ${template}\n`);
    process.exit(1);
    return;
  }

  if (existsSync(local)) {
    process.stdout.write(`Inventory file already exists:\n  ${local}\n\n`);
    process.stdout.write("Monday: fill software_version / series fields from controller plates or diagnostic screens.\n");
    return;
  }

  copyFileSync(template, local);
  process.stdout.write(`Created (gitignored):\n  ${local}\n\n`);
  process.stdout.write("Edit JSON with real values Monday; keep template under config/ unchanged.\n");
}

main();
