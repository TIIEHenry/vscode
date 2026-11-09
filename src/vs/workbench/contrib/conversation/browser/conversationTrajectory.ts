/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, getActiveElement, getWindow } from '../../../../base/browser/dom.js';
import { renderMarkdown } from '../../../../base/browser/markdownRenderer.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { summarizeTrajectoryProcessSteps, TrajectoryProcessFoldSpan } from './conversationProcessFoldModel.js';
import {
	conversationLensSessionBarNoTrajectory,
	conversationLensSessionBarTrajectoryListAria,
} from './conversationLensSessionBarStrings.js';
import {
	applyTrajectoryRecordLimit,
	buildTrajectoryTableViewModel,
	ConversationTrajectoryKind,
	ConversationTrajectoryRecord,
	filterTrajectoryRecordsBySearch,
	findTurnIdForTrajectoryRecord,
	trajectoryAdmittedDetailLines,
	TrajectoryTableDisplayItem,
} from './conversationTrajectoryModel.js';
import {
	buildTrajectoryOverviewSegments,
} from './conversationTrajectoryOverview.js';
import {
	conversationTrajectoryCompactedDiscardedNotice,
	conversationTrajectoryDetailLoading,
	conversationTrajectoryDetailRetry,
	ITrajectoryDetailContext,
	TrajectoryDetailInspectorModel,
	TrajectoryDetailInspectorState,
} from './conversationTrajectoryDetailInspector.js';
import { conversationUserBodyText } from './conversationUserRefs.js';
export const CONVERSATION_TRAJECTORY_OVERLAY_WIDTH = 600;

export const conversationTrajectoryKindUser = localize('conversationTrajectory.kindUser', "User");
export const conversationTrajectoryKindContext = localize('conversationTrajectory.kindContext', "Context");
export const conversationTrajectoryKindSystem = localize('conversationTrajectory.kindSystem', "System");
export const conversationTrajectoryKindAssistant = localize('conversationTrajectory.kindAssistant', "Assistant");
export const conversationTrajectoryKindTool = localize('conversationTrajectory.kindTool', "Tool");
export const conversationTrajectoryKindSubtool = localize('conversationTrajectory.kindSubtool', "Subtool");
export const conversationTrajectoryKindThinking = localize('conversationTrajectory.kindThinking', "Thinking");
export const conversationTrajectoryKindCompacted = localize('conversationTrajectory.kindCompacted', "Compacted");
export const conversationTrajectoryKindPermission = localize('conversationTrajectory.kindPermission', "Permission");
export const conversationTrajectoryKindQuestion = localize('conversationTrajectory.kindQuestion', "Question");
export const conversationTrajectoryKindError = localize('conversationTrajectory.kindError', "Error");
export const conversationTrajectoryKindUnknown = localize('conversationTrajectory.kindUnknown', "Unknown");

export const conversationTrajectoryInspectorSummary = localize('conversationTrajectory.inspectorSummary', "Summary");
export const conversationTrajectoryInspectorPayload = localize('conversationTrajectory.inspectorPayload', "Payload");
export const conversationTrajectoryInspectorResult = localize('conversationTrajectory.inspectorResult', "Result");
export const conversationTrajectoryInspectorClose = localize('conversationTrajectory.inspectorClose', "Close inspector");
export const conversationTrajectoryInspectorBack = localize('conversationTrajectory.inspectorBack', "Back");
export const conversationTrajectoryTableKindColumn = localize('conversationTrajectory.tableKind', "Kind");
export const conversationTrajectoryTablePreviewColumn = localize('conversationTrajectory.tablePreview', "Preview");
export const conversationTrajectorySearchPlaceholder = localize('conversationTrajectory.searchPlaceholder', "Search trajectory");
export const conversationTrajectorySearchAria = localize('conversationTrajectory.searchAria', "Filter trajectory records");
export const conversationTrajectoryLimitNotice = localize(
	'conversationTrajectory.limitNotice',
	"Showing the most recent {0} of {1} records. Older records are omitted.",
);

export function formatConversationTrajectoryLimitNotice(visibleCount: number, totalCount: number): string {
	return conversationTrajectoryLimitNotice
		.replace('{0}', String(visibleCount))
		.replace('{1}', String(totalCount));
}

export const conversationTrajectoryRevealUnmapped = localize('conversationTrajectory.revealUnmapped', "This message has no matching trajectory record.");

export function formatConversationTrajectoryRevealOutsideWindow(visibleCount: number): string {
	return localize('conversationTrajectory.revealOutsideWindow', "This record is older than the most recent {0} records shown.", visibleCount);
}

/** `revealed` moved to the row; the others wrote why into the reveal notice. */
export type ConversationTrajectoryRevealResult = 'revealed' | 'missing' | 'outsideWindow';

const TRAJECTORY_SUBTOOL_INDENT_PX = 12;
/** Product list/table row. Fold headers in this table use the same height. */
export const TRAJECTORY_ROW_HEIGHT = 22;
export const TRAJECTORY_FOLD_HEADER_HEIGHT = 22;
const TRAJECTORY_SEARCH_DEBOUNCE_MS = 150;

let nextTrajectoryOverviewId = 0;
let nextTrajectoryFoldChildrenId = 0;

/** Kind column label for trajectory record rows. */
export function getTrajectoryKindLabel(kind: ConversationTrajectoryKind): string {
	switch (kind) {
		case 'user':
			return conversationTrajectoryKindUser;
		case 'context':
			return conversationTrajectoryKindContext;
		case 'system':
			return conversationTrajectoryKindSystem;
		case 'message':
			return conversationTrajectoryKindAssistant;
		case 'tool':
			return conversationTrajectoryKindTool;
		case 'subtool':
			return conversationTrajectoryKindSubtool;
		case 'thinking':
			return conversationTrajectoryKindThinking;
		case 'compacted':
			return conversationTrajectoryKindCompacted;
		case 'permission':
			return conversationTrajectoryKindPermission;
		case 'question':
			return conversationTrajectoryKindQuestion;
		case 'error':
			return conversationTrajectoryKindError;
		case 'unknown':
			return conversationTrajectoryKindUnknown;
	}
}

/** Type-column icon. The visible label stays sentence case beside it. */
export function getTrajectoryKindIcon(kind: ConversationTrajectoryKind): ThemeIcon {
	switch (kind) {
		case 'user':
			return Codicon.account;
		case 'context':
			return Codicon.folder;
		case 'system':
			return Codicon.gear;
		case 'message':
			return Codicon.comment;
		case 'tool':
			return Codicon.tools;
		case 'subtool':
			return Codicon.symbolMethod;
		case 'thinking':
			return Codicon.lightbulb;
		case 'compacted':
			return Codicon.fold;
		case 'permission':
			return Codicon.shield;
		case 'question':
			return Codicon.question;
		case 'error':
			return Codicon.error;
		case 'unknown':
			return Codicon.circleOutline;
	}
}

function withAdmittedDetailPreview(preview: string, record: ConversationTrajectoryRecord): string {
	const extra = trajectoryAdmittedDetailLines(record).join(' · ');
	if (!extra) {
		return preview;
	}
	const empty = localize('conversationTrajectory.emptyPreview', "(empty)");
	const combined = !preview || preview === empty ? extra : `${preview} · ${extra}`;
	return combined.length > 120 ? `${combined.slice(0, 119)}…` : combined;
}

