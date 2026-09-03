/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * D16: mounting ConversationLens in jsdom fires ResizeObserver loop errors
 * that mocha treats as Uncaught and aborts the rest of the suite.
 * Lens-mounting suites share this gate (conversationLens / reveal /
 * trajectory / trajectoryUi). Identity strip still installs the same
 * listener locally.
 */

export function ignoreConversationLensResizeObserverLoop(event: ErrorEvent): void {
	if (event.message.includes('ResizeObserver loop')) {
		event.preventDefault();
	}
}

export function installConversationLensResizeObserverHarness(): void {
	suiteSetup(() => {
		window.addEventListener('error', ignoreConversationLensResizeObserverLoop);
	});
	suiteTeardown(() => {
		window.removeEventListener('error', ignoreConversationLensResizeObserverLoop);
	});
}

export async function flushConversationLensLayout(): Promise<void> {
	await new Promise<void>(resolve => setTimeout(resolve, 20));
	await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
