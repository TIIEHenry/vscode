/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, suite, test } from 'vitest';
import { INewWorkspaceStoredData } from '../../common/newWorkspaceContext';
import { INewWorkspaceSetupResumeHost, runNewWorkspaceSetupResume } from '../newWorkspaceInitializer';

const folderUri = 'file:///workspace';
const userPrompt = 'Build a command line tool';
const continueQuery = 'Continue with #new workspace setup';

function stored(initialized: boolean | undefined): INewWorkspaceStoredData[] {
	return [{ workspaceURI: folderUri, userPrompt, initialized }];
}

async function run(options: {
	isAgentSessionsWorkspace: boolean | undefined;
	contexts: INewWorkspaceStoredData[];
	confirm?: boolean;
	directoryNames?: readonly string[];
	workspaceFolderUri?: string;
}): Promise<{ prompts: number; opened: string[]; writes: number; contexts: INewWorkspaceStoredData[] }> {
	const opened: string[] = [];
	let prompts = 0;
	let writes = 0;
	const host: INewWorkspaceSetupResumeHost = {
		isAgentSessionsWorkspace: options.isAgentSessionsWorkspace,
		workspaceFolderUri: options.workspaceFolderUri === undefined ? folderUri : options.workspaceFolderUri,
		readContexts: () => options.contexts,
		writeContexts: () => { writes++; },
		readDirectoryNames: async () => options.directoryNames ?? [],
		showContinuePrompt: async () => {
			prompts++;
			return options.confirm ?? false;
		},
		openChat: query => { opened.push(query); },
		continueWithSetupQuery: continueQuery,
	};
	await runNewWorkspaceSetupResume(host);
	return { prompts, opened, writes, contexts: options.contexts };
}

suite('New workspace setup resume', () => {
	test('default Code window does not prompt or open chat', async () => {
		for (const isAgentSessionsWorkspace of [false, undefined]) {
			const result = await run({
				isAgentSessionsWorkspace,
				contexts: stored(false),
				confirm: true,
			});
			expect(result.prompts).toBe(0);
			expect(result.opened).toEqual([]);
			expect(result.writes).toBe(0);
			expect(result.contexts[0].initialized).toBe(false);
		}
	});

	test('Agents window still asks and opens chat with the continue-setup query', async () => {
		const result = await run({
			isAgentSessionsWorkspace: true,
			contexts: stored(false),
			confirm: true,
		});
		expect(result.prompts).toBe(1);
		expect(result.opened).toEqual([continueQuery]);
		expect(result.writes).toBe(1);
		expect(result.contexts[0].initialized).toBe(true);
	});

	test('Agents window still opens the stored user prompt when the empty workspace was already initialized', async () => {
		const result = await run({
			isAgentSessionsWorkspace: true,
			contexts: stored(true),
			confirm: true,
			directoryNames: ['.git'],
		});
		expect(result.prompts).toBe(1);
		expect(result.opened).toEqual([userPrompt]);
		expect(result.writes).toBe(0);
	});

	test('Agents window drops the stored context when setup is declined or the folder is no longer empty', async () => {
		const declined = await run({
			isAgentSessionsWorkspace: true,
			contexts: stored(false),
			confirm: false,
		});
		expect(declined.opened).toEqual([]);
		expect(declined.contexts).toEqual([]);

		const filled = await run({
			isAgentSessionsWorkspace: true,
			contexts: stored(true),
			directoryNames: ['README.md'],
		});
		expect(filled.prompts).toBe(0);
		expect(filled.opened).toEqual([]);
		expect(filled.contexts).toEqual([]);
	});
});
