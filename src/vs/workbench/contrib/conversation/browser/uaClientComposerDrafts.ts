/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

/** Workspace+machine only; draft body must not roam through Settings Sync. */
export const UA_CLIENT_COMPOSER_DRAFTS_STORAGE_KEY = 'conversation.drafts.v1';

type ComposerDraftMap = Record<string, string>;

export function uaClientComposerDraftEntryKey(sessionId: string, chatId: string): string {
	return `${sessionId}/${chatId}`;
}

export function sessionIdFromUaClientComposerDraftEntryKey(entryKey: string): string {
	const slash = entryKey.lastIndexOf('/');
	return slash === -1 ? entryKey : entryKey.slice(0, slash);
}

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
		for (const [entryKey, text] of Object.entries(parsed as Record<string, unknown>)) {
			if (typeof text === 'string') {
				result[entryKey] = text;
			}
		}
		return result;
	} catch {
		return {};
	}
}

function writeDraftMap(storageService: IStorageService, drafts: ComposerDraftMap): void {
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

export function loadUaClientComposerDraft(storageService: IStorageService, sessionId: string, chatId: string): string {
	return readDraftMap(storageService)[uaClientComposerDraftEntryKey(sessionId, chatId)] ?? '';
}

export function storeUaClientComposerDraft(storageService: IStorageService, sessionId: string, chatId: string, text: string): void {
	const drafts = readDraftMap(storageService);
	const entryKey = uaClientComposerDraftEntryKey(sessionId, chatId);
	if (text) {
		drafts[entryKey] = text;
	} else {
		delete drafts[entryKey];
	}
	writeDraftMap(storageService, drafts);
}

export function removeUaClientComposerDraftsForSession(storageService: IStorageService, sessionId: string): void {
	const drafts = readDraftMap(storageService);
	let changed = false;
	for (const entryKey of Object.keys(drafts)) {
		if (sessionIdFromUaClientComposerDraftEntryKey(entryKey) === sessionId) {
			delete drafts[entryKey];
			changed = true;
		}
	}
	if (changed) {
		writeDraftMap(storageService, drafts);
	}
}

export function pruneUaClientComposerDrafts(storageService: IStorageService, liveSessionIds: readonly string[]): void {
	const live = new Set(liveSessionIds);
	const drafts = readDraftMap(storageService);
	let changed = false;
	for (const entryKey of Object.keys(drafts)) {
		if (!live.has(sessionIdFromUaClientComposerDraftEntryKey(entryKey))) {
			delete drafts[entryKey];
			changed = true;
		}
	}
	if (changed) {
		writeDraftMap(storageService, drafts);
	}
}
