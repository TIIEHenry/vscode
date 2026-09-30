/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, suite, test } from 'vitest';
import { CancellationToken } from '../../../../util/vs/base/common/cancellation';
import { ToolName } from '../../common/toolNames';
import { ToolRegistry } from '../../common/toolsRegistry';

// Side-effect registration
import '../vscodeCmdTool';

function createVSCodeCmdTool() {
	const toolCtor = ToolRegistry.getTools().find(t => t.toolName === ToolName.RunVscodeCmd)!;
	return new (toolCtor as any)({}, {}, {});
}

async function prepare(commandId: string, args?: unknown[]) {
	const tool = createVSCodeCmdTool();
	return tool.prepareInvocation(
		{
			input: {
				commandId,
				name: commandId,
				args: args ?? [],
			},
		},
		CancellationToken.None,
	);
}

suite('VSCodeCmdTool prepareInvocation confirmation', () => {
	test('requires confirmation for git.stageAll, git.stashPopLatest, and git.rebaseAbort without args', async () => {
		for (const commandId of ['git.stageAll', 'git.stashPopLatest', 'git.rebaseAbort'] as const) {
			const result = await prepare(commandId);
			expect(result.confirmationMessages?.title, commandId).toBeTruthy();
		}
	});

	test('requires confirmation for git.stage with and without args', async () => {
		const withoutArgs = await prepare('git.stage');
		expect(withoutArgs.confirmationMessages?.title).toBeTruthy();

		const withArgs = await prepare('git.stage', ['/path/to/file.ts']);
		expect(withArgs.confirmationMessages?.title).toBeTruthy();
	});

	test('does not require confirmation for git.stash, git.stashPop, and git.showOutput without args', async () => {
		for (const commandId of ['git.stash', 'git.stashPop', 'git.showOutput'] as const) {
			const result = await prepare(commandId);
			expect(result.confirmationMessages, commandId).toBeUndefined();
			expect(result.invocationMessage).toBeTruthy();
		}
	});
});
