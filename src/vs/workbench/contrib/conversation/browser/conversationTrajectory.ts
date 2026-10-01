/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, getWindow } from '../../../../base/browser/dom.js';
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

const TRAJECTORY_SUBTOOL_INDENT_PX = 12;
/** Product list/table row. Fold headers in this table use the same height. */
export const TRAJECTORY_ROW_HEIGHT = 22;
export const TRAJECTORY_FOLD_HEADER_HEIGHT = 22;
const TRAJECTORY_SEARCH_DEBOUNCE_MS = 150;

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

/** One-line preview for trajectory table navigation. User rows omit a legal refs trailer. */
export function getTrajectoryRecordPreview(record: ConversationTrajectoryRecord): string {
	if (record.kind === 'compacted') {
		if (record.compactedSummary) {
			const parts = [record.compactedRange, record.compactedReason, record.compactedSummary].filter(Boolean);
			return parts.join(' · ');
		}
		return record.text.trim() || localize('conversationTrajectory.compactedTypeOnly', "Compacted");
	}
	if (record.kind === 'unknown') {
		const typeName = record.messageSource?.kind;
		const unknownText = record.text.trim();
		if (typeName && unknownText) {
			return `${typeName}: ${unknownText}`;
		}
		return typeName || unknownText || localize('conversationTrajectory.unknownEmptyPreview', "(unknown)");
	}
	const readable = record.kind === 'user' ? conversationUserBodyText(record.text) : record.text;
	if (record.kind === 'user' && record.sourceBlocks?.length) {
		const chips = record.sourceBlocks.map(block => block.toolName ?? block.content).join(', ');
		const trimmed = readable.trim();
		return trimmed ? `${trimmed} · ${chips}` : chips;
	}

	const trimmed = readable.trim();
	if (!trimmed) {
		return localize('conversationTrajectory.emptyPreview', "(empty)");
	}
	return trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed;
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
	showLiveChrome(): boolean;
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
	getWidgetAriaLabel(): string {
		return conversationLensSessionBarTrajectoryListAria;
	}

	getAriaLabel(element: TrajectoryTableDisplayItem): string {
		if (element.type === 'record') {
			return `${getTrajectoryKindLabel(element.record.kind)}: ${getTrajectoryRecordPreview(element.record)}`;
		}
		return summarizeTrajectoryProcessSteps(element.span);
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
	private inspectorOverlayScrollTop = 0;
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
		this.overviewToggle.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
		this._register(addDisposableListener(this.overviewToggle, 'click', () => {
			this.overviewExpanded = !this.overviewExpanded;
			this.syncOverviewChrome();
			this.relayoutList();
		}));

		this.overviewTrack = append(this.overviewHost, $('.conversation-lens-trajectory-overview-track'));
		this.overviewTrack.setAttribute('role', 'list');
		this.overviewTrack.setAttribute('aria-label', conversationTrajectoryOverviewTitle);

		this.limitNotice = append(this.body, $('.conversation-lens-trajectory-limit-notice'));
		this.limitNotice.hidden = true;
		this.limitNotice.setAttribute('role', 'status');

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
				accessibilityProvider: new TrajectoryTableAccessibilityProvider(),
				openOnSingleClick: true,
				mouseSupport: true,
				keyboardSupport: true,
			},
		)) as WorkbenchList<TrajectoryTableDisplayItem>;

		this._register(addDisposableListener(this.tableScroll, 'click', (e) => {
			this.activateRecordFromTableRow(e.target as HTMLElement);
		}));
		this._register(addDisposableListener(this.tableScroll, 'keydown', (e) => {
			if (e.key !== 'Enter' && e.key !== ' ') {
				return;
			}
			const row = this.resolveTrajectoryRecordRow(e.target as HTMLElement);
			if (!row) {
				return;
			}
			e.preventDefault();
			this.activateRecordFromTableRow(row);
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
		return this.processFoldOuterExpanded.get(spanId) ?? true;
	}

	showLiveChrome(): boolean {
		return this.options.showLiveChrome?.() ?? false;
	}

	onSelectRecord(record: ConversationTrajectoryRecord, navigateToConversation: boolean): void {
		this.selectRecord(record, navigateToConversation);
	}

	onToggleFold(spanId: string): void {
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
		this.detailInspector.clearSession();
		this.processFoldOuterExpanded.clear();
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
		if (!selectedId) {
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
			segmentEl.setAttribute('role', 'listitem');
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
		const segments = this.overviewTrack.querySelectorAll<HTMLElement>('.conversation-lens-trajectory-overview-segment');
		for (const segment of segments) {
			const ids = segment.dataset.recordIds?.split(',') ?? [];
			const active = !!recordId && ids.includes(recordId);
			segment.classList.toggle('conversation-lens-trajectory-overview-segment--active', active);
			segment.setAttribute('aria-current', active ? 'true' : 'false');
		}
	}

	private syncOverviewChrome(): void {
		this.overviewToggle.setAttribute('aria-expanded', String(this.overviewExpanded));
		this.overviewToggle.title = this.overviewExpanded ? conversationTrajectoryOverviewCollapse : conversationTrajectoryOverviewExpand;
		this.overviewToggle.classList.toggle('conversation-lens-trajectory-overview-toggle--collapsed', !this.overviewExpanded);
		this.overviewTrack.hidden = !this.overviewExpanded;
	}

	revealRecord(recordId: string): void {
		const record = this.currentRecords.find(candidate => candidate.id === recordId);
		if (!record) {
			return;
		}

		const windowRecords = applyTrajectoryRecordLimit(this.currentRecords).visibleRecords;
		if (!windowRecords.some(candidate => candidate.id === recordId)) {
			return;
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
			return;
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
		} else if (this.selectedRecordIdHolder.current && selectedStillVisible) {
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
		this.host.classList.toggle('conversation-lens-trajectory--narrow', this.isNarrowWidth());
		this.host.classList.toggle('conversation-lens-trajectory--inspector-open', open);
		this.host.classList.toggle('conversation-lens-trajectory--inspector-overlay', overlay);
		this.inspectorBackButton.hidden = !overlay;
	}

	private dismissInspectorOverlay(): void {
		this.inspector.hidden = true;
		clearNode(this.inspectorContent);
		this.syncInspectorOverlay();
		this.syncTrajectoryRowSelectionStyles();
		this.syncOverviewActiveSegment(undefined);
		this.relayoutList();
		if (this.isNarrowWidth()) {
			this.list.scrollTop = this.inspectorOverlayScrollTop;
		}
	}

	private openInspector(record: ConversationTrajectoryRecord): void {
		if (this.inspector.hidden && this.isNarrowWidth()) {
			this.inspectorOverlayScrollTop = this.list.scrollTop;
		}
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
	templateData.summary.textContent = summarizeTrajectoryProcessSteps(span, { showLiveChrome: host.showLiveChrome() });
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
	previewCell.textContent = getTrajectoryRecordPreview(record);

	if (record.sourceBlocks?.length) {
		for (const block of record.sourceBlocks) {
			const chip = append(previewCell, $('span.conversation-lens-trajectory-source-block'));
			chip.textContent = block.toolName ?? block.content;
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

	if (record.sourceBlocks?.length) {
		for (const block of record.sourceBlocks) {
			parts.push(`${block.type}${block.toolName ? ` (${block.toolName})` : ''}: ${block.content}`);
		}
	}

	return parts.length > 0 ? parts.join('\n') : undefined;
}