/** One-line preview for trajectory table navigation. User rows omit a legal refs trailer. */
export function getTrajectoryRecordPreview(record: ConversationTrajectoryRecord): string {
	if (record.kind === 'compacted') {
		if (record.compactedSummary) {
			const parts = [record.compactedRange, record.compactedReason, record.compactedSummary].filter(Boolean);
			return withAdmittedDetailPreview(parts.join(' · '), record);
		}
		return withAdmittedDetailPreview(record.text.trim() || localize('conversationTrajectory.compactedTypeOnly', "Compacted"), record);
	}
	if (record.kind === 'unknown') {
		const typeName = record.messageSource?.kind;
		const unknownText = record.text.trim();
		if (typeName && unknownText) {
			return withAdmittedDetailPreview(`${typeName}: ${unknownText}`, record);
		}
		return withAdmittedDetailPreview(typeName || unknownText || localize('conversationTrajectory.unknownEmptyPreview', "(unknown)"), record);
	}
	const readable = record.kind === 'user' ? conversationUserBodyText(record.text) : record.text;
	if (record.kind === 'user' && record.sourceBlocks?.length) {
		const chips = record.sourceBlocks.map(block => block.toolName ?? block.content).join(', ');
		const trimmed = readable.trim();
		return withAdmittedDetailPreview(trimmed ? `${trimmed} · ${chips}` : chips, record);
	}

	const trimmed = readable.trim();
	if (!trimmed) {
		return withAdmittedDetailPreview(localize('conversationTrajectory.emptyPreview', "(empty)"), record);
	}
	return withAdmittedDetailPreview(trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed, record);
}

export const conversationTrajectoryOverviewTitle = localize('conversationTrajectory.overviewTitle', "Overview");
export const conversationTrajectoryOverviewCollapse = localize('conversationTrajectory.overviewCollapse', "Collapse overview");
export const conversationTrajectoryOverviewExpand = localize('conversationTrajectory.overviewExpand', "Expand overview");
export const conversationTrajectoryInspectorPreview = localize('conversationTrajectory.inspectorPreview', "Preview");
export const conversationTrajectoryInspectorFull = localize('conversationTrajectory.inspectorFull', "Full content");
export const conversationTrajectoryInspectorPartial = localize('conversationTrajectory.inspectorPartial', "Partial content");
export const conversationTrajectoryInspectorStatus = localize('conversationTrajectory.inspectorStatus', "Status");

export interface IConversationTrajectoryOptions {
	readonly onNavigateToLinkedTurn?: (turnId: string) => void;
	readonly detailContext?: ITrajectoryDetailContext;
	/** When false (stub fixture), omit live / duration chrome and keep Stub prefix. */
	readonly showLiveChrome?: () => boolean;
	readonly displayMode?: () => 'stub' | 'live' | 'cached';
}

interface ITrajectoryRecordTemplateData {
	readonly row: HTMLElement;
}

interface ITrajectoryFoldTemplateData {
	readonly root: HTMLElement;
	readonly header: HTMLButtonElement;
	readonly chevron: HTMLElement;
	readonly summary: HTMLElement;
	readonly children: HTMLElement;
	span: TrajectoryProcessFoldSpan | undefined;
}

interface ITrajectoryTableHost {
	readonly selectedRecordId: string | undefined;
	isFoldExpanded(spanId: string): boolean;
	isFoldForcedOpen(): boolean;
	showLiveChrome(): boolean;
	displayMode(): 'stub' | 'live' | 'cached';
	onSelectRecord(record: ConversationTrajectoryRecord, navigateToConversation: boolean): void;
	onToggleFold(spanId: string): void;
}

class TrajectoryTableDelegate implements IListVirtualDelegate<TrajectoryTableDisplayItem> {

	constructor(
		private readonly host: ITrajectoryTableHost,
	) { }

	getHeight(element: TrajectoryTableDisplayItem): number {
		if (element.type === 'record') {
			return TRAJECTORY_ROW_HEIGHT;
		}
		if (!this.host.isFoldExpanded(element.span.id)) {
			return TRAJECTORY_FOLD_HEADER_HEIGHT;
		}
		return TRAJECTORY_FOLD_HEADER_HEIGHT + element.span.records.length * TRAJECTORY_ROW_HEIGHT;
	}

	getTemplateId(element: TrajectoryTableDisplayItem): string {
		return element.type === 'fold' ? TrajectoryFoldRenderer.TEMPLATE_ID : TrajectoryRecordRenderer.TEMPLATE_ID;
	}

	hasDynamicHeight(): boolean {
		return true;
	}
}

class TrajectoryRecordRenderer implements IListRenderer<TrajectoryTableDisplayItem, ITrajectoryRecordTemplateData> {

	static readonly TEMPLATE_ID = 'conversationTrajectoryRecord';

	readonly templateId = TrajectoryRecordRenderer.TEMPLATE_ID;

	constructor(
		private readonly host: ITrajectoryTableHost,
	) { }

	renderTemplate(container: HTMLElement): ITrajectoryRecordTemplateData {
		const row = append(container, $('.conversation-lens-trajectory-record-row'));
		row.setAttribute('role', 'row');
		append(row, $('.conversation-lens-trajectory-table-kind')).setAttribute('role', 'cell');
		append(row, $('.conversation-lens-trajectory-table-preview')).setAttribute('role', 'cell');
		return { row };
	}

	renderElement(element: TrajectoryTableDisplayItem, _index: number, templateData: ITrajectoryRecordTemplateData): void {
		if (element.type !== 'record') {
			return;
		}
		populateTrajectoryRecordRow(templateData.row, element.record, this.host.selectedRecordId);
	}

	disposeTemplate(): void {
		// noop
	}
}

class TrajectoryFoldRenderer implements IListRenderer<TrajectoryTableDisplayItem, ITrajectoryFoldTemplateData> {

	static readonly TEMPLATE_ID = 'conversationTrajectoryFold';

	readonly templateId = TrajectoryFoldRenderer.TEMPLATE_ID;

	constructor(
		private readonly host: ITrajectoryTableHost,
		private readonly renderDisposables: DisposableStore,
	) { }

	renderTemplate(container: HTMLElement): ITrajectoryFoldTemplateData {
		const root = append(container, $('div.conversation-process-fold'));
		root.setAttribute('data-process-fold', '');

		const header = append(root, $('button.conversation-process-fold-header')) as HTMLButtonElement;
		header.type = 'button';
		header.setAttribute('role', 'button');

		const chevron = append(header, $('span.conversation-process-fold-chevron.ua-motion'));
		chevron.setAttribute('aria-hidden', 'true');
		chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));

		const summary = append(header, $('span.conversation-process-fold-summary'));
		const children = append(root, $('div.conversation-process-fold-children'));
		children.id = `conversation-trajectory-fold-children-${++nextTrajectoryFoldChildrenId}`;
		header.setAttribute('aria-controls', children.id);
		const templateData: ITrajectoryFoldTemplateData = { root, header, chevron, summary, children, span: undefined };

		// Owned by the view, not the template: pooled rows outlive individual renders.
		this.renderDisposables.add(addDisposableListener(header, 'click', (e) => {
			e.stopPropagation();
			const span = templateData.span;
			if (!span) {
				return;
			}
			this.host.onToggleFold(span.id);
			applyTrajectoryFoldTemplate(templateData, span, this.host);
		}));

		return templateData;
	}

	renderElement(element: TrajectoryTableDisplayItem, _index: number, templateData: ITrajectoryFoldTemplateData): void {
		if (element.type !== 'fold') {
			return;
		}
		templateData.span = element.span;
		applyTrajectoryFoldTemplate(templateData, element.span, this.host);
	}

	disposeTemplate(): void {
		// noop
	}
}

class TrajectoryTableAccessibilityProvider implements IListAccessibilityProvider<TrajectoryTableDisplayItem> {
	constructor(
		private readonly host?: Pick<ITrajectoryTableHost, 'showLiveChrome' | 'displayMode'>,
	) { }

	getWidgetAriaLabel(): string {
		return conversationLensSessionBarTrajectoryListAria;
	}

