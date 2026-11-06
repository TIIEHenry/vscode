/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Product shell module loaded by both window entries (`workbench.common.main.ts` and
// `sessions.common.main.ts`), after the theme service. Both windows load `style.ts`, the
// theme service and the settings contributions, but only the default window loads the
// conversation contribution, so anything both windows need cannot hang off that one.

import './productShell/media/productAccessibility.css';
import './parts/conversation/media/ua-common.css';
