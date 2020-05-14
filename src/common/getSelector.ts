import { rcompare } from 'semver';
import { die } from './die';

const preset: { [id: string]: ISelectionFunction } = {
	'--newest'(_: string, versions: string[]) {
		return versions.sort(rcompare)[0];
	},
};

export interface ISelectionFunction {
	(name: string, versions: string[]): string | Promise<string>;
}

export function getSelector() {
	if (process.argv.length <= 2) {
		die(
			'Usage:\n\t$0 %s\n\t$0 selector.js\n\tSelector should \x1B[38;5;14mexport default function(name: string, version: string[]): string|Promise<string>;\x1B[0m',
			Object.keys(preset).join('|')
		);
	}
	const arg = process.argv[2];
	if (preset[arg]) {
		return preset[arg];
	} else {
		let fn: any;
		try {
			fn = require(arg).default;
		} catch (e) {
			die('Can not found script at %s', arg);
		}

		if (typeof fn !== 'function') {
			die('script did not export default function');
		}

		return fn;
	}
}