	getAriaLabel(element: TrajectoryTableDisplayItem): string {
		if (element.type === 'record') {
			return `${getTrajectoryKindLabel(element.record.kind)}: ${getTrajectoryRecordPreview(element.record)}`;
		}
		return summarizeTrajectoryProcessSteps(element.span, {
			showLiveChrome: this.host?.showLiveChrome() === true,
			displayMode: this.host?.displayMode(),
		});
	}
}

/**
 * Trajectory lens: searchable virtualized record table + local inspector with process-fold overlay (default expanded).
 */
export class ConversationTrajectory extends Disposable implements ITrajectoryTableHost {

	private readonly host: HTMLElement;
	private readonly emptyState: HTMLElement;
	private readonly body: HTMLElement;
	private readonly toolbar: HTMLElement;
	private readonly overviewHost: HTMLElement;
	private readonly overviewToggle: HTMLButtonElement;
	private readonly overviewTrack: HTMLElement;
	private overviewExpanded = true;
	private readonly detailInspector = new TrajectoryDetailInspectorModel();
	private readonly searchInput: HTMLInputElement;
	private readonly limitNotice: HTMLElement;
	private readonly revealNotice: HTMLElement;
	private readonly table: HTMLElement;
	private readonly tableScroll: HTMLElement;
	private readonly inspector: HTMLElement;
	private readonly inspectorContent: HTMLElement;
	private readonly inspectorDisposables = this._register(new DisposableStore());
	private readonly overviewDisposables = this._register(new DisposableStore());
	private readonly renderDisposables = this._register(new DisposableStore());
	private readonly processFoldOuterExpanded = new Map<string, boolean>();
	private readonly selectedRecordIdHolder = { current: undefined as string | undefined };
	private readonly linkedTurnIds = { current: new Set<string>() };
	private readonly listDelegate: TrajectoryTableDelegate;
	private readonly list: WorkbenchList<TrajectoryTableDisplayItem>;
	private readonly searchScheduler: RunOnceScheduler;
	private currentRecords: readonly ConversationTrajectoryRecord[] = [];
	private displayItems: readonly TrajectoryTableDisplayItem[] = [];
	private searchQuery = '';
	private omittedCount = 0;
	private pendingRevealRecordId: string | undefined;
	private lastRevealedRecordId: string | undefined;
	private focusedFoldRecordId: string | undefined;
	private inspectorOverlayScrollTop = 0;
	/** True while the open inspector covers the table. Scroll is saved on that transition, not when the inspector first opened beside it. */
	private inspectorOverlayActive = false;
	private lastLayoutCollapsed = true;
	private listHeight = 0;
	private listWidth = 0;
	private visible = false;
	private inspectorBackButton!: HTMLButtonElement;

	constructor(
		parent: HTMLElement,
		private readonly options: IConversationTrajectoryOptions,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this.host = append(parent, $('.conversation-lens-trajectory'));
		this.host.hidden = true;
		this.host.setAttribute('role', 'region');
		this.host.setAttribute('aria-label', conversationLensSessionBarTrajectoryListAria);

		this.emptyState = append(this.host, $('.conversation-lens-trajectory-empty'));
		append(this.emptyState, $('p.conversation-lens-trajectory-empty-title')).textContent =
			conversationLensSessionBarNoTrajectory;

		this.body = append(this.host, $('.conversation-lens-trajectory-body'));
		this.body.hidden = true;

		this.toolbar = append(this.body, $('.conversation-lens-trajectory-toolbar'));
		this.searchInput = append(this.toolbar, $('input.conversation-lens-trajectory-search')) as HTMLInputElement;
		this.searchInput.type = 'search';
		this.searchInput.placeholder = conversationTrajectorySearchPlaceholder;
		this.searchInput.setAttribute('aria-label', conversationTrajectorySearchAria);
		this.searchInput.autocomplete = 'off';
		this.searchInput.spellcheck = false;

		this.overviewHost = append(this.body, $('.conversation-lens-trajectory-overview'));
		const overviewHeader = append(this.overviewHost, $('.conversation-lens-trajectory-overview-header'));
		append(overviewHeader, $('span.conversation-lens-trajectory-overview-title')).textContent = conversationTrajectoryOverviewTitle;
		this.overviewToggle = append(overviewHeader, $('button.conversation-lens-trajectory-overview-toggle')) as HTMLButtonElement;
		this.overviewToggle.type = 'button';
		this.overviewToggle.setAttribute('aria-expanded', 'true');
		this.overviewToggle.title = conversationTrajectoryOverviewCollapse;
		this.overviewToggle.setAttribute('aria-label', conversationTrajectoryOverviewCollapse);
		this.overviewToggle.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
		this._register(addDisposableListener(this.overviewToggle, 'click', () => {
			this.overviewExpanded = !this.overviewExpanded;
			this.syncOverviewChrome();
			this.relayoutList();
		}));

		const overviewScroll = append(this.overviewHost, $('.conversation-lens-trajectory-overview-scroll'));
		this.overviewTrack = append(overviewScroll, $('.conversation-lens-trajectory-overview-track'));
		this.overviewTrack.id = `conversation-lens-trajectory-overview-${++nextTrajectoryOverviewId}`;
		this.overviewToggle.setAttribute('aria-controls', this.overviewTrack.id);
		this.overviewTrack.setAttribute('role', 'toolbar');
		this.overviewTrack.setAttribute('aria-label', conversationTrajectoryOverviewTitle);
		this._register(addDisposableListener(this.overviewTrack, 'keydown', (e) => {
			if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
				return;
			}
			// eslint-disable-next-line no-restricted-syntax -- overview segments are owned by overviewTrack
			const segments = [...this.overviewTrack.querySelectorAll<HTMLButtonElement>('.conversation-lens-trajectory-overview-segment')];
			if (segments.length === 0) {
				return;
			}
			const currentIndex = Math.max(0, segments.indexOf(e.target as HTMLButtonElement));
			let nextIndex = currentIndex;
			if (e.key === 'ArrowRight') {
				nextIndex = (currentIndex + 1) % segments.length;
			} else if (e.key === 'ArrowLeft') {
				nextIndex = (currentIndex - 1 + segments.length) % segments.length;
			} else if (e.key === 'Home') {
				nextIndex = 0;
			} else if (e.key === 'End') {
				nextIndex = segments.length - 1;
			}
			e.preventDefault();
			segments.forEach((seg, idx) => {
				seg.tabIndex = idx === nextIndex ? 0 : -1;
			});
			segments[nextIndex]?.focus();
		}));

		this.limitNotice = append(this.body, $('.conversation-lens-trajectory-limit-notice'));
		this.limitNotice.hidden = true;
		this.limitNotice.setAttribute('role', 'status');

		this.revealNotice = append(this.body, $('.conversation-lens-trajectory-reveal-notice'));
		this.revealNotice.hidden = true;
		this.revealNotice.setAttribute('role', 'status');

		this.table = append(this.body, $('.conversation-lens-trajectory-table'));
		this.table.setAttribute('role', 'table');

		const headerRow = append(this.table, $('.conversation-lens-trajectory-table-header'));
		headerRow.setAttribute('role', 'row');
		const kindHeader = append(headerRow, $('.conversation-lens-trajectory-table-kind-header'));
		kindHeader.setAttribute('role', 'columnheader');
		kindHeader.textContent = conversationTrajectoryTableKindColumn;
		const previewHeader = append(headerRow, $('.conversation-lens-trajectory-table-preview-header'));
		previewHeader.setAttribute('role', 'columnheader');
		previewHeader.textContent = conversationTrajectoryTablePreviewColumn;

		this.tableScroll = append(this.table, $('.conversation-lens-trajectory-table-scroll'));

