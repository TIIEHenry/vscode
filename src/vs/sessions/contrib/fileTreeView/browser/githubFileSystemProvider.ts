/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType, IFileDeleteOptions, IFileOverwriteOptions, IFileSystemProviderWithFileReadWriteCapability, IFileWriteOptions, IStat, createFileSystemProviderError, IFileChange } from '../../../../platform/files/common/files.js';
import { IRequestService, asJson, asText } from '../../../../platform/request/common/request.js';
import { IAuthenticationService } from '../../../../workbench/services/authentication/common/authentication.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { GITHUB_REMOTE_FILE_SCHEME } from '../../../services/sessions/common/session.js';

/**
 * Owner, repo, and ref are one URI segment each. `decodeURIComponent` throws
 * on a truncated escape such as `100%`; keep the raw segment so the tree does
 * not fail closed. A branch slash is stored as `%2F` in that one segment.
 */
function decodeGitHubUriSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

/**
 * Derives a display name from a github-remote-file URI.
 * Returns "repo (branch)" or just "repo" when on HEAD.
 */
export function getGitHubRemoteFileDisplayName(uri: URI): string | undefined {
	if (uri.scheme !== GITHUB_REMOTE_FILE_SCHEME) {
		return undefined;
	}
	const parts = uri.path.split('/').filter(Boolean);
	// path = /{owner}/{repo}/{ref}/...
	if (parts.length >= 3) {
		const [, repo, ref] = parts;
		const decodedRepo = decodeGitHubUriSegment(repo);
		const decodedRef = decodeGitHubUriSegment(ref);
		if (decodedRef === 'HEAD') {
			return decodedRepo;
		}
		return `${decodedRepo} (${decodedRef})`;
	}
	return undefined;
}

/**
 * GitHub REST API response for the Trees endpoint.
 * GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1
 */
interface IGitHubTreeResponse {
	readonly sha: string;
	readonly url: string;
	readonly truncated: boolean;
	readonly tree: readonly IGitHubTreeEntry[];
}

interface IGitHubTreeEntry {
	readonly path: string;
	readonly mode: string;
	readonly type: 'blob' | 'tree' | 'commit';
	readonly sha: string;
	readonly size?: number;
	readonly url: string;
}

/** `commit` is a submodule. `symlink` is a blob with mode 120000. Only `blob` has Blobs API content. */
type GitHubTreeEntryKind = 'blob' | 'tree' | 'commit' | 'symlink';

interface ICachedTreeNode {
	readonly type: FileType;
	readonly size: number;
	readonly sha: string;
	readonly kind: GitHubTreeEntryKind;
}

interface ITreeCacheEntry {
	/** Map from path → entry metadata. */
	readonly entries: Map<string, ICachedTreeNode>;
	readonly fetchedAt: number;
	/**
	 * The recursive tree exceeded GitHub's limit. Directory listings come from
	 * one non-recursive request per directory instead of this partial snapshot.
	 */
	readonly lazy: boolean;
	/** Tree sha of the repository root. Used for the first lazy directory fetch. */
	readonly rootSha: string;
	/** Directories whose direct children are a complete listing. Root is `''`. */
	readonly completeDirectories: Set<string>;
	/**
	 * Directories whose own tree response was truncated. Listing them, or
	 * treating an unknown child as missing, would pretend the page is complete.
	 * Files that were included can still be read.
	 */
	readonly truncatedDirectories: Set<string>;
}

/**
 * A readonly virtual filesystem provider backed by the GitHub REST API.
 *
 * URI format: github-remote-file://github/{owner}/{repo}/{ref}/{path...}
 *
 * For example: github-remote-file://github/microsoft/vscode/main/src/vs/base/common/uri.ts
 *
 * A slash inside the ref stays in that one segment as `%2F`. Path segments
 * after the ref are the GitHub names as listed; they are not decoded again.
 *
 * This provider fetches the recursive tree from the GitHub Trees API on first
 * access and caches it. When that response is truncated, the partial snapshot
 * is not used as the repository: each directory is fetched without `recursive`
 * so a large repo can still be browsed. A directory whose own response is
 * truncated fails closed (listings and unknown children are Unavailable);
 * files included in that partial page can still be read.
 * On a complete tree, readdir throws FileNotFound for a non-root path that is
 * not a known directory. The root still lists as [] when it has no children.
 * Blob contents are fetched on demand via the Blobs API. Submodules (`commit`)
 * and symbolic links (mode 120000) stay in directory listings; reading them
 * fails instead of decoding a blob.
 */
