/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationSessionPill.css';
import { $, reset } from '../../../../base/browser/dom.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IConversationTimelineLinkHit } from './resolveConversationTimelineLink.js';

export const conversationSessionPillClass = 'conversation-session-pill';
export const conversationSessionPillKindAttribute = 'data-conversation-pill-kind';

export type ConversationSessionPillKind = 'session' | 'subagent';

export function conversationSessionPillKind(hit: IConversationTimelineLinkHit): ConversationSessionPillKind {
	return hit.originKind === 'tool' ? 'subagent' : 'session';
}

export function conversationSessionPillHoverLines(hit: IConversationTimelineLinkHit): string[] {
	const titleLine = hit.originKind === 'root' || !hit.catalogTitle
		? hit.sessionTitle
		: `${hit.sessionTitle} · ${hit.catalogTitle}`;
	const lines = [titleLine];
	const workDir = hit.workDir?.trim();
	if (workDir) {
		lines.push(workDir);
	}
	const model = hit.model?.trim();
	if (model) {
		lines.push(model);
	}
	return lines;
}

export function decorateConversationSessionPill(
	anchor: HTMLAnchorElement,
	hit: IConversationTimelineLinkHit,
	hoverService: IHoverService,
): IDisposable | undefined {
	if (anchor.classList.contains(conversationSessionPillClass)) {
		return undefined;
	}

	const kind = conversationSessionPillKind(hit);
	const icon = kind === 'subagent' ? Codicon.commentDiscussion : Codicon.agent;
	const labelText = anchor.textContent ?? '';
	const hoverLines = conversationSessionPillHoverLines(hit);
	const ariaLabel = hoverLines[0] ?? labelText;

	anchor.classList.add(conversationSessionPillClass);
	anchor.setAttribute(conversationSessionPillKindAttribute, kind);
	anchor.setAttribute('aria-label', ariaLabel);

	const iconSpan = $('span.conversation-session-pill-icon');
	iconSpan.setAttribute('aria-hidden', 'true');
	iconSpan.classList.add(...ThemeIcon.asClassNameArray(icon));
	const labelSpan = $('span.conversation-session-pill-label');
	labelSpan.textContent = labelText;
	reset(anchor, iconSpan, labelSpan);

	return hoverService.setupManagedHover(
		getDefaultHoverDelegate('element'),
		anchor,
		hoverLines.join('\n'),
	);
}
