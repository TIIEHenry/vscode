/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './compactDesktopShell.css';
import { $, addDisposableListener, EventType } from '../../../../base/browser/dom.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { autorun } from '../../../../base/common/observable.js';
import { ICustomViewService } from '../../../services/customView/browser/customViewService.js';

/**
 * Narrow-desktop navigation chrome — prepended above the workbench grid when
 * {@link SessionsLayoutPolicy.isCompactDesktop} is active. Reuses the mobile
 * navigation *model* (toggle sidebar drawer, dismiss custom view) but uses
 * desktop styling and focus management — not the phone title bar or sheets.
 */
export class CompactDesktopNavigationHost extends Disposable {

	readonly element: HTMLElement;

	private readonly _navButton: HTMLButtonElement;
	private readonly _backButton: HTMLButtonElement;

	private readonly _onDidClickNavigation = this._register(new Emitter<void>());
	readonly onDidClickNavigation: Event<void> = this._onDidClickNavigation.event;

	private readonly _onDidClickBackToSessions = this._register(new Emitter<void>());
	readonly onDidClickBackToSessions: Event<void> = this._onDidClickBackToSessions.event;

	constructor(
		parent: HTMLElement,
		@ICustomViewService private readonly _customViewService: ICustomViewService,
	) {
		super();

		this.element = $('.compact-desktop-nav-host');
		parent.insertBefore(this.element, parent.firstChild);
		this._register(toDisposable(() => this.element.remove()));

		this._navButton = document.createElement('button');
		this._navButton.type = 'button';
		this._navButton.className = 'compact-desktop-nav-button';
		this._navButton.setAttribute('aria-label', localize('compactDesktopOpenNavigation', "Open navigation"));
		this._navButton.appendChild($(`span${ThemeIcon.asCSSSelector(Codicon.menu)}`));

		this._backButton = document.createElement('button');
		this._backButton.type = 'button';
		this._backButton.className = 'compact-desktop-nav-button compact-desktop-back-button';
		this._backButton.setAttribute('aria-label', localize('compactDesktopBackToSessions', "Back to sessions"));
		this._backButton.appendChild($(`span${ThemeIcon.asCSSSelector(Codicon.arrowLeft)}`));
		const backLabel = document.createElement('span');
		backLabel.className = 'compact-desktop-back-label';
		backLabel.textContent = localize('compactDesktopBackToSessionsLabel', "Sessions");
		this._backButton.appendChild(backLabel);

		this.element.appendChild(this._navButton);
		this.element.appendChild(this._backButton);

		this._register(addDisposableListener(this._navButton, EventType.CLICK, () => {
			this._onDidClickNavigation.fire();
		}));

		this._register(addDisposableListener(this._backButton, EventType.CLICK, () => {
			this._customViewService.hideCustomView();
			this._onDidClickBackToSessions.fire();
		}));

		this._register(autorun(reader => {
			const customViewActive = !!this._customViewService.activeCustomView.read(reader);
			this._backButton.hidden = !customViewActive;
			this._navButton.hidden = customViewActive;
		}));
	}
}