export class GitHubFileSystemProvider extends Disposable implements IFileSystemProviderWithFileReadWriteCapability {

	private readonly _onDidChangeCapabilities = this._register(new Emitter<void>());
	readonly onDidChangeCapabilities: Event<void> = this._onDidChangeCapabilities.event;

	readonly capabilities: FileSystemProviderCapabilities =
		FileSystemProviderCapabilities.Readonly |
		FileSystemProviderCapabilities.FileReadWrite |
		FileSystemProviderCapabilities.PathCaseSensitive;

	private readonly _onDidChangeFile = this._register(new Emitter<readonly IFileChange[]>());
	readonly onDidChangeFile: Event<readonly IFileChange[]> = this._onDidChangeFile.event;

	/** Cache keyed by "owner/repo/ref" */
	private readonly treeCache = new Map<string, ITreeCacheEntry>();

	/** Negative cache for refs that returned 404, keyed by "owner/repo/ref" */
	private readonly notFoundCache = new Map<string, number>();

	/** In-flight fetch promises keyed by "owner/repo/ref" to deduplicate concurrent requests */
	private readonly pendingFetches = new Map<string, Promise<ITreeCacheEntry>>();

	/** In-flight non-recursive directory fetches, keyed by repo, cache generation, and directory path. */
	private readonly pendingDirFetches = new Map<string, Promise<void>>();

	/**
	 * Git's empty tree object. GitHub's Trees API returns 404 for this sha and
	 * for a branch that points at it — the same status as a missing ref.
	 * SHA-1 then SHA-256 (`git`'s `empty_tree` ids).
	 */
	private static readonly EMPTY_TREE_SHAS = new Set([
		'4b825dc642cb6eb9a060e54bf8d69288fbee4904',
		'6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321',
	]);

	/** Cache TTL - 5 minutes */
	private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

	/** Negative cache TTL - 1 minute */
	private static readonly NOT_FOUND_CACHE_TTL_MS = 60 * 1000;

