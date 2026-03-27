import { existsSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";

const repoRoot = process.cwd();
const dexterRoot = path.resolve(
  repoRoot,
  "services/tianshi-automaton/vendor/dexter-upstream",
);
const venvRoot = path.join(dexterRoot, ".venv");
const venvPython = path.join(
  venvRoot,
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "python.exe" : "python",
);

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    shell: false,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(dexterRoot)) {
  console.error(`Dexter checkout not found at ${dexterRoot}`);
  process.exit(1);
}

if (!existsSync(venvPython)) {
  run("python", ["-m", "venv", venvRoot], dexterRoot);
}

run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], dexterRoot);
run(venvPython, ["-m", "pip", "install", "-r", "req.txt"], dexterRoot);
run(venvPython, ["-m", "pip", "install", "-e", "."], dexterRoot);

console.log("Dexter agent bootstrap complete.");
