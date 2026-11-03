/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TimeoutTimer } from '../../../../base/common/async.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';
import Severity from '../../../../base/common/severity.js';
import { localize } from '../../../../nls.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationHandle, INotificationService, NotificationPriority } from '../../../../platform/notification/common/notification.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';

export class AccessibilityStatus extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.accessibilityStatus';

	private _isDisposed = false;
	private screenReaderNotification: INotificationHandle | null = null;
	private promptedScreenReader: boolean = false;
	private readonly screenReaderModeElement = this._register(new MutableDisposable<IStatusbarEntryAccessor>());
	private readonly screenReaderPromptTimer = this._register(new TimeoutTimer());

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@INotificationService private readonly notificationService: INotificationService,
		@IAccessibilityService private readonly accessibilityService: IAccessibilityService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IOpenerService private readonly openerService: IOpenerService,
	) {
		super();

		this._register(CommandsRegistry.registerCommand({ id: 'showEditorScreenReaderNotification', handler: () => this.showScreenReaderNotification() }));

		this.updateScreenReaderModeElement(this.accessibilityService.isScreenReaderOptimized());

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => this.onScreenReaderModeChange()));

		this._register(this.configurationService.onDidChangeConfiguration(c => {
			if (c.affectsConfiguration('editor.accessibilitySupport')) {
				this.onScreenReaderModeChange();
			}
		}));
	}

	private showScreenReaderNotification(): void {
		if (this._store.isDisposed || this._isDisposed) {
			return;
		}
		this.screenReaderNotification = this.notificationService.prompt(
			Severity.Info,
			localize('screenReaderDetectedExplanation.question', "Screen reader usage detected. Do you want to enable {0} to optimize the editor for screen reader usage?", 'editor.accessibilitySupport'),
			[{
				label: localize('screenReaderDetectedExplanation.answerYes', "Yes"),
				run: () => {
					if (this._store.isDisposed || this._isDisposed) {
						return;
					}
					this.configurationService.updateValue('editor.accessibilitySupport', 'on', ConfigurationTarget.USER).catch(onUnexpectedError);
				}
			}, {
				label: localize('screenReaderDetectedExplanation.answerNo', "No"),
				run: () => {
					if (this._store.isDisposed || this._isDisposed) {
						return;
					}
					this.configurationService.updateValue('editor.accessibilitySupport', 'off', ConfigurationTarget.USER).catch(onUnexpectedError);
				}
			},
			{
				label: localize('screenReaderDetectedExplanation.answerLearnMore', "Learn More"),
				run: () => {
					if (this._store.isDisposed || this._isDisposed) {
						return;
					}
					this.openerService.open('https://code.visualstudio.com/docs/editor/accessibility#_screen-readers');
				}
			}],
			{
				sticky: true,
				priority: NotificationPriority.URGENT
			}
		);

		Event.once(this.screenReaderNotification.onDidClose)(() => this.screenReaderNotification = null);
	}
	private updateScreenReaderModeElement(visible: boolean): void {
		if (visible) {
			if (!this.screenReaderModeElement.value) {
				const text = localize('screenReaderDetected', "Screen Reader Optimized");
				this.screenReaderModeElement.value = this.statusbarService.addEntry({
					name: localize('status.editor.screenReaderMode', "Screen Reader Mode"),
					text,
					ariaLabel: text,
					command: 'showEditorScreenReaderNotification',
					kind: 'prominent',
					showInAllWindows: true
				}, 'status.editor.screenReaderMode', StatusbarAlignment.RIGHT, 100.6);
			}
		} else {
			this.screenReaderModeElement.clear();
		}
	}

	private onScreenReaderModeChange(): void {
		if (this._store.isDisposed || this._isDisposed) {
			return;
		}

		// We only support text based editors
		const screenReaderDetected = this.accessibilityService.isScreenReaderOptimized();
		if (screenReaderDetected) {
			const screenReaderConfiguration = this.configurationService.getValue('editor.accessibilitySupport');
			if (screenReaderConfiguration === 'auto') {
				if (!this.promptedScreenReader) {
					this.promptedScreenReader = true;
					this.screenReaderPromptTimer.cancelAndSet(() => {
						if (this._store.isDisposed || this._isDisposed) {
							return;
						}
						this.showScreenReaderNotification();
					}, 100);
				}
			}
		}

		if (this.screenReaderNotification) {
			this.screenReaderNotification.close();
		}
		this.updateScreenReaderModeElement(this.accessibilityService.isScreenReaderOptimized());
	}

	override dispose(): void {
		this._isDisposed = true;
		if (this.screenReaderNotification) {
			this.screenReaderNotification.close();
			this.screenReaderNotification = null;
		}
		super.dispose();
	}
}