		this.listDelegate = new TrajectoryTableDelegate(this);
		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'ConversationTrajectoryTable',
			this.tableScroll,
			this.listDelegate,
			[
				new TrajectoryRecordRenderer(this),
				new TrajectoryFoldRenderer(this, this.renderDisposables),
			],
			{
				identityProvider: {
					getId: (element: TrajectoryTableDisplayItem) =>
						element.type === 'record' ? element.record.id : element.span.id,
				},
				accessibilityProvider: new TrajectoryTableAccessibilityProvider(this),
				openOnSingleClick: true,
				mouseSupport: true,
				keyboardSupport: true,
			},
		)) as WorkbenchList<TrajectoryTableDisplayItem>;

		this._register(this.list.onDidChangeFocus(() => {
			const focused = this.list.getFocusedElements()[0];
			if (this.focusedFoldRecordId && (focused?.type !== 'fold' || !focused.span.recordIds.includes(this.focusedFoldRecordId))) {
				this.focusedFoldRecordId = undefined;
				this.syncTrajectoryFoldChildFocus(false);
			}
		}));

		this._register(addDisposableListener(this.tableScroll, 'click', (e) => {
			this.activateRecordFromTableRow(e.target as HTMLElement);
		}));
		this._register(addDisposableListener(this.tableScroll, 'keydown', (e) => {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				const focused = this.list.getFocusedElements()[0];
				if (focused?.type === 'fold' && this.isFoldExpanded(focused.span.id) && focused.span.records.length > 0) {
					if (e.key === 'ArrowDown') {
						if (!this.focusedFoldRecordId) {
							e.preventDefault();
							e.stopPropagation();
							this.focusedFoldRecordId = focused.span.records[0].id;
							this.scrollRecordIntoView(this.focusedFoldRecordId);
							this.syncTrajectoryFoldChildFocus(true);
							return;
						}
						const subIdx = focused.span.records.findIndex(r => r.id === this.focusedFoldRecordId);
						if (subIdx >= 0 && subIdx + 1 < focused.span.records.length) {
							e.preventDefault();
							e.stopPropagation();
							this.focusedFoldRecordId = focused.span.records[subIdx + 1].id;
							this.scrollRecordIntoView(this.focusedFoldRecordId);
							this.syncTrajectoryFoldChildFocus(true);
							return;
						}
						const focusIdx = this.list.getFocus()[0] ?? -1;
						this.focusedFoldRecordId = undefined;
						this.syncTrajectoryFoldChildFocus(false);
						if (focusIdx >= 0 && focusIdx + 1 < this.displayItems.length) {
							e.preventDefault();
							e.stopPropagation();
							this.list.setFocus([focusIdx + 1]);
							this.list.reveal(focusIdx + 1);
							this.list.domFocus();
						}
						return;
					} else if (this.focusedFoldRecordId) {
						const subIdx = focused.span.records.findIndex(r => r.id === this.focusedFoldRecordId);
						e.preventDefault();
						e.stopPropagation();
						if (subIdx > 0) {
							this.focusedFoldRecordId = focused.span.records[subIdx - 1].id;
							this.scrollRecordIntoView(this.focusedFoldRecordId);
							this.syncTrajectoryFoldChildFocus(true);
						} else {
							this.focusedFoldRecordId = undefined;
							this.syncTrajectoryFoldChildFocus(false);
							this.list.domFocus();
						}
						return;
					}
				}
			}
		}, true));
		this._register(addDisposableListener(this.tableScroll, 'keydown', (e) => {
			if (e.key !== 'Enter' && e.key !== ' ') {
				return;
			}
			const row = this.resolveTrajectoryRecordRow(e.target as HTMLElement);
			if (row) {
				e.preventDefault();
				this.activateRecordFromTableRow(row);
				return;
			}
			const focused = this.list.getFocusedElements()[0];
			if (!focused) {
				return;
			}
			e.preventDefault();
			if (focused.type === 'record') {
				this.selectRecord(focused.record, true);
			} else if (focused.type === 'fold') {
				if (this.focusedFoldRecordId && this.isFoldExpanded(focused.span.id)) {
					const childRecord = focused.span.records.find(r => r.id === this.focusedFoldRecordId);
					if (childRecord) {
						this.selectRecord(childRecord, true);
						return;
					}
				}
				this.onToggleFold(focused.span.id);
			}
		}));

		this._register(addDisposableListener(this.tableScroll, 'scroll', (e) => {
			if (this.tableScroll.scrollTop !== 0) {
				this.tableScroll.scrollTop = 0;
			}
			if (this.tableScroll.scrollLeft !== 0) {
				this.tableScroll.scrollLeft = 0;
			}
			const target = e.target as HTMLElement | null;
			if (target && target !== this.tableScroll) {
				if (target.scrollTop !== 0) {
					target.scrollTop = 0;
				}
				if (target.scrollLeft !== 0) {
					target.scrollLeft = 0;
				}
			}
		}, true));

		const targetWindow = getWindow(this.tableScroll);
		if (typeof targetWindow.ResizeObserver === 'function') {
			const observer = new targetWindow.ResizeObserver(entries => {
				for (const entry of entries) {
					const width = Math.floor(entry.contentRect.width);
					const height = Math.floor(entry.contentRect.height);
					if (width > 0 && height > 0) {
						this.listHeight = height;
						this.listWidth = width;
						if (this.displayItems.length > 0) {
							this.list.layout(this.listHeight, this.listWidth);
						}
					}
				}
			});
			observer.observe(this.tableScroll);
			this._register(toDisposable(() => observer.disconnect()));
		}

		this.searchScheduler = this._register(new RunOnceScheduler(() => {
			this.searchQuery = this.searchInput.value;
			this.refreshTable();
		}, TRAJECTORY_SEARCH_DEBOUNCE_MS));

		this._register(addDisposableListener(this.searchInput, 'input', () => {
			this.searchScheduler.schedule();
		}));
		this._register(addDisposableListener(this.searchInput, 'keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				if (this.searchInput.value.length > 0 || this.searchQuery.length > 0) {
					this.clearTrajectorySearch();
					this.refreshTable();
				} else {
					this.list.domFocus();
				}
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				if (this.list.length > 0 && this.list.getFocus().length === 0) {
					this.list.setFocus([0]);
				}
				this.list.domFocus();
			}
		}));

		this.inspector = append(this.body, $('.conversation-lens-trajectory-inspector'));
		this.inspector.hidden = true;

		const inspectorHeader = append(this.inspector, $('.conversation-lens-trajectory-inspector-header'));
		this.inspectorBackButton = append(inspectorHeader, $('button.conversation-lens-trajectory-inspector-back')) as HTMLButtonElement;
		this.inspectorBackButton.type = 'button';
		this.inspectorBackButton.textContent = conversationTrajectoryInspectorBack;
		this.inspectorBackButton.setAttribute('aria-label', conversationTrajectoryInspectorBack);
		this.inspectorBackButton.hidden = true;
		this._register(addDisposableListener(this.inspectorBackButton, 'click', () => this.dismissInspectorOverlay()));

		const inspectorTitle = append(inspectorHeader, $('span.conversation-lens-trajectory-inspector-title'));
		inspectorTitle.textContent = localize('conversationTrajectory.inspectorTitle', "Inspector");

		const closeButton = append(inspectorHeader, $('button.conversation-lens-trajectory-inspector-close')) as HTMLButtonElement;
		closeButton.type = 'button';
		closeButton.title = conversationTrajectoryInspectorClose;
		closeButton.setAttribute('aria-label', conversationTrajectoryInspectorClose);
		closeButton.classList.add(...ThemeIcon.asClassNameArray(Codicon.close));
		this._register(addDisposableListener(closeButton, 'click', () => this.dismissInspectorOverlay()));
		this._register(addDisposableListener(this.host, 'keydown', e => {
			if (e.key !== 'Escape' || this.inspector.hidden) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			this.dismissInspectorOverlay();
		}));

		this.inspectorContent = append(this.inspector, $('.conversation-lens-trajectory-inspector-content'));

		this._register(toDisposable(() => this.detailInspector.dispose()));
		this._register(this.detailInspector.onDidChange(() => this.refreshDetailInspector()));
	}

	get selectedRecordId(): string | undefined {
		return this.selectedRecordIdHolder.current;
	}

	isFoldExpanded(spanId: string): boolean {
		// A collapsed fold hides the step the search matched. Keep the stored bit for when the query clears.
		if (this.searchQuery.trim().length > 0) {
			return true;
		}
		return this.processFoldOuterExpanded.get(spanId) ?? true;
	}

	isFoldForcedOpen(): boolean {
		return this.searchQuery.trim().length > 0;
	}

	showLiveChrome(): boolean {
		return this.options.showLiveChrome?.() ?? false;
	}

	displayMode(): 'stub' | 'live' | 'cached' {
		return this.options.displayMode?.() ?? (this.showLiveChrome() ? 'live' : 'stub');
	}

	onSelectRecord(record: ConversationTrajectoryRecord, navigateToConversation: boolean): void {
		this.selectRecord(record, navigateToConversation);
	}

	onToggleFold(spanId: string): void {
		// Search forces folds open. Toggling here would only flip the stored bit.
		if (this.searchQuery.trim().length > 0) {
			return;
		}
		this.processFoldOuterExpanded.set(spanId, !this.isFoldExpanded(spanId));
		const index = this.displayItems.findIndex(item => item.type === 'fold' && item.span.id === spanId);
		if (index >= 0) {
			this.list.updateElementHeight(index, this.listDelegate.getHeight(this.displayItems[index]));
		}
		this.relayoutList();
	}

	show(): void {
		this.visible = true;
		this.host.hidden = false;
		this.relayoutList();
		if (this.lastRevealedRecordId) {
			this.scrollRecordIntoView(this.lastRevealedRecordId);
		}
	}

	hide(): void {
		this.visible = false;
		this.host.hidden = true;
	}

	isVisible(): boolean {
		return this.visible;
	}

	getPaintedRecordCount(): number {
		return this.currentRecords.length;
	}

	setRecords(records: readonly ConversationTrajectoryRecord[], linkedTurnIds?: ReadonlySet<string>): void {
		this.currentRecords = records;
		if (linkedTurnIds) {
			this.linkedTurnIds.current = new Set(linkedTurnIds);
		}
		this.refreshOverview();
		this.refreshTable();
	}

	clearSessionState(): void {
		this.hideRevealNotice();
		this.detailInspector.clearSession();
		this.processFoldOuterExpanded.clear();
		// Search belongs to the session being left. The next table must not stay filtered.
		this.clearTrajectorySearch();
		this.closeInspector();
	}

	/** Closes the local inspector if open. Does not change the session or selected record. */
	tryDismissInspector(): boolean {
		if (this.inspector.hidden) {
			return false;
		}
		this.dismissInspectorOverlay();
		return true;
	}

	refreshDetailInspector(): void {
		const selectedId = this.selectedRecordIdHolder.current;
		if (!selectedId || this.inspector.hidden) {
			return;
		}
		const record = this.currentRecords.find(candidate => candidate.id === selectedId);
		if (record) {
			this.openInspector(record);
		}
	}

	private refreshOverview(): void {
		this.overviewDisposables.clear();
		clearNode(this.overviewTrack);
		// Same window as the table. Records the limit notice already dropped are not clickable segments.
		const { segments } = buildTrajectoryOverviewSegments(applyTrajectoryRecordLimit(this.currentRecords).visibleRecords);
		this.overviewHost.hidden = segments.length === 0;
		if (segments.length === 0) {
			return;
		}
		for (const segment of segments) {
			const segmentEl = append(this.overviewTrack, $('button.conversation-lens-trajectory-overview-segment')) as HTMLButtonElement;
			segmentEl.type = 'button';
			segmentEl.dataset.segmentKind = segment.kind;
			segmentEl.dataset.recordIds = segment.recordIds.join(',');
			segmentEl.title = segment.label;
			segmentEl.setAttribute('aria-label', segment.label);
			const glyph = append(segmentEl, $('span.conversation-lens-trajectory-overview-segment-glyph'));
			glyph.setAttribute('aria-hidden', 'true');
			this.overviewDisposables.add(addDisposableListener(segmentEl, 'click', () => {
				const targetId = segment.recordIds[0];
				if (targetId) {
					this.revealRecord(targetId);
				}
			}));
		}
		this.syncOverviewChrome();
		this.syncOverviewActiveSegment();
	}

	private syncOverviewActiveSegment(recordId = this.selectedRecordIdHolder.current): void {
		const segments = [...this.overviewTrack.querySelectorAll<HTMLElement>('.conversation-lens-trajectory-overview-segment')];
		let activeIndex = -1;
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			const ids = segment.dataset.recordIds?.split(',') ?? [];
			const active = !!recordId && ids.includes(recordId);
			if (active && activeIndex === -1) {
				activeIndex = i;
			}
			segment.classList.toggle('conversation-lens-trajectory-overview-segment--active', active);
			segment.setAttribute('aria-current', active ? 'true' : 'false');
		}
		const tabStopIndex = activeIndex >= 0 ? activeIndex : 0;
		for (let i = 0; i < segments.length; i++) {
			segments[i].tabIndex = i === tabStopIndex ? 0 : -1;
		}
	}

	private syncOverviewChrome(): void {
		this.overviewToggle.setAttribute('aria-expanded', String(this.overviewExpanded));
		const label = this.overviewExpanded ? conversationTrajectoryOverviewCollapse : conversationTrajectoryOverviewExpand;
		this.overviewToggle.title = label;
		this.overviewToggle.setAttribute('aria-label', label);
		this.overviewToggle.classList.toggle('conversation-lens-trajectory-overview-toggle--collapsed', !this.overviewExpanded);
		this.overviewTrack.hidden = !this.overviewExpanded;
	}

	/** Writes why into the reveal notice when no row is shown for the jump. */
	reportUnmappedReveal(options?: { readonly focus?: boolean }): void {
		this.showRevealNotice(conversationTrajectoryRevealUnmapped, options?.focus);
	}

	revealRecord(recordId: string, options?: { readonly focus?: boolean }): ConversationTrajectoryRevealResult {
		const record = this.currentRecords.find(candidate => candidate.id === recordId);
		if (!record) {
			this.showRevealNotice(conversationTrajectoryRevealUnmapped, options?.focus);
			return 'missing';
		}

		const windowRecords = applyTrajectoryRecordLimit(this.currentRecords).visibleRecords;
		if (!windowRecords.some(candidate => candidate.id === recordId)) {
			this.showRevealNotice(formatConversationTrajectoryRevealOutsideWindow(windowRecords.length), options?.focus);
			return 'outsideWindow';
		}
		// Overview is the window map, not the search result. A click still has to land on that row.
		if (!filterTrajectoryRecordsBySearch(windowRecords, this.searchQuery).some(candidate => candidate.id === recordId)) {
			this.clearTrajectorySearch();
		}

		const viewModel = buildTrajectoryTableViewModel(this.currentRecords, this.searchQuery);
		const visibleRecord = viewModel.items.some(item =>
			item.type === 'record'
				? item.record.id === recordId
				: item.span.recordIds.includes(recordId),
		);
		if (!visibleRecord) {
			this.showRevealNotice(conversationTrajectoryRevealUnmapped, options?.focus);
			return 'missing';
		}

		for (const item of viewModel.items) {
			if (item.type === 'fold' && item.span.recordIds.includes(recordId)) {
				this.processFoldOuterExpanded.set(item.span.id, true);
				break;
			}
		}

		this.lastRevealedRecordId = recordId;
		this.selectedRecordIdHolder.current = recordId;
		this.refreshTable();
		this.selectRecord(record, false);
		this.scrollRecordIntoView(recordId);
		if (options?.focus) {
			this.focusTableRow(this.displayIndexOfRecord(recordId));
		}
		return 'revealed';
	}

	private showRevealNotice(text: string, focus: boolean | undefined): void {
		this.revealNotice.textContent = text;
		this.revealNotice.hidden = false;
		if (focus) {
			this.focusTableRow(this.list.getFocus()[0] ?? -1);
		}
	}

	private hideRevealNotice(): void {
		this.revealNotice.hidden = true;
		this.revealNotice.textContent = '';
	}

	private displayIndexOfRecord(recordId: string): number {
		return this.displayItems.findIndex(item =>
			item.type === 'record'
				? item.record.id === recordId
				: item.span.recordIds.includes(recordId),
		);
	}

	/** Moves DOM focus into the table so the jump does not strand keyboard focus on the hidden lens. */
	private focusTableRow(index: number): void {
		if (this.displayItems.length === 0) {
			return;
		}
		if (index >= 0 && index < this.displayItems.length) {
			this.list.setFocus([index]);
		}
		this.list.domFocus();
	}

	private clearTrajectorySearch(): void {
		this.searchScheduler.cancel();
		this.searchQuery = '';
		if (this.searchInput.value.length > 0) {
			this.searchInput.value = '';
		}
	}

	private relayoutList(): void {
		if (this.lastLayoutCollapsed || !this.visible) {
			return;
		}
		if (this.tableScroll.scrollTop !== 0) {
			this.tableScroll.scrollTop = 0;
		}
		if (this.tableScroll.scrollLeft !== 0) {
			this.tableScroll.scrollLeft = 0;
		}
		const scrollable = this.tableScroll.querySelector<HTMLElement>('.monaco-scrollable-element');
		if (scrollable && scrollable.scrollTop !== 0) {
			scrollable.scrollTop = 0;
		}
		if (scrollable && scrollable.scrollLeft !== 0) {
			scrollable.scrollLeft = 0;
		}
		const measuredHeight = Math.floor(this.tableScroll.clientHeight);
		const measuredWidth = Math.floor(this.tableScroll.clientWidth);
		if (measuredHeight > 0 && measuredWidth > 0) {
			this.listHeight = measuredHeight;
			this.listWidth = measuredWidth;
			if (this.displayItems.length > 0) {
				this.list.layout(this.listHeight, this.listWidth);
			}
		}
	}

	layout(height: number, width: number): void {
		const wasCollapsed = this.lastLayoutCollapsed;
		const collapsed = width < 1 || height < 1;
		this.lastLayoutCollapsed = collapsed;
		if (collapsed) {
			return;
		}
		if (this.tableScroll.scrollTop !== 0) {
			this.tableScroll.scrollTop = 0;
		}
		if (this.tableScroll.scrollLeft !== 0) {
			this.tableScroll.scrollLeft = 0;
		}
		const measuredHeight = Math.floor(this.tableScroll.clientHeight);
		const measuredWidth = Math.floor(this.tableScroll.clientWidth);
		if (measuredHeight > 0 && measuredWidth > 0) {
			this.listHeight = measuredHeight;
			this.listWidth = measuredWidth;
		} else {
			const inspectorOpen = !this.inspector.hidden && !this.isNarrowWidth();
			const overviewHeight = this.overviewExpanded ? 64 : 28;
			const toolbarHeight = 30;
			const inspectorHeight = inspectorOpen ? Math.min(height * 0.4, 200) : 0;
			this.listHeight = Math.max(0, height - toolbarHeight - overviewHeight - inspectorHeight - 32);
			this.listWidth = Math.min(width, 704);
		}
		this.syncInspectorOverlay();
		if (this.displayItems.length > 0 && this.listHeight > 0 && this.listWidth > 0) {
			this.list.layout(this.listHeight, this.listWidth);
		}
		if (wasCollapsed && this.lastRevealedRecordId) {
			this.scrollRecordIntoView(this.lastRevealedRecordId);
		}
	}

	private refreshTable(): void {
		const viewModel = buildTrajectoryTableViewModel(this.currentRecords, this.searchQuery);
		this.displayItems = viewModel.items;
		this.omittedCount = viewModel.omittedCount;

		const empty = viewModel.totalCount === 0;
		this.emptyState.style.display = empty ? '' : 'none';
		this.body.hidden = empty;

		if (empty) {
			this.closeInspector();
			this.limitNotice.hidden = true;
			this.list.splice(0, this.list.length, []);
			return;
		}

		this.limitNotice.hidden = this.omittedCount === 0;
		if (this.omittedCount > 0) {
			this.limitNotice.textContent = formatConversationTrajectoryLimitNotice(
				viewModel.visibleRecordCount,
				viewModel.totalCount,
			);
		}

		const selectedStillVisible = this.selectedRecordIdHolder.current
			&& viewModel.items.some(item =>
				item.type === 'record'
					? item.record.id === this.selectedRecordIdHolder.current
					: item.span.recordIds.includes(this.selectedRecordIdHolder.current!),
			);
		if (this.selectedRecordIdHolder.current && !selectedStillVisible) {
			this.closeInspector();
		} else if (this.selectedRecordIdHolder.current && selectedStillVisible && !this.inspector.hidden) {
			const selected = this.currentRecords.find(record => record.id === this.selectedRecordIdHolder.current);
			if (selected) {
				this.openInspector(selected);
			}
		}

		this.list.splice(0, this.list.length, [...viewModel.items]);
		this.relayoutList();

		if (this.pendingRevealRecordId) {
			const recordId = this.pendingRevealRecordId;
			this.pendingRevealRecordId = undefined;
			this.scrollRecordIntoView(recordId);
		}
	}

	private scrollRecordIntoView(recordId: string): void {
		const index = this.displayItems.findIndex(item =>
			item.type === 'record'
				? item.record.id === recordId
				: item.span.recordIds.includes(recordId),
		);
		if (index < 0 || index >= this.displayItems.length) {
			return;
		}
		const item = this.displayItems[index];
		let targetTop = this.list.getElementTop(index);
		const targetHeight = TRAJECTORY_ROW_HEIGHT;

		if (item.type === 'fold') {
			if (!this.isFoldExpanded(item.span.id)) {
				this.list.reveal(index);
				return;
			}
			const subIndex = item.span.recordIds.indexOf(recordId);
			if (subIndex >= 0) {
				targetTop += TRAJECTORY_FOLD_HEADER_HEIGHT + subIndex * TRAJECTORY_ROW_HEIGHT;
			}
		}

		const targetBottom = targetTop + targetHeight;
		const currentScrollTop = this.list.scrollTop;
		const viewportHeight = this.list.renderHeight;

		if (targetTop < currentScrollTop) {
			this.list.scrollTop = targetTop;
		} else if (targetBottom > currentScrollTop + viewportHeight) {
			this.list.scrollTop = Math.max(0, targetBottom - viewportHeight);
		}
	}

	private selectRecord(record: ConversationTrajectoryRecord, navigateToConversation: boolean): void {
		const linkedTurnId = findTurnIdForTrajectoryRecord(record, this.linkedTurnIds.current);
		if (navigateToConversation && linkedTurnId && this.options.onNavigateToLinkedTurn) {
			this.options.onNavigateToLinkedTurn(linkedTurnId);
			return;
		}

		this.hideRevealNotice();
		this.selectedRecordIdHolder.current = record.id;
		this.syncTrajectoryRowSelectionStyles();
		this.syncOverviewActiveSegment(record.id);
		this.openInspector(record);
		this.scrollRecordIntoView(record.id);
	}

	private isNarrowWidth(): boolean {
		return this.listWidth > 0 && this.listWidth < CONVERSATION_TRAJECTORY_OVERLAY_WIDTH;
	}

	private syncInspectorOverlay(): void {
		const open = !this.inspector.hidden;
		const overlay = open && this.isNarrowWidth();
		// Opening beside the table must not remember scroll 0. Save the position when the inspector starts covering the list.
		if (overlay && !this.inspectorOverlayActive) {
			this.inspectorOverlayScrollTop = this.list.scrollTop;
		}
		this.inspectorOverlayActive = overlay;
		this.host.classList.toggle('conversation-lens-trajectory--narrow', this.isNarrowWidth());
		this.host.classList.toggle('conversation-lens-trajectory--inspector-open', open);
		this.host.classList.toggle('conversation-lens-trajectory--inspector-overlay', overlay);
		this.inspectorBackButton.hidden = !overlay;
	}

	private dismissInspectorOverlay(): void {
		const hadFocus = this.inspector.contains(getActiveElement());
		const restoreOverlayScroll = this.inspectorOverlayActive;
		const scrollTop = this.inspectorOverlayScrollTop;
		this.inspector.hidden = true;
		clearNode(this.inspectorContent);
		this.syncInspectorOverlay();
		this.syncTrajectoryRowSelectionStyles();
		this.syncOverviewActiveSegment(undefined);
		this.relayoutList();
		if (restoreOverlayScroll) {
			this.list.scrollTop = scrollTop;
		}
		if (hadFocus) {
			this.list.domFocus();
		}
	}

	private openInspector(record: ConversationTrajectoryRecord): void {
		this.inspector.hidden = false;
		this.syncInspectorOverlay();
		this.relayoutList();
		this.inspectorDisposables.clear();
		clearNode(this.inspectorContent);

		const detailView = this.detailInspector.resolve(record, this.options.detailContext);
		appendInspectorStateBadge(this.inspectorContent, detailView.state);

		appendInspectorSection(this.inspectorContent, conversationTrajectoryInspectorSummary, detailView.previewText, this.inspectorDisposables);

		if (detailView.statusMessage) {
			const statusSection = append(this.inspectorContent, $('.conversation-lens-trajectory-inspector-status'));
			statusSection.textContent = detailView.statusMessage;
			statusSection.setAttribute('role', 'status');
		}

		if (detailView.state === 'full' && detailView.fullText !== undefined) {
			appendInspectorSection(this.inspectorContent, conversationTrajectoryInspectorFull, detailView.fullText, this.inspectorDisposables);
		} else if (detailView.state === 'partial' && detailView.boundedText) {
			appendInspectorSection(this.inspectorContent, conversationTrajectoryInspectorPartial, detailView.boundedText, this.inspectorDisposables);
		} else if (detailView.truncated && detailView.boundedText) {
			appendInspectorSection(this.inspectorContent, conversationTrajectoryInspectorPreview, detailView.boundedText, this.inspectorDisposables);
		} else if (detailView.state === 'loading') {
			const loading = append(this.inspectorContent, $('.conversation-lens-trajectory-inspector-loading'));
			loading.textContent = conversationTrajectoryDetailLoading;
			loading.setAttribute('role', 'status');
		}

		if (detailView.canRetry && record.detailRef) {
			const retry = append(this.inspectorContent, $('button.conversation-lens-trajectory-inspector-retry')) as HTMLButtonElement;
			retry.type = 'button';
			retry.textContent = conversationTrajectoryDetailRetry;
			retry.setAttribute('aria-label', conversationTrajectoryDetailRetry);
			const detailRef = record.detailRef;
			this.inspectorDisposables.add(addDisposableListener(retry, 'click', () => this.detailInspector.retry(detailRef)));
		}

		if (record.kind === 'compacted') {
			appendInspectorCompactedMetadata(this.inspectorContent, record, this.inspectorDisposables);
		} else {
			const payload = buildInspectorPayload(record);
			if (payload) {
				appendInspectorSection(this.inspectorContent, conversationTrajectoryInspectorPayload, payload, this.inspectorDisposables);
			}

			const result = record.result ?? record.outputDetail;
			if (result && (record.kind === 'tool' || record.kind === 'subtool' || record.kind === 'thinking')) {
				appendInspectorSection(this.inspectorContent, conversationTrajectoryInspectorResult, result, this.inspectorDisposables);
			}
		}
	}

	private closeInspector(): void {
		this.selectedRecordIdHolder.current = undefined;
		this.dismissInspectorOverlay();
	}

	/** T5 virtual list `rerender()` does not re-run row renderers; sync selection chrome in DOM. */
	private syncTrajectoryRowSelectionStyles(): void {
		const selectedId = this.selectedRecordIdHolder.current;
		// eslint-disable-next-line no-restricted-syntax -- rows are virtualized by the list view, so no stable reference exists
		for (const row of this.host.querySelectorAll('.conversation-lens-trajectory-record-row')) {
			const recordId = row.getAttribute('data-record-id');
			const selected = !!selectedId && recordId === selectedId;
			row.classList.toggle('conversation-lens-trajectory-record-row--selected', selected);
			row.setAttribute('aria-selected', String(selected));
		}
	}

	private syncTrajectoryFoldChildFocus(focusDom: boolean): void {
		const focusedId = this.focusedFoldRecordId;
		// eslint-disable-next-line no-restricted-syntax -- rows are virtualized by the list view, so no stable reference exists
		for (const row of this.host.querySelectorAll<HTMLElement>('.conversation-process-fold-children .conversation-lens-trajectory-record-row')) {
			const recordId = row.getAttribute('data-record-id');
			const isFocused = !!focusedId && recordId === focusedId;
			row.classList.toggle('conversation-lens-trajectory-record-row--focused', isFocused);
			if (isFocused && focusDom) {
				row.focus({ preventScroll: true });
			}
		}
	}

	private resolveTrajectoryRecordRow(target: HTMLElement): HTMLElement | undefined {
		const row = target.closest('.conversation-lens-trajectory-record-row');
		if (!row || !this.tableScroll.contains(row)) {
			return undefined;
		}
		return row as HTMLElement;
	}

	private activateRecordFromTableRow(target: HTMLElement): void {
		const row = this.resolveTrajectoryRecordRow(target);
		if (!row) {
			return;
		}
		const recordId = row.getAttribute('data-record-id');
		if (!recordId) {
			return;
		}
		const record = this.currentRecords.find(candidate => candidate.id === recordId);
		if (record) {
			this.selectRecord(record, true);
		}
	}
}