	constructor(
		@IRequestService private readonly requestService: IRequestService,
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	// --- URI parsing

	/**
	 * Parse a github-remote-file URI into its components.
	 * Format: github-remote-file://github/{owner}/{repo}/{ref}/{path...}
	 *
	 * Only owner, repo, and ref are decoded. File names come back from
	 * readdir and are joined onto the URI as literal text. Decoding them
	 * again reads `a%2Fb.txt` as `a/b.txt`, and throws on a name like `100%`.
	 */
	private parseUri(resource: URI): { owner: string; repo: string; ref: string; path: string } {
		// authority = "github"
		// path = /{owner}/{repo}/{ref}/{rest...}
		const parts = resource.path.split('/').filter(Boolean);
		if (parts.length < 3) {
			throw createFileSystemProviderError('Invalid github-remote-file URI: expected /{owner}/{repo}/{ref}/...', FileSystemProviderErrorCode.FileNotFound);
		}

		const owner = decodeGitHubUriSegment(parts[0]);
		const repo = decodeGitHubUriSegment(parts[1]);
		const ref = decodeGitHubUriSegment(parts[2]);
		const path = parts.slice(3).join('/');

		return { owner, repo, ref, path };
	}

	private getCacheKey(owner: string, repo: string, ref: string): string {
		return `${owner}/${repo}/${ref}`;
	}

	// --- GitHub API

	private async getAuthToken(): Promise<string> {
		let sessions = await this.authenticationService.getSessions('github', [], { silent: true });
		if (!sessions || sessions.length === 0) {
			sessions = await this.authenticationService.getSessions('github', [], { createIfNone: true });
		}
		if (!sessions || sessions.length === 0) {
			throw createFileSystemProviderError('No GitHub authentication sessions available', FileSystemProviderErrorCode.Unavailable);
		}
		return sessions[0].accessToken ?? '';
	}

	private fetchTree(owner: string, repo: string, ref: string): Promise<ITreeCacheEntry> {
		const cacheKey = this.getCacheKey(owner, repo, ref);

		// Check positive cache
		const cached = this.treeCache.get(cacheKey);
		if (cached && (Date.now() - cached.fetchedAt) < GitHubFileSystemProvider.CACHE_TTL_MS) {
			return Promise.resolve(cached);
		}

		// Check negative cache (recently returned 404)
		const notFoundAt = this.notFoundCache.get(cacheKey);
		if (notFoundAt !== undefined && (Date.now() - notFoundAt) < GitHubFileSystemProvider.NOT_FOUND_CACHE_TTL_MS) {
			return Promise.reject(createFileSystemProviderError(`Tree not found for ${owner}/${repo}@${ref}`, FileSystemProviderErrorCode.FileNotFound));
		}

		// Deduplicate concurrent requests for the same tree
		const pending = this.pendingFetches.get(cacheKey);
		if (pending) {
			return pending;
		}

		const promise = this.doFetchTree(owner, repo, ref, cacheKey).finally(() => {
			this.pendingFetches.delete(cacheKey);
		});
		this.pendingFetches.set(cacheKey, promise);
		return promise;
	}

	private async doFetchTree(owner: string, repo: string, ref: string, cacheKey: string): Promise<ITreeCacheEntry> {
		this.logService.info(`[SessionRepoFS] Fetching tree for ${owner}/${repo}@${ref}`);
		const token = await this.getAuthToken();

		const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
		const response = await this.requestService.request({
			type: 'GET',
			url,
			headers: {
				'Authorization': `token ${token}`,
				'Accept': 'application/vnd.github.v3+json',
				'User-Agent': 'VSCode-SessionRepoFS',
			},
			callSite: 'githubFileSystemProvider.fetchTree'
		}, CancellationToken.None);

		// A branch that only has an empty commit 404s here, same as a missing ref.
		// Resolve that before remembering the 404, or the folder looks deleted.
		if (response.res.statusCode === 404) {
			const empty = await this.emptyTreeForRef(owner, repo, ref, token);
			if (empty) {
				this.notFoundCache.delete(cacheKey);
				this.treeCache.set(cacheKey, empty);
				return empty;
			}
			this.notFoundCache.set(cacheKey, Date.now());
			throw createFileSystemProviderError(`Tree not found for ${owner}/${repo}@${ref}`, FileSystemProviderErrorCode.FileNotFound);
		}

		if (response.res.statusCode === 409) {
			const text = await asText(response);
			if (text && /empty/i.test(text)) {
				const empty = this.emptyRootCache('');
				this.treeCache.set(cacheKey, empty);
				return empty;
			}
			throw createFileSystemProviderError(`Failed to fetch tree for ${owner}/${repo}@${ref}`, FileSystemProviderErrorCode.Unavailable);
		}

		const data = await asJson<IGitHubTreeResponse>(response);

		if (!data) {
			throw createFileSystemProviderError(`Failed to fetch tree for ${owner}/${repo}@${ref}`, FileSystemProviderErrorCode.Unavailable);
		}

		// A truncated recursive snapshot is not a directory listing. Keep only
		// the root sha and fill each directory from its own non-recursive tree.
		if (data.truncated === true) {
			this.logService.warn(`[SessionRepoFS] Tree for ${owner}/${repo}@${ref} is truncated; listing directories individually`);
			const entries = new Map<string, ICachedTreeNode>();
			entries.set('', this.directoryNode(data.sha));
			const cacheEntry: ITreeCacheEntry = {
				entries,
				fetchedAt: Date.now(),
				lazy: true,
				rootSha: data.sha,
				completeDirectories: new Set(),
				truncatedDirectories: new Set(),
			};
			this.treeCache.set(cacheKey, cacheEntry);
			return cacheEntry;
		}

		const entries = new Map<string, ICachedTreeNode>();

		// Add root directory entry
		entries.set('', this.directoryNode(data.sha));

		// Track directories implicitly from paths
		const dirs = new Set<string>();

		for (const entry of data.tree) {
			const cached = this.cacheTreeEntry(entry);
			entries.set(entry.path, cached);

			if (cached.kind === 'tree') {
				dirs.add(entry.path);
			}

			// Ensure parent directories are tracked
			const pathParts = entry.path.split('/');
			for (let i = 1; i < pathParts.length; i++) {
				const parentPath = pathParts.slice(0, i).join('/');
				if (!dirs.has(parentPath)) {
					dirs.add(parentPath);
					if (!entries.has(parentPath)) {
						entries.set(parentPath, this.directoryNode(''));
					}
				}
			}
		}

		const cacheEntry: ITreeCacheEntry = {
			entries,
			fetchedAt: Date.now(),
			lazy: false,
			rootSha: data.sha,
			completeDirectories: new Set(),
			truncatedDirectories: new Set(),
		};
		this.treeCache.set(cacheKey, cacheEntry);
		return cacheEntry;
	}

	/**
	 * fileService.resolve turns a thrown readdir into `children: []`, so a
	 * truncated directory must fail stat too — otherwise the missing page
	 * looks like an empty folder. Known files from that page stay readable.
	 */
	private truncatedTreeError(owner: string, repo: string, ref: string) {
		return createFileSystemProviderError(`GitHub tree for ${owner}/${repo}@${ref} is truncated`, FileSystemProviderErrorCode.Unavailable);
	}

	private isEmptyTreeSha(sha: string): boolean {
		return GitHubFileSystemProvider.EMPTY_TREE_SHAS.has(sha.toLowerCase());
	}

	/** A root with no children. `lazy: false` so readdir does not fetch again. */
	private emptyRootCache(sha: string): ITreeCacheEntry {
		const entries = new Map<string, ICachedTreeNode>();
		entries.set('', this.directoryNode(sha));
		return {
			entries,
			fetchedAt: Date.now(),
			lazy: false,
			rootSha: sha,
			completeDirectories: new Set(),
			truncatedDirectories: new Set(),
		};
	}

	/**
	 * Trees API 404. If the ref's commit really uses the empty tree, the
	 * folder is empty. Any other commit, or no commit, stays missing.
	 */
	private async emptyTreeForRef(owner: string, repo: string, ref: string, token: string): Promise<ITreeCacheEntry | undefined> {
		const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}`;
		const response = await this.requestService.request({
			type: 'GET',
			url,
			headers: {
				'Authorization': `token ${token}`,
				'Accept': 'application/vnd.github.v3+json',
				'User-Agent': 'VSCode-SessionRepoFS',
			},
			callSite: 'githubFileSystemProvider.emptyTree'
		}, CancellationToken.None);

		if (response.res.statusCode !== 200) {
			return undefined;
		}

		const data = await asJson<{ commit?: { tree?: { sha?: string } } }>(response);
		const sha = data?.commit?.tree?.sha;
		if (!sha || !this.isEmptyTreeSha(sha)) {
			return undefined;
		}
		return this.emptyRootCache(sha);
	}

	private parentPath(path: string): string {
		const index = path.lastIndexOf('/');
		return index === -1 ? '' : path.slice(0, index);
	}

	private hasTruncatedAncestor(tree: ITreeCacheEntry, path: string): boolean {
		let current = this.parentPath(path);
		while (true) {
			if (tree.truncatedDirectories.has(current)) {
				return true;
			}
			if (!current) {
				return false;
			}
			current = this.parentPath(current);
		}
	}

	private toStat(entry: ICachedTreeNode): IStat {
		return {
			type: entry.type,
			ctime: 0,
			mtime: 0,
			size: entry.size,
		};
	}

	/**
	 * List `dirPath` from the Git Trees API without `recursive`. A truncated
	 * page is remembered so later reads do not refetch it for the cache TTL.
	 */
	private fetchDirectory(owner: string, repo: string, ref: string, tree: ITreeCacheEntry, dirPath: string, sha: string): Promise<void> {
		if (tree.completeDirectories.has(dirPath) || tree.truncatedDirectories.has(dirPath)) {
			return Promise.resolve();
		}
		const pendingKey = `${this.getCacheKey(owner, repo, ref)}\n${tree.fetchedAt}\n${dirPath}`;
		const pending = this.pendingDirFetches.get(pendingKey);
		if (pending) {
			return pending;
		}
		const promise = this.doFetchDirectory(owner, repo, ref, tree, dirPath, sha).finally(() => {
			this.pendingDirFetches.delete(pendingKey);
		});
		this.pendingDirFetches.set(pendingKey, promise);
		return promise;
	}

	private async doFetchDirectory(owner: string, repo: string, ref: string, tree: ITreeCacheEntry, dirPath: string, sha: string): Promise<void> {
		if (this.isEmptyTreeSha(sha)) {
			tree.completeDirectories.add(dirPath);
			return;
		}
		const token = await this.getAuthToken();
		const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(sha)}`;
		const response = await this.requestService.request({
			type: 'GET',
			url,
			headers: {
				'Authorization': `token ${token}`,
				'Accept': 'application/vnd.github.v3+json',
				'User-Agent': 'VSCode-SessionRepoFS',
			},
			callSite: 'githubFileSystemProvider.fetchDirectory'
		}, CancellationToken.None);

		if (response.res.statusCode === 404) {
			throw createFileSystemProviderError(`Tree not found for ${owner}/${repo}@${ref}`, FileSystemProviderErrorCode.FileNotFound);
		}

		const data = await asJson<IGitHubTreeResponse>(response);
		if (!data || !Array.isArray(data.tree)) {
			throw createFileSystemProviderError(`Failed to fetch tree for ${owner}/${repo}@${ref}`, FileSystemProviderErrorCode.Unavailable);
		}

		this.storeTreeEntries(tree.entries, dirPath, data.tree);
		if (data.truncated === true) {
			tree.truncatedDirectories.add(dirPath);
			this.logService.warn(`[SessionRepoFS] Directory ${dirPath || '/'} in ${owner}/${repo}@${ref} is truncated`);
			return;
		}
		tree.completeDirectories.add(dirPath);
	}

