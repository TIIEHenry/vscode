/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentSessionStreamCloseCause } from './universeAgentTypes.js';

/**
 * Once-only close gate shared by Chat bidi, ContinueGeneration, Regenerate, and SessionEventStream.
 * Remote `end` / `error` notify `onClosed`; local dispose / cancel must call
 * {@link StreamCloseGate.closeLocal} first so a follow-up CANCELLED is silent.
 */
export interface StreamCloseGate {
	readonly closed: boolean;
	finish(cause: UniverseAgentSessionStreamCloseCause): void;
	closeLocal(): void;
}

export function createStreamCloseGate(
	onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
): StreamCloseGate {
	let closed = false;
	return {
		get closed(): boolean {
			return closed;
		},
		finish(cause: UniverseAgentSessionStreamCloseCause): void {
			if (closed) {
				return;
			}
			closed = true;
			onClosed?.(cause);
		},
		closeLocal(): void {
			closed = true;
		},
	};
}