function applyTrajectoryFoldTemplate(
	templateData: ITrajectoryFoldTemplateData,
	span: TrajectoryProcessFoldSpan,
	host: ITrajectoryTableHost,
): void {
	const expanded = host.isFoldExpanded(span.id);
	templateData.root.dataset.foldId = span.id;
	templateData.header.setAttribute('aria-expanded', String(expanded));
	if (host.isFoldForcedOpen()) {
		templateData.header.setAttribute('aria-disabled', 'true');
	} else {
		templateData.header.removeAttribute('aria-disabled');
	}
	templateData.summary.textContent = summarizeTrajectoryProcessSteps(span, {
		showLiveChrome: host.showLiveChrome(),
		displayMode: host.displayMode(),
	});
	const summaryText = templateData.summary.textContent ?? '';
	templateData.header.setAttribute('aria-label', expanded
		? localize('conversationProcessFold.outerHeaderExpanded', "Process steps, {0}, expanded", summaryText)
		: localize('conversationProcessFold.outerHeaderCollapsed', "Process steps, {0}, collapsed", summaryText));
	templateData.chevron.classList.toggle('conversation-process-fold-chevron--expanded', expanded);
	templateData.children.hidden = !expanded;
	clearNode(templateData.children);

	if (expanded) {
		for (const record of span.records) {
			const row = append(templateData.children, $('.conversation-lens-trajectory-record-row'));
			row.tabIndex = -1;
			populateTrajectoryRecordRow(row, record, host.selectedRecordId);
		}
	}
}