	private storeTreeEntries(entries: Map<string, ICachedTreeNode>, dirPath: string, treeEntries: readonly IGitHubTreeEntry[]): void {
		for (const entry of treeEntries) {
			const fullPath = dirPath ? `${dirPath}/${entry.path}` : entry.path;
			entries.set(fullPath, this.cacheTreeEntry(entry));

			const pathParts = fullPath.split('/');
			for (let i = 1; i < pathParts.length; i++) {
				const parentPath = pathParts.slice(0, i).join('/');
				if (!entries.has(parentPath)) {
					entries.set(parentPath, this.directoryNode(''));
				}
			}
		}
	}

	private async ensureDirectory(owner: string, repo: string, ref: string, tree: ITreeCacheEntry, dirPath: string): Promise<void> {
		if (tree.completeDirectories.has(dirPath) || tree.truncatedDirectories.has(dirPath)) {
			return;
		}
		if (!dirPath) {
			await this.fetchDirectory(owner, repo, ref, tree, '', tree.rootSha);
			return;
		}
		const node = tree.entries.get(dirPath);
		if (!node || node.type !== FileType.Directory) {
			throw createFileSystemProviderError('File not found', FileSystemProviderErrorCode.FileNotFound);
		}
		if (!node.sha) {
			throw this.truncatedTreeError(owner, repo, ref);
		}
		await this.fetchDirectory(owner, repo, ref, tree, dirPath, node.sha);
	}

