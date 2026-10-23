/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { appendFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { appendFile, rename, stat, unlink, writeFile } from 'fs/promises';
import { readFileTextOrUndefined, tryParseJson } from '../../../util/node/jsonFile';
import { BugIndicatingError } from '../../../util/vs/base/common/errors';

export class FlushableJSONFile<T> {
	public static async loadOrCreate<T>(filePath: string, initialValue: T): Promise<FlushableJSONFile<T>> {
		let data: T = initialValue;

		const result = await readFileTextOrUndefined(filePath);
		if (result !== undefined) {
			const parsed = tryParseJson(result) as T | undefined;
			if (parsed !== undefined) {
				data = parsed;
			}
		}

		return new FlushableJSONFile(filePath, data, result !== undefined);
	}

	private _value: T;
	public get value(): Readonly<T> { return this._value; }

	private _dirty = false;


	private constructor(
		public readonly filePath: string,
		initialValue: T,
		private _exists = false,
	) {
		this._value = initialValue;
	}

	public setValue(value: T): void {
		this._value = value;
		this._dirty = true;
	}

	async flushAsync(): Promise<void> {
		if (!this._dirty) { return; }

		const jsonStr = JSON.stringify(this._value, null, 4);

		const tempFilePath = this.filePath + '.new';

		// TODO test what can go wrong here!
		await writeFile(tempFilePath, jsonStr, { encoding: 'utf8' });
		if (this._exists) {
			await unlink(this.filePath);
		}
		await rename(tempFilePath, this.filePath);
		this._exists = true;

		this._dirty = false;
	}

	flushSync(): void {
		if (!this._dirty) { return; }

		const json = JSON.stringify(this._value, null, 4);

		const tempFilePath = this.filePath + '.new';
		// TODO test what can go wrong here!
		writeFileSync(tempFilePath, json, { encoding: 'utf8' });
		if (this._exists) {
			unlinkSync(this.filePath);
		}
		renameSync(tempFilePath, this.filePath);
		this._exists = true;

		this._dirty = false;
	}
}

export class FlushableSafeJSONLFile<T> {
	private _lock = false;
	private readonly _newEntries: string[] = [];

	constructor(
		public readonly filePath: string
	) { }

	appendEntry(data: T): void {
		this._newEntries.push(JSON.stringify(data));
	}

	private _pendingText(count: number): string {
		return this._newEntries.slice(0, count).map(l => '\n' + l).join('');
	}

	async flushAsync(): Promise<void> {
		if (this._newEntries.length === 0) { return; }

		if (this._lock) { throw new BugIndicatingError('Locked!'); }
		this._lock = true;
		const batchCount = this._newEntries.length;
		const text = this._pendingText(batchCount);
		try {
			if (text === '') { return; }

			await appendFile(this.filePath, text, { encoding: 'utf8' });
			// Entries appended while the write was in flight stay after this batch.
			this._newEntries.splice(0, batchCount);
		} finally {
			this._lock = false;
		}
	}

	flushSync(): void {
		if (this._newEntries.length === 0) { return; }

		// An async flush already owns this batch. Leave the queue for that flush.
		if (this._lock) { return; }

		const batchCount = this._newEntries.length;
		const text = this._pendingText(batchCount);
		if (text === '') { return; }
		appendFileSync(this.filePath, text, { encoding: 'utf8' });
		this._newEntries.splice(0, batchCount);
	}
}

export async function getFileSize(filePath: string): Promise<number | undefined> {
	try {
		const stats = await stat(filePath);
		return stats.size;
	} catch {
		return undefined;
	}
}
