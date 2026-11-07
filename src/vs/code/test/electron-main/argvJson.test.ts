/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { parse } from '../../../base/common/jsonc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { appendToArgvJson } from '../../electron-main/argvJson.js';

suite('argv.json', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const additionalContent = [
		'',
		'	// Allows to disable crash reporting.',
		'	"enable-crash-reporter": true,',
		'	"crash-reporter-id": "id"',
		'}'
	].join('\n');

	function appendAndParse(argvString: string): unknown {
		return parse(appendToArgvJson(argvString, additionalContent));
	}

	const expected = { 'disable-hardware-acceleration': true, 'enable-crash-reporter': true, 'crash-reporter-id': 'id' };

	test('appends to a file ending with \\n', () => {
		assert.deepStrictEqual(appendAndParse('{\n\t// comment\n\t"disable-hardware-acceleration": true\n}\n'), expected);
	});

	test('appends to a file ending with \\r\\n', () => {
		assert.deepStrictEqual(appendAndParse('{\r\n\t// comment\r\n\t"disable-hardware-acceleration": true\r\n}\r\n'), expected);
	});

	test('appends to a file with trailing blank lines or no final line break', () => {
		assert.deepStrictEqual(appendAndParse('{\n\t"disable-hardware-acceleration": true\n}\n\n\n'), expected);
		assert.deepStrictEqual(appendAndParse('{\n\t"disable-hardware-acceleration": true\n}'), expected);
	});

	test('throws when there is no object to append to', () => {
		assert.throws(() => appendToArgvJson('', additionalContent));
	});
});