	/** List ancestors of `path` so its parent entry is present. Stops at a truncated page. */
	private async ensureParentListed(owner: string, repo: string, ref: string, tree: ITreeCacheEntry, path: string): Promise<void> {
		await this.ensureDirectory(owner, repo, ref, tree, '');
		if (tree.truncatedDirectories.has('')) {
			return;
		}
		const parent = this.parentPath(path);
		if (!parent) {
			return;
		}
		let current = '';
		for (const segment of parent.split('/')) {
			current = current ? `${current}/${segment}` : segment;
			const node = tree.entries.get(current);
			if (!node || node.type !== FileType.Directory) {
				return;
			}
			await this.ensureDirectory(owner, repo, ref, tree, current);
			if (tree.truncatedDirectories.has(current)) {
				return;
			}
		}
	}

	private listDirectChildren(tree: ITreeCacheEntry, path: string): [string, FileType][] {
		const prefix = path ? path + '/' : '';
		const result: [string, FileType][] = [];
		for (const [entryPath, entry] of tree.entries) {
			if (!entryPath.startsWith(prefix)) {
				continue;
			}
			const relativePath = entryPath.slice(prefix.length);
			if (relativePath && !relativePath.includes('/')) {
				result.push([relativePath, entry.type]);
			}
		}
		return result;
	}

	private directoryNode(sha: string): ICachedTreeNode {
		return { type: FileType.Directory, size: 0, sha, kind: 'tree' };
	}

