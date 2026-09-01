/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, reset } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import {
	conversationLensVoiceRecording,
	conversationLensVoiceTranscriptHint,
	conversationLensVoiceTranscriptLabel,
	conversationLensVoiceTranscribing,
	conversationLensVoiceTranscribingDetail,
} from './conversationLensDockStrings.js';
import { ConversationVoiceClip } from './conversationVoiceTranscriptModel.js';

export const conversationLensVoiceTranscriptBarClass = 'conversation-lens-voice-transcript-bar';

/**
 * Stub voice transcription queue above the composer. Not MessageQueue.
 */
export class ConversationVoiceTranscriptBar extends Disposable {

	readonly element: HTMLElement;

	private readonly listRoot: HTMLElement;
	private composerVisible = true;

	constructor(parent: HTMLElement) {
		super();

		this.element = append(parent, $(`.${conversationLensVoiceTranscriptBarClass}`));
		this.element.hidden = true;
		this.element.setAttribute('role', 'region');
		this.element.setAttribute('aria-label', conversationLensVoiceTranscriptLabel);

		const panel = append(this.element, $('.conversation-lens-voice-transcript-panel'));
		append(panel, $('.conversation-lens-voice-transcript-header')).textContent = conversationLensVoiceTranscriptLabel;
		this.listRoot = append(panel, $('.conversation-lens-voice-transcript-list'));
		append(panel, $('.conversation-lens-voice-transcript-hint')).textContent = conversationLensVoiceTranscriptHint;
	}

	setComposerVisible(visible: boolean): void {
		this.composerVisible = visible;
		this.element.classList.toggle('conversation-lens-voice-transcript-bar--composer-hidden', !visible);
	}

	render(clips: readonly ConversationVoiceClip[]): void {
		reset(this.listRoot);
		const show = this.composerVisible && clips.length > 0;
		this.element.hidden = !show;
		if (!show) {
			return;
		}
		for (const clip of clips) {
			const row = append(this.listRoot, $('.conversation-lens-voice-transcript-row'));
			const icon = append(row, $('span.conversation-lens-voice-transcript-row-icon'));
			icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.mic));
			const body = append(row, $('.conversation-lens-voice-transcript-row-body'));
			const recording = clip.status === 'recording';
			append(body, $('.conversation-lens-voice-transcript-row-status')).textContent = recording
				? conversationLensVoiceRecording
				: conversationLensVoiceTranscribing;
			const detail = append(body, $('.conversation-lens-voice-transcript-row-detail'));
			detail.textContent = recording
				? clip.durationLabel
				: `${clip.durationLabel} · ${conversationLensVoiceTranscribingDetail}`;
		}
	}
}
