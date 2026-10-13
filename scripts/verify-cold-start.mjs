/** Isolated real-bundle TCP-readiness regression. No dotenv, DB or credentials. */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const cycles = Number(process.argv[2] ?? 10);
assert.ok(Number.isInteger(cycles) && cycles > 0 && cycles <= 50);
for (let cycle = 1; cycle <= cycles; cycle++) {
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['dist/index.js'], {
    env: { PATH: process.env.PATH, NODE_ENV: 'production', PORT: String(port), DATABASE_URL: '', DOTENV_CONFIG_PATH: '/dev/null' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume(); child.stderr.resume();
  try {
    const deadline = Date.now() + 15000;
    const response = await new Promise((resolve, reject) => {
      function probe() {
        if (Date.now() > deadline) return reject(new Error('No listening socket within 15 seconds'));
        const socket = net.connect(port, '127.0.0.1');
        let accepted = false, bytes = '';
        socket.on('connect', () => {
          accepted = true;
          socket.setTimeout(2000);
          socket.write('GET /api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A1%7D%7D HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
        });
        socket.on('data', data => { bytes += data.toString(); });
        socket.on('end', () => resolve(bytes));
        socket.on('timeout', () => { socket.destroy(); reject(new Error('TCP readiness accepted but HTTP did not respond')); });
        socket.on('error', error => {
          socket.destroy();
          if (accepted) reject(error);
          else if (error.code === 'ECONNREFUSED') setTimeout(probe, 1);
          else reject(error);
        });
      }
      probe();
    });
    assert.match(response, /^HTTP\/1\.1 200 /);
    assert.match(response, /"ok":true/);
    console.log(JSON.stringify({ cycle, passed: true, firstAcceptedSocketServesHttp: true }));
  } finally {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
}
