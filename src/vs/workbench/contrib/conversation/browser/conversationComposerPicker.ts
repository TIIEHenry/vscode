/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, addStandardDisposableListener } from '../../../../base/browser/dom.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { IAction, Separator, toAction } from '../../../../base/common/actions.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { ResolvedChord, ResolvedKeybinding, SingleModifierChord } from '../../../../base/common/keybindings.js';
import { DisposableStore, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IContextMenuService, IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { conversationLensDockNoModel } from './conversationLensDockStrings.js';

/**
 * Opens the workbench menu for the composer's Ask / Agent / Model controls.
 *
 * The `SelectBox` stays the source of truth (options, selection, enabled state, `onDidSelect`).
 * A pick writes the index back to the `<select>` and fires `change`. The menu is the same popup
 * as the application menu: 24px rows, a check on the current value, and the menu's own keyboard.
 */

export interface IComposerPickerFooter {
	readonly label: string;
	run(): void;
}

export interface IComposerPickerOptions {
	readonly alignment: AnchorAlignment;
	readonly ariaLabel: string;
	readonly footer?: IComposerPickerFooter;
	/** When the window uses the native menu, leave the platform `<select>` popup alone. */
	readonly useNativeSelect?: boolean;
	readonly getItemDetail?: (index: number, label: string) => string | undefined;
}

class MenuDetailKeybinding extends ResolvedKeybinding {
	constructor(private readonly detail: string) {
		super();
	}
	override getLabel(): string | null { return this.detail; }
	override getAriaLabel(): string | null { return this.detail; }
	override getElectronAccelerator(): string | null { return null; }
	override getUserSettingsLabel(): string | null { return null; }
	override isWYSIWYG(): boolean { return false; }
	override hasMultipleChords(): boolean { return false; }
	override getChords(): ResolvedChord[] { return []; }
	override getDispatchChords(): (string | null)[] { return []; }
	override getSingleModifierDispatchChords(): (SingleModifierChord | null)[] { return []; }
}

export function attachComposerPicker(container: HTMLElement, contextViewService: IContextViewService, contextMenuService: IContextMenuService, options: IComposerPickerOptions): IDisposable {
	const store = new DisposableStore();
	if (options.useNativeSelect) {
		return store;
	}
	const select = container.getElementsByTagName('select')[0];
	if (!select) {
		return store;
	}
	select.setAttribute('aria-haspopup', 'menu');
	select.setAttribute('aria-expanded', 'false');

	let open = false;

	const show = () => {
		if (select.disabled || select.options.length === 0) {
			return;
		}
		const labels = Array.from(select.options, option => option.text);
		const selected = select.selectedIndex;
		const skipFirstNoModel = labels.length > 1 && labels[0] === conversationLensDockNoModel;
		const offset = skipFirstNoModel ? 1 : 0;
		const visibleLabels = labels.slice(offset);
		const details = new Map<IAction, string>();
		const actions: IAction[] = visibleLabels.map((label, i) => {
			const index = i + offset;
			const action = toAction({
				id: `conversation.composer.pick.${index}`,
				label,
				checked: index === selected,
				run: () => {
					// The options can be replaced while the menu is open (catalog refresh, disconnect).
					const stale = select.disabled || select.options[index]?.text !== label;
					if (!stale && index !== select.selectedIndex) {
						select.selectedIndex = index;
						select.dispatchEvent(new Event('change', { bubbles: true }));
					}
				},
			});
			const detail = options.getItemDetail?.(index, label);
			if (detail) {
				details.set(action, detail);
				(action as { detail?: string }).detail = detail;
			}
			return action;
		});
		if (options.footer) {
			const footer = options.footer;
			actions.push(new Separator());
			actions.push(toAction({
				id: 'conversation.composer.pick.footer',
				label: footer.label,
				run: () => footer.run(),
			}));
		}
		open = true;
		select.setAttribute('aria-expanded', 'true');
		contextMenuService.showContextMenu({
			getAnchor: () => select,
			getActions: () => actions,
			getCheckedActionsRepresentation: () => 'radio',
			getKeyBinding: action => {
				const detail = details.get(action);
				return detail ? new MenuDetailKeybinding(detail) : undefined;
			},
			getMenuClassName: () => 'conversation-composer-picker-menu',
			skipTelemetry: true,
			anchorAlignment: options.alignment,
			autoSelectFirstItem: true,
			onHide: () => {
				open = false;
				select.setAttribute('aria-expanded', 'false');
			},
		});
	};

	const toggle = () => {
		if (open) {
			contextViewService.hideContextView();
			return;
		}
		show();
	};

	// Capture on the container so the SelectBox's own handlers on the `<select>` never run.
	store.add(addDisposableListener(container, 'mousedown', e => {
		if (e.button !== 0) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		toggle();
	}, true));
	store.add(addDisposableListener(container, 'click', e => {
		e.preventDefault();
		e.stopPropagation();
	}, true));
	// A focused `<select>` changes its value on arrows, Home / End, Page keys and type-ahead
	// without opening anything. Those keys open this menu instead.
	store.add(addStandardDisposableListener(container, 'keydown', e => {
		if (e.target !== select || e.ctrlKey || e.metaKey) {
			return;
		}
		switch (e.keyCode) {
			case KeyCode.Enter:
			case KeyCode.Space:
			case KeyCode.DownArrow:
			case KeyCode.UpArrow:
			case KeyCode.Home:
			case KeyCode.End:
			case KeyCode.PageUp:
			case KeyCode.PageDown:
				e.preventDefault();
				e.stopPropagation();
				toggle();
				return;
		}
		if (!e.altKey && e.browserEvent.key.length === 1) {
			e.preventDefault();
			e.stopPropagation();
		}
	}, true));
	store.add(toDisposable(() => {
		if (open) {
			contextViewService.hideContextView();
		}
	}));
	return store;
}
