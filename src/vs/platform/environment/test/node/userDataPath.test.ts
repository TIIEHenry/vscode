/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { basename } from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { OPTIONS, parseArgs } from '../../node/argv.js';
import { getDefaultUserDataPath, getUserDataPath } from '../../node/userDataPath.js';
import product from '../../../product/common/product.js';

function restoreEnv(key: string, original: string | undefined): void {
	if (typeof original === 'string') {
		process.env[key] = original;
	} else {
		delete process.env[key];
	}
}

suite('User data path', () => {

	test('getUserDataPath - default', () => {
		const path = getUserDataPath(parseArgs(process.argv, OPTIONS), product.nameShort);
		assert.ok(path.length > 0);
	});

	test('getUserDataPath - portable mode', () => {
		const origPortable = process.env['VSCODE_PORTABLE'];
		try {
			const portableDir = 'portable-dir';
			process.env['VSCODE_PORTABLE'] = portableDir;

			const path = getUserDataPath(parseArgs(process.argv, OPTIONS), product.nameShort);
			assert.ok(path.includes(portableDir));
		} finally {
			if (typeof origPortable === 'string') {
				process.env['VSCODE_PORTABLE'] = origPortable;
			} else {
				delete process.env['VSCODE_PORTABLE'];
			}
		}
	});

	test('getUserDataPath - --user-data-dir', () => {
		const cliUserDataDir = 'cli-data-dir';
		const args = parseArgs(process.argv, OPTIONS);
		args['user-data-dir'] = cliUserDataDir;

		const path = getUserDataPath(args, product.nameShort);
		assert.ok(path.includes(cliUserDataDir));
	});

	test('getUserDataPath - VSCODE_APPDATA', () => {
		const origAppData = process.env['VSCODE_APPDATA'];
		try {
			const appDataDir = 'appdata-dir';
			process.env['VSCODE_APPDATA'] = appDataDir;

			const path = getUserDataPath(parseArgs(process.argv, OPTIONS), product.nameShort);
			assert.ok(path.includes(appDataDir));
		} finally {
			if (typeof origAppData === 'string') {
				process.env['VSCODE_APPDATA'] = origAppData;
			} else {
				delete process.env['VSCODE_APPDATA'];
			}
		}
	});

	test('getUserDataPath - I2 VSCODE_DEV hardcodes universe-agent-studio-dev over passed productName', () => {
		const origDev = process.env['VSCODE_DEV'];
		const origAppData = process.env['VSCODE_APPDATA'];
		try {
			process.env['VSCODE_DEV'] = '1';
			process.env['VSCODE_APPDATA'] = 'i2-appdata-dir';

			for (const productName of ['code-oss-dev', 'Code - OSS'] as const) {
				const path = getUserDataPath(parseArgs(process.argv, OPTIONS), productName);
				assert.ok(path.includes('universe-agent-studio-dev'), `expected I2 folder when productName=${productName}, got ${path}`);
				assert.ok(!path.includes('code-oss-dev'), `expected no code-oss-dev when productName=${productName}, got ${path}`);
			}
		} finally {
			restoreEnv('VSCODE_DEV', origDev);
			restoreEnv('VSCODE_APPDATA', origAppData);
		}
	});

	test('getUserDataPath - --user-data-dir wins over I2 VSCODE_DEV rename', () => {
		const origDev = process.env['VSCODE_DEV'];
		const origAppData = process.env['VSCODE_APPDATA'];
		try {
			process.env['VSCODE_DEV'] = '1';
			delete process.env['VSCODE_APPDATA'];

			const cliUserDataDir = 'cli-data-dir-i2';
			const args = parseArgs(process.argv, OPTIONS);
			args['user-data-dir'] = cliUserDataDir;

			const path = getUserDataPath(args, 'code-oss-dev');
			assert.ok(path.includes(cliUserDataDir), `expected CLI dir to win, got ${path}`);
			assert.ok(!path.includes('universe-agent-studio-dev'), `expected CLI dir to beat I2 rename, got ${path}`);
		} finally {
			restoreEnv('VSCODE_DEV', origDev);
			restoreEnv('VSCODE_APPDATA', origAppData);
		}
	});

	test('getDefaultUserDataPath - UniverseAgentStudio basename', () => {
		const path = getDefaultUserDataPath('UniverseAgentStudio');
		assert.strictEqual(basename(path), 'UniverseAgentStudio');
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
