/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import type { ConversationQuestionRespondAnswers } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { getConversationQuestionSeatAriaLabel } from './conversationAccessibility.js';
import { wireConversationSeatOptionKeys } from './conversationConfirmationSeat.js';
import { ConfirmationStatus, ConversationQuestionOptionItem } from './conversationStubModel.js';
import { getConversationTurnRoleLabel } from './conversationTrajectoryList.js';

export interface IConversationQuestionSeatOptions {
	readonly message: string;
	readonly status: ConfirmationStatus;
	readonly questionItems?: readonly ConversationQuestionOptionItem[];
	readonly answerKeysValid?: boolean;
	readonly questionRequestId?: string;
	/** Bounded options preview when items cannot be submitted. */
	readonly payload?: string;
	readonly agentId?: string;
	readonly onRespond?: (requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string) => void;
}

/**
 * Timeline ask-user seat (option radios / checkboxes / Submit).
 * Distinct from {@link ConversationConfirmationSeat}: different role/name,
 * never Allow/Skip (PRD-004.4). Not ChatConfirmationWidget.
 */
export class ConversationQuestionSeat extends Disposable {

	readonly element: HTMLElement;

	constructor(options: IConversationQuestionSeatOptions) {
		super();

		const isAnswered = options.status === 'allowed';
		const keys = this._register(new DisposableStore());

		this.element = $('.conversation-lens-question-seat.conversation-lens-turn.conversation-lens-turn--question');
		this.element.tabIndex = 0;
		this.element.setAttribute('role', 'region');
		this.element.setAttribute('data-kind', 'question');
		this.element.setAttribute('data-honest-kind', 'question');
		this.element.setAttribute('aria-label', getConversationQuestionSeatAriaLabel(options.status, options.message));

		const header = append(this.element, $('.conversation-lens-turn-header'));
		header.textContent = getConversationTurnRoleLabel('question');
		if (options.agentId && options.agentId !== 'default') {
			const identity = append(header, $('span.conversation-lens-turn-agent-identity'));
			identity.textContent = options.agentId;
		}
		const status = append(header, $('span.conversation-lens-turn-honest-status'));
		status.textContent = isAnswered
			? localize('conversationLens.questionAnsweredBadge', "Answered")
			: localize('conversationLens.questionPendingBadge', "Input needed");

		const body = append(this.element, $('.conversation-lens-turn-body.conversation-lens-turn-body--honest'));
		body.textContent = options.message;

		this.renderOptions(options, keys);
	}

	private renderOptions(options: IConversationQuestionSeatOptions, disposables: DisposableStore): void {
		const items = options.questionItems ?? [];
		const requestId = options.questionRequestId;
		const respond = options.onRespond;
		const canSubmit = options.status !== 'allowed'
			&& options.answerKeysValid === true
			&& requestId !== undefined
			&& items.length > 0
			&& respond !== undefined;

		if (!canSubmit || requestId === undefined || respond === undefined) {
			if (!options.payload) {
				return;
			}
			const list = append(this.element, $('ul.conversation-lens-question-options'));
			list.setAttribute('role', 'list');
			for (const option of options.payload.split(' · ')) {
				const item = append(list, $('li.conversation-lens-question-option'));
				item.setAttribute('role', 'listitem');
				item.textContent = option;
			}
			return;
		}

		const selections = new Map<string, string[]>();
		let customText = '';
		const needsExplicitSubmit = items.some(item => item.multiSelect === true || item.allowCustom === true);
		const required = items.filter(item => item.options.length > 0 && item.multiSelect !== true);
		const collectAnswers = (): ConversationQuestionRespondAnswers => {
			const answers: Record<string, { readonly selectedLabels: readonly string[] }> = {};
			for (const item of items) {
				answers[item.id] = { selectedLabels: selections.get(item.id) ?? [] };
			}
			return answers;
		};
		const submit = (): void => {
			respond(requestId, collectAnswers(), customText);
		};
		const submitIfComplete = (): void => {
			if (needsExplicitSubmit) {
				return;
			}
			if (required.some(item => !selections.has(item.id))) {
				return;
			}
			submit();
		};

		for (const item of items) {
			if (item.multiSelect === true && item.options.length > 0) {
				const group = append(this.element, $('div.conversation-lens-question-options'));
				group.setAttribute('role', 'group');
				group.setAttribute('aria-label', item.title || options.message);
				const boxes: HTMLElement[] = [];
				const chosen = new Set<string>();
				for (const option of item.options) {
					const box = append(group, $('div.conversation-lens-question-option'));
					box.setAttribute('role', 'checkbox');
					box.setAttribute('aria-checked', 'false');
					box.textContent = option;
					boxes.push(box);
				}
				const sync = (): void => {
					selections.set(item.id, [...chosen]);
					boxes.forEach((box, index) => {
						const label = item.options[index];
						box.setAttribute('aria-checked', label !== undefined && chosen.has(label) ? 'true' : 'false');
					});
				};
				wireConversationSeatOptionKeys(boxes, disposables, {
					onActivate: index => {
						const label = item.options[index];
						if (label === undefined) {
							return;
						}
						if (chosen.has(label)) {
							chosen.delete(label);
						} else {
							chosen.add(label);
						}
						sync();
					},
				});
				continue;
			}

			if (item.options.length > 0) {
				const group = append(this.element, $('div.conversation-lens-question-options'));
				group.setAttribute('role', 'radiogroup');
				group.setAttribute('aria-label', item.title || options.message);
				const radios: HTMLElement[] = [];
				for (const option of item.options) {
					const radio = append(group, $('div.conversation-lens-question-option'));
					radio.setAttribute('role', 'radio');
					radio.textContent = option;
					radios.push(radio);
				}
				wireConversationSeatOptionKeys(radios, disposables, {
					role: 'radio',
					onActivate: index => {
						const label = item.options[index];
						if (label === undefined) {
							return;
						}
						selections.set(item.id, [label]);
						if (!needsExplicitSubmit && required.length === 1) {
							submit();
							return;
						}
						submitIfComplete();
					},
				});
			}
		}

		if (items.some(item => item.allowCustom === true)) {
			const input = append(this.element, $('input.conversation-lens-question-custom')) as HTMLInputElement;
			input.type = 'text';
			input.setAttribute('aria-label', localize('conversationLens.questionCustomAnswer', "Custom answer"));
			disposables.add(addDisposableListener(input, 'input', () => {
				customText = input.value;
			}));
			disposables.add(addDisposableListener(input, 'keydown', e => {
				if (e.key === 'Enter') {
					e.preventDefault();
					e.stopPropagation();
					submit();
				}
			}));
		}

		if (needsExplicitSubmit) {
			const actions = append(this.element, $('div.conversation-lens-question-actions'));
			const submitLabel = localize('conversationLens.questionSubmit', "Submit");
			const submitButton = this._register(new Button(actions, { ...defaultButtonStyles, ariaLabel: submitLabel }));
			submitButton.label = submitLabel;
			this._register(submitButton.onDidClick(() => submit()));
		}
	}
}
