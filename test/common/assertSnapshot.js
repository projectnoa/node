'use strict';
const common = require('.');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');


const stackFramesRegexp = /(\s+)((.+?)\s+\()?(?:\(?(.+?):(\d+)(?::(\d+))?)\)?(\s+\{)?(\n|$)/g;
const windowNewlineRegexp = /\r/g;

function replaceStackTrace(str, replacement = '$1*$7\n') {
  return str.replace(stackFramesRegexp, replacement);
}

function replaceWindowsLineEndings(str) {
  return str.replace(windowNewlineRegexp, '');
}

function replaceWindowsPaths(str) {
  return str.replaceAll(path.win32.sep, path.posix.sep);
}

function transform(...args) {
  return (str) => args.reduce((acc, fn) => fn(acc), str);
}

function getSnapshotPath(filename) {
  const { name, dir } = path.parse(filename);
  return path.resolve(dir, `${name}.snapshot`);
}

async function assertSnapshot(actual, filename = process.argv[1]) {
  const snapshot = getSnapshotPath(filename);
  if (process.env.NODE_REGENERATE_SNAPSHOTS) {
    await fs.writeFile(snapshot, actual);
  } else {
    const expected = await fs.readFile(snapshot, 'utf8');
    assert.strictEqual(actual, replaceWindowsLineEndings(expected));
  }
}

/**
 * Spawn a process and assert its output against a snapshot.
 * if you want to automatically update the snapshot, run tests with NODE_REGENERATE_SNAPSHOTS=1
 * transform is a function that takes the output and returns a string that will be compared against the snapshot
 * this is useful for normalizing output such as stack traces
 * there are some predefined transforms in this file such as replaceStackTrace and replaceWindowsLineEndings
 * both of which can be used as an example for writing your own
 * compose multiple transforms by passing them as arguments to the transform function:
 * assertSnapshot.transform(assertSnapshot.replaceStackTrace, assertSnapshot.replaceWindowsLineEndings)
 *
 * @param {string} filename
 * @param {function(string): string} [transform]
 * @returns {Promise<void>}
 */
async function spawnAndAssert(filename, transform = (x) => x) {
  const flags = common.parseTestFlags(filename);
  const { stdout, stderr } = await common.spawnPromisified(process.execPath, [...flags, filename]);
  await assertSnapshot(transform(`${stdout}${stderr}`), filename);
}

module.exports = {
  assertSnapshot,
  getSnapshotPath,
  replaceStackTrace,
  replaceWindowsLineEndings,
  replaceWindowsPaths,
  spawnAndAssert,
  transform,
};
