/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const PROVIDER_REL = 'src/vs/sessions/contrib/providers/copilotChatSessions/browser/copilotChatSessionsProvider.ts';

function copilotChatSessionsProviderSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), PROVIDER_REL),
		path.join(thisDir, '../../browser/copilotChatSessionsProvider.ts'),
		path.join(thisDir, '../../../../../../../../', PROVIDER_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `copilotChatSessionsProvider.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('CopilotChatSessionsProvider leftover fire-and-forget catch scan (D615)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('openRepository then success/error callbacks keep; success-path throw double-catch onUnexpectedError (D615)', () => {
		// `.then(success, error)` still leaks when success throws; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(copilotChatSessionsProviderSourcePath(), 'utf8');
		const collapsed = source.replace(/\s+/g, ' ');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const thenHead = 'void this.gitService.openRepository(uri).then(repository => {';
		const warn = "this.logService.warn(`Failed to resolve GitHub repository metadata for '${uri.toString()}'.`, error);";
		const doubleThenCollapsed = `${thenHead} if (!repository || this._localGitHubInfo.get(key) !== gitHubInfo) { this._localGitHubInfoResolutionStarted.delete(key); return; } this._localGitHubInfoDisposables.set(key, autorun(reader => { const repositoryInfo = getGitHubRemoteInfo(repository.state.read(reader)); gitHubInfo.set(repositoryInfo ? { owner: repositoryInfo.owner, repo: repositoryInfo.repo } : undefined, undefined); })); }, error => { this._localGitHubInfoResolutionStarted.delete(key); ${warn} })${doubleCatch};`;
		const bareThenCollapsed = `${thenHead} if (!repository || this._localGitHubInfo.get(key) !== gitHubInfo) { this._localGitHubInfoResolutionStarted.delete(key); return; } this._localGitHubInfoDisposables.set(key, autorun(reader => { const repositoryInfo = getGitHubRemoteInfo(repository.state.read(reader)); gitHubInfo.set(repositoryInfo ? { owner: repositoryInfo.owner, repo: repositoryInfo.repo } : undefined, undefined); })); }, error => { this._localGitHubInfoResolutionStarted.delete(key); ${warn} });`;
		const singleThenCollapsed = `${thenHead} if (!repository || this._localGitHubInfo.get(key) !== gitHubInfo) { this._localGitHubInfoResolutionStarted.delete(key); return; } this._localGitHubInfoDisposables.set(key, autorun(reader => { const repositoryInfo = getGitHubRemoteInfo(repository.state.read(reader)); gitHubInfo.set(repositoryInfo ? { owner: repositoryInfo.owner, repo: repositoryInfo.repo } : undefined, undefined); })); }, error => { this._localGitHubInfoResolutionStarted.delete(key); ${warn} }).catch(onUnexpectedError);`;
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes(thenHead));
		assert.ok(source.includes(warn));
		assert.strictEqual((source.match(/void this\.gitService\.openRepository\(uri\)\.then\(/g) ?? []).length, 1);
		assert.ok(collapsed.includes(doubleThenCollapsed));
		assert.ok(!collapsed.includes(bareThenCollapsed));
		assert.ok(!collapsed.includes(singleThenCollapsed));
		assert.ok(source.includes('this._gitRepository = await this.gitService.openRepository(repoUri);'));
		assert.ok(!source.includes('void this.gitService.openRepository(repoUri)'));
		assert.ok(source.includes('lookup.then(pullRequestNumber => {'));
		assert.ok(source.includes('}).catch(onUnexpectedError);\n\t\treturn observable;'));
	});
});
