/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { localize } from '../../../../nls.js';

const $ = dom.$;

export interface ISourcesCommitRowDelegate {
	onCommit?(): Promise<void>;
	onInput?(value: string): void;
}

export class SourcesCommitRow extends Disposable {

	readonly container: HTMLElement;
	readonly commitInput: HTMLTextAreaElement;
	readonly commitButton: Button;
	readonly provenance: HTMLElement;
	readonly provenanceText: HTMLElement;
	private isCommitInFlight = false;

	constructor(
		container: HTMLElement,
		private readonly delegate?: ISourcesCommitRowDelegate,
	) {
		super();
		this.container = dom.append(container, $('.sources-changes-commit'));
		this.commitInput = dom.append(this.container, $('textarea.sources-changes-commit-input')) as HTMLTextAreaElement;
		this.commitInput.rows = 1;
		this.commitInput.placeholder = localize('sourcesChangesList.commitMessage', "Commit message");
		this.commitInput.setAttribute('aria-label', localize('sourcesChangesList.commitMessage', "Commit message"));
		this.commitInput.title = localize('sourcesChangesList.commitHint', "Enter commits. Shift+Enter inserts a new line.");

		this.commitButton = this._register(new Button(this.container, defaultButtonStyles));
		this.commitButton.label = localize('sourcesChangesList.commit', "Commit");

		this.provenance = dom.append(this.container, $('.sources-changes-provenance'));
		this.provenance.setAttribute('role', 'status');
		this.provenance.style.display = 'none';
		const provenanceIcon = dom.append(this.provenance, $('span.sources-changes-provenance-icon.codicon.codicon-info'));
		provenanceIcon.setAttribute('aria-hidden', 'true');
		this.provenanceText = dom.append(this.provenance, $('span.sources-changes-provenance-text'));

		this._register(this.commitButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.runCommit().catch(onUnexpectedError);
		}));

		this._register(dom.addStandardDisposableListener(this.commitInput, 'input', () => {
			if (this._store.isDisposed) {
				return;
			}
			this.layoutCommitInput();
			this.delegate?.onInput?.(this.commitInput.value);
		}));

		this._register(dom.addDisposableListener(this.commitInput, 'keydown', (e: KeyboardEvent) => {
			if (this._store.isDisposed) {
				return;
			}
			const event = new StandardKeyboardEvent(e);
			if (event.keyCode === KeyCode.Enter && !event.shiftKey && this.commitButton.enabled && !this.isCommitInFlight) {
				event.preventDefault();
				event.stopPropagation();
				void this.runCommit().catch(onUnexpectedError);
			}
		}));
	}

	get value(): string {
		return this.commitInput.value;
	}

	set value(val: string) {
		if (this._store.isDisposed) {
			return;
		}
		if (this.commitInput.value !== val) {
			this.commitInput.value = val;
			this.layoutCommitInput();
		}
	}

	setDisabled(disabled: boolean): void {
		if (this._store.isDisposed) {
			return;
		}
		this.commitInput.disabled = disabled;
	}

	setCommitInFlight(inFlight: boolean): void {
		if (this._store.isDisposed) {
			return;
		}
		this.isCommitInFlight = inFlight;
	}

	setProvenance(message: string | undefined): void {
		if (this._store.isDisposed) {
			return;
		}
		if (!message) {
			this.provenanceText.textContent = '';
			this.provenance.title = '';
			this.provenance.removeAttribute('aria-label');
			this.provenance.style.display = 'none';
			return;
		}
		this.provenanceText.textContent = message;
		this.provenance.title = message;
		this.provenance.setAttribute('aria-label', message);
		this.provenance.style.display = 'flex';
	}

	layoutCommitInput(): void {
		if (this._store.isDisposed) {
			return;
		}
		const input = this.commitInput;
		const min = 28;
		const max = 112;
		input.style.height = 'auto';
		const border = Math.max(0, input.offsetHeight - input.clientHeight);
		const scroll = input.scrollHeight + border;
		const next = scroll > 0 ? Math.min(Math.max(scroll, min), max) : min;
		input.style.height = `${next}px`;
	}

	async runCommit(): Promise<void> {
		if (this._store.isDisposed || this.isCommitInFlight) {
			return;
		}
		this.isCommitInFlight = true;
		try {
			await this.delegate?.onCommit?.();
		} catch (error) {
			if (this._store.isDisposed) {
				return;
			}
			onUnexpectedError(error);
		} finally {
			if (!this._store.isDisposed) {
				this.isCommitInFlight = false;
			}
		}
	}

	override dispose(): void {
		if (this._store.isDisposed) {
			return;
		}
		this.container.remove();
		dom.clearNode(this.container);
		dom.clearNode(this.provenance);
		super.dispose();
	}
}
