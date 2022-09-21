#!/usr/bin/env node
"use strict";

//require("dotenv").config({ path: ".env" });
//require("dotenv").config({ path: ".env.secret" });

let Fs = require("node:fs/promises");
let Path = require("node:path");

function showHelp() {
  console.info();
  console.info("Usage:");
  console.info("    jswt <subcommand> [opts]");
  console.info();
  console.info("Subcommands:");
  console.info("    help        - display this menu");
  console.info("    init        - initialize this project");
  console.info();
}

async function main() {
  let subcmd = process.argv[2];
  if (!subcmd) {
    showHelp();
    process.exit(1);
    return;
  }
  if ("help" === subcmd) {
    showHelp();
    process.exit(0);
    return;
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
