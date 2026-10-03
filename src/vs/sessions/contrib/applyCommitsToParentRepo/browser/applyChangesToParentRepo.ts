/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { toAction } from '../../../../base/common/actions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { autorun } from '../../../../base/common/observable.js';
import { extUri, extUriBiasedIgnorePathCase, normalizePath } from '../../../../base/common/resources.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';
import { IsSessionsWindowContext } from '../../../../workbench/common/contextkeys.js';
import { CHAT_CATEGORY } from '../../../../workbench/contrib/chat/browser/actions/chatActions.js';
import { IGitService } from '../../../../workbench/contrib/git/common/gitService.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';
import { ISessionFolder } from '../../../services/sessions/common/session.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { URI } from '../../../../base/common/uri.js';
import { SessionIsArchivedContext } from '../../../common/contextkeys.js';

const hasWorktreeAndRepositoryContextKey = new RawContextKey<boolean>('agentSessionHasWorktreeAndRepository', false, {
	type: 'boolean',
	description: localize('agentSessionHasWorktreeAndRepository', "True when the active agent session has both a worktree and a parent repository.")
});

/**
 * Local checkout that can receive the worktree branch.
 * The parent is the source repository, not the folder root: the root may be the
 * worktree itself. A non-file URI's `fsPath` is a path on this machine, not that checkout.
 * Paths that normalize to the same file (for example a `..` segment) are the same checkout.
 */
export function resolveParentRepoApplyTarget(folder: ISessionFolder | undefined): { readonly worktree: URI; readonly parent: URI } | undefined {
	const worktree = folder?.gitRepository?.workTreeUri;
	const parent = folder?.gitRepository?.uri;
	if (!worktree || !parent || worktree.scheme !== Schemas.file || parent.scheme !== Schemas.file) {
		return undefined;
	}
	if (extUriBiasedIgnorePathCase.isEqual(normalizePath(worktree), normalizePath(parent))) {
		return undefined;
	}
	return { worktree, parent };
}

/**
 * `rev-parse --abbrev-ref HEAD` prints `HEAD` when the worktree is detached.
 * Merging that name updates the parent with its own HEAD.
 * The worktree commit has to be merged instead.
 */
export function worktreeMergeRef(abbrevRef: string, headCommit: string | undefined): string | undefined {
	if (abbrevRef !== 'HEAD') {
		return abbrevRef;
	}
	const commit = headCommit?.trim();
	return commit && commit !== 'HEAD' ? commit : undefined;
}

/**
 * `rev-parse --show-toplevel` resolves symlinks. Two spellings of one checkout
 * are not a worktree and its parent.
 */
export function isSameGitCheckout(worktreeTop: string | undefined, parentTop: string | undefined): boolean {
	if (!worktreeTop || !parentTop) {
		return false;
	}
	return extUriBiasedIgnorePathCase.isEqual(
		normalizePath(URI.file(worktreeTop)),
		normalizePath(URI.file(parentTop)),
	);
}

/**
 * Parent HEAD is the source of truth. A quiet merge can print nothing, and a
 * non-English "already up to date" must not be reported as applied.
 */
export function classifyParentApplyResult(before: string | undefined, after: string | undefined, result: string | undefined): 'applied' | 'upToDate' | 'unconfirmed' {
	const headMoved = !!before && !!after && before !== after;
	const headUnchanged = !!before && !!after && before === after;
	const text = typeof result === 'string' ? result.trim() : '';
	const saysUpToDate = /^already up[- ]to[- ]date/i.test(text);
	if (headMoved) {
		return 'applied';
	}
	if (saysUpToDate || (headUnchanged && !!text)) {
		return 'upToDate';
	}
	if (text) {
		return 'applied';
	}
	return 'unconfirmed';
}

async function tryRevParse(commandService: ICommandService, repositoryPath: string, ref: string): Promise<string | undefined> {
	try {
		const value = await commandService.executeCommand<string>('_git.revParse', repositoryPath, ref);
		const trimmed = typeof value === 'string' ? value.trim() : '';
		return trimmed || undefined;
	} catch {
		return undefined;
	}
}

async function refreshOpenParentRepository(commandService: ICommandService, gitService: IGitService, parent: URI, logService: ILogService): Promise<void> {
	const open = [...gitService.repositories].some(repository => extUri.isEqual(normalizePath(repository.rootUri), normalizePath(parent)));
	if (!open) {
		return;
	}
	try {
		await commandService.executeCommand('git.refresh', parent.fsPath);
	} catch (error) {
		logService.warn('[ApplyChangesToParentRepo] Failed to refresh parent repository', error);
	}
}

class ApplyChangesToParentRepoContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'sessions.contrib.applyChangesToParentRepo';

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@ISessionsService sessionsService: ISessionsService,
	) {
		super();

		const worktreeAndRepoKey = hasWorktreeAndRepositoryContextKey.bindTo(contextKeyService);

		this._register(autorun(reader => {
			const activeSession = sessionsService.activeSession.read(reader);
			const folder = activeSession?.workspace.read(reader)?.folders[0];
			worktreeAndRepoKey.set(!!resolveParentRepoApplyTarget(folder));
		}));
	}
}

class ApplyChangesToParentRepoAction extends Action2 {
	static readonly ID = 'chatEditing.applyChangesToParentRepo';

