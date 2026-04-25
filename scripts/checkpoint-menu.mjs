import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function getLatestCheckpoints(limit = 5) {
  const raw = run(`git log --oneline --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    const [hash, ...rest] = line.split(" ");
    return { hash, subject: rest.join(" ") };
  });
}

function main() {
  const checkpoints = getLatestCheckpoints(5);
  process.stdout.write("CNC Workbench Checkpoint Menu\n");
  process.stdout.write("=============================\n\n");

  if (checkpoints.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    process.stdout.write("Create one by running your normal verify flow.\n");
    return;
  }

  process.stdout.write("Latest checkpoints:\n");
  checkpoints.forEach((c, idx) => {
    process.stdout.write(`${idx + 1}. ${c.hash}  ${c.subject}\n`);
  });

  const latest = checkpoints[0].hash;
  const previous = checkpoints[1]?.hash ?? latest;

  process.stdout.write("\nCommon commands:\n");
  process.stdout.write(`- health:           npm run repo:health\n`);
  process.stdout.write(`- full verify:      npm run verify\n`);
  process.stdout.write(`- latest summary:   npm run checkpoint:latest\n`);
  process.stdout.write(`- list recent:      npm run checkpoint:list\n`);
  process.stdout.write(`- cadence stats:    npm run checkpoint:stats\n`);
  process.stdout.write(`- open latest:      npm run checkpoint:open\n`);
  process.stdout.write(`- since latest day: npm run checkpoint:since -- ${new Date().toISOString().slice(0, 10)}\n`);
  process.stdout.write(`- compare last two: npm run checkpoint:diff -- ${previous} ${latest}\n`);
  process.stdout.write(`- range by hash:    npm run checkpoint:range -- ${previous} ${latest}\n`);

  process.stdout.write("\nSafe recovery hints:\n");
  process.stdout.write(`- inspect latest:   git show ${latest}\n`);
  process.stdout.write(`- safety branch:    git branch "checkpoint-${latest}" ${latest}\n`);
  process.stdout.write(`- detached review:  git switch --detach ${latest}\n`);
}

main();
