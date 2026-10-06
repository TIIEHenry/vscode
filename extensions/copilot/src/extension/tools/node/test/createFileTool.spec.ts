/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, suite, test } from 'vitest';
import { getFilepathComment } from '../../../../util/common/markdown';
import { extractNotebookCreateFileContent } from '../createFileTool';

suite('extractNotebookCreateFileContent', () => {
	const languageId = 'python';
	const filePath = '/workspace/notebook.ipynb';

	test('strips fenced code and leading filepath comment inside the fence', () => {
		const body = 'print("hello")\n';
		const fenced = '```python\n' + getFilepathComment(languageId, filePath) + body + '```';
		expect(extractNotebookCreateFileContent(fenced, languageId, filePath)).toBe(body);
	});

	test('removes filepath comment when there is no fence', () => {
		const body = 'print("hello")\n';
		const raw = getFilepathComment(languageId, filePath) + body;
		expect(extractNotebookCreateFileContent(raw, languageId, filePath)).toBe(body);
	});

	test('returns raw input when fence is not closed', () => {
		const raw = '```python\nprint("unfinished")\n';
		expect(extractNotebookCreateFileContent(raw, languageId, filePath)).toBe(raw);
	});
});