	/**
	 * `commit` is a gitlink (submodule), not a blob. Mode 120000 is a symlink
	 * whose target lives in a blob; that blob is not file contents we should decode.
	 */
	private cacheTreeEntry(entry: IGitHubTreeEntry): ICachedTreeNode {
		if (entry.type === 'commit') {
			return { type: FileType.Unknown, size: entry.size ?? 0, sha: entry.sha, kind: 'commit' };
		}
		if (entry.mode === '120000') {
			return { type: FileType.SymbolicLink, size: entry.size ?? 0, sha: entry.sha, kind: 'symlink' };
		}
		if (entry.type === 'tree') {
			return { type: FileType.Directory, size: entry.size ?? 0, sha: entry.sha, kind: 'tree' };
		}
		return { type: FileType.File, size: entry.size ?? 0, sha: entry.sha, kind: 'blob' };
	}

	private unreadableEntryError(entry: ICachedTreeNode): Error | undefined {
		if (entry.kind === 'commit') {
			return createFileSystemProviderError('Submodule is not file content', FileSystemProviderErrorCode.Unknown);
		}
		if (entry.kind === 'symlink') {
			return createFileSystemProviderError('Symbolic link is not a blob', FileSystemProviderErrorCode.Unknown);
		}
		return undefined;
	}

	// --- IFileSystemProvider

	async stat(resource: URI): Promise<IStat> {
		const parsed = this.parseUri(resource);
		const tree = await this.fetchTree(parsed.owner, parsed.repo, parsed.ref);
		if (tree.lazy) {
			return this.statLazy(parsed, tree);
		}

		const entry = tree.entries.get(parsed.path);
		if (!entry) {
			throw createFileSystemProviderError('File not found', FileSystemProviderErrorCode.FileNotFound);
		}

		return this.toStat(entry);
	}

	private async statLazy(parsed: { owner: string; repo: string; ref: string; path: string }, tree: ITreeCacheEntry): Promise<IStat> {
		const { owner, repo, ref, path } = parsed;
		if (!path) {
			await this.ensureDirectory(owner, repo, ref, tree, '');
			if (tree.truncatedDirectories.has('')) {
				throw this.truncatedTreeError(owner, repo, ref);
			}
			const root = tree.entries.get('');
			if (!root) {
				throw this.truncatedTreeError(owner, repo, ref);
			}
			return this.toStat(root);
		}

		await this.ensureParentListed(owner, repo, ref, tree, path);
		const entry = tree.entries.get(path);
		const parentTruncated = this.hasTruncatedAncestor(tree, path) || tree.truncatedDirectories.has(this.parentPath(path));
		if (!entry) {
			if (parentTruncated) {
				throw this.truncatedTreeError(owner, repo, ref);
			}
			throw createFileSystemProviderError('File not found', FileSystemProviderErrorCode.FileNotFound);
		}
		if (entry.type !== FileType.Directory) {
			return this.toStat(entry);
		}
		// A synthesized parent from a partial page has no tree sha. Fail closed
		// so resolve() does not turn the missing listing into an empty folder.
		if (parentTruncated && !entry.sha) {
			throw this.truncatedTreeError(owner, repo, ref);
		}
		await this.ensureDirectory(owner, repo, ref, tree, path);
		if (tree.truncatedDirectories.has(path)) {
			throw this.truncatedTreeError(owner, repo, ref);
		}
		return this.toStat(entry);
	}

	async readdir(resource: URI): Promise<[string, FileType][]> {
		const parsed = this.parseUri(resource);
		const tree = await this.fetchTree(parsed.owner, parsed.repo, parsed.ref);
		if (tree.lazy) {
			return this.readdirLazy(parsed, tree);
		}

		// Root is always a directory entry, so a repo with no children is [].
		// Any other path that is not a known directory is missing — [] would
		// look like an empty folder.
		if (parsed.path) {
			const entry = tree.entries.get(parsed.path);
			if (!entry || entry.type !== FileType.Directory) {
				throw createFileSystemProviderError('File not found', FileSystemProviderErrorCode.FileNotFound);
			}
		}

		return this.listDirectChildren(tree, parsed.path);
	}

