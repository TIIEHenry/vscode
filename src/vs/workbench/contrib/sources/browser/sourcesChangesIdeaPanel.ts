/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { Button, IButtonStyles } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';

const $ = dom.$;

const ghostActionButtonStyles: IButtonStyles = {
	buttonBackground: undefined,
	buttonHoverBackground: undefined,
	buttonSeparator: undefined,
	buttonForeground: undefined,
	buttonBorder: undefined,
	buttonSecondaryBackground: undefined,
	buttonSecondaryForeground: undefined,
	buttonSecondaryHoverBackground: undefined,
	buttonSecondaryBorder: undefined,
};

export interface ISourcesChangesIdeaPanelDelegate {
	onStageSelected?(): Promise<void>;
	onUnstageSelected?(): Promise<void>;
	onRefresh?(): Promise<void>;
	onExpandAll?(): void;
	onCollapseAll?(): void;
}

export class SourcesChangesIdeaPanel extends Disposable {

	readonly container: HTMLElement;
	readonly toolbar: HTMLElement;
	readonly stageSelectedButton: Button;
	readonly unstageSelectedButton: Button;
	readonly refreshButton: Button;
	readonly expandAllButton: Button;
	readonly collapseAllButton: Button;
	readonly contentContainer: HTMLElement;
	readonly listContainer: HTMLElement;
	readonly emptyMessage: HTMLElement;

	constructor(
		container: HTMLElement,
		private readonly delegate?: ISourcesChangesIdeaPanelDelegate,
	) {
		super();
		this.container = container;

		this.toolbar = dom.append(container, $('.sources-changes-toolbar'));
		this.stageSelectedButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.stageSelected', "Stage Selected"),
			...ghostActionButtonStyles,
		}));
		this.stageSelectedButton.icon = Codicon.add;

		this.unstageSelectedButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.unstageSelected', "Unstage Selected"),
			...ghostActionButtonStyles,
		}));
		this.unstageSelectedButton.icon = Codicon.remove;

		this.refreshButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.refresh', "Refresh Changes"),
			...ghostActionButtonStyles,
		}));
		this.refreshButton.icon = Codicon.refresh;

		this.expandAllButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.expandAll', "Expand All Folders"),
			...ghostActionButtonStyles,
		}));
		this.expandAllButton.icon = Codicon.chevronDown;

		this.collapseAllButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.collapseAll', "Collapse All Folders"),
			...ghostActionButtonStyles,
		}));
		this.collapseAllButton.icon = Codicon.chevronUp;

		this.contentContainer = dom.append(container, $('.sources-changes-content'));
		this.listContainer = dom.append(this.contentContainer, $('.sources-changes-list'));
		this.emptyMessage = dom.append(this.contentContainer, $('.sources-changes-empty'));
		this.emptyMessage.setAttribute('role', 'status');
		this.emptyMessage.style.display = 'none';

		this._register(this.stageSelectedButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.runIdeaAction(() => this.delegate?.onStageSelected?.() ?? Promise.resolve()).catch(onUnexpectedError);
		}));

		this._register(this.unstageSelectedButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.runIdeaAction(() => this.delegate?.onUnstageSelected?.() ?? Promise.resolve()).catch(onUnexpectedError);
		}));

		this._register(this.refreshButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.runIdeaAction(() => this.delegate?.onRefresh?.() ?? Promise.resolve()).catch(onUnexpectedError);
		}));

		this._register(this.expandAllButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.delegate?.onExpandAll?.();
		}));

		this._register(this.collapseAllButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.delegate?.onCollapseAll?.();
		}));
	}

	async runIdeaAction(action: () => Promise<void>): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		try {
			await action();
		} catch (error) {
			if (this._store.isDisposed) {
				return;
			}
			onUnexpectedError(error);
		}
	}

	render(hasVisibleEntries: boolean, emptyText?: string, isError = false): void {
		if (this._store.isDisposed) {
			return;
		}
		this.emptyMessage.classList.toggle('is-error', isError);
		if (emptyText !== undefined) {
			this.emptyMessage.textContent = emptyText;
		}
		this.emptyMessage.style.display = hasVisibleEntries ? 'none' : '';
		this.listContainer.style.display = hasVisibleEntries ? 'block' : 'none';
	}

	override dispose(): void {
		if (this._store.isDisposed) {
			return;
		}
		this.toolbar.remove();
		this.contentContainer.remove();
		this.container?.remove();
		dom.clearNode(this.toolbar);
		dom.clearNode(this.contentContainer);
		dom.clearNode(this.listContainer);
		dom.clearNode(this.emptyMessage);
		if (this.container) {
			dom.clearNode(this.container);
		}
		super.dispose();
	}
}
