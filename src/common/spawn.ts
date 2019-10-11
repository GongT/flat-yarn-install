import { spawn } from 'node-pty';
import { PassThrough, Writable } from 'stream';

export function spawnYarn(...args: string[]) {
	console.error(' + yarn %s', args.join(' '));
	const ps = spawn('yarn', args, {
		name: 'xterm-256color',
		cols: 4000,
		rows: 100000,
		encoding: null as any,
	});

	const output = new PassThrough();
	ps.onData((d) => {
		output.write(d);
	});

	const input = new Writable({
		objectMode: true,
		write(chunk: string, _: string, callback: (error?: Error | null) => void) {
			ps.write(chunk);
			callback();
		},
	});

	const p = new Promise((resolve, reject) => {
		ps.onExit(({ exitCode, signal }) => {
			input.end();
			output.end();
			if (signal) {
				reject(new Error('killed ' + signal));
			} else if (exitCode !== 0) {
				reject(new Error('exit with code ' + signal));
			} else {
				resolve();
			}
		});
	});

	return {
		output: output,
		input: input,
		promise: p,
	};
}
