import { die } from './die';
import { ISelectionFunction } from './getSelector';
import { spawnYarn } from './spawn';

/*
info Unable to find a suitable version for "supports-color", please choose one by typing one of the numbers below:
  1) "supports-color@^4.5.0" which resolved to "4.5.0"
  2) "supports-color@^5.3.0" which resolved to "5.5.0"
  3) "supports-color@^6.1.0" which resolved to "6.1.0"
*/
const regChoice = / which resolved to "(.+)"$/;
const regWaitAnswer = /Answer\?:/;
const regHeader = /Unable to find a suitable version for "(.+)",/;

export async function runYarnFlat(selector: ISelectionFunction) {
	const { output, input, promise } = spawnYarn('install', '--flat', '--no-progress');

	let currentPackage: string;
	let currentVersions: string[];

	async function answer() {
		const version = await selector(currentPackage, currentVersions);
		const index = currentVersions.indexOf(version) + 1;
		if (index === 0) {
			die('Invalid selected version for package "%s": "%s"', currentPackage, version);
		}

		currentPackage = '';
		const indexStr = index.toString();
		process.stderr.write(`\x1B[2mfrom ["${currentVersions.join('", "')}"] select ${version} -> \x1B[0m`);
		input.write(Buffer.from(`${indexStr}\n`, 'utf-8'));
		output.read(indexStr.length);
	}

	async function commitLine(l: string) {
		if (currentPackage) {
			if (regChoice.test(l)) {
				currentVersions.push(regChoice.exec(l)![1]);
			} else if (regWaitAnswer.test(l.toString())) {
				await answer();
			}
		} else if (regHeader.test(l)) {
			currentPackage = regHeader.exec(l)![1];
			currentVersions = [];
		}
	}

	const failPromise = new Promise((_, reject) => {
		let lineCache = Buffer.alloc(0);
		output.on('readable', () => {
			let readData: Buffer | null = null;
			while ((readData = output.read(1)) !== null) {
				const c: number = readData[0];
				if (c === 10 || c === 13 || c === 0x1b) {
					const l = lineCache.toString();
					lineCache = Buffer.alloc(0);
					commitLine(l).catch((e) => reject(e));
				} else {
					lineCache = Buffer.concat([lineCache, readData]);
				}
			}
		});
	});

	output.pipe(process.stderr);
	await Promise.race([failPromise, promise]);
}