function populateTrajectoryRecordRow(
	row: HTMLElement,
	record: ConversationTrajectoryRecord,
	selectedRecordId: string | undefined,
): void {
	clearNode(row);
	row.setAttribute('role', 'row');
	row.setAttribute('data-record-id', record.id);
	row.setAttribute('data-kind', record.kind);

	const depth = record.depth ?? 0;
	row.style.paddingInlineStart = depth > 0 ? `${depth * TRAJECTORY_SUBTOOL_INDENT_PX}px` : '';
	row.classList.toggle('conversation-lens-trajectory-record-row--indented', depth > 0);

	const kindCell = append(row, $('.conversation-lens-trajectory-table-kind'));
	kindCell.setAttribute('role', 'cell');
	const kindIcon = append(kindCell, $('span.conversation-lens-trajectory-table-kind-icon'));
	kindIcon.classList.add(...ThemeIcon.asClassNameArray(getTrajectoryKindIcon(record.kind)));
	kindIcon.setAttribute('aria-hidden', 'true');
	const kindLabel = append(kindCell, $('span.conversation-lens-trajectory-table-kind-label'));
	kindLabel.textContent = getTrajectoryKindLabel(record.kind);

	const previewCell = append(row, $('.conversation-lens-trajectory-table-preview'));
	previewCell.setAttribute('role', 'cell');
	if (record.sourceBlocks?.length) {
		const readable = record.kind === 'user' ? conversationUserBodyText(record.text) : record.text;
		const trimmed = readable.trim();
		previewCell.textContent = trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed;
		if (trimmed.length > 120) {
			previewCell.title = trimmed;
		}
	} else {
		const preview = getTrajectoryRecordPreview(record);
		previewCell.textContent = preview;
		if (preview.length > 120) {
			previewCell.title = preview;
		}
	}

	if (record.sourceBlocks?.length) {
		for (const block of record.sourceBlocks) {
			const chip = append(previewCell, $('span.conversation-lens-trajectory-source-block'));
			const chipText = block.toolName ?? block.content;
			chip.textContent = chipText;
			chip.title = chipText;
		}
	}

	const selected = selectedRecordId === record.id;
	row.classList.toggle('conversation-lens-trajectory-record-row--selected', selected);
	row.setAttribute('aria-selected', String(selected));
}

