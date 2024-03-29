#!/usr/bin/env node
"use strict";

//require("dotenv").config({ path: ".env" });
//require("dotenv").config({ path: ".env.secret" });

//@ts-ignore
let pkg = require("../package.json");

let Fs = require("node:fs/promises");
let Path = require("node:path");

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

  let subcmdPath = Path.join(__dirname, `jswt-${subcmd}.js`);
  let notExists = await Fs.access(subcmdPath).catch(Object);
  if (notExists) {
    console.error(`error: '${subcmd}' is not a valid subcommand`);
    showHelp();
    process.exit(1);
    return;
  }

  await require(`./jswt-${subcmd}.js`);
}

main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
  process.exit(1);
});