	private async readdirLazy(parsed: { owner: string; repo: string; ref: string; path: string }, tree: ITreeCacheEntry): Promise<[string, FileType][]> {
		const { owner, repo, ref, path } = parsed;
		if (path) {
			await this.ensureParentListed(owner, repo, ref, tree, path);
			const entry = tree.entries.get(path);
			if (this.hasTruncatedAncestor(tree, path) && (!entry || entry.type !== FileType.Directory || !entry.sha)) {
				throw this.truncatedTreeError(owner, repo, ref);
			}
			if (!entry || entry.type !== FileType.Directory) {
				throw createFileSystemProviderError('File not found', FileSystemProviderErrorCode.FileNotFound);
			}
		}
		await this.ensureDirectory(owner, repo, ref, tree, path);
		if (tree.truncatedDirectories.has(path)) {
			throw this.truncatedTreeError(owner, repo, ref);
		}
		return this.listDirectChildren(tree, path);
	}

	async readFile(resource: URI): Promise<Uint8Array> {
		const parsed = this.parseUri(resource);
		const tree = await this.fetchTree(parsed.owner, parsed.repo, parsed.ref);
		const entry = tree.lazy
			? await this.lookupLazyFile(parsed, tree)
			: tree.entries.get(parsed.path);

		if (!entry || entry.type === FileType.Directory) {
			throw createFileSystemProviderError('File not found', FileSystemProviderErrorCode.FileNotFound);
		}

		const unreadable = this.unreadableEntryError(entry);
		if (unreadable) {
			throw unreadable;
		}

		const token = await this.getAuthToken();

		// Fetch file content via the Blobs API
		const url = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/blobs/${encodeURIComponent(entry.sha)}`;
		const response = await this.requestService.request({
			type: 'GET',
			url,
			headers: {
				'Authorization': `token ${token}`,
				'Accept': 'application/vnd.github.v3+json',
				'User-Agent': 'VSCode-SessionRepoFS',
			},
			callSite: 'githubFileSystemProvider.readFile'
		}, CancellationToken.None);

		const data = await asJson<{ content: string; encoding: string }>(response);
		if (!data) {
			throw createFileSystemProviderError(`Failed to read file ${parsed.path}`, FileSystemProviderErrorCode.Unavailable);
		}

		if (data.encoding === 'base64') {
			const binaryString = atob(data.content.replace(/\n/g, ''));
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			return bytes;
		}

		return new TextEncoder().encode(data.content);
	}

	private async lookupLazyFile(parsed: { owner: string; repo: string; ref: string; path: string }, tree: ITreeCacheEntry): Promise<ICachedTreeNode | undefined> {
		const { owner, repo, ref, path } = parsed;
		if (!path) {
			return undefined;
		}
		let entry = tree.entries.get(path);
		if (!entry || entry.type === FileType.Directory) {
			await this.ensureParentListed(owner, repo, ref, tree, path);
			entry = tree.entries.get(path);
		}
		if (!entry || entry.type === FileType.Directory) {
			if (this.hasTruncatedAncestor(tree, path) || tree.truncatedDirectories.has(this.parentPath(path))) {
				throw this.truncatedTreeError(owner, repo, ref);
			}
		}
		return entry;
	}

	// --- Readonly stubs

	watch(): IDisposable {
		return Disposable.None;
	}

	async writeFile(_resource: URI, _content: Uint8Array, _opts: IFileWriteOptions): Promise<void> {
		throw createFileSystemProviderError('Operation not supported', FileSystemProviderErrorCode.NoPermissions);
	}

	async mkdir(_resource: URI): Promise<void> {
		throw createFileSystemProviderError('Operation not supported', FileSystemProviderErrorCode.NoPermissions);
	}

	async delete(_resource: URI, _opts: IFileDeleteOptions): Promise<void> {
		throw createFileSystemProviderError('Operation not supported', FileSystemProviderErrorCode.NoPermissions);
	}

	async rename(_from: URI, _to: URI, _opts: IFileOverwriteOptions): Promise<void> {
		throw createFileSystemProviderError('Operation not supported', FileSystemProviderErrorCode.NoPermissions);
	}

	// --- Cache management

	invalidateCache(owner: string, repo: string, ref: string): void {
		const cacheKey = this.getCacheKey(owner, repo, ref);
		this.treeCache.delete(cacheKey);
		this.notFoundCache.delete(cacheKey);
	}

	override dispose(): void {
		this.treeCache.clear();
		this.notFoundCache.clear();
		this.pendingFetches.clear();
		this.pendingDirFetches.clear();
		super.dispose();
	}
}
