/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createWriteStream, WriteStream, promises } from 'fs';
import type { FileHandle } from 'fs/promises';
import { Readable } from 'stream';
import { createCancelablePromise, Sequencer } from '../common/async.js';
import { CancellationToken } from '../common/cancellation.js';
import { isEqualOrParent } from '../common/extpath.js';
import * as path from '../common/path.js';
import { assertReturnsDefined } from '../common/types.js';
import { generateUuid } from '../common/uuid.js';
import { Promises } from './pfs.js';
import * as nls from '../../nls.js';
import type { Entry, ZipFile } from 'yauzl';

export const CorruptZipMessage: string = 'end of central directory record signature not found';
const CORRUPT_ZIP_PATTERN = new RegExp(CorruptZipMessage);

export interface IExtractOptions {
	overwrite?: boolean;

	/**
	 * Source path within the ZIP archive. Only the files contained in this
	 * path will be extracted.
	 */
	sourcePath?: string;
}

interface ISourcePathMatcher {
	matches(fileName: string): boolean;
	stripPrefix(fileName: string): string | undefined;
}

interface IExtractZipOptions {
	sourcePathMatcher: ISourcePathMatcher;
}

const EXTRACT_REPLACE_BYPASS_SUFFIX = '.extract-replace';

function escapeRegExp(source: string): string {
	return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createSourcePathMatcher(sourcePath: string | undefined): ISourcePathMatcher {
	if (!sourcePath) {
		return {
			matches: () => true,
			stripPrefix: fileName => fileName
		};
	}

	const hasTrailingSlash = sourcePath.endsWith('/');
	const literal = escapeRegExp(sourcePath);
	const prefixPattern = hasTrailingSlash
		? new RegExp(`^${literal}`)
		: new RegExp(`^${literal}(?:$|/)`);

	return {
		matches: fileName => prefixPattern.test(fileName),
		stripPrefix: fileName => {
			if (!prefixPattern.test(fileName)) {
				return undefined;
			}

			if (hasTrailingSlash) {
				const rest = fileName.slice(sourcePath.length);
				return rest === '' ? undefined : rest;
			}

			if (fileName.length === sourcePath.length) {
				return undefined;
			}

			return fileName.slice(sourcePath.length + 1);
		}
	};
}

async function swapExtractedDirectoryIntoPlace(tempPath: string, targetPath: string): Promise<void> {
	const targetExisted = await Promises.exists(targetPath);
	const bypassPath = `${targetPath}${EXTRACT_REPLACE_BYPASS_SUFFIX}`;

	if (targetExisted) {
		await Promises.rename(targetPath, bypassPath, false /* no retry */);
	}

	try {
		await Promises.rename(tempPath, targetPath, false /* no retry */);
	} catch (error) {
		if (targetExisted) {
			try {
				await Promises.rename(bypassPath, targetPath, false /* no retry */);
			} catch {
				// ignore — same as recovery swap restore failure
			}
		}

		throw error;
	}

	if (targetExisted) {
		await Promises.rm(bypassPath).catch(() => { /* ignore */ });
	}
}

export type ExtractErrorType = 'CorruptZip' | 'Incomplete';

export class ExtractError extends Error {

	readonly type?: ExtractErrorType;

	constructor(type: ExtractErrorType | undefined, cause: Error) {
		let message = cause.message;

		switch (type) {
			case 'CorruptZip': message = `Corrupt ZIP: ${message}`; break;
		}

		super(message);
		this.type = type;
		this.cause = cause;
	}
}

function modeFromEntry(entry: Entry) {
	const attr = entry.externalFileAttributes >> 16 || 33188;

	return [448 /* S_IRWXU */, 56 /* S_IRWXG */, 7 /* S_IRWXO */]
		.map(mask => attr & mask)
		.reduce((a, b) => a + b, attr & 61440 /* S_IFMT */);
}

function toExtractError(err: Error): ExtractError {
	if (err instanceof ExtractError) {
		return err;
	}

	let type: ExtractErrorType | undefined = undefined;

	if (CORRUPT_ZIP_PATTERN.test(err.message)) {
		type = 'CorruptZip';
	}

	return new ExtractError(type, err);
}

export function isZipEntryWithinTarget(entryRelativePath: string, targetDirectory: string): boolean {
	const resolvedPath = path.normalize(path.join(targetDirectory, entryRelativePath));
	const normalizedTarget = path.normalize(targetDirectory);
	return isEqualOrParent(resolvedPath, normalizedTarget);
}

function extractEntry(stream: Readable, fileName: string, mode: number, targetPath: string, token: CancellationToken): Promise<void> {
	if (!isZipEntryWithinTarget(fileName, targetPath)) {
		return Promise.reject(new Error(nls.localize('invalid file', "Error extracting {0}. Invalid file.", fileName)));
	}
	const dirName = path.dirname(fileName);
	const targetDirName = path.join(targetPath, dirName);
	const targetFileName = path.join(targetPath, fileName);

	let istream: WriteStream;

	const listener = token.onCancellationRequested(() => {
		istream?.destroy();
	});

	return Promise.resolve(promises.mkdir(targetDirName, { recursive: true })).then(() => new Promise<void>((c, e) => {
		if (token.isCancellationRequested) {
			c();
			return;
		}

		try {
			istream = createWriteStream(targetFileName, { mode });
			istream.once('close', () => c());
			istream.once('error', e);
			stream.once('error', e);
			stream.pipe(istream);
		} catch (error) {
			e(error);
		}
	})).finally(() => listener.dispose());
}

function extractZip(zipfile: ZipFile, targetPath: string, options: IExtractZipOptions, token: CancellationToken): Promise<void> {
	let last = createCancelablePromise<void>(() => Promise.resolve());
	let extractedEntriesCount = 0;

	const listener = token.onCancellationRequested(() => {
		last.cancel();
		zipfile.close();
	});

	return new Promise<void>((c, e) => {
		const throttler = new Sequencer();

		const readNextEntry = (token: CancellationToken) => {
			if (token.isCancellationRequested) {
				return;
			}

			extractedEntriesCount++;
			zipfile.readEntry();
		};

		zipfile.once('error', e);
		zipfile.once('close', () => last.then(() => {
			if (token.isCancellationRequested || zipfile.entryCount === extractedEntriesCount) {
				c();
			} else {
				e(new ExtractError('Incomplete', new Error(nls.localize('incompleteExtract', "Incomplete. Found {0} of {1} entries", extractedEntriesCount, zipfile.entryCount))));
			}
		}, e));
		zipfile.readEntry();
		zipfile.on('entry', (entry: Entry) => {

			if (token.isCancellationRequested) {
				return;
			}

			if (!options.sourcePathMatcher.matches(entry.fileName)) {
				readNextEntry(token);
				return;
			}

			const fileName = options.sourcePathMatcher.stripPrefix(entry.fileName);
			if (fileName === undefined) {
				readNextEntry(token);
				return;
			}

			// directory file names end with '/'
			if (/\/$/.test(fileName)) {
				if (!isZipEntryWithinTarget(fileName, targetPath)) {
					last = createCancelablePromise(() => Promise.reject(new Error(nls.localize('invalid file', "Error extracting {0}. Invalid file.", fileName))).then(undefined, e));
					return;
				}
				const targetFileName = path.join(targetPath, fileName);
				last = createCancelablePromise(token => promises.mkdir(targetFileName, { recursive: true }).then(() => readNextEntry(token)).then(undefined, e));
				return;
			}

			const stream = openZipStream(zipfile, entry);
			const mode = modeFromEntry(entry);

			last = createCancelablePromise(token => throttler.queue(() => stream.then(stream => extractEntry(stream, fileName, mode, targetPath, token).then(() => readNextEntry(token)))).then(null, e));
		});
	}).finally(() => listener.dispose());
}

async function openZip(zipFile: string, lazy: boolean = false): Promise<ZipFile> {
	const { open } = await import('yauzl');

	return new Promise<ZipFile>((resolve, reject) => {
		open(zipFile, lazy ? { lazyEntries: true } : undefined!, (error: Error | null, zipfile?: ZipFile) => {
			if (error) {
				reject(toExtractError(error));
			} else {
				resolve(assertReturnsDefined(zipfile));
			}
		});
	});
}

function openZipStream(zipFile: ZipFile, entry: Entry): Promise<Readable> {
	return new Promise<Readable>((resolve, reject) => {
		zipFile.openReadStream(entry, (error: Error | null, stream?: Readable) => {
			if (error) {
				reject(toExtractError(error));
			} else {
				resolve(assertReturnsDefined(stream));
			}
		});
	});
}

export interface IFile {
	path: string;
	contents?: Buffer | string;
	localPath?: string;
	/**
	 * When set (and `contents` is not provided), stream at most this many bytes
	 * from the start of {@link localPath} instead of adding the whole file. The
	 * prefix is clamped to the file's current size so a rotated or truncated file
	 * still produces a valid entry.
	 */
	localPathSize?: number;
	/**
	 * Skip the entry when its local source cannot be opened or inspected.
	 */
	skipSourceErrors?: boolean;
}

export interface IZipValidationOptions {
	readonly maxEntries: number;
	readonly maxUncompressedSize?: number;
}

export async function validateZip(zipPath: string, options: IZipValidationOptions): Promise<void> {
	const zipfile = await openZip(zipPath, true);
	return new Promise<void>((resolve, reject) => {
		let entries = 0;
		let uncompressedSize = 0;
		let settled = false;
		const fail = (error: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			zipfile.close();
			reject(error);
		};
		zipfile.once('error', error => fail(toExtractError(error)));
		zipfile.once('end', () => {
			if (!settled) {
				settled = true;
				resolve();
			}
		});
		zipfile.on('entry', (entry: Entry) => {
			entries++;
			uncompressedSize += entry.uncompressedSize;
			if (entries > options.maxEntries) {
				fail(new Error(`ZIP contains too many entries (${entries}; limit ${options.maxEntries})`));
				return;
			}
			if (options.maxUncompressedSize !== undefined && uncompressedSize > options.maxUncompressedSize) {
				fail(new Error(`ZIP expands beyond the allowed size (${uncompressedSize} bytes; limit ${options.maxUncompressedSize} bytes)`));
				return;
			}
			zipfile.readEntry();
		});
		zipfile.readEntry();
	});
}

export async function zip(zipPath: string, files: IFile[]): Promise<string> {
	const { ZipFile } = await import('yazl');

	const zip = new ZipFile();
	const zipStream = createWriteStream(zipPath);

	// Attach error/finish handling before adding entries so a read stream that
	// errors while a later entry is still awaiting I/O has a listener.
	const result = new Promise<string>((c, e) => {
		zip.outputStream.once('error', e);
		zipStream.once('error', e);
		zipStream.once('finish', () => c(zipPath));
	});
	zip.outputStream.pipe(zipStream);

	for (const f of files) {
		if (f.contents !== undefined) {
			zip.addBuffer(typeof f.contents === 'string' ? Buffer.from(f.contents, 'utf8') : f.contents, f.path);
		} else if (f.localPath) {
			if (f.localPathSize === undefined && !f.skipSourceErrors) {
				zip.addFile(f.localPath, f.path);
			} else {
				// yazl aborts the archive unless the streamed byte count matches the
				// declared size. Derive both from a single handle so the counts match
				// even if the path is rotated or truncated concurrently; skip a
				// vanished file rather than failing the whole archive.
				let handle: FileHandle;
				try {
					handle = await promises.open(f.localPath, 'r');
				} catch (error) {
					if (f.skipSourceErrors) {
						continue;
					}
					throw error;
				}
				let streamOwnsHandle = false;
				try {
					let size: number;
					try {
						const currentSize = (await handle.stat()).size;
						size = f.localPathSize === undefined ? currentSize : Math.min(f.localPathSize, currentSize);
					} catch (error) {
						if (f.skipSourceErrors) {
							continue;
						}
						throw error;
					}
					if (size === 0) {
						zip.addBuffer(Buffer.alloc(0), f.path);
					} else {
						const readStream = handle.createReadStream({ start: 0, end: size - 1 });
						readStream.once('error', error => zip.outputStream.emit('error', error));
						zip.addReadStream(readStream, f.path, { size });
						streamOwnsHandle = true;
					}
				} finally {
					// The read stream closes the handle when it finishes.
					if (!streamOwnsHandle) {
						await handle.close();
					}
				}
			}
		}
	}
	zip.end();

	return result;
}
export function extract(zipPath: string, targetPath: string, options: IExtractOptions = {}, token: CancellationToken): Promise<void> {
	const sourcePathMatcher = createSourcePathMatcher(options.sourcePath);
	const extractOptions: IExtractZipOptions = { sourcePathMatcher };

	if (options.overwrite) {
		const tempPath = `${targetPath}.extract-temp-${generateUuid()}`;

		return openZip(zipPath, true).then(async zipfile => {
			try {
				await extractZip(zipfile, tempPath, extractOptions, token);
				await swapExtractedDirectoryIntoPlace(tempPath, targetPath);
			} catch (error) {
				await Promises.rm(tempPath).catch(() => { /* ignore */ });
				throw error;
			}
		});
	}

	return openZip(zipPath, true).then(zipfile => extractZip(zipfile, targetPath, extractOptions, token));
}

function read(zipPath: string, filePath: string): Promise<Readable> {
	return openZip(zipPath).then(zipfile => {
		return new Promise<Readable>((c, e) => {
			zipfile.once('error', err => e(toExtractError(err)));
			zipfile.on('entry', (entry: Entry) => {
				if (entry.fileName === filePath) {
					openZipStream(zipfile, entry).then(stream => c(stream), err => e(err));
				}
			});

			zipfile.once('close', () => e(new Error(nls.localize('notFound', "{0} not found inside zip.", filePath))));
		});
	});
}

export function buffer(zipPath: string, filePath: string): Promise<Buffer> {
	return read(zipPath, filePath).then(stream => {
		return new Promise<Buffer>((c, e) => {
			const buffers: Buffer[] = [];
			stream.once('error', e);
			stream.on('data', (b: Buffer) => buffers.push(b));
			stream.on('end', () => c(Buffer.concat(buffers)));
		});
	});
}
