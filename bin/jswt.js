#!/usr/bin/env node

//import Dotenv from "dotenv";
//Dotenv.config({ path: ".env" });
//Dotenv.config({ path: ".env.secret" });

import Fs from "node:fs/promises";
import FsSync from "node:fs";
import Path from "node:path";

let modulePath = import.meta.url.slice("file://".length);
let moduleDir = Path.dirname(modulePath);

let pkgPath = Path.join(moduleDir, "../package.json");
let pkgText = FsSync.readFileSync(pkgPath, "utf8");
let pkg = JSON.parse(pkgText);

function showVersion() {
  console.info(`jswt v${pkg.version}`);
  console.info();
}

function showHelp() {
  showVersion();

  console.info("Usage:");
  console.info("    jswt <subcommand> [opts]");
  console.info();
  console.info("Subcommands:");
  console.info("    help                    - display this menu");
  console.info("    init                    - initialize this project");
  console.info(
    "    reexport [--global]     - reexport typedefs to index.js (or types.js)",
  );
  console.info();
}

async function main() {
  let subcmd = process.argv[2];
  if (!subcmd) {
    showHelp();
    process.exit(1);
    return;
  }

  {
    let wantsHelp = ["help", "--help", "-h"].includes(subcmd);
    if (wantsHelp) {
      showHelp();
      process.exit(0);
      return;
    }
  }

  {
    let wantsVersion = ["version", "--version", "-V"].includes(subcmd);
    if (wantsVersion) {
      showVersion();
      process.exit(0);
      return;
    }
  }

  let subcmdPath = Path.join(moduleDir, `jswt-${subcmd}.js`);
  let notExists = await Fs.access(subcmdPath).catch(Object);
  if (notExists) {
    console.error(`error: '${subcmd}' is not a valid subcommand`);
    showHelp();
    process.exit(1);
    return;
  }

  await import(`./jswt-${subcmd}.js`);
}

main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
  process.exit(1);
});
