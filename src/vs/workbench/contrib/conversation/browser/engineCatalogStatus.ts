/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	getCatalogEmptyCopy,
	getCatalogFailedCopy,
	getCatalogListLoadingCopy,
	getCatalogRetryLabel,
	getCatalogUnknownCopy,
	getCatalogUnsupportedCopy,
} from './engineCatalog.js';
import { getEngineSectionDisconnectedCopy } from './engineSectionChrome.js';

const $ = DOM.$;

export type EngineCatalogLoadingKind = 'capability' | 'list';

export interface IEngineCatalogStatusRenderOptions {
	readonly mode: EngineCatalogPaneMode;
	readonly featureLabel?: string;
	readonly reason?: string;
	readonly loadingKind?: EngineCatalogLoadingKind;
	readonly emptyCopy?: string;
	readonly onRetry?: () => void;
	readonly onOpenConnection?: () => void;
}

export function getEngineCatalogStatusMessage(options: IEngineCatalogStatusRenderOptions): string {
	switch (options.mode) {
		case 'disconnected':
			return getEngineSectionDisconnectedCopy();
		case 'unsupported':
			return getCatalogUnsupportedCopy(options.featureLabel ?? '', options.reason);
		case 'loading':
			return options.loadingKind === 'list'
				? getCatalogListLoadingCopy()
				: getCatalogUnknownCopy();
		case 'failed':
			return getCatalogFailedCopy(options.featureLabel ?? '', options.reason);
		case 'empty':
			return options.emptyCopy ?? getCatalogEmptyCopy(options.featureLabel ?? localize('ua.engineCatalogEmptyFeature', "items"));
		case 'ready':
			return '';
	}
}

/**
 * Shared Engine catalog status (E2-1): one DOM shape, one `role=status` live region, one Retry.
 * Reason copy comes from capability `reason` or transport error — sections do not hand-write it.
 */
export class EngineCatalogStatusWidget extends Disposable {

	readonly element: HTMLElement;
	private readonly messageEl: HTMLElement;
	private readonly actionsEl: HTMLElement;
	private readonly actionDisposables = this._register(new DisposableStore());

	constructor(parent: HTMLElement) {
		super();
		this.element = DOM.append(parent, $('.engine-catalog-status-widget'));
		this.element.setAttribute('role', 'status');
		this.element.setAttribute('aria-live', 'polite');
		this.element.style.display = 'none';
		this.messageEl = DOM.append(this.element, $('.engine-catalog-status-message'));
		this.actionsEl = DOM.append(this.element, $('.engine-catalog-status-actions'));
	}

	render(options: IEngineCatalogStatusRenderOptions): void {
		this.actionDisposables.clear();
		DOM.clearNode(this.actionsEl);

		if (options.mode === 'ready') {
			this.hide();
			return;
		}

		this.element.style.display = '';
		this.element.dataset['catalogMode'] = options.mode;
		this.messageEl.textContent = getEngineCatalogStatusMessage(options);

		if (options.mode === 'disconnected' && options.onOpenConnection) {
			const openConnection = this.actionDisposables.add(new Button(this.actionsEl, defaultButtonStyles));
			openConnection.label = localize('ua.engineOpenConnection', "Open Connection");
			this.actionDisposables.add(openConnection.onDidClick(() => {
				options.onOpenConnection?.();
			}));
		}

		if (options.mode === 'failed') {
			const retry = this.actionDisposables.add(new Button(this.actionsEl, defaultButtonStyles));
			retry.label = getCatalogRetryLabel();
			retry.enabled = !!options.onRetry;
			this.actionDisposables.add(retry.onDidClick(() => {
				options.onRetry?.();
			}));
		}
	}

	hide(): void {
		this.actionDisposables.clear();
		DOM.clearNode(this.actionsEl);
		this.element.style.display = 'none';
		this.element.dataset['catalogMode'] = '';
		this.messageEl.textContent = '';
	}
}
