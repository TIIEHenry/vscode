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

export function getConversationConfirmationSeatAriaLabel(status: ConfirmationStatus, message: string): string {
	const statusLabel = getConversationConfirmationStatusLabel(status);
	if (status === 'pending') {
		return localize(
			'conversationLens.confirmationSeatAriaPending',
			"Confirmation, {0}, Input needed, {1}",
			statusLabel,
			message,
		);
	}
	return localize(
		'conversationLens.confirmationSeatAria',
		"Confirmation, {0}, {1}",
		statusLabel,
		message,
	);
}

export function getConversationTurnAriaLabel(turn: ConversationStubTurn): string {
	if (turn.kind === 'confirmation') {
		return getConversationConfirmationSeatAriaLabel(turn.status ?? 'pending', turn.text);
	}
	return localize(
		'conversationLens.turnAriaLabel',
		"{0}: {1}",
		getConversationTurnRoleLabel(turn.kind),
		getConversationTurnSummary(turn),
	);
}
