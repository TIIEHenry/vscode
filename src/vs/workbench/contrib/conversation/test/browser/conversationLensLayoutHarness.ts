/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * D16: mounting ConversationLens in jsdom fires ResizeObserver loop errors
 * that mocha treats as Uncaught and aborts the rest of the suite.
 * Lens-mounting suites share this gate (conversationLens / identity /
 * reveal / trajectory / trajectoryUi).
 */

function isResizeObserverLoopMessage(message: unknown): boolean {
	return typeof message === 'string' && message.includes('ResizeObserver loop');
}

export function ignoreConversationLensResizeObserverLoop(event: ErrorEvent): void {
	if (!isResizeObserverLoopMessage(event.message)) {
		return;
	}
	event.preventDefault();
	event.stopImmediatePropagation();
}

export function installConversationLensResizeObserverHarness(): void {
	let previousOnError: OnErrorEventHandler | undefined;
	suiteSetup(() => {
		window.addEventListener('error', ignoreConversationLensResizeObserverLoop, true);
		previousOnError = window.onerror;
		window.onerror = (message, source, lineno, colno, error) => {
			if (isResizeObserverLoopMessage(message) || isResizeObserverLoopMessage(error?.message)) {
				return true;
			}
			if (typeof previousOnError === 'function') {
				return previousOnError.call(window, message, source, lineno, colno, error);
			}
			return false;
		};
	});
	suiteTeardown(() => {
		window.removeEventListener('error', ignoreConversationLensResizeObserverLoop, true);
		window.onerror = previousOnError ?? null;
	});
}

export async function flushConversationLensLayout(): Promise<void> {
	await new Promise<void>(resolve => setTimeout(resolve, 20));
	await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
