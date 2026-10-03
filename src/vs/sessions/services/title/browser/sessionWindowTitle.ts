/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { autorun, IObservable } from '../../../../base/common/observable.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { getUntitledSessionTitle } from '../../sessions/common/session.js';

/** Idle Agents window title. Not the product long name. */
export const AGENTS_WINDOW_TITLE = localize('agentsWindowTitle', "Agents");

/** Same separator as the workbench `window.titleSeparator` default. */
export const sessionWindowTitleSeparator = isMacintosh ? ' \u2014 ' : ' - ';

export interface ISessionWindowTitleSession {
	readonly title: IObservable<string>;
	readonly isQuickChat?: IObservable<boolean>;
}

export interface IWindowTitleTarget {
	document: { title: string };
}

/**
 * OS window title for the active session. Blank titles use the untitled
 * fallback. No session drops back to {@link AGENTS_WINDOW_TITLE} so the
 * previous session name does not stick.
 */
export function formatSessionWindowTitle(session: { readonly title: string; readonly isQuickChat: boolean } | undefined): string {
	if (!session) {
		return AGENTS_WINDOW_TITLE;
	}
	const display = session.title.trim() || getUntitledSessionTitle(session.isQuickChat);
	return `${display}${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`;
}

/**
 * Writes {@link formatSessionWindowTitle} onto every bound window whenever
 * the active session or its title changes.
 */
export class SessionWindowTitle extends Disposable {

	private readonly _windows = new Set<IWindowTitleTarget>();
	private readonly _main: IWindowTitleTarget;
	private _title: string;

	constructor(
		activeSession: IObservable<ISessionWindowTitleSession | undefined>,
		initialWindow: IWindowTitleTarget,
	) {
		super();
		this._main = initialWindow;
		this._title = formatSessionWindowTitle(undefined);
		this._windows.add(initialWindow);
		this._register(autorun(reader => {
			const session = activeSession.read(reader);
			this._title = formatSessionWindowTitle(session ? {
				title: session.title.read(reader),
				isQuickChat: session.isQuickChat?.read(reader) ?? false,
			} : undefined);
			this._applyAll();
		}));
	}

	bind(target: IWindowTitleTarget): void {
		this._windows.add(target);
		this._apply(target);
	}

	unbind(target: IWindowTitleTarget): void {
		// The main window stays bound for the service lifetime. An auxiliary
		// titlebar whose container is still on that window must not drop it.
		if (target !== this._main) {
			this._windows.delete(target);
		}
	}

	/** Restore the session title after another writer replaces `document.title`. */
	reapply(): void {
		this._applyAll();
	}

	private _applyAll(): void {
		for (const target of this._windows) {
			this._apply(target);
		}
	}

	private _apply(target: IWindowTitleTarget): void {
		if (target.document.title !== this._title) {
			target.document.title = this._title;
		}
	}
}
