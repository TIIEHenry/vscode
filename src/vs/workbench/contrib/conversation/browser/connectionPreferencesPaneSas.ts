/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	formatRecoverTrustDialogBody,
	formatSasDialogBody,
	RECOVER_TRUST_CANCEL_BUTTON_LABEL,
	RECOVER_TRUST_CONFIRM_BUTTON_LABEL,
	SAS_CANCEL_BUTTON_LABEL,
	SAS_CONFIRM_BUTTON_LABEL,
	isForbiddenSasButtonLabel,
} from './connectionPreferencesPaneLabels.js';

const $ = DOM.$;

export type SasConfirmDialogInput = {
	readonly displayName: string;
	readonly sasCode?: string;
	readonly engineIdentityId: string;
};

export type SasConfirmDialogResult = {
	readonly confirmed: boolean;
	readonly buttonLabels: readonly string[];
};

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

function assertSasButtonLabels(confirmLabel: string, cancelLabel: string): void {
	if (isForbiddenSasButtonLabel(confirmLabel) || isForbiddenSasButtonLabel(cancelLabel)) {
		throw new Error('SAS dialog must not expose skip/trust buttons');
	}
}

function renderPairingConfirmShell(
	container: HTMLElement,
	message: string,
	detail: string,
): { readonly dialogBox: HTMLElement; readonly buttonsContainer: HTMLElement } {
	DOM.clearNode(container);
	container.style.display = '';
	container.classList.add('connection-pairing-confirm');

	const dialogBox = DOM.append(container, $('.monaco-dialog-box'));
	dialogBox.setAttribute('role', 'dialog');
	dialogBox.setAttribute('aria-modal', 'true');

	const messageRow = DOM.append(dialogBox, $('.dialog-message-row'));
	const messageContainer = DOM.append(messageRow, $('.dialog-message-container'));
	const messageEl = DOM.append(messageContainer, $('.dialog-message'));
	messageEl.textContent = message;
	const detailEl = DOM.append(messageContainer, $('.dialog-message-detail'));
	detailEl.textContent = detail;

	const buttonsRow = DOM.append(dialogBox, $('.dialog-buttons-row'));
	const buttonsContainer = DOM.append(buttonsRow, $('.dialog-buttons'));

	return { dialogBox, buttonsContainer };
}

function clearPairingConfirmHost(container: HTMLElement): void {
	DOM.clearNode(container);
	container.style.display = 'none';
	container.classList.remove('connection-pairing-confirm');
}

async function promptPairingConfirmInPane(
	container: HTMLElement,
	message: string,
	detail: string,
	confirmLabel: string,
	cancelLabel: string,
): Promise<{ readonly confirmed: boolean; readonly buttonLabels: readonly [string, string] }> {
	const buttonLabels = [confirmLabel, cancelLabel] as const;
	const disposables = new DisposableStore();
	try {
		const { buttonsContainer } = renderPairingConfirmShell(container, message, detail);
		return await new Promise(resolve => {
			const confirmButton = disposables.add(new Button(buttonsContainer, defaultButtonStyles));
			confirmButton.label = confirmLabel;
			disposables.add(confirmButton.onDidClick(() => resolve({ confirmed: true, buttonLabels })));

			const cancelButton = disposables.add(new Button(buttonsContainer, defaultButtonStyles));
			cancelButton.label = cancelLabel;
			disposables.add(cancelButton.onDidClick(() => resolve({ confirmed: false, buttonLabels })));
		});
	} finally {
		disposables.dispose();
		clearPairingConfirmHost(container);
	}
}

/** In-pane SAS confirmation — visible inside Preferences modal (connection-hub §4.2). */
export async function promptSasConfirmInPane(
	container: HTMLElement,
	input: SasConfirmDialogInput,
): Promise<SasConfirmDialogResult> {
	const confirmLabel = SAS_CONFIRM_BUTTON_LABEL;
	const cancelLabel = SAS_CANCEL_BUTTON_LABEL;
	assertSasButtonLabels(confirmLabel, cancelLabel);
	return promptPairingConfirmInPane(
		container,
		localize('ua.connectionSasTitle', "Confirm Engine pairing code"),
		formatSasDialogBody(input),
		confirmLabel,
		cancelLabel,
	);
}

/** In-pane recoverTrust confirmation — visible inside Preferences modal. */
export async function promptRecoverTrustConfirmInPane(
	container: HTMLElement,
	input: RecoverTrustConfirmDialogInput,
): Promise<RecoverTrustConfirmDialogResult> {
	const confirmLabel = RECOVER_TRUST_CONFIRM_BUTTON_LABEL;
	const cancelLabel = RECOVER_TRUST_CANCEL_BUTTON_LABEL;
	return promptPairingConfirmInPane(
		container,
		localize('ua.connectionRecoverTrustTitle', "Recover trust for {0}?", input.displayName),
		formatRecoverTrustDialogBody(input),
		confirmLabel,
		cancelLabel,
	);
}

/** Native SAS confirmation — exactly two buttons, no skip/trust (connection-hub §4.2). */
export async function promptSasConfirmDialog(
	dialogService: IDialogService,
	input: SasConfirmDialogInput,
	paneContainer?: HTMLElement,
): Promise<SasConfirmDialogResult> {
	if (paneContainer) {
		return promptSasConfirmInPane(paneContainer, input);
	}

	const detail = formatSasDialogBody(input);
	const confirmLabel = SAS_CONFIRM_BUTTON_LABEL;
	const cancelLabel = SAS_CANCEL_BUTTON_LABEL;
	const buttonLabels = [confirmLabel, cancelLabel] as const;

	assertSasButtonLabels(confirmLabel, cancelLabel);

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

export async function promptRecoverTrustConfirmDialog(
	dialogService: IDialogService,
	input: RecoverTrustConfirmDialogInput,
	paneContainer?: HTMLElement,
): Promise<RecoverTrustConfirmDialogResult> {
	if (paneContainer) {
		return promptRecoverTrustConfirmInPane(paneContainer, input);
	}

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
