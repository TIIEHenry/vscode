/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ConfirmationStatus } from './conversationStubModel.js';
import { getConversationTurnRoleLabel, getConversationTurnSummary } from './conversationTrajectoryList.js';
import type { ConversationStubTurn } from './conversationStubModel.js';

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

export function getConversationTurnAriaLabel(turn: ConversationStubTurn): string {
	if (turn.kind === 'confirmation') {
		return getConversationPermissionSeatAriaLabel(turn.status ?? 'pending', turn.text);
	}
	if ((turn.kind as string) === 'question') {
		return getConversationQuestionSeatAriaLabel(turn.status ?? 'pending', turn.text);
	}
	return localize(
		'conversationLens.turnAriaLabel',
		"{0}: {1}",
		getConversationTurnRoleLabel(turn.kind),
		getConversationTurnSummary(turn),
	);
}
