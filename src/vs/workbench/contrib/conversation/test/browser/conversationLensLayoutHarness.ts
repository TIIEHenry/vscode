/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * D16: mounting ConversationLens in the Electron mocha renderer fires
 * `ResizeObserver loop completed with undelivered notifications`. Mocha marks
 * that as `err.uncaught` and `abort()`s the rest of the suite when it lands
 * after a passing test. Capture + window.onerror is not enough: mocha binds
 * `Runner#_uncaught` onto `window.onerror` at `mocha.run()`, and Electron also
 * delivers the same text on Node `process.uncaughtException`.
 * Lens-mounting suites share this gate (conversationLens / identity /
 * reveal / trajectory / trajectoryUi).
 */

import { errorHandler } from '../../../../../base/common/errors.js';

function isResizeObserverLoopMessage(message: unknown): boolean {
	return typeof message === 'string' && message.includes('ResizeObserver loop');
}

function isResizeObserverLoop(value: unknown): boolean {
	if (isResizeObserverLoopMessage(value)) {
		return true;
	}
	if (!value || typeof value !== 'object') {
		return false;
	}
	const rec = value as { message?: unknown; error?: unknown; reason?: unknown };
	return isResizeObserverLoopMessage(rec.message)
		|| isResizeObserverLoop(rec.error)
		|| isResizeObserverLoop(rec.reason);
}

export function ignoreConversationLensResizeObserverLoop(event: ErrorEvent): void {
	if (!isResizeObserverLoop(event)) {
		return;
	}
	event.preventDefault();
	event.stopImmediatePropagation();
}

interface IMochaRunnerPrototype {
	_uncaught(err: unknown): void;
}

function getMochaRunnerPrototype(): IMochaRunnerPrototype | undefined {
	const mochaGlobal = globalThis as {
		Mocha?: { Runner?: { prototype: IMochaRunnerPrototype } };
		mocha?: { Mocha?: { Runner?: { prototype: IMochaRunnerPrototype } } };
	};
	return mochaGlobal.Mocha?.Runner?.prototype ?? mochaGlobal.mocha?.Mocha?.Runner?.prototype;
}

let mochaUncaughtPatched = false;
let captureListenerInstalled = false;
let processListenersWrapped = false;
let unexpectedHandlerWrapped = false;
let activeOnError: OnErrorEventHandler | undefined;

function patchMochaUncaught(): void {
	if (mochaUncaughtPatched) {
		return;
	}
	const proto = getMochaRunnerPrototype();
	if (!proto || typeof proto._uncaught !== 'function') {
		return;
	}
	const original = proto._uncaught;
	proto._uncaught = function (this: unknown, err: unknown): void {
		if (isResizeObserverLoop(err)) {
			return;
		}
		return original.call(this, err);
	};
	mochaUncaughtPatched = true;
}

function installCaptureListener(): void {
	if (captureListenerInstalled) {
		return;
	}
	window.addEventListener('error', ignoreConversationLensResizeObserverLoop, true);
	captureListenerInstalled = true;
}

function wrapWindowOnError(): void {
	if (window.onerror === activeOnError && activeOnError) {
		return;
	}
	const previous = window.onerror;
	const wrapped: OnErrorEventHandler = (message, source, lineno, colno, error) => {
		if (isResizeObserverLoop(message) || isResizeObserverLoop(error)) {
			return true;
		}
		if (typeof previous === 'function') {
			return previous.call(window, message, source, lineno, colno, error);
		}
		return false;
	};
	activeOnError = wrapped;
	window.onerror = wrapped;
}

function wrapProcessListeners(): void {
	if (processListenersWrapped || typeof process === 'undefined' || typeof process.rawListeners !== 'function') {
		return;
	}
	for (const event of ['uncaughtException', 'unhandledRejection'] as const) {
		const originals = process.rawListeners(event).slice();
		for (const listener of originals) {
			if (typeof listener !== 'function') {
				continue;
			}
			process.removeListener(event, listener);
			process.on(event, (...args: unknown[]) => {
				if (isResizeObserverLoop(args[0])) {
					return;
				}
				return listener.apply(process, args);
			});
		}
	}
	processListenersWrapped = true;
}

function wrapUnexpectedErrorHandler(): void {
	if (unexpectedHandlerWrapped) {
		return;
	}
	const previous = errorHandler.getUnexpectedErrorHandler();
	errorHandler.setUnexpectedErrorHandler(e => {
		if (isResizeObserverLoop(e)) {
			return;
		}
		previous(e);
	});
	unexpectedHandlerWrapped = true;
}

export function installConversationLensResizeObserverHarness(): void {
	// Must run at suite-definition time (loadTests), before mocha.run() binds
	// Runner#uncaught to the current `_uncaught`.
	patchMochaUncaught();
	installCaptureListener();
	wrapProcessListeners();
	wrapUnexpectedErrorHandler();
	suiteSetup(() => {
		// mocha.run() assigns window.onerror after modules load.
		wrapWindowOnError();
	});
}

export async function flushConversationLensLayout(): Promise<void> {
	await new Promise<void>(resolve => setTimeout(resolve, 20));
	await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