	constructor() {
		super({
			id: ApplyChangesToParentRepoAction.ID,
			title: localize2('applyChangesToParentRepo', 'Apply Changes to Parent Repository'),
			icon: Codicon.desktopDownload,
			category: CHAT_CATEGORY,
			precondition: ContextKeyExpr.and(
				IsSessionsWindowContext,
				hasWorktreeAndRepositoryContextKey,
			),
			menu: [
				{
					id: MenuId.AgentsChangesPrimaryActionSubMenu,
					group: 'navigation',
					order: 2,
					when: ContextKeyExpr.and(
						ContextKeyExpr.false(),
						IsSessionsWindowContext,
						hasWorktreeAndRepositoryContextKey
					),
				},
			],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const sessionsService = accessor.get(ISessionsService);
		const commandService = accessor.get(ICommandService);
		const notificationService = accessor.get(INotificationService);
		const logService = accessor.get(ILogService);
		const openerService = accessor.get(IOpenerService);
		const productService = accessor.get(IProductService);
		const gitService = accessor.get(IGitService);

		const activeSession = sessionsService.activeSession.get();
		const folder = activeSession?.workspace.get()?.folders[0];
		const target = resolveParentRepoApplyTarget(folder);
		if (!activeSession || !target) {
			if (activeSession && folder?.gitRepository?.workTreeUri) {
				notificationService.notify({
					severity: Severity.Warning,
					message: localize('applyChangesNoLocalParent', "Could not apply changes because this session has no separate local parent repository."),
				});
			}
			return;
		}

		const worktreeRoot = target.worktree;
		const repoRoot = target.parent;

		const openFolderAction = toAction({
			id: 'applyChangesToParentRepo.openFolder',
			label: localize('openInVSCode', "Open in VS Code"),
			run: () => {
				const scheme = productService.quality === 'stable'
					? 'vscode'
					: productService.quality === 'exploration'
						? 'vscode-exploration'
						: 'vscode-insiders';

				const params = new URLSearchParams();
				params.set('windowId', '_blank');
				params.set('session', activeSession.resource.toString());

				openerService.open(URI.from({
					scheme,
					authority: Schemas.file,
					path: repoRoot.path,
					query: params.toString(),
				}), { openExternal: true });
			}
		});

		try {
			// The worktree and parent share a git object store, so the parent can
			// merge the worktree branch (or, when detached, that commit) directly.
			const worktreeBranch = await commandService.executeCommand<string>(
				'_git.revParseAbbrevRef',
				worktreeRoot.fsPath
			);

			if (!worktreeBranch) {
				notificationService.notify({
					severity: Severity.Warning,
					message: localize('applyChangesNoBranch', "Could not determine worktree branch name."),
				});
				return;
			}

			const headCommit = worktreeBranch === 'HEAD'
				? await tryRevParse(commandService, worktreeRoot.fsPath, 'HEAD')
				: undefined;
			const mergeRef = worktreeMergeRef(worktreeBranch, headCommit);
			if (!mergeRef) {
				notificationService.notify({
					severity: Severity.Warning,
					message: localize('applyChangesDetachedCommit', "Could not determine the worktree commit because this worktree is not on a branch."),
				});
				return;
			}

			const worktreeTop = await tryRevParse(commandService, worktreeRoot.fsPath, '--show-toplevel');
			const parentTop = await tryRevParse(commandService, repoRoot.fsPath, '--show-toplevel');
			if (isSameGitCheckout(worktreeTop, parentTop)) {
				notificationService.notify({
					severity: Severity.Warning,
					message: localize('applyChangesNoLocalParent', "Could not apply changes because this session has no separate local parent repository."),
				});
				return;
			}

			const before = await tryRevParse(commandService, repoRoot.fsPath, 'HEAD');
			const result = await commandService.executeCommand<string>('_git.mergeBranch', repoRoot.fsPath, mergeRef);
			const after = await tryRevParse(commandService, repoRoot.fsPath, 'HEAD');
			const outcome = classifyParentApplyResult(before, after, result);
			if (outcome === 'unconfirmed') {
				logService.warn('[ApplyChangesToParentRepo] No result from merge command');
				notificationService.notify({
					severity: Severity.Warning,
					message: localize('applyChangesUnconfirmed', "Could not confirm that changes were applied to the parent repository."),
					actions: { primary: [openFolderAction] }
				});
				return;
			}

			if (outcome === 'applied') {
				await refreshOpenParentRepository(commandService, gitService, repoRoot, logService);
			}
			notificationService.notify({
				severity: Severity.Info,
				message: outcome === 'upToDate'
					? localize('alreadyUpToDate', 'Parent repository is up to date with worktree.')
					: localize('applyChangesSuccess', 'Applied changes to parent repository.'),
				actions: { primary: [openFolderAction] }
			});
		} catch (err) {
			logService.error('[ApplyChangesToParentRepo] Failed to apply changes', err);
			notificationService.notify({
				severity: Severity.Warning,
				message: localize('applyChangesConflict', "Failed to apply changes to parent repo. The parent repo may have diverged — resolve conflicts manually."),
				actions: { primary: [openFolderAction] }
			});
		}
	}
}

registerAction2(ApplyChangesToParentRepoAction);
registerWorkbenchContribution2(ApplyChangesToParentRepoContribution.ID, ApplyChangesToParentRepoContribution, WorkbenchPhase.AfterRestored);

// Register the apply submenu in the session changes toolbar
MenuRegistry.appendMenuItem(MenuId.AgentsChangesToolbar, {
	submenu: MenuId.AgentsChangesPrimaryActionSubMenu,
	title: localize2('applyActions', 'Apply Actions'),
	group: 'navigation',
	order: 1,
	when: ContextKeyExpr.and(
		IsSessionsWindowContext,
		SessionIsArchivedContext.isEqualTo(false))
});