function appendInspectorSection(parent: HTMLElement, title: string, body: string, disposables?: DisposableStore): void {
	const section = append(parent, $('.conversation-lens-trajectory-inspector-section'));
	append(section, $('h4.conversation-lens-trajectory-inspector-section-title')).textContent = title;
	const content = append(section, $('.conversation-lens-trajectory-inspector-section-body'));
	if (disposables && (body.includes('[') || body.includes('`') || body.includes('*') || body.includes('#'))) {
		const md = new MarkdownString(body, { isTrusted: true, supportThemeIcons: true });
		const rendered = renderMarkdown(md);
		disposables.add(rendered);
		content.appendChild(rendered.element);
	} else {
		content.textContent = body;
	}
}

function appendInspectorStateBadge(parent: HTMLElement, state: TrajectoryDetailInspectorState): void {
	const badge = append(parent, $('.conversation-lens-trajectory-inspector-state'));
	badge.textContent = getInspectorStateLabel(state);
	badge.dataset.state = state;
	badge.setAttribute('aria-label', `${conversationTrajectoryInspectorStatus}: ${badge.textContent}`);
}

function getInspectorStateLabel(state: TrajectoryDetailInspectorState): string {
	switch (state) {
		case 'preview':
			return localize('conversationTrajectory.inspectorStatePreview', "Preview");
		case 'loading':
			return localize('conversationTrajectory.inspectorStateLoading', "Loading");
		case 'full':
			return localize('conversationTrajectory.inspectorStateFull', "Full");
		case 'partial':
			return localize('conversationTrajectory.inspectorStatePartial', "Partial");
		case 'unavailable':
			return localize('conversationTrajectory.inspectorStateUnavailable', "Unavailable");
		case 'failed':
			return localize('conversationTrajectory.inspectorStateFailed', "Failed");
	}
}

