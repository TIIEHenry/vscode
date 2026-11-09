/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { IVSCodeExtensionContext } from '../../../../../platform/extContext/common/extensionContext';
import { TestLogService } from '../../../../../platform/testing/common/testLogService';
import { IInstantiationService } from '../../../../../util/vs/platform/instantiation/common/instantiation';
import { IChatSessionMetadataStore } from '../../../common/chatSessionMetadataStore';
import { CustomSessionTitleService } from '../customSessionTitleServiceImpl';

const LEGACY_TITLES_KEY = 'github.copilot.cli.customSessionTitles';

/** Like the extension host memento, `get` returns the stored object itself, so in-place changes show. */
class MockGlobalState implements vscode.Memento {
	private readonly data = new Map<string, unknown>();

	get<T>(key: string, defaultValue?: T): T {
		const value = this.data.get(key);
		return (value ?? defaultValue) as T;
	}

	async update(key: string, value: unknown): Promise<void> {
		if (value === undefined) {
			this.data.delete(key);
		} else {
			this.data.set(key, value);
		}
	}

	keys(): readonly string[] {
		return Array.from(this.data.keys());
	}

	seed(key: string, value: unknown): void {
		this.data.set(key, value);
	}
}

describe('CustomSessionTitleService legacy title migration', () => {
	let globalState: MockGlobalState;
	const setCustomTitle = vi.fn<(sessionId: string, title: string) => Promise<void>>();
	let service: CustomSessionTitleService;

	beforeEach(() => {
		globalState = new MockGlobalState();
		setCustomTitle.mockReset();
		setCustomTitle.mockResolvedValue(undefined);
		const metadataStore = {
			getCustomTitle: async () => undefined,
			setCustomTitle,
		} as unknown as IChatSessionMetadataStore;
		service = new CustomSessionTitleService({ globalState } as unknown as IVSCodeExtensionContext, {} as unknown as IInstantiationService, new TestLogService(), metadataStore);
	});

	it('keeps the legacy title when it cannot be stored and still returns it', async () => {
		const legacy = { 'session-1': { title: 'Legacy title', updatedAt: 1 } };
		globalState.seed(LEGACY_TITLES_KEY, legacy);
		setCustomTitle.mockRejectedValue(new Error('metadata unreadable'));
		const update = vi.spyOn(globalState, 'update');

		await expect(service.getCustomSessionTitle('session-1')).resolves.toBe('Legacy title');

		expect(update).not.toHaveBeenCalled();
		expect(globalState.get(LEGACY_TITLES_KEY)).toBe(legacy);
		expect(legacy['session-1']).toBeDefined();
	});

	it('removes the legacy title only after it was stored, without changing the memento object in place', async () => {
		const legacy = { 'session-1': { title: 'Legacy title', updatedAt: 1 } };
		globalState.seed(LEGACY_TITLES_KEY, legacy);
		const update = vi.spyOn(globalState, 'update');

		await expect(service.getCustomSessionTitle('session-1')).resolves.toBe('Legacy title');

		expect(setCustomTitle).toHaveBeenCalledWith('session-1', 'Legacy title');
		expect(setCustomTitle.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
		expect(globalState.get(LEGACY_TITLES_KEY)).toBeUndefined();
		expect(legacy['session-1']).toBeDefined();
	});

	it('still returns the stored title when the legacy entry cannot be removed', async () => {
		globalState.seed(LEGACY_TITLES_KEY, { 'session-1': { title: 'Legacy title', updatedAt: 1 } });
		vi.spyOn(globalState, 'update').mockRejectedValue(new Error('storage unavailable'));

		await expect(service.getCustomSessionTitle('session-1')).resolves.toBe('Legacy title');

		expect(setCustomTitle).toHaveBeenCalledWith('session-1', 'Legacy title');
	});

	it('removes both legacy titles when two sessions migrate at the same time', async () => {
		globalState.seed(LEGACY_TITLES_KEY, {
			'session-1': { title: 'First', updatedAt: 1 },
			'session-2': { title: 'Second', updatedAt: 2 },
		});

		await Promise.all([service.getCustomSessionTitle('session-1'), service.getCustomSessionTitle('session-2')]);

		expect(globalState.get(LEGACY_TITLES_KEY)).toBeUndefined();
	});
});
