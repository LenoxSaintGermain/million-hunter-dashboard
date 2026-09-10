/** Private, durable release receipts. Existing locks are never stolen. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, lstatSync, openSync, writeFileSync, fsyncSync, closeSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
const hash = value => createHash('sha256').update(value).digest('hex');

export function openReleaseJournal({ root, target, planSha256 }) {
  const rootPath = resolve(root), rootStat = lstatSync(rootPath);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || rootStat.uid !== process.getuid() || (rootStat.mode & 0o077)) throw Error('Use an owner-only release directory');
  const targetDirectory = join(rootPath, hash(target));
  // Preserve previous-plan receipts; all plan revisions still share one lock.
  const directory = join(targetDirectory, hash(planSha256));
  for (const path of [targetDirectory, directory]) {
    try { mkdirSync(path, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw Error('Unsafe journal directory');
  }
  const syncDirectory = () => { for (const path of [directory,targetDirectory]) { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } } };
  const lockPath = join(targetDirectory, 'release.lock'), nonce = randomUUID();
  const lock = openSync(lockPath, 'wx', 0o600);
  try { writeFileSync(lock, JSON.stringify({ nonce, pid: process.pid, target, planSha256 })); fsyncSync(lock); } finally { closeSync(lock); }
  syncDirectory();
  const verifyLease = async () => {
    try { return JSON.parse(readFileSync(lockPath, 'utf8')).nonce === nonce; } catch { return false; }
  };
  const path = id => join(directory, `${hash(id)}.json`);
  return {
    directory, verifyLease,
    readJournal: async id => {
      try {
        const file = path(id), stat = lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw Error('Unsafe journal file');
        const entry = JSON.parse(readFileSync(file, 'utf8'));
        if (entry.target !== target || entry.planSha256 !== planSha256 || entry.stepId !== id) throw Error('Journal identity mismatch');
        return entry;
      } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    writeJournal: async entry => {
      if (!await verifyLease()) throw Error('Release lock was lost');
      if (entry.target !== target || entry.planSha256 !== planSha256) throw Error('Journal identity mismatch');
      const temp = join(directory, `${randomUUID()}.pending`);
      const fd = openSync(temp, 'wx', 0o600);
      try { writeFileSync(fd, JSON.stringify(entry)); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temp, path(entry.stepId)); syncDirectory();
    },
    close: async () => {
      if (!await verifyLease()) throw Error('Cannot release another runner’s lock');
      unlinkSync(lockPath); syncDirectory();
    },
  };
}
