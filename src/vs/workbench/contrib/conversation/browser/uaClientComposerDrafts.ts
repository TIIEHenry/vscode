/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

/** Workspace+machine only; draft body must not roam through Settings Sync. */
export const UA_CLIENT_COMPOSER_DRAFTS_STORAGE_KEY = 'ua.client.chatInput.drafts.v1';

type ComposerDraftMap = Record<string, string>;

function readDraftMap(storageService: IStorageService): ComposerDraftMap {
	const raw = storageService.get(UA_CLIENT_COMPOSER_DRAFTS_STORAGE_KEY, StorageScope.WORKSPACE);
	if (!raw) {
		return {};
	}
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return {};
		}
		const result: ComposerDraftMap = {};
		for (const [sessionId, text] of Object.entries(parsed as Record<string, unknown>)) {
			if (typeof text === 'string') {
				result[sessionId] = text;
			}
		}
		return result;
	} catch {
		return {};
	}
}

export function loadUaClientComposerDraft(storageService: IStorageService, sessionId: string): string {
	return readDraftMap(storageService)[sessionId] ?? '';
}

export function storeUaClientComposerDraft(storageService: IStorageService, sessionId: string, text: string): void {
	const drafts = readDraftMap(storageService);
	if (text) {
		drafts[sessionId] = text;
	} else {
		delete drafts[sessionId];
	}
	if (Object.keys(drafts).length === 0) {
		storageService.remove(UA_CLIENT_COMPOSER_DRAFTS_STORAGE_KEY, StorageScope.WORKSPACE);
		return;
	}
	storageService.store(
		UA_CLIENT_COMPOSER_DRAFTS_STORAGE_KEY,
		JSON.stringify(drafts),
		StorageScope.WORKSPACE,
		StorageTarget.MACHINE,
	);
}
