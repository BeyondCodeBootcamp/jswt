"use strict";

const Fs = require("node:fs/promises");
const Path = require("node:path");

const skipDir = new Error("skip this directory");
const _withFileTypes = { withFileTypes: true };

/** @typedef {import('fs').Dirent} Dirent */

/**
 * @callback WalkFunc
 * @param {Error?} [err]
 * @param {String} dirname
 * @param {Dirent} [dirent]
 * @returns {Promise<Boolean|undefined>}
 * @throws {skipDir|Error}
 */

/**
 * a port of Go's filepath.Walk
 * @param {String} pathname
 * @param {WalkFunc} walkFunc
 * @param {Dirent} [_dirent]
 * @returns {Promise<void>}
 */
const walk = async (pathname, walkFunc, _dirent) => {
  let err;

  // special case of the very first run
  if (!_dirent) {
    let _name = Path.basename(Path.resolve(pathname));
    //@ts-ignore - Stat and Dirent differ by .name
    _dirent = await Fs.lstat(pathname).catch(function (_err) {
      err = _err;
    });
    if (_dirent) {
      _dirent.name = _name;
    }
  }

  // run the user-supplied function and either skip, bail, or continue
  let cont = await walkFunc(err, pathname, _dirent).catch(function (err) {
    if (skipDir === err) {
      return false;
    }
    throw err;
  });
  if (false === cont) {
    return;
  }

  // "walk does not follow symbolic links"
  if (!_dirent?.isDirectory()) {
    return;
  }

  /** @type {Array<Dirent>} */
  //@ts-ignore - node typedef doesn't account for `withFileTypes`
  let dirents = await Fs.readdir(pathname, _withFileTypes).catch(
    async function (err) {
      await walkFunc(err, pathname, _dirent);
      return [];
    },
  );

  for (let dirent of dirents) {
    await walk(Path.join(pathname, dirent.name), walkFunc, dirent);
  }
};

module.exports = {
  walk,
  skipDir,
};
