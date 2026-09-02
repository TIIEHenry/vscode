/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ConfirmationStatus, ConversationStubTurn } from './conversationStubModel.js';
import { getConversationTurnRoleLabel, getConversationTurnSummary } from './conversationTrajectoryList.js';

export function getConversationConfirmationStatusLabel(status: ConfirmationStatus): string {
	switch (status) {
		case 'pending':
			return localize('conversationLens.confirmationPending', "1 confirmation pending");
		case 'allowed':
			return localize('conversationLens.confirmationAllowed', "Allowed");
		case 'skipped':
			return localize('conversationLens.confirmationSkipped', "Skipped");
	}
}

export function getConversationPermissionSeatAriaLabel(status: ConfirmationStatus, message: string): string {
	const statusLabel = status === 'pending'
		? localize('conversationLens.permissionPendingStatus', "pending")
		: status === 'allowed'
			? localize('conversationLens.confirmationAllowed', "Allowed")
			: localize('conversationLens.confirmationSkipped', "Skipped");
	if (status === 'pending') {
		return localize(
			'conversationLens.permissionSeatAriaPending',
			"Permission, {0}, Input needed, {1}",
			statusLabel,
			message,
		);
	}
	return localize(
		'conversationLens.permissionSeatAria',
		"Permission, {0}, {1}",
		statusLabel,
		message,
	);
}

export function getConversationConfirmationSeatAriaLabel(status: ConfirmationStatus, message: string): string {
	return getConversationPermissionSeatAriaLabel(status, message);
}

export function getConversationQuestionSeatAriaLabel(status: ConfirmationStatus, message: string): string {
	const statusLabel = status === 'allowed'
		? localize('conversationLens.questionAnsweredBadge', "Answered")
		: localize('conversationLens.questionPendingBadge', "Input needed");
	if (status !== 'allowed') {
		return localize(
			'conversationLens.questionSeatAriaPending',
			"Question, {0}, {1}",
			statusLabel,
			message,
		);
	}
	return localize(
		'conversationLens.questionSeatAria',
		"Question, {0}, {1}",
		statusLabel,
		message,
	);
}

function conversationTurnAgentSuffix(turn: ConversationStubTurn): string {
	return turn.agentId && turn.agentId !== 'default'
		? localize('conversationAccessibility.ariaAgent', ", Agent {0}", turn.agentId)
		: '';
}

/**
 * Stable row name for the timeline / tree.
 * Streaming rows add an "in progress" suffix only while `streaming` is true;
 * the growing token body is omitted so aria-label does not update per token.
 */
export function getConversationTurnAriaLabel(turn: ConversationStubTurn): string {
	const agent = conversationTurnAgentSuffix(turn);
	const streaming = turn.streaming
		? localize('conversationAccessibility.ariaInProgress', ", in progress")
		: '';
	const summary = turn.streaming
		? ''
		: (turn.text.trim() || localize('conversationAccessibility.emptySummary', "(empty)"));

	if (turn.kind === 'confirmation') {
		const seat = getConversationPermissionSeatAriaLabel(turn.status ?? 'pending', turn.streaming ? '' : turn.text);
		return streaming ? `${seat}${streaming}` : seat;
	}
	if (turn.kind === 'question') {
		const seat = getConversationQuestionSeatAriaLabel(turn.status ?? 'pending', turn.streaming ? '' : turn.text);
		return streaming ? `${seat}${streaming}` : seat;
	}
	if (turn.kind === 'error') {
		const retry = turn.retryable
			? localize('conversationAccessibility.errorRetryable', "retryable")
			: localize('conversationAccessibility.errorNotRetryable', "not retryable");
		return turn.streaming
			? localize('conversationAccessibility.errorAriaStreaming', "Error, {0}{1}{2}", retry, agent, streaming)
			: localize('conversationAccessibility.errorAria', "Error, {0}{1}: {2}", retry, agent, summary);
	}
	if (turn.kind === 'unknown') {
		const typeName = turn.typeName || localize('conversationAccessibility.unknownType', "unknown type");
		return turn.streaming
			? localize('conversationAccessibility.unknownAriaStreaming', "Unknown content, {0}{1}{2}", typeName, agent, streaming)
			: localize('conversationAccessibility.unknownAria', "Unknown content, {0}{1}: {2}", typeName, agent, summary);
	}
	if (turn.kind === 'visualization') {
		const title = turn.streaming ? '' : (turn.visualize?.title || summary);
		return localize('conversationAccessibility.visualizeAria', "Visualization{0}{1}{2}", title ? `, ${title}` : '', agent, streaming);
	}
	if (turn.kind === 'reviewNav') {
		return localize('conversationAccessibility.reviewNavAria', "Review, {0}{1}", summary || localize('conversationAccessibility.emptySummary', "(empty)"), agent);
	}
	if (turn.kind === 'system') {
		return turn.streaming
			? localize('conversationAccessibility.systemAriaStreaming', "System{0}{1}", agent, streaming)
			: localize('conversationAccessibility.systemAria', "System{0}: {1}", agent, summary);
	}

	const role = getConversationTurnRoleLabel(turn.kind);
	return turn.streaming
		? localize('conversationAccessibility.turnAriaStreaming', "{0}{1}{2}", role, agent, streaming)
		: localize('conversationAccessibility.turnAria', "{0}{1}: {2}", role, agent, summary || getConversationTurnSummary(turn));
}

/** Full turn text for Accessible View. Includes the body even while streaming. */
export function getConversationTurnAccessibleText(turn: ConversationStubTurn): string {
	const header = getConversationTurnAriaLabel({ ...turn, streaming: false });
	const body = turn.kind === 'unknown'
		? (turn.rawContent ?? turn.text)
		: turn.text;
	if (!body.trim()) {
		return header;
	}
	if (header.includes(body.trim())) {
		return header;
	}
	return `${header}\n\n${body}`;
}
