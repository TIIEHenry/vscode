/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SedFileWriteParser } from '../../../common/autoApprove/sedFileWriteParser.js';

suite('SedFileWriteParser', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const parser = new SedFileWriteParser();

	test('detects supported in-place options', () => {
		const commandLines = [
			'sed -i "s/foo/bar/" file.txt',
			'sed -I "s/foo/bar/" file.txt',
			'sed -ni "s/foo/bar/" file.txt',
			'sed -i.bak "s/foo/bar/" file.txt',
			'sed -i \'\' "s/foo/bar/" file.txt',
			'sed --in-place "s/foo/bar/" file.txt',
			'sed --in-place=.bak "s/foo/bar/" file.txt',
			// GNU unique abbreviations of --in-place
			'sed --i "s/a/b/" f',
			'sed --in "s/a/b/" f',
			'sed --in-plac "s/a/b/" f',
			'sed --in=.bak "s/a/b/" f',
			// Quotes and escapes that the shell removes
			'sed "--in-place" "s/a/b/" f',
			'sed -"i" "s/a/b/" f',
			'sed \\-i "s/a/b/" f',
			'sed --"in" "s/a/b/" f',
			'sed "s/a/b/" -i f',
			// Line continuations that the shell removes
			'sed \\\n-i "s/a/b/" f',
			'sed -\\\ni "s/a/b/" f',
			'sed --in\\\n-place "s/a/b/" f',
			// Arguments split differently from the shell (`\'` inside `$'...'`, quotes inside `$(...)`)
			'sed $\'s/a/\\\'/\' -i /home/u/.bashrc',
			'sed "$(echo \'p;#"\')" -i /etc/x',
		];
		assert.deepStrictEqual(commandLines.map(commandLine => parser.canHandle(commandLine)), commandLines.map(() => true));
	});

	test('does not classify non-in-place commands', () => {
		const commandLines = [
			'sed "s/foo/bar/" file.txt',
			'sed -n "s/foo/bar/p" file.txt',
			'echo sed -i file.txt',
			'sed --posix "s/a/b/" f',
			'sed --debug -n "1p" f',
			'sed -E "s/(i)/I/" f',
			'sed -e "s/a/-i/" f',
		];
		assert.deepStrictEqual(commandLines.map(commandLine => parser.canHandle(commandLine)), commandLines.map(() => false));
	});

	test('extracts in-place file targets', () => {
		assert.deepStrictEqual({
			single: parser.extractFileWrites('sed -i "s/foo/bar/" file.txt'),
			multiple: parser.extractFileWrites('sed -i "s/foo/bar/" file1.txt file2.txt'),
			bsd: parser.extractFileWrites('sed -i \'\' "s/foo/bar/" file.txt'),
			abbreviated: parser.extractFileWrites('sed --in "s/a/b/" /etc/x'),
			abbreviatedExpression: parser.extractFileWrites('sed --in --expr="s/a/b/" /etc/x'),
			abbreviatedFile: parser.extractFileWrites('sed --in --fi=script.sed /etc/x'),
		}, {
			single: ['file.txt'],
			multiple: ['file1.txt', 'file2.txt'],
			bsd: ['file.txt'],
			abbreviated: ['/etc/x'],
			abbreviatedExpression: ['/etc/x'],
			abbreviatedFile: ['/etc/x'],
		});
	});
});
