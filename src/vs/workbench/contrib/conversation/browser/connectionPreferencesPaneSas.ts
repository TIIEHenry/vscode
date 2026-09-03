/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import {
	formatRecoverTrustDialogBody,
	formatSasDialogBody,
	RECOVER_TRUST_CANCEL_BUTTON_LABEL,
	RECOVER_TRUST_CONFIRM_BUTTON_LABEL,
	SAS_CANCEL_BUTTON_LABEL,
	SAS_CONFIRM_BUTTON_LABEL,
	SAS_FORBIDDEN_BUTTON_PATTERNS,
} from './connectionPreferencesPaneLabels.js';

export type SasConfirmDialogInput = {
	readonly displayName: string;
	readonly sasCode?: string;
	readonly engineIdentityId: string;
};

export type SasConfirmDialogResult = {
	readonly confirmed: boolean;
	readonly buttonLabels: readonly string[];
};

/** Native SAS confirmation — exactly two buttons, no skip/trust (connection-hub §4.2). */
export async function promptSasConfirmDialog(
	dialogService: IDialogService,
	input: SasConfirmDialogInput,
): Promise<SasConfirmDialogResult> {
	const detail = formatSasDialogBody(input);
	const confirmLabel = SAS_CONFIRM_BUTTON_LABEL;
	const cancelLabel = SAS_CANCEL_BUTTON_LABEL;
	const buttonLabels = [confirmLabel, cancelLabel] as const;

	for (const pattern of SAS_FORBIDDEN_BUTTON_PATTERNS) {
		if (pattern.test(confirmLabel) || pattern.test(cancelLabel)) {
			throw new Error('SAS dialog must not expose skip/trust buttons');
		}
	}

	const result = await dialogService.prompt<boolean>({
		type: 'info',
		message: localize('ua.connectionSasTitle', "Confirm Engine pairing code"),
		detail,
		buttons: [
			{ label: confirmLabel, run: () => true },
			{ label: cancelLabel, run: () => false },
		],
		cancelButton: { run: () => false },
	});

	return {
		confirmed: result.result === true,
		buttonLabels,
	};
}

/** Desktop ADR-031 — identity + fingerprint only; separate input type (no sasCode). */
export type RecoverTrustConfirmDialogInput = {
	readonly displayName: string;
	readonly engineIdentityId: string;
	readonly leafSha256Hex: string;
};

export type RecoverTrustConfirmDialogResult = {
	readonly confirmed: boolean;
	readonly buttonLabels: readonly string[];
};

export async function promptRecoverTrustConfirmDialog(
	dialogService: IDialogService,
	input: RecoverTrustConfirmDialogInput,
): Promise<RecoverTrustConfirmDialogResult> {
	const detail = formatRecoverTrustDialogBody(input);
	const confirmLabel = RECOVER_TRUST_CONFIRM_BUTTON_LABEL;
	const cancelLabel = RECOVER_TRUST_CANCEL_BUTTON_LABEL;
	const buttonLabels = [confirmLabel, cancelLabel] as const;

	const result = await dialogService.prompt<boolean>({
		type: 'info',
		message: localize('ua.connectionRecoverTrustTitle', "Recover trust for {0}?", input.displayName),
		detail,
		buttons: [
			{ label: confirmLabel, run: () => true },
			{ label: cancelLabel, run: () => false },
		],
		cancelButton: { run: () => false },
	});

	return {
		confirmed: result.result === true,
		buttonLabels,
	};
}
