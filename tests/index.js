import ChildProcess from "child_process";
import Fs from "node:fs/promises";
import Path from "node:path";

let modulePath = import.meta.url.slice("file://".length);
let moduleDir = Path.dirname(modulePath);

async function main() {
  console.info("TAP version 13");

  let dirents = await Fs.readdir(moduleDir, { withFileTypes: true });

  let failures = 0;
  let count = 0;
  for (let dirent of dirents) {
    if (dirent.name === "index.js") {
      continue;
    }

    count += 1;
    let direntPath = Path.join(moduleDir, dirent.name);
    let relPath = Path.relative(".", direntPath);

    let success = await handleEach(count, relPath);
    if (!success) {
      failures += 1;
    }
  }

  let start = 1;
  if (count < 1) {
    start = 0;
  }

  let passes = count - failures;
  console.info(``);
  console.info(`${start}..${count}`);
  console.info(`# tests ${count}`);
  console.info(`# pass  ${passes}`);
  console.info(`# fail  ${failures}`);
  console.info(`# skip  0`);

  if (failures !== 0) {
    process.exit(1);
  }
}

/**
 * @param {Number} count
 * @param {String} relPath
 */
async function handleEach(count, relPath) {
  let success = await exec("node", [relPath])
    .then(function (result) {
      console.info(`ok ${count} - ${relPath}`);
      return true;
    })
    .catch(function (err) {
      console.info(`not ok ${count} - ${relPath}`);
      if (err.code) {
        console.info(`  # Error: ${err.code}`);
      }
      if (err.stderr) {
        console.info(`  # Stderr: ${err.stderr}`);
      }
      return false;
    });

  return success;
}

/**
 * @param {String} exe
 * @param {Array<String>} args
 */
async function exec(exe, args) {
  return new Promise(function (resolve, reject) {
    let cmd = ChildProcess.spawn(exe, args);

    /** @type {Array<String>} */
    let stdout = [];
    /** @type {Array<String>} */
    let stderr = [];

    cmd.stdout.on("data", function (data) {
      stdout.push(data.toString("utf8"));
    });

    cmd.stderr.on("data", function (data) {
      stderr.push(data.toString("utf8"));
    });

    cmd.on("close", function (code) {
      let result = {
        code: code,
        stdout: stdout.join(""),
        stderr: stderr.join(""),
      };

      if (!code) {
        resolve(result);
        return;
      }

      let err = new Error(result.stderr);
      Object.assign(err, result);
      reject(err);
    });
  });
}

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error("Fail:");
    console.error(err.stack || err);
    process.exit(1);
  });
