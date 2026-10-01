/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isThenable } from '../../../../base/common/async.js';

/**
 * Sources opens a Preview tab on its own. The explorer's auto-reveal listens to
 * every active-editor change, so that open would move the navigator. Hold this
 * only around the Sources open. Explorer clicks use the same editor helper and
 * must not take the gate.
 */
let explorerAutoRevealSuppressDepth = 0;

export function isExplorerAutoRevealSuppressed(): boolean {
	return explorerAutoRevealSuppressDepth > 0;
}

export function runSuppressingExplorerAutoReveal<T>(run: () => T): T {
	explorerAutoRevealSuppressDepth++;
	try {
		const result = run();
		if (isThenable(result)) {
			return result.finally(() => {
				explorerAutoRevealSuppressDepth--;
			}) as T;
		}
		explorerAutoRevealSuppressDepth--;
		return result;
	} catch (error) {
		explorerAutoRevealSuppressDepth--;
		throw error;
	}
}