function appendInspectorCompactedMetadata(parent: HTMLElement, record: ConversationTrajectoryRecord, disposables?: DisposableStore): void {
	const parts: string[] = [];
	if (record.compactedAnchorTurnId || record.compactedFoldedLeafTurnId || record.compactedBranchTurnId) {
		if (record.compactedAnchorTurnId) {
			parts.push(localize('conversationTrajectory.compactedMetaAnchor', "Anchor: {0}", record.compactedAnchorTurnId));
		}
		if (record.compactedFoldedLeafTurnId) {
			parts.push(localize('conversationTrajectory.compactedMetaFoldedLeaf', "Folded leaf: {0}", record.compactedFoldedLeafTurnId));
		}
		if (record.compactedBranchTurnId) {
			parts.push(localize('conversationTrajectory.compactedMetaBranch', "Compact branch: {0}", record.compactedBranchTurnId));
		}
	} else if (record.compactedRange) {
		parts.push(localize('conversationTrajectory.compactedMetaRange', "Range: {0}", record.compactedRange));
	}
	if (record.compactedReason) {
		parts.push(localize('conversationTrajectory.compactedMetaReason', "Reason: {0}", record.compactedReason));
	}
	if (record.compactedSummary) {
		parts.push(localize('conversationTrajectory.compactedMetaSummary', "Summary: {0}", record.compactedSummary));
	}
	if (record.compactedTokensBefore !== undefined) {
		parts.push(localize('conversationTrajectory.compactedMetaTokensBefore', "Tokens before: {0}", String(record.compactedTokensBefore)));
	}
	if (record.compactedTokensAfter !== undefined) {
		parts.push(localize('conversationTrajectory.compactedMetaTokensAfter', "Tokens after: {0}", String(record.compactedTokensAfter)));
	}
	if (parts.length > 0) {
		appendInspectorSection(parent, conversationTrajectoryInspectorPayload, parts.join('\n'), disposables);
	}
	const notice = append(parent, $('.conversation-lens-trajectory-inspector-compacted-notice'));
	notice.textContent = conversationTrajectoryCompactedDiscardedNotice;
	notice.setAttribute('role', 'note');
}

function buildInspectorPayload(record: ConversationTrajectoryRecord): string | undefined {
	const parts: string[] = [];

	if (record.messageSource) {
		parts.push(`${record.messageSource.kind}${record.messageSource.label ? `: ${record.messageSource.label}` : ''}`);
	}

	if (record.environment) {
		const envParts = [record.environment.cwd, record.environment.os, record.environment.extra].filter(Boolean);
		if (envParts.length) {
			parts.push(envParts.join(' · '));
		}
	}

	if (record.promptDetail) {
		parts.push(record.promptDetail);
	}

	if (record.inputDetail) {
		parts.push(record.inputDetail);
	}

	for (const line of trajectoryAdmittedDetailLines(record)) {
		parts.push(line);
	}

	if (record.sourceBlocks?.length) {
		for (const block of record.sourceBlocks) {
			parts.push(`${block.type}${block.toolName ? ` (${block.toolName})` : ''}: ${block.content}`);
		}
	}

	return parts.length > 0 ? parts.join('\n') : undefined;
}
