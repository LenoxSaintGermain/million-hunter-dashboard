// Process-wide deny-by-default boundary, inherited by Vitest's fork workers.
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const dns = require('node:dns');
const cp = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const deny = () => { throw new Error('ISOLATED_INTEGRATION_NETWORK_DENIED'); };
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (process.env.ISOLATED_INTEGRATION_DATABASE === 'capital_aperture_test_20260909_zzugqp' &&
      typeof options === 'object' && options.host === '127.0.0.1' && Number(options.port) === 3307 && !options.path) {
    return connect.apply(this, args);
  }
  return deny();
};
tls.connect = http.request = http.get = https.request = https.get = deny;
globalThis.fetch = async () => deny();
for (const name of ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse']) {
  dns[name] = (...args) => {
    const callback = args.at(-1);
    if (typeof callback === 'function') queueMicrotask(() => callback(new Error('ISOLATED_INTEGRATION_DNS_DENIED')));
    else deny();
  };
  if (dns.promises[name]) dns.promises[name] = async () => deny();
}
const spawn = cp.spawn;
cp.spawn = function (command, args, options) {
  if (typeof command === 'string' && /node_modules\/.*\/bin\/esbuild$/.test(command)) return spawn.call(this, command, args, options);
  return deny();
};
cp.exec = cp.execSync = cp.execFile = cp.execFileSync = cp.spawnSync = deny;
const fork = cp.fork;
cp.fork = function (modulePath, args, options) {
  if (typeof modulePath !== 'string' || !modulePath.includes('/tinypool/')) return deny();
  return fork.call(this, modulePath, args, options);
};
syncBuiltinESMExports();
