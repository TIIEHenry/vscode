/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { EditorOpenSource } from '../../../../../platform/editor/common/editor.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { buildSourcesEngineListFilesRequest, buildSourcesEngineReadFileRequest, projectSourcesEngineFileEntries, provideSourcesEngineFileText, putSourcesEngineFileText, resetSourcesEngineFileTextForTests, resolveSourcesFilesListSource, SOURCES_ENGINE_FILE_SCHEME, sourcesEngineFileText, sourcesEngineReadonlyTextInput, sourcesFilesWorkDirIsWorkspaceRoot } from '../../common/sourcesFilesEngineRead.js';

suite('Sources - Files engine read', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	teardown(() => {
		resetSourcesEngineFileTextForTests();
	});

	test('workDir on a workspace root stays on fileSearch, including a trailing slash', () => {
		const root = URI.file('/repo');
		const other = URI.file('/other');
		assert.strictEqual(sourcesFilesWorkDirIsWorkspaceRoot('/repo', [root, other]), true);
		assert.strictEqual(sourcesFilesWorkDirIsWorkspaceRoot('/repo/', [root]), true);
		assert.strictEqual(sourcesFilesWorkDirIsWorkspaceRoot('/repo/src', [root]), false);
		assert.strictEqual(sourcesFilesWorkDirIsWorkspaceRoot('   ', [root]), false);

		assert.deepStrictEqual(resolveSourcesFilesListSource({
			workspaceFolders: [root],
			sessionId: 'sess-1',
			workDir: '/repo',
			hasListFiles: true,
		}), { kind: 'workspace' });
		assert.deepStrictEqual(resolveSourcesFilesListSource({
			workspaceFolders: [root],
			sessionId: 'sess-1',
			workDir: '/repo/',
			hasListFiles: true,
		}), { kind: 'workspace' });
	});

	test('workDir outside every root, including an empty workspace, uses listFiles', () => {
		const root = URI.file('/repo');
		assert.deepStrictEqual(resolveSourcesFilesListSource({
			workspaceFolders: [root],
			sessionId: 'sess-1',
			workDir: '/engine/proj',
			hasListFiles: true,
		}), { kind: 'engine', sessionId: 'sess-1', path: '/engine/proj' });
		assert.deepStrictEqual(resolveSourcesFilesListSource({
			workspaceFolders: [],
			sessionId: 'sess-1',
			workDir: '/engine/proj',
			hasListFiles: true,
		}), { kind: 'engine', sessionId: 'sess-1', path: '/engine/proj' });
		assert.deepStrictEqual(resolveSourcesFilesListSource({
			workspaceFolders: [],
			sessionId: 'sess-1',
			workDir: '  /engine/proj  ',
			hasListFiles: true,
		}), { kind: 'engine', sessionId: 'sess-1', path: '/engine/proj' });
	});

	test('missing workDir or listFiles stays on the workspace search path', () => {
		const root = URI.file('/repo');
		assert.deepStrictEqual(resolveSourcesFilesListSource({
			workspaceFolders: [],
			sessionId: 'sess-1',
			workDir: undefined,
			hasListFiles: true,
		}), { kind: 'workspace' });
		assert.deepStrictEqual(resolveSourcesFilesListSource({
			workspaceFolders: [],
			sessionId: 'sess-1',
			workDir: '   ',
			hasListFiles: true,
		}), { kind: 'workspace' });
		assert.deepStrictEqual(resolveSourcesFilesListSource({
			workspaceFolders: [],
			sessionId: 'sess-1',
			workDir: '/engine/proj',
			hasListFiles: false,
		}), { kind: 'workspace' });
		assert.deepStrictEqual(resolveSourcesFilesListSource({
			workspaceFolders: [root],
			sessionId: 'sess-1',
			workDir: '/not-a-root',
			hasListFiles: false,
		}), { kind: 'workspace' });
	});

	test('listFiles and readFile requests carry the session and path', () => {
		assert.deepStrictEqual(buildSourcesEngineListFilesRequest('sess-1', '/engine/proj', 20), {
			path: '/engine/proj',
			sessionId: 'sess-1',
			recursive: true,
			pattern: '',
			maxResults: 20,
		});
		assert.deepStrictEqual(buildSourcesEngineReadFileRequest('sess-1', '/engine/proj/src/a.ts'), {
			path: '/engine/proj/src/a.ts',
			sessionId: 'sess-1',
			startLine: 0,
			endLine: 0,
			maxBytes: 0,
		});
	});

	test('projected rows skip directories and are not file URIs', () => {
		const outcome = projectSourcesEngineFileEntries(
			{ kind: 'engine', sessionId: 'sess-1', path: '/engine/proj' },
			{
				entries: [
					{ name: 'src', path: '/engine/proj/src', isDirectory: true, size: 0, lastModified: 0, mimeType: '' },
					{ name: 'b.ts', path: '/engine/proj/src/b.ts', isDirectory: false, size: 1, lastModified: 0, mimeType: 'text/plain' },
					{ name: 'a.ts', path: '/engine/proj/a.ts', isDirectory: false, size: 1, lastModified: 0, mimeType: 'text/plain' },
				],
				total: 3,
			},
			10,
		);
		assert.deepStrictEqual(outcome.entries.map(entry => entry.name), ['a.ts', 'b.ts']);
		assert.deepStrictEqual(outcome.entries.map(entry => entry.description), ['a.ts', 'src/b.ts']);
		assert.ok(outcome.entries.every(entry => entry.resource.scheme === SOURCES_ENGINE_FILE_SCHEME));
		assert.ok(outcome.entries.every(entry => entry.resource.scheme !== 'file'));
		assert.strictEqual(outcome.entries[1].engine?.sessionId, 'sess-1');
		assert.strictEqual(outcome.entries[1].engine?.path, '/engine/proj/src/b.ts');
		assert.strictEqual(outcome.truncated, false);
	});

	test('read-only text input refuses a file URI and decodes engine bytes', () => {
		const text = sourcesEngineFileText(VSBuffer.fromString('hello engine').buffer);
		assert.strictEqual(text, 'hello engine');
		const fileInput = sourcesEngineReadonlyTextInput(URI.file('/engine/proj/a.ts'), text, 'a.ts', { source: EditorOpenSource.USER });
		assert.strictEqual(fileInput, undefined);
		const resource = projectSourcesEngineFileEntries(
			{ kind: 'engine', sessionId: 'sess-1', path: '/engine/proj' },
			{ entries: [{ name: 'a.ts', path: '/engine/proj/a.ts', isDirectory: false, size: 1, lastModified: 0, mimeType: 'text/plain' }], total: 1 },
			10,
		).entries[0].resource;
		const input = sourcesEngineReadonlyTextInput(resource, text, 'a.ts', { source: EditorOpenSource.USER });
		assert.strictEqual(input?.resource.scheme, SOURCES_ENGINE_FILE_SCHEME);
		assert.strictEqual(input?.contents, 'hello engine');
		assert.notStrictEqual(input?.resource.scheme, 'file');
	});

	test('content provider creates the decoded text on the engine resource', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const modelService = instantiationService.get(IModelService);
		const resource = URI.from({ scheme: SOURCES_ENGINE_FILE_SCHEME, path: '/engine/proj/a.ts' });
		putSourcesEngineFileText(resource, 'hello engine');
		const model = provideSourcesEngineFileText(resource, modelService);
		try {
			assert.ok(model);
			assert.strictEqual(model?.getValue(), 'hello engine');
			assert.strictEqual(model?.uri.scheme, SOURCES_ENGINE_FILE_SCHEME);
			assert.strictEqual(provideSourcesEngineFileText(URI.file('/engine/proj/a.ts'), modelService), null);
		} finally {
			model?.dispose();
		}
	});
});
