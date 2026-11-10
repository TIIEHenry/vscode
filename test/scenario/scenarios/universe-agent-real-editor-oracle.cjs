/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is a verifier for opt-in real runs. Its pure functions are also exercised
// with negative fixtures; those fixtures are never labelled live evidence.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const provenance = require('./universe-agent-real-editor-provenance.cjs');

const COMMON_ASSERTIONS = Object.freeze([
	'model-identity', 'protocol-identity', 'profile-identity', 'user-dedup',
	'dom-visible', 'body-order', 'live-to-durable', 'no-terminal-overlay',
	'tool-call-correlation', 'process-fold-persistence', 'event-correlated', 'scene-contract', 'dom-frame-provenance'
]);
const RESPONSE_MODEL_ALIASES = Object.freeze({
	'sub2api-mimo/mimo-v2.6-flash': Object.freeze(['sub2api-mimo/mimo-v2.6-flash', 'mimo-v2.6-flash']),
	'sub2api-mimo/mimo-v2.6-pro': Object.freeze(['sub2api-mimo/mimo-v2.6-pro', 'mimo-v2.6-pro'])
});
const REQUIRED_ASSERTIONS = Object.freeze(Object.fromEntries(Array.from({ length: 10 }, (_, index) => {
	const id = `U${String(index + 1).padStart(2, '0')}`;
	const extra = id === 'U07' ? ['history-identity', 'history-status']
		: id === 'U04' || id === 'U05' ? ['permission-delivered']
			: id === 'U06' ? ['cancel-terminal']
				: ['U08', 'U09', 'U10'].includes(id) ? ['route-owned-terminal'] : [];
	return [id, Object.freeze([...COMMON_ASSERTIONS, ...extra])];
})));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' ? value : '';
const normalize = value => text(value).replace(/\s+/gu, ' ').trim();
const isWithin = (root, file) => file.startsWith(`${root}${path.sep}`);
const jsonEqual = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
function canonical(value) {
	if (Array.isArray(value)) { return value.map(canonical); }
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
	}
	return value;
}
function check(condition, code) {
	if (!condition) { const error = new Error(code); error.code = code; throw error; }
}
function diagnosticError(error) {
 if (String(error?.code || '').startsWith('budget-')) { return error; }
 const invalid = /dom-frame-provenance-invalid|digest-mismatch|module-seal-invalid/u.test(error?.code || error?.message || '');
 const code = invalid ? 'dom-frame-provenance-invalid' : 'dom-frame-provenance-unavailable';
 return Object.assign(new Error(code), { code });
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
	fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	const temporary = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
	fs.renameSync(temporary, file);
}

const BUDGET_POLICY = require('./universe-agent-real-editor-budget.json');
const nsPerMs = 1000000n;
function budgetForCase(caseId) {
	const { cases, ...common } = BUDGET_POLICY;
	check(Object.hasOwn(cases, caseId), 'budget-case-not-registered');
	return { ...common, ...cases[caseId], episodeCount: cases[caseId].episodeLabels.length };
}
function decimalNs(value, code) {
	check(typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/u.test(value), code);
	return BigInt(value);
}
function validateBudgetIdentity(env, identity, caseRoot, nowNs = process.hrtime.bigint(), bootId = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()) {
	const budget = budgetForCase(identity.caseId);
	const budgetSha256 = sha256(JSON.stringify(canonical(budget)));
	check(jsonEqual(identity.budget, budget) && identity.budgetSha256 === budgetSha256
		&& env.UA_REAL_EDITOR_BUDGET_SHA256 === budgetSha256, 'budget-policy-identity-mismatch');
	check(budget.clock === 'linux-clock-monotonic-ns' && process.platform === 'linux', 'budget-clock-domain-unsupported');
	const clock = identity.clock;
	check(clock?.bootId === bootId && env.UA_REAL_EDITOR_BOOT_ID === bootId, 'budget-boot-id-mismatch');
	check(env.UA_REAL_EDITOR_SETUP_STARTED_MONO_NS === clock.setupStartedMonoNs
		&& env.UA_REAL_EDITOR_SETUP_DEADLINE_MONO_NS === clock.setupDeadlineMonoNs, 'budget-setup-clock-identity-mismatch');
	const start = decimalNs(clock.setupStartedMonoNs, 'budget-setup-start-invalid');
	const deadline = decimalNs(clock.setupDeadlineMonoNs, 'budget-setup-deadline-invalid');
	check(deadline - start === BigInt(budget.setupMs) * nsPerMs && nowNs >= start, 'budget-monotonic-domain-or-setup-range-mismatch');
	for (const [key, name] of [['UA_REAL_EDITOR_BUDGET_PROGRESS_FILE', 'budget-progress.json'], ['UA_REAL_EDITOR_CLEANUP_BUDGET_FILE', 'cleanup-budget.json']]) {
		check(env[key] === path.join(caseRoot, name), 'budget-file-not-fixed-private-case-path');
	}
	return { budget, budgetSha256, clock, progressFile: env.UA_REAL_EDITOR_BUDGET_PROGRESS_FILE, cleanupFile: env.UA_REAL_EDITOR_CLEANUP_BUDGET_FILE };
}

/** Publish a complete cleanup claim once. A competing owner can never extend it. */
function claimCleanupBudget(file, identity, config, nowNs, clockNow = () => process.hrtime.bigint()) {
	const cap = BigInt(config.clock.setupStartedMonoNs) + BigInt(config.budget.watchdogMs) * nsPerMs;
	const requested = nowNs + BigInt(config.budget.cleanupMs) * nsPerMs;
	const claim = { schemaVersion: 1, campaignId: identity.campaignId, cellId: identity.cellId, caseId: identity.caseId,
		nonce: identity.nonce, budgetSha256: config.budgetSha256, bootId: config.clock.bootId,
		cleanupStartedMonoNs: String(nowNs), cleanupDeadlineMonoNs: String(requested < cap ? requested : cap) };
	const temporary = `${file}.${process.pid}.${crypto.randomBytes(12).toString('hex')}.claim`;
	fs.writeFileSync(temporary, `${JSON.stringify(claim)}\n`, { flag: 'wx', mode: 0o600 });
	try { fs.linkSync(temporary, file); }
	catch (error) { if (error.code !== 'EEXIST') { throw error; } }
	finally { fs.unlinkSync(temporary); }
	check(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(), 'cleanup-budget-not-regular');
	const existing = readJson(file);
	for (const key of ['schemaVersion', 'campaignId', 'cellId', 'caseId', 'nonce', 'budgetSha256', 'bootId']) {
		check(existing[key] === claim[key], `cleanup-budget-identity-mismatch:${key}`);
	}
	const started = decimalNs(existing.cleanupStartedMonoNs, 'cleanup-budget-start-invalid');
	const deadline = decimalNs(existing.cleanupDeadlineMonoNs, 'cleanup-budget-deadline-invalid');
	const expected = started + BigInt(config.budget.cleanupMs) * nsPerMs;
	check(started >= BigInt(config.clock.setupStartedMonoNs) && started <= clockNow()
		&& deadline === (expected < cap ? expected : cap), 'cleanup-budget-range-mismatch');
	return existing;
}

/** One monotonic deadline per stage; a timed-out operation poisons all later business work. */
function createBudgetController(identity, config, hooks = {}) {
	const now = hooks.nowNs ?? (() => process.hrtime.bigint());
	const arm = hooks.setTimer ?? setTimeout;
	const disarm = hooks.clearTimer ?? clearTimeout;
	const publish = hooks.publish ?? (value => writeJson(config.progressFile, value));
	const cleanupExists = hooks.cleanupExists ?? (() => fs.existsSync(config.cleanupFile));
	const cleanupClaim = hooks.claimCleanup ?? (at => claimCleanupBudget(config.cleanupFile, identity, config, at, now));
	const plan = [{ phase: 'setup', ms: config.budget.setupMs },
		...config.budget.episodeLabels.map((episodeLabel, index) => ({ phase: 'episode', ms: config.budget.episodeMs, episodeLabel, episodeIndex: index + 1 })),
		...(config.budget.historyMs ? [{ phase: 'history', ms: config.budget.historyMs }] : []),
		{ phase: 'finalization', ms: config.budget.finalizationMs }];
	const stages = [];
	let index = 0;
	let seq = 0;
	let poison;
	let timeout;
	let startedEpisodeCount = 0;
	let completedEpisodeCount = 0;
	let active = { ...plan[0], started: BigInt(config.clock.setupStartedMonoNs), deadline: BigInt(config.clock.setupDeadlineMonoNs), status: 'active' };
	stages.push(active);
	const view = stage => ({ phase: stage.phase, episodeIndex: stage.episodeIndex ?? 0, episodeLabel: stage.episodeLabel ?? null,
		phaseStartedMonoNs: String(stage.started), phaseDeadlineMonoNs: String(stage.deadline), status: stage.status,
		endedMonoNs: stage.ended === undefined ? null : String(stage.ended),
		durationMs: Number((stage.ended ?? now()) - stage.started) / 1e6, timeoutOperation: stage.timeoutOperation ?? null });
	function snapshot() {
		return { budget: config.budget, budgetSha256: config.budgetSha256, clock: config.clock,
			expectedEpisodeCount: config.budget.episodeCount, startedEpisodeCount, completedEpisodeCount,
			budgetStages: stages.map(view), ...(timeout ? { timeout } : {}) };
	}
	function update() {
		const progress = { schemaVersion: 1, campaignId: identity.campaignId, cellId: identity.cellId, caseId: identity.caseId,
			nonce: identity.nonce, budgetSha256: config.budgetSha256, bootId: config.clock.bootId, seq: ++seq,
			...view(active), expectedEpisodeCount: config.budget.episodeCount, startedEpisodeCount, completedEpisodeCount,
			budgetStages: stages.map(view) };
		publish(progress);
		hooks.changed?.(snapshot());
	}
	function expired(operation) {
		if (active.status === 'timed-out') { return active.timeoutError ?? poison; }
		if (!poison || active.phase === 'cleanup') {
			const error = new Error(`budget-timeout:${active.phase}:${operation}`);
			error.code = 'budget-stage-timeout';
			if (!timeout) { timeout = { phase: active.phase, episodeIndex: active.episodeIndex ?? 0,
				episodeLabel: active.episodeLabel ?? null, operation, atMonoNs: String(now()) }; }
			active.status = 'timed-out'; active.ended = now(); active.timeoutOperation = operation;
			active.timeoutError = error;
			poison ??= error;
			update();
			return error;
		}
		return poison;
	}
	function remaining(operation) {
		if (active.phase !== 'cleanup') {
			if (poison) { throw poison; }
			if (cleanupExists()) {
				poison = Object.assign(new Error('budget-cleanup-already-started'), { code: 'budget-cleanup-already-started' });
				throw poison;
			}
		}
		const left = active.deadline - now();
		if (left <= 0n) { throw expired(operation); }
		check(active.status === 'active', 'budget-stage-already-closed');
		return Number((left + nsPerMs - 1n) / nsPerMs);
	}
	async function operation(label, callback) {
		const stage = active;
		const left = remaining(label);
		let timer;
		try {
			const value = await Promise.race([
				Promise.resolve().then(() => callback(remaining(label))),
				new Promise((_, reject) => { timer = arm(() => reject(expired(label)), left); })
			]);
			check(active === stage, 'budget-stage-changed-during-operation');
			remaining(label);
			return value;
		} catch (error) {
			if (active === stage && active.deadline <= now()) { throw expired(label); }
			throw error;
		} finally { if (timer !== undefined) { disarm(timer); } }
	}
	function next() {
		remaining('stage-transition');
		check(active.phase !== 'cleanup' && index + 1 < plan.length, 'budget-unregistered-stage-transition');
		const at = now();
		if (at >= active.deadline) { throw expired('stage-transition'); }
		active.status = 'completed'; active.ended = at;
		if (active.phase === 'episode') { completedEpisodeCount++; }
		const target = plan[++index];
		active = { ...target, started: at, deadline: at + BigInt(target.ms) * nsPerMs, status: 'active' };
		if (active.phase === 'episode') { startedEpisodeCount++; }
		stages.push(active); update();
		return active;
	}
	function expect(phase, episodeLabel) {
		remaining('stage-precondition');
		check(active.phase === phase && (phase !== 'episode' || active.episodeLabel === episodeLabel), 'budget-stage-or-episode-order-mismatch');
	}
	function beginCleanup(success = false) {
		if (active.phase === 'cleanup') { return; }
		if (success) {
			remaining('finalization-complete');
			check(active.phase === 'finalization' && completedEpisodeCount === config.budget.episodeCount, 'budget-incomplete-business-stages');
		} else if (!poison) { poison = Object.assign(new Error('budget-business-failed'), { code: 'budget-business-failed' }); }
		const at = now();
		if (success && at >= active.deadline) { throw expired('finalization-complete'); }
		active.ended ??= at;
		if (active.status === 'active') { active.status = success ? 'completed' : 'failed'; }
		const claim = cleanupClaim(at);
		active = { phase: 'cleanup', ms: config.budget.cleanupMs, started: BigInt(claim.cleanupStartedMonoNs),
			deadline: BigInt(claim.cleanupDeadlineMonoNs), status: 'active' };
		stages.push(active); update();
	}
	function finishCleanup() {
		expect('cleanup'); active.status = 'completed'; active.ended = now(); update();
	}
	update();
	return { remaining, operation, next, expect, beginCleanup, finishCleanup, snapshot,
		current: () => view(active), assert: operation => remaining(operation) };
}
function exactFile(root, relative) {
	return canonicalTaskFile(root, relative);
}

/** Resolve the declared task path, refusing symlink aliases and traversal. */
function canonicalTaskFile(root, raw) {
	check(typeof root === 'string' && path.isAbsolute(root) && fs.realpathSync(root) === root && fs.statSync(root).isDirectory(), 'route-workspace-not-canonical');
	check(typeof raw === 'string' && raw.length > 0 && raw === raw.trim() && !raw.includes('\0'), 'route-file-path-missing-or-invalid');
	check(!raw.split(path.sep).includes('..'), 'route-file-path-traversal');
	const file = path.resolve(root, raw);
	check(isWithin(root, file), 'fixture-path-outside-private-workspace');
	let cursor = root;
	const pieces = path.relative(root, file).split(path.sep);
	for (let index = 0; index < pieces.length; index++) {
		cursor = path.join(cursor, pieces[index]);
		let info;
		try { info = fs.lstatSync(cursor); }
		catch (error) { if (error.code === 'ENOENT') { break; } throw error; }
		check(!info.isSymbolicLink(), 'route-file-path-symlink');
		check(index === pieces.length - 1 ? info.isFile() : info.isDirectory(), 'route-file-path-not-regular');
	}
	return file;
}

function fileArguments(raw) {
	let args;
	try { args = JSON.parse(raw); } catch { check(false, 'route-file-arguments-not-json'); }
	check(args && typeof args === 'object' && !Array.isArray(args), 'route-file-arguments-not-object');
	return args;
}

function exactArgumentPath(workspace, rawArgs, expectedName) {
	const args = fileArguments(rawArgs);
	return canonicalTaskFile(workspace, args.file_path) === exactFile(workspace, expectedName);
}

function exactWriterContent(rawArgs, expected) {
	const args = fileArguments(rawArgs);
	check(typeof args.content === 'string', 'route-file-write-content-missing');
	let content;
	try { content = JSON.parse(args.content); } catch { check(false, 'route-file-write-content-not-json'); }
	check(jsonEqual(content, expected), 'route-file-write-content-differs-from-oracle');
}

function isOtherWriter(name) {
	return name === 'bash' || name.startsWith('shell_')
		|| name.startsWith('file_') && !['file_read', 'file_list', 'file_search', 'file_write'].includes(name);
}

function routeWriters(calls, fixture, rootAgentId) {
	check(fixture?.workspace && fixture.outputs && text(rootAgentId).trim(), 'route-workspace-or-root-owner-missing');
	const targets = Object.entries(fixture.outputs).map(([name, expected]) => ({ name, expected, path: exactFile(fixture.workspace, name) }));
	const writers = new Map(targets.map(target => [target.name, []]));
	for (const call of calls) {
		check(!isOtherWriter(call.name || ''), 'route-unregistered-writer-or-shell');
		if (call.name !== 'file_write') { continue; }
		check(call.agentId === rootAgentId, 'route-file-write-not-owned-by-root');
		check(call.executionArgRecords.length === 1, 'route-file-write-execution-args-not-observed-once');
		const actual = canonicalTaskFile(fixture.workspace, fileArguments(call.executionArgs).file_path);
		const target = targets.find(item => item.path === actual);
		check(target, 'route-file-write-target-not-declared');
		exactWriterContent(call.executionArgs, target.expected);
		writers.get(target.name).push(call);
	}
	return writers;
}

function writerInStage(writers, name, after, before) {
	const candidates = writers.get(name) ?? [];
	check(candidates.length === 1, 'route-target-not-written-exactly-once');
	const call = candidates[0];
	check(call.starts.length === 1 && call.terminals.length === 1 && !call.isError
		&& call.starts[0] > after && call.executionArgRecords[0] > call.starts[0] && call.terminals[0] > call.executionArgRecords[0]
		&& call.terminals[0] < before, 'route-target-write-outside-own-stage');
	return call;
}

function validateIdentity(env, oracle) {
	check(oracle?.schemaVersion === 1, 'unsupported-oracle-schema');
	for (const [field, key] of [
		['campaignId', 'UA_REAL_EDITOR_CAMPAIGN_ID'], ['cellId', 'UA_REAL_EDITOR_CELL_ID'],
		['caseId', 'UA_REAL_EDITOR_CASE_ID'], ['nonce', 'UA_REAL_EDITOR_NONCE'],
		['model', 'UA_REAL_EDITOR_MODEL'], ['protocol', 'UA_REAL_EDITOR_PROTOCOL'],
		['modelProfile', 'UA_REAL_EDITOR_MODEL_PROFILE']
	]) {
		check(typeof env[key] === 'string' && env[key].length > 0 && oracle[field] === env[key], `oracle-identity-mismatch:${field}`);
	}
	check(Object.hasOwn(REQUIRED_ASSERTIONS, oracle.caseId), 'unsupported-required-scene');
	check(['anthropic', 'openai-chat', 'openai-response'].includes(oracle.protocol), 'unsupported-protocol');
	check(['sub2api-mimo/mimo-v2.6-flash', 'sub2api-mimo/mimo-v2.6-pro'].includes(oracle.model), 'unsupported-model');
	check(jsonEqual(oracle.responseModelAliases, RESPONSE_MODEL_ALIASES[oracle.model]), 'response-model-aliases-not-predeclared-exact-sku');
	check(jsonEqual(oracle.requiredAssertions, REQUIRED_ASSERTIONS[oracle.caseId]), 'required-assertions-differ-from-frozen-contract');
	const workspace = path.resolve(env.UA_REAL_EDITOR_WORKDIR || '');
	check(path.isAbsolute(env.UA_REAL_EDITOR_WORKDIR || '') && oracle.workspaceExpected?.root === workspace, 'workspace-oracle-mismatch');
	check(fs.realpathSync(workspace) === workspace && fs.statSync(workspace).isDirectory(), 'workspace-not-real-directory');
	const oracleFile = path.resolve(env.UA_REAL_EDITOR_ORACLE_FILE || '');
	check(!isWithin(workspace, oracleFile) && oracleFile !== workspace, 'expected-answer-is-readable-from-task-workspace');
	return { ...oracle, workspace, oracleFile };
}

/** Random data is written to inputs only. Expected outputs stay outside the model workspace. */
function prepareFixture(workspace, caseId, label = caseId) {
	check(Object.hasOwn(REQUIRED_ASSERTIONS, caseId), 'unsupported-fixture-case');
	const nonce = crypto.randomBytes(18).toString('hex');
	const values = Array.from({ length: 6 }, () => crypto.randomInt(101, 900));
	const second = Array.from({ length: 3 }, () => crypto.randomInt(101, 900));
	const sum = values.reduce((total, value) => total + value, 0);
	const combined = sum + second.reduce((total, value) => total + value, 0);
	const inputName = `${label.toLowerCase()}-input.json`;
	const otherName = `${label.toLowerCase()}-other.json`;
	const outputName = `${label.toLowerCase()}-result.json`;
	const stageName = `${label.toLowerCase()}-stage1.json`;
	const missingName = `${label.toLowerCase()}-missing-${crypto.randomBytes(5).toString('hex')}.json`;
	let input = { nonce, values };
	const outputs = {};
	let finalTokens = [nonce, String(sum)];
	const instruction = '先用中文简短说明接下来要做的工作，再执行真实工具。最后用中文回答，使用 Markdown 标题、加粗标签和 JSON 代码块。';
	let prompt = `${instruction}读取当前工作区的 ${inputName}，从实际文件取得 nonce 和 values；计算 values 的整数总和。最终回答给出文件中的 nonce 和总和，不要猜测文件内容。`;
	if (caseId === 'U02') {
		prompt = `${instruction}分别用 file_read 读取 ${inputName} 和 ${otherName}，必须进行两个独立的同名工具调用。合计两个文件的所有 values，最终给出第一个文件中的 nonce 与总和。`;
		finalTokens = [nonce, String(combined)];
	} else if (caseId === 'U03') {
		prompt = `${instruction}用 file_read 实际读取 ${missingName} 一次。此文件可能不存在；保留工具的真实失败，不创建它，不换其他路径，不重试。然后说明实际结果。`;
		finalTokens = [];
	} else if (caseId === 'U04' || caseId === 'U05') {
		prompt = `${instruction}读取 ${inputName}，然后用 file_write 将 ${outputName} 写为只有 nonce 和 sum 两个字段的 JSON：nonce 复制输入字符串，sum 是 values 的整数总和。等待客户端权限决定；若被拒绝，不用其他工具绕过，不重试或创建替代文件，说明实际结果即可。`;
		outputs[outputName] = { nonce, sum };
		finalTokens = caseId === 'U04' ? [nonce] : [];
	} else if (caseId === 'U06') {
		prompt = `${instruction}用前台 shell_run 执行 python3 -c 'import time; time.sleep(90)'，等待它运行结束。不要放后台，不要设置短超时，不要调用其他工具，也不要写文件。客户端会测试取消这个正在执行的工具。`;
		finalTokens = [];
	} else if (caseId === 'U08') {
		prompt = `${instruction}这是明确的路由合同。只调用一次 agent_spawn，profile='code', context='none', async=false。给子代理绝对工作区 ${workspace}，让子代理实际读取 ${inputName} 并用 file_write 将 ${outputName} 写为只有 nonce、count、sum 的 JSON；nonce 复制输入，count 是 values 数量，sum 是整数总和。你自己不得写、编辑或使用 shell；等待子代理成功后读取结果，在最终回答给出 nonce 与 sum。`;
		outputs[outputName] = { nonce, count: values.length, sum };
	} else if (caseId === 'U09') {
		const limit = crypto.randomInt(30, 70);
		const options = [
			{ id: crypto.randomBytes(8).toString('hex'), replicas: 2, p99Ms: limit - 4 },
			{ id: crypto.randomBytes(8).toString('hex'), replicas: 3, p99Ms: limit - 1 },
			{ id: crypto.randomBytes(8).toString('hex'), replicas: 4, p99Ms: limit + 8 }
		].sort(() => crypto.randomInt(0, 2) ? 1 : -1);
		input = { nonce, minimumReplicas: 3, maximumP99Ms: limit, options };
		const chosen = options.find(option => option.replicas >= 3 && option.p99Ms <= limit).id;
		outputs[outputName] = { nonce, option: chosen };
		finalTokens = [nonce, chosen];
		prompt = `${instruction}读取 ${inputName}。只调用一次 deep_think，dimensions=['durability','latency'], validate_conflicts=false, budget_seconds=300。durability 维度检查文件的 minimumReplicas，latency 检查 maximumP99Ms；必须等待两个维度均完成并综合。然后用 file_write 将 ${outputName} 写为只有 nonce 和 option 的 JSON；option 是唯一满足全部硬约束的输入候选 id。不要调用其他路由工具或冲突校验。最终给出 nonce 与选中 id。`;
	} else if (caseId === 'U10') {
		outputs[stageName] = { nonce, sum };
		outputs[outputName] = { nonce, twice: sum * 2 };
		finalTokens = [nonce, String(sum * 2)];
		prompt = `${instruction}执行明确的两轮 loop 合同：调用 loop_create 一次，target='two-phase reconciliation', exit_condition='both files verified', max_iterations=3。第1轮读取 ${inputName}，用 file_write 写 ${stageName}，只有 nonce 和 sum（values 的整数总和）。写入成功后调用 loop_next 一次，参数 {}。第2轮读取 ${stageName}，用 file_write 写 ${outputName}，只有 nonce 和 twice（sum 的两倍）。写入成功后调用 loop_exit 一次，随后最终回答给出 nonce 和 twice。不要创建第二个 loop 或调用其他路由工具。`;
	}
	const inputText = `${JSON.stringify(input, null, 2)}\n`;
	fs.writeFileSync(exactFile(workspace, inputName), inputText, { flag: 'wx', mode: 0o600 });
	const inputs = { [inputName]: inputText };
	if (caseId === 'U02') {
		inputs[otherName] = `${JSON.stringify({ nonce: crypto.randomBytes(18).toString('hex'), values: second }, null, 2)}\n`;
		fs.writeFileSync(exactFile(workspace, otherName), inputs[otherName], { flag: 'wx', mode: 0o600 });
	}
	for (const name of [...Object.keys(outputs), missingName]) { check(!fs.existsSync(exactFile(workspace, name)), 'fixture-result-must-not-be-prefilled'); }
	const followup = caseId === 'U02' ? '继续同一会话：把刚才两个文件 values 的总和乘以 2，用中文和 JSON 代码块回答，并保留第一个输入文件中的 nonce。不要使用其他会话的数据。' : undefined;
	check(!prompt.includes(nonce) && (!followup || !followup.includes(nonce)), 'prompt-leaks-oracle-answer');
	if (caseId === 'U09') { check(!prompt.includes(outputs[outputName].option), 'prompt-leaks-route-answer'); }
	return { caseId, label, workspace, prompt, followup, followupTokens: followup ? [nonce, String(combined * 2)] : undefined,
		inputs, outputs, finalTokens, inputName, otherName, outputName, stageName, missingName };
}

function envelopesFromEvents(records) {
	const byId = new Map();
	for (const record of records) {
		const event = record.decoded ?? record;
		const entries = [event.envelope_appended?.envelope,
			...(event.envelope_batch_appended?.envelopes ?? []),
			...(event.envelope_range_replaced?.replacement ?? [])].filter(Boolean);
		for (const id of event.envelope_range_replaced?.replaced_envelope_ids ?? []) { byId.delete(id); }
		for (const envelope of entries) { if (envelope.id) { byId.set(envelope.id, envelope); } }
	}
	return [...byId.values()].sort((left, right) => BigInt(left.seq) < BigInt(right.seq) ? -1 : BigInt(left.seq) > BigInt(right.seq) ? 1 : 0);
}
function envelopeText(envelope) {
	return (envelope.blocks ?? []).map(block => text(block.text_block?.text)).join('');
}
function toolFacts(records) {
	const calls = new Map();
	const stable = (call, key, value) => {
		if (typeof value !== 'string' || value.length === 0) { return; }
		check(call[key] === undefined || call[key] === value, `tool-call-${key}-changed-for-same-id`);
		call[key] = value;
	};
	const fact = id => {
		check(typeof id === 'string' && id.trim() === id && id.length > 0, 'real-tool-call-id-missing');
		if (!calls.has(id)) { calls.set(id, { id, envelopes: [], starts: [], terminals: [], executionArgRecords: [] }); }
		return calls.get(id);
	};
	for (const [index, record] of records.entries()) {
		const event = record.decoded ?? record;
		const life = event.tool_call_lifecycle;
		if (life) {
			const call = fact(life.tool_call_id);
			stable(call, 'agentId', life.agent_id);
			stable(call, 'turnId', life.turn_id);
			if (life.started) {
				stable(call, 'name', life.started.tool_name);
				call.args = call.executionArgs ?? life.started.args_json;
				call.starts.push(index);
			}
			if (life.args_complete) {
				const args = life.args_complete.args_json ?? '';
				check(call.executionArgs === undefined || toolOutputMatches(call.executionArgs, args), 'tool-execution-arguments-changed-for-same-call');
				call.executionArgs = args;
				call.executionArgRecords.push(index);
				call.args = args;
			}
			if (life.completed || life.failed) {
				call.terminals.push(index);
				if (life.completed) {
					const output = life.completed.output ?? '';
					const isError = life.completed.is_error === true;
					check(!call.lifecycleFailed || isError, 'tool-failed-execution-presented-as-success');
					check(!call.hasExecutionResult || toolOutputMatches(call.executionOutput, output) && call.executionIsError === isError, 'tool-execution-result-changed-for-same-call');
					call.hasExecutionResult = true; call.executionOutput = output; call.executionIsError = isError;
					call.output = output; call.isError = isError;
				} else {
					check(!call.hasExecutionResult || call.executionIsError, 'tool-execution-terminal-status-conflict');
					call.lifecycleFailed = true; call.failedMessage = life.failed.error_message ?? '';
					call.output = call.failedMessage; call.isError = true;
				}
			}
		}
		const snapshot = event.tool_runtime_snapshot;
		if (snapshot?.tool_call_id) {
			const call = fact(snapshot.tool_call_id);
			call.runtime = snapshot;
		}
	}
	for (const envelope of envelopesFromEvents(records)) {
		let callIndex = 0;
		for (const block of envelope.blocks ?? []) {
			if (block.tool_call_block) {
				const wire = block.tool_call_block;
				const call = fact(wire.tool_call_id);
				stable(call, 'name', wire.tool_name);
				stable(call, 'agentId', envelope.agent_id);
				if (wire.arguments_json !== undefined && call.executionArgs !== undefined) {
					check(toolOutputMatches(call.executionArgs, wire.arguments_json), 'tool-execution-and-durable-arguments-disagree');
				}
				call.persistedArgs = wire.arguments_json;
				call.args = call.executionArgs ?? wire.arguments_json ?? call.args;
				call.envelopes.push({ id: envelope.id, rowId: callIndex ? `${envelope.id}:tool:${callIndex}` : envelope.id, seq: envelope.seq });
				callIndex++;
			}
			if (block.tool_result_block) {
				const wire = block.tool_result_block;
				const call = fact(wire.tool_call_id);
				stable(call, 'name', wire.tool_name);
				stable(call, 'agentId', envelope.agent_id);
				if (call.hasExecutionResult) {
					check(toolOutputMatches(call.executionOutput, wire.content ?? '') && call.executionIsError === (wire.is_error === true), 'tool-execution-and-durable-result-disagree');
				}
				check(!call.lifecycleFailed || wire.is_error === true, 'tool-failed-execution-presented-as-success');
				call.persistedOutput = wire.content ?? '';
				call.output = call.hasExecutionResult ? call.executionOutput : call.persistedOutput;
				call.isError = call.hasExecutionResult ? call.executionIsError : call.lifecycleFailed || wire.is_error === true;
				call.persistedResult = true;
			}
		}
	}
	return [...calls.values()];
}

function verifyRoute(caseId, records, fixture) {
	const events = records.map(record => record.decoded ?? record);
	const calls = toolFacts(records);
	const completed = name => {
		const matching = calls.filter(call => call.name === name && call.starts.length === 1 && call.terminals.length === 1 && !call.isError && call.starts[0] < call.terminals[0]);
		check(matching.length === 1, `route-required-completed-tool:${name}`);
		return matching[0];
	};
	if (caseId === 'U08') {
		const parent = completed('agent_spawn');
		check(fixture?.workspace && fixture.outputs && text(parent.agentId).trim(), 'route-workspace-or-root-owner-missing');
		const activity = events.filter(event => event.sub_agent_activity?.parent_tool_call_id === parent.id).map(event => event.sub_agent_activity);
		const childIds = new Set(activity.map(item => item.sub_agent_id).filter(Boolean));
		check(childIds.size === 1, 'spawn-child-ownership-missing-or-ambiguous');
		const childId = [...childIds][0];
		const terminal = events.map(event => event.sub_agent_completed).filter(item => item?.sub_agent_id === childId && item.parent_tool_call_id === parent.id);
		check(terminal.length === 1 && terminal[0].outcome === 'SUB_AGENT_RUNTIME_STATUS_SUCCESS' && text(terminal[0].output).trim().length > 0, 'spawn-correlated-success-terminal-missing');
		const terminalIndex = events.findIndex(event => event.sub_agent_completed === terminal[0]);
		check(terminalIndex > parent.starts[0] && terminalIndex < parent.terminals[0], 'spawn-child-terminal-outside-parent-call');
		const childById = new Map();
		for (const item of activity.map(update => update.append_entry?.tool_invocation).filter(Boolean)) {
			check(text(item.tool_call_id).trim().length > 0, 'spawn-child-tool-call-id-missing');
			childById.set(item.tool_call_id, item);
		}
		const childTools = [...childById.values()];
		const childPath = (item, name) => {
			return exactArgumentPath(fixture.workspace, item.args_json, name);
		};
		const reads = childTools.filter(item => item.tool_name === 'file_read' && !item.is_error && childPath(item, fixture.inputName));
		const writes = childTools.filter(item => item.tool_name === 'file_write');
		check(reads.length > 0 && writes.length === 1 && !writes[0].is_error && childPath(writes[0], fixture.outputName), 'spawn-child-owned-work-not-observed');
		exactWriterContent(writes[0].args_json, fixture.outputs[fixture.outputName]);
		check(childTools.every(item => !isOtherWriter(item.tool_name || '')), 'spawn-child-unregistered-writer-or-shell');
		check(calls.every(call => call.name !== 'file_write' && !isOtherWriter(call.name || '')), 'root-manufactured-delegated-result');
		check(events.every((event, index) => !event.sub_agent_activity || event.sub_agent_activity.parent_tool_call_id !== parent.id
			|| index > parent.starts[0] && index < parent.terminals[0]), 'spawn-child-work-outside-parent-call');
		return { kind: 'spawn', callIds: [parent.id], ownerIds: [childId], textEvidence: [terminal[0].output], childTools };
	}
	if (caseId === 'U09') {
		const parent = completed('deep_think');
		const starts = events.map(event => event.deep_think_started).filter(item => item?.tool_call_id === parent.id);
		check(starts.length === 1 && jsonEqual([...starts[0].dimensions].sort(), ['durability', 'latency']), 'deep-think-two-dimension-start-missing');
		const request = starts[0].request_id;
		check(text(request).length > 0, 'deep-think-request-id-missing');
		const dimensions = events.map(event => event.deep_think_dimension_completed).filter(item => item?.tool_call_id === parent.id && item.request_id === request);
		check(dimensions.length === 2 && jsonEqual(dimensions.map(item => item.dimension).sort(), ['durability', 'latency']) && dimensions.every(item => item.success && !item.cancelled && text(item.result).trim()), 'deep-think-dimensions-incomplete');
		const dimensionStarts = events.map(event => event.deep_think_dimension_started).filter(item => item?.tool_call_id === parent.id && item.request_id === request);
		check(dimensionStarts.length === 2 && jsonEqual(dimensionStarts.map(item => item.dimension).sort(), ['durability', 'latency']), 'deep-think-dimension-start-missing');
		const terminal = events.map(event => event.deep_think_completed).filter(item => item?.tool_call_id === parent.id && item.request_id === request);
		check(terminal.length === 1 && text(terminal[0].aggregated_result).trim().length > 0, 'deep-think-correlated-aggregate-missing');
		const terminalIndex = events.findIndex(event => event.deep_think_completed === terminal[0]);
		check(terminalIndex < parent.terminals[0] && dimensions.every(item => {
			const started = dimensionStarts.find(candidate => candidate.dimension === item.dimension);
			const startIndex = events.findIndex(event => event.deep_think_dimension_started === started);
			const endIndex = events.findIndex(event => event.deep_think_dimension_completed === item);
			return startIndex > parent.starts[0] && endIndex > startIndex && endIndex < terminalIndex;
		}), 'deep-think-dimension-order-or-parent-ownership-invalid');
		const writers = routeWriters(calls, fixture, parent.agentId);
		const rootEnd = events.findLastIndex(event => event.turn_lifecycle?.turn_completed?.agent_id === parent.agentId);
		check(rootEnd > parent.terminals[0], 'route-root-turn-terminal-missing');
		writerInStage(writers, fixture.outputName, parent.terminals[0], rootEnd);
		return { kind: 'deep_think', callIds: [parent.id], ownerIds: [request], textEvidence: dimensions.map(item => item.result), aggregate: terminal[0].aggregated_result };
	}
	check(caseId === 'U10', 'not-a-route-scene');
	const create = completed('loop_create');
	const next = completed('loop_next');
	const exit = completed('loop_exit');
	check(create.terminals[0] < next.starts[0] && next.terminals[0] < exit.starts[0], 'loop-tool-order-invalid');
	const states = envelopesFromEvents(records).flatMap(envelope => (envelope.blocks ?? []).filter(block => block.loop_state_block).map(block => ({ ...block.loop_state_block, envelopeId: envelope.id })));
	const first = states.find(item => item.iteration === 1 && !item.is_exit);
	const second = states.find(item => item.iteration === 2 && !item.is_exit && item.loop_id === first?.loop_id);
	const terminal = states.filter(item => item.is_exit && item.loop_id === first?.loop_id);
	check(first && second && terminal.length === 1 && terminal[0].iteration === 2 && terminal[0].terminal_reason === 'agent_exit', 'loop-correlated-two-iteration-terminal-missing');
	const envelopeIndex = id => records.findIndex(record => envelopesFromEvents([record]).some(envelope => envelope.id === id));
	check([[first, create], [second, next], [terminal[0], exit]].every(([state, call]) => {
		const index = envelopeIndex(state.envelopeId);
		return index > call.starts[0] && index < call.terminals[0];
	}), 'loop-snapshots-not-owned-by-corresponding-calls');
	check(create.agentId === next.agentId && create.agentId === exit.agentId, 'loop-call-root-owner-mismatch');
	const writers = routeWriters(calls, fixture, create.agentId);
	writerInStage(writers, fixture.stageName, create.terminals[0], next.starts[0]);
	writerInStage(writers, fixture.outputName, next.terminals[0], exit.starts[0]);
	return { kind: 'loop', callIds: [create.id, next.id, exit.id], ownerIds: [first.loop_id], states: [first, second, terminal[0]], textEvidence: [] };
}

function verifyPromptDoesNotContainAnswer(fixture) {
	const privateStrings = [...Object.values(fixture.inputs).map(value => readJsonString(value).nonce), ...Object.values(fixture.outputs).map(value => value.option)].filter(Boolean);
	for (const prompt of [fixture.prompt, fixture.followup].filter(Boolean)) {
		check(privateStrings.every(value => !prompt.includes(value)), 'prompt-leaks-oracle-answer');
	}
}
function readJsonString(value) { return JSON.parse(value); }

// Serialized by Playwright into the owned Electron main process. No second RPC
// or stream is created. Only future UI-owned streams at this exact private port
// are tapped. The identical Buffer goes to the identical original decoder.
async function installMainTap(_electron, options) {
	const nodeModule = typeof process.getBuiltinModule === 'function' ? process.getBuiltinModule('module') : undefined;
	if (typeof nodeModule?.createRequire !== 'function') { throw new Error('dom-frame-provenance-unavailable'); }
	const require = nodeModule.createRequire(options.packageJson);
	const grpc = require('@grpc/grpc-js');
	const key = '__uaRealEditorRawTap';
	if (globalThis[key]) { throw new Error('raw-tap-already-installed'); }
	const original = grpc.Client.prototype.makeBidiStreamRequest;
	const state = { token: options.token, active: true, frames: [], streams: [], errors: [], bytes: 0, ordinal: 0, installedAt: Date.now() };
	const wrapped = function (...args) {
		if (args[0] !== '/agentservice.SessionService/SessionEventStream') { return Reflect.apply(original, this, args); }
		const target = this.getChannel().getTarget();
		const selected = target === options.address || target === `dns:${options.address}` || target === `dns:///${options.address}`;
		if (selected) {
			const streamId = state.streams.length + 1;
			state.streams.push({ streamId, target, openedAt: Date.now() });
			const deserialize = args[2];
			args[2] = function (bytes) {
				if (!state.active) { return Reflect.apply(deserialize, this, [bytes]); }
				try {
					if (state.bytes + bytes.length > 32 * 1024 * 1024) { throw new Error('raw-tap-buffer-limit'); }
					state.frames.push({ streamId, ordinal: ++state.ordinal, observedAt: Date.now(), bytesBase64: Buffer.from(bytes).toString('base64') });
					state.bytes += bytes.length;
				} catch (error) { state.errors.push(String(error?.message || error)); }
				return Reflect.apply(deserialize, this, [bytes]);
			};
		}
		return Reflect.apply(original, this, args);
	};
	state.restore = () => {
		if (grpc.Client.prototype.makeBidiStreamRequest !== wrapped) { throw new Error('raw-tap-was-replaced'); }
		state.active = false;
		grpc.Client.prototype.makeBidiStreamRequest = original;
		delete globalThis[key];
	};
	globalThis[key] = state;
	grpc.Client.prototype.makeBidiStreamRequest = wrapped;
	return { pid: process.pid, installedAt: state.installedAt, address: options.address, extraStreamsCreated: 0 };
}
function drainMainTap(_electron, options) {
	const state = globalThis.__uaRealEditorRawTap;
	if (!state || state.token !== options.token) { throw new Error('raw-tap-ownership-mismatch'); }
	const frames = state.frames.splice(0);
	state.bytes = 0;
	const result = { frames, streams: state.streams, errors: state.errors, ordinal: state.ordinal };
	if (options.restore) { state.restore(); }
	return result;
}

/** Pure DOM observation. It never reads service internals or manufactures events. */
function readMatrixDom() {
	const rendered = element => {
		const rect = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('[inert]');
	};
	const visible = element => {
		const rect = element.getBoundingClientRect();
		return rendered(element) && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
	};
	const articles = [...document.querySelectorAll('article.conversation-timeline-item')].filter(rendered);
	const rows = [...document.querySelectorAll('article.conversation-timeline-item [data-turn-id][data-kind]')]
		.filter(element => rendered(element) && !element.parentElement?.closest('[data-turn-id][data-kind]'))
		.map((element, order) => {
			const article = element.closest('article.conversation-timeline-item');
			const rootId = article?.getAttribute('data-root-id') || '';
			const turnId = element.getAttribute('data-turn-id') || '';
			const tool = element.classList.contains('conversation-process-fold-tool');
			const kind = element.getAttribute('data-kind') || '';
			const status = element.classList.contains('conversation-process-fold-tool--cancelled') ? 'cancelled'
				: element.classList.contains('conversation-process-fold-tool--failed') ? 'failed'
					: element.classList.contains('conversation-process-fold-tool--executing') ? 'running'
						: element.querySelector('.conversation-process-fold-tool-icon .codicon-check') ? 'completed' : undefined;
			const body = element.querySelector('.conversation-lens-turn-body')?.cloneNode(true);
			if (body) { for (const control of body.querySelectorAll('button,[role="button"],.monaco-toolbar,[aria-hidden="true"]')) { control.remove(); } }
			const leaf = element.closest('.conversation-session-leaf');
			const paneSessionId = (leaf ? leaf.getAttribute('data-session-key') : element.closest('.conversation-subagent-overlay')?.getAttribute('data-session-key'))?.trim() || null;
			const provenance = globalThis.__uaRealEditorProvenance?.runtime?.sampleRow(element) ?? null;
			return { rootId, turnId, kind, order, paneSessionId, provenance, text: element.textContent || '', bodyText: body?.textContent || element.textContent || '', visible: visible(element),
				busy: article?.getAttribute('aria-busy') === 'true', persistent: !!rootId.trim() && !!turnId.trim() && !rootId.startsWith('overlay:') && !turnId.startsWith('overlay:'),
				inFold: !!element.closest('.conversation-process-fold'), inThinking: !!element.closest('.conversation-process-fold-thinking-tools'),
				toolName: tool ? element.querySelector('.conversation-process-fold-tool-name')?.textContent || '' : undefined,
				status, payload: tool ? element.querySelector('.conversation-process-fold-tool-payload')?.textContent || '' : undefined,
				argumentsText: tool ? element.querySelector('.conversation-process-fold-tool-summary')?.textContent || '' : undefined,
				processText: kind === 'thinking' ? element.querySelector('.conversation-process-fold-thinking-body')?.textContent || '' : undefined,
				cancelCallId: element.querySelector('[data-tool-call-id]')?.getAttribute('data-tool-call-id'),
				markdown: kind === 'assistant' ? { code: !!element.querySelector('pre code'), strong: !!element.querySelector('strong'), heading: !!element.querySelector('h1,h2,h3,h4,h5,h6') } : undefined };
		});
	return { at: Date.now(), rows, articleIds: articles.map(element => element.getAttribute('data-root-id')),
		folds: [...document.querySelectorAll('article.conversation-timeline-item .conversation-process-fold')].filter(rendered).map(element => ({
			id: element.closest('article')?.getAttribute('data-root-id') || '', expanded: element.querySelector('.conversation-process-fold-header')?.getAttribute('aria-expanded') === 'true'
		})),
		busy: articles.some(element => element.getAttribute('aria-busy') === 'true'),
		overlay: rows.some(row => !row.persistent),
		pending: [...document.querySelectorAll('.conversation-lens-confirmation-seat')].filter(rendered).map(element => ({
			requestId: element.getAttribute('data-turn-id') || '', text: element.textContent || '', visible: visible(element),
			pending: !!element.querySelector('.conversation-lens-confirmation-actions'), inFold: !!element.closest('.conversation-process-fold')
		})) };
}

function verifyVisibleAnswer(records, dom, fixture, prompt = fixture.prompt, expected = fixture.finalTokens, requirePreamble = true) {
	const envelopes = envelopesFromEvents(records);
	const users = envelopes.filter(envelope => envelope.role === 'USER' && normalize(envelopeText(envelope)) === normalize(prompt));
	check(users.length === 1, 'engine-user-message-not-exactly-once');
	const uiUsers = dom.rows.filter(row => row.kind === 'user' && normalize(row.text).includes(normalize(prompt)));
	check(uiUsers.length === 1 && (uiUsers[0].visible || uiUsers[0].visibilityVerified) && uiUsers[0].persistent && !uiUsers[0].inFold, 'visible-user-message-not-exactly-once-outside-fold');
	const answers = envelopes.filter(envelope => envelope.role === 'ASSISTANT' && envelopeText(envelope).trim()
		&& !(envelope.blocks ?? []).some(block => block.tool_call_block));
	const matching = expected.length ? answers.filter(envelope => expected.every(token => envelopeText(envelope).includes(token))) : answers.slice(-1);
	check(matching.length === 1, 'independent-answer-not-unique-in-real-events');
	const final = matching[0];
	const duplicates = dom.rows.filter(row => row.kind === 'assistant' && row.persistent && row.turnId !== final.id
		&& assistantBodyMatches(envelopeText(final), row.bodyText ?? row.text));
	check(duplicates.length === 0, 'extra-durable-assistant-duplicates-real-answer');
	const uiAnswers = dom.rows.filter(row => row.kind === 'assistant' && row.turnId === final.id);
	check(uiAnswers.length === 1 && (uiAnswers[0].visible || uiAnswers[0].visibilityVerified) && uiAnswers[0].persistent && !uiAnswers[0].busy && !uiAnswers[0].inFold, 'final-answer-only-in-events-or-not-visible-durable');
	check(expected.every(token => uiAnswers[0].text.includes(token)), 'visible-final-answer-does-not-match-independent-oracle');
	verifyBodyText(envelopeText(final), uiAnswers[0].bodyText ?? uiAnswers[0].text);
	check(uiUsers[0].order < uiAnswers[0].order, 'visible-body-order-inverted');
	const preambles = envelopes.filter(envelope => envelope.role === 'ASSISTANT' && envelopeText(envelope).trim() && (envelope.blocks ?? []).some(block => block.tool_call_block));
	if (requirePreamble) { check(preambles.length > 0, 'required-real-tool-preamble-not-observed'); }
	for (const preamble of preambles) {
		const row = dom.rows.find(item => item.kind === 'assistant' && item.turnId === `${preamble.id}:body`);
		check(row && (row.visible || row.visibilityVerified) && !row.inFold && row.order > uiUsers[0].order && row.order < uiAnswers[0].order, 'real-tool-preamble-missing-or-out-of-order');
		verifyBodyText(envelopeText(preamble), row.bodyText ?? row.text);
	}
	check(!dom.overlay && !dom.busy, 'terminal-overlay-or-busy-remains');
	check(dom.articleIds.every(Boolean) && new Set(dom.articleIds).size === dom.articleIds.length, 'duplicate-or-empty-timeline-root');
	return { userEnvelopeId: users[0].id, finalEnvelopeId: final.id, finalTurnId: final.turn_id };
}

function assistantBodyParts(source) {
	const compact = value => value.replace(/(^|\n)\s{0,3}(?:#{1,6}|[-+*])\s+/gu, '$1').replace(/[*_`\s]/gu, '');
	return { compact, parts: text(source).split(/```[^\n]*\n|```/gu).map(compact).filter(Boolean) };
}
function assistantBodyMatches(source, visibleBody) {
	const { compact, parts } = assistantBodyParts(source);
	const actual = compact(text(visibleBody));
	return parts.length > 0 && parts.every(part => actual.includes(part));
}
function verifyBodyText(source, visibleBody) {
	check(assistantBodyMatches(source, visibleBody), 'real-assistant-body-was-dropped-or-replaced');
}

function verifyAssistantDom(records, dom) {
	const expected = envelopesFromEvents(records).filter(envelope => envelope.role === 'ASSISTANT' && envelopeText(envelope).trim())
		.map(envelope => ({ id: (envelope.blocks ?? []).some(block => block.tool_call_block) ? `${envelope.id}:body` : envelope.id, body: envelopeText(envelope) }));
	const expectedIds = new Set(expected.map(item => item.id));
	const actual = dom.rows.filter(row => row.kind === 'assistant' && row.persistent);
	check(actual.length === expected.length && actual.every(row => expectedIds.has(row.turnId)), 'unexpected-or-duplicate-durable-assistant-row');
	for (const item of expected) {
		const rows = actual.filter(row => row.turnId === item.id);
		check(rows.length === 1, 'real-durable-assistant-not-rendered-once');
		verifyBodyText(item.body, rows[0].bodyText ?? rows[0].text);
	}
}

function toolOutputMatches(source, payload) {
	const clean = value => text(value).replace(/\r\n?/gu, '\n').trim();
	const expectedText = clean(source);
	const actualText = clean(payload);
	let expected;
	let actual;
	let expectedJson = false;
	let actualJson = false;
	try { expected = JSON.parse(expectedText); expectedJson = true; } catch { /* Entire plain-text output is compared below. */ }
	try { actual = JSON.parse(actualText); actualJson = true; } catch { /* A prefix is never accepted as a JSON document. */ }
	return expectedJson || actualJson ? expectedJson && actualJson && jsonEqual(expected, actual) : expectedText === actualText;
}

function verifyToolDom(records, dom) {
	const allCalls = toolFacts(records);
	check(allCalls.every(call => !call.persistedResult || call.envelopes.length > 0), 'persisted-result-has-no-corresponding-real-call-id');
	const calls = allCalls.filter(call => call.envelopes.length > 0);
	check(calls.length > 0, 'no-real-persisted-tool-calls');
	const mappedIds = [];
	for (const call of calls) {
		check(call.envelopes.length === 1, 'tool-call-id-used-by-multiple-envelopes');
		const rowId = call.envelopes[0].rowId;
		const rows = dom.rows.filter(row => row.kind === 'tool' && row.turnId === rowId);
		check(rows.length === 1 && (rows[0].visible || rows[0].visibilityVerified) && rows[0].inFold, 'real-tool-not-visible-once-in-process-fold');
		check(rows[0].toolName === call.name, 'tool-name-not-correlated-by-real-call-id');
		check(!rows[0].inThinking, 'tool-is-nested-under-thinking-instead-of-peer');
		const cancelled = call.runtime?.lifecycle === 'TOOL_LIFECYCLE_CANCELLED' || /cancel(?:led|ed)|取消/iu.test(call.output || '');
		const expectedStatus = cancelled ? 'cancelled' : call.isError ? 'failed' : 'completed';
		check(rows[0].status === expectedStatus, 'tool-terminal-status-does-not-match-engine');
		check(call.persistedResult || call.terminals.length > 0 || cancelled, 'started-only-tool-does-not-prove-completion');
		let args;
		try { args = JSON.parse(call.args || '{}'); } catch { check(false, 'real-tool-arguments-not-json'); }
		for (const key of ['file_path', 'path', 'command']) {
			if (typeof args[key] === 'string' && args[key]) {
				const distinctive = key === 'command' ? args[key] : path.basename(args[key]);
				check(rows[0].argumentsText.includes(distinctive) || rows[0].payload.includes(distinctive), 'tool-arguments-not-visible-on-correlated-row');
			}
		}
		if (text(call.output).trim()) { check(text(rows[0].payload).trim().length > 0, 'real-tool-result-detail-not-visible'); }
		check(toolOutputMatches(call.output, rows[0].payload), 'tool-result-detail-belongs-to-different-call');
		mappedIds.push(rowId);
	}
	check(new Set(mappedIds).size === mappedIds.length, 'two-real-call-ids-merged-into-one-row');
	return calls;
}

function stableHistory(dom) {
	return dom.rows.filter(row => row.persistent).map(row => ({
		rootId: row.rootId, turnId: row.turnId, kind: row.kind, text: row.kind === 'tool' ? undefined : normalize(row.text),
		toolName: row.toolName, status: row.status, payload: row.payload === undefined ? undefined : normalize(row.payload)
	}));
}
function verifyHistory(before, after) {
	check(jsonEqual(stableHistory(before), stableHistory(after)), 'reload-changed-durable-message-order-identity-or-status');
	check(!after.busy && !after.overlay && after.rows.every(row => row.visible || row.visibilityVerified), 'reload-restored-hidden-or-incomplete-process-as-success');
}

function expectedDisplayIds(records) {
	return envelopesFromEvents(records).flatMap(envelope => {
		const calls = (envelope.blocks ?? []).filter(block => block.tool_call_block);
		const body = envelopeText(envelope).trim();
		if (envelope.role === 'USER' && body) { return [envelope.id]; }
		if (envelope.role !== 'ASSISTANT') {
			return (envelope.blocks ?? []).some(block => block.loop_state_block) ? [envelope.id] : [];
		}
		return [...(body ? [calls.length ? `${envelope.id}:body` : envelope.id] : []),
			...calls.map((_, index) => index ? `${envelope.id}:tool:${index}` : envelope.id)];
	});
}
function verifyWholeOrder(records, dom) {
	verifyAssistantDom(records, dom);
	const expected = expectedDisplayIds(records);
	const targetIds = new Set(expected);
	const actual = dom.rows.filter(row => targetIds.has(row.turnId)).map(row => row.turnId);
	check(jsonEqual(actual, expected), 'real-envelope-body-process-order-not-preserved-in-dom');
	check(dom.rows.filter(row => targetIds.has(row.turnId)).every(row => row.visible || row.visibilityVerified), 'real-row-present-but-never-visibly-inspected');
}

/** All public thinking sources survive independently of their persistence policy. */
function thinkingFacts(records) {
	const blocks = new Map();
	const turns = new Map();
	const envelopeOwners = new Map();
	const durable = [];
	const lifecycles = [];
	const token = (value, code) => { check(typeof value === 'string' && value.trim() === value && value.length > 0, code); return value; };
	const identity = (event, delta) => ({ sessionId: token(event.session_id, 'thinking-session-id-missing'),
		epoch: String(decimalNs(delta.runtime_epoch ?? '0', 'thinking-runtime-epoch-invalid')),
		turnId: token(delta.turn_id, 'thinking-runtime-turn-id-missing'), agentId: token(delta.agent_id, 'thinking-agent-id-missing') });
	const registerTurn = owner => {
		// The existing DOM aggregates wire blocks into one runtime-turn row.
		// A reused row id with another session/epoch/agent is ambiguous evidence.
		const prior = turns.get(owner.turnId);
		check(!prior || jsonEqual(prior.owner, owner), 'thinking-turn-row-identity-conflict');
		if (!prior) { turns.set(owner.turnId, { owner, chunks: [], blockIds: new Set() }); }
		return turns.get(owner.turnId);
	};
	for (const record of records) {
		const event = record.decoded ?? record;
		const delta = event.thinking_delta;
		if (delta) {
			const owner = identity(event, delta);
			const turn = registerTurn(owner);
			const blockId = token(delta.block_id, 'thinking-block-id-missing');
			const key = JSON.stringify([owner.sessionId, owner.epoch, blockId]);
			const block = blocks.get(key) ?? { owner, blockId, chunks: new Map() };
			check(jsonEqual(block.owner, owner), 'thinking-block-identity-conflict');
			blocks.set(key, block); turn.blockIds.add(blockId);
			const seq = String(decimalNs(delta.delta_seq ?? '0', 'thinking-delta-sequence-invalid'));
			const value = delta.text_delta ?? '';
			check(typeof value === 'string', 'thinking-delta-text-invalid');
			const prior = block.chunks.get(seq);
			check(!prior || prior.text === value, 'thinking-delta-sequence-text-conflict');
			if (!prior) {
				check(block.lastSequence === undefined || BigInt(seq) > BigInt(block.lastSequence), 'thinking-delta-sequence-regressed');
				check(Number.isSafeInteger(record.ordinal) && record.ordinal > 0, 'thinking-source-ordinal-missing');
				const chunk = { seq, text: value, ordinal: record.ordinal };
				block.lastSequence = seq; block.chunks.set(seq, chunk); turn.chunks.push(chunk);
			}
		}
		for (const life of [event.turn_lifecycle?.turn_started, event.turn_lifecycle?.turn_completed].filter(Boolean)) {
			lifecycles.push({ event, life });
		}
		const entries = [event.envelope_appended?.envelope, ...(event.envelope_batch_appended?.envelopes ?? []),
			...(event.envelope_range_replaced?.replacement ?? [])].filter(Boolean);
		for (const envelope of entries) {
			const parts = (envelope.blocks ?? []).map(block => block.thinking_block?.thinking).filter(value => typeof value === 'string' && value.trim());
			if (!parts.length) { continue; }
			const sessionId = token(event.session_id, 'thinking-session-id-missing');
			check(!envelope.session_id || envelope.session_id === sessionId, 'thinking-envelope-session-conflict');
			const id = token(envelope.id, 'thinking-envelope-id-missing');
			const owner = { sessionId, agentId: envelope.agent_id || undefined, turnId: envelope.turn_id || undefined };
			const prior = envelopeOwners.get(id);
			check(!prior || jsonEqual(prior, owner), 'thinking-envelope-identity-conflict');
			envelopeOwners.set(id, owner);
			check(Number.isSafeInteger(record.ordinal) && record.ordinal > 0, 'thinking-source-ordinal-missing');
			const mixed = (envelope.blocks ?? []).some(block => text(block.text_block?.text).trim() || block.tool_call_block || block.tool_result_block);
			const value = parts.join('\n');
			if (!durable.some(item => item.envelopeId === id && item.text === value)) {
				durable.push({ ...owner, envelopeId: id, rowId: mixed ? `${id}:think` : id, text: value,
					blockCount: parts.length, ordinal: record.ordinal });
			}
		}
	}
	for (const { event, life } of lifecycles) {
		const turn = turns.get(life.turn_id);
		if (!turn) { continue; }
		const owner = identity(event, { ...life, runtime_epoch: event.turn_lifecycle.runtime_epoch });
		check(jsonEqual(turn.owner, owner), 'thinking-turn-lifecycle-identity-conflict');
		if (life.assistant_turn_id) {
			check(!turn.assistantTurnId || turn.assistantTurnId === life.assistant_turn_id, 'thinking-assistant-turn-link-conflict');
			turn.assistantTurnId = life.assistant_turn_id;
		}
	}
	return { blocks: [...blocks.values()], turns: [...turns.values()].filter(turn => turn.chunks.some(chunk => chunk.text.trim())).map(turn => ({
		...turn.owner, assistantTurnId: turn.assistantTurnId, blockIds: [...turn.blockIds],
		text: turn.chunks.sort((left, right) => left.ordinal - right.ordinal).map(chunk => chunk.text).join(''),
		lastOrdinal: turn.chunks.reduce((last, chunk) => Math.max(last, chunk.ordinal), 0)
	})), durable };
}

function verifyThinkingDom(records, samples) {
	const facts = thinkingFacts(records);
	const visible = (sample, row) => row.kind === 'thinking' && row.inFold && row.visible
		&& Number.isSafeInteger(sample.rawOrdinalBefore);
	const hasBody = (sample, row, value, ordinal) => sample.rawOrdinalBefore >= ordinal && visible(sample, row)
		&& normalize(row.processText) === normalize(value);
	for (const item of facts.durable) {
		check(samples.some(sample => sample.rows.some(row => row.turnId === item.rowId && row.persistent
			&& hasBody(sample, row, item.text, item.ordinal))), 'actual-durable-thinking-block-not-visible-on-own-row');
	}
	for (const turn of facts.turns) {
		const rowIds = [`overlay:${turn.turnId}`, `overlay:${turn.turnId}:think`];
		const live = samples.some(sample => sample.rows.some(row => rowIds.includes(row.turnId) && !row.persistent
			&& hasBody(sample, row, turn.text, turn.lastOrdinal)));
		// Runtime turn_id and persistent tree turn_id differ. Only the formal
		// completed.assistant_turn_id settle link (or exact turn identity) relates them.
		const persisted = facts.durable.filter(item => item.sessionId === turn.sessionId && item.agentId === turn.agentId
			&& (item.turnId === turn.turnId || turn.assistantTurnId && item.turnId === turn.assistantTurnId)
			&& normalize(item.text) === normalize(turn.text) && item.ordinal >= turn.lastOrdinal);
		check(live || persisted.some(item => samples.some(sample => sample.rows.some(row => row.turnId === item.rowId && row.persistent
			&& hasBody(sample, row, turn.text, item.ordinal)))), 'actual-stream-thinking-block-not-visible-on-own-turn');
	}
	return { observed: facts.turns.length > 0 || facts.durable.length > 0, streamBlocks: facts.blocks.filter(block => [...block.chunks.values()].some(chunk => chunk.text.trim())).length,
		runtimeTurns: facts.turns.length, durableBlocks: facts.durable.reduce((count, item) => count + item.blockCount, 0) };
}

function verifyThinkingProvenance(records, samples, evidence) {
 check(evidence?.status === 'available' && evidence.counts.matchedScopes > 0, 'dom-frame-provenance-unavailable');
 const facts = thinkingFacts(records);
 const epochAt = (session, ordinal) => {
  const hello = records.filter(record => record.ordinal <= ordinal && record.decoded?.session_id === session && record.decoded?.hello).at(-1);
  return hello ? String(hello.decoded.hello.runtime_epoch ?? '0') : undefined;
 };
 const match = (sample, row, owner, value, ordinal) => row.kind === 'thinking' && row.inFold && row.visible
  && normalize(row.processText) === normalize(value) && provenance.requireScope(evidence, sample, row, owner, ordinal);
 for (const item of facts.durable) {
  check(samples.some(sample => sample.rows.some(row => row.turnId === item.rowId && row.persistent
   && epochAt(item.sessionId, item.ordinal) !== undefined && match(sample, row, { ...item, epoch: String(epochAt(item.sessionId, item.ordinal)) }, item.text, item.ordinal))), 'dom-frame-provenance-invalid');
 }
 for (const turn of facts.turns) {
  const live = samples.some(sample => sample.rows.some(row => !row.persistent
   && [`overlay:${turn.turnId}`, `overlay:${turn.turnId}:think`].includes(row.turnId)
   && match(sample, row, turn, turn.text, turn.lastOrdinal)));
  const persisted = facts.durable.filter(item => item.sessionId === turn.sessionId && item.agentId === turn.agentId
   && (item.turnId === turn.turnId || turn.assistantTurnId && item.turnId === turn.assistantTurnId)
   && normalize(item.text) === normalize(turn.text) && item.ordinal >= turn.lastOrdinal);
  check(live || persisted.some(item => samples.some(sample => sample.rows.some(row => row.turnId === item.rowId && row.persistent
   && match(sample, row, { ...item, epoch: turn.epoch }, turn.text, item.ordinal)))), 'dom-frame-provenance-invalid');
 }
 return true;
}

// Capture may grow during cleanup. Re-run both pure verifiers only after the
// final raw tap has been stopped; an earlier result is never a capture seal.
function verifyCapturedThinking(records, samples, evidence) {
 const thinking = verifyThinkingDom(records, samples);
 verifyThinkingProvenance(records, samples, evidence);
 return thinking;
}

function foldOwners(records, sessionId, foldId, dom) {
	const scoped = records.filter(record => (record.decoded ?? record).session_id === sessionId);
	const envelopes = envelopesFromEvents(scoped);
	const calls = toolFacts(scoped);
	return dom.rows.filter(row => row.rootId === foldId && ['tool', 'thinking'].includes(row.kind)).map(row => {
		const callIds = calls.filter(call => call.id === row.cancelCallId || call.envelopes.some(item => item.rowId === row.turnId)).map(call => call.id);
		const envelopeIds = envelopes.filter(envelope => row.turnId === envelope.id
			|| row.turnId === `${envelope.id}:think` || /^tool:\d+$/u.test(row.turnId.slice(envelope.id.length + 1)) && row.turnId.startsWith(`${envelope.id}:`))
			.map(envelope => envelope.id);
		const blocks = scoped.map(record => (record.decoded ?? record).thinking_delta).filter(delta => delta?.block_id
			&& [ `overlay:${delta.turn_id}`, `overlay:${delta.turn_id}:think` ].includes(row.turnId))
			.map(delta => `${delta.turn_id}:${delta.block_id}`);
		const owned = { rowId: row.turnId, callIds: [...new Set(callIds)], envelopeIds: [...new Set(envelopeIds)], blocks: [...new Set(blocks)] };
		if (!owned.callIds.length && !owned.envelopeIds.length && !owned.blocks.length) { return undefined; }
		owned.firstRecord = records.findIndex(record => {
			const event = record.decoded ?? record;
			if (event.session_id !== sessionId) { return false; }
			return owned.callIds.includes(event.tool_call_lifecycle?.tool_call_id) || owned.callIds.includes(event.tool_runtime_snapshot?.tool_call_id)
				|| envelopesFromEvents([record]).some(envelope => owned.envelopeIds.includes(envelope.id))
				|| event.thinking_delta && owned.blocks.includes(`${event.thinking_delta.turn_id}:${event.thinking_delta.block_id}`);
		});
		return owned;
	}).filter(Boolean);
}

function foldFingerprints(records, observation, dom) {
	const scoped = records.filter(record => (record.decoded ?? record).session_id === observation.sessionId);
	const callIds = new Set(observation.members.flatMap(member => member.callIds));
	const envelopeIds = new Set(observation.members.flatMap(member => member.envelopeIds));
	const blocks = new Set(observation.members.flatMap(member => member.blocks));
	const deltas = new Map();
	for (const record of scoped) {
		const delta = (record.decoded ?? record).thinking_delta;
		const key = delta ? `${delta.turn_id}:${delta.block_id}` : undefined;
		if (!blocks.has(key)) { continue; }
		if (!deltas.has(key)) { deltas.set(key, new Map()); }
		deltas.get(key).set(delta.delta_seq ?? '0', delta.text_delta ?? '');
	}
	const source = {
		calls: toolFacts(scoped).filter(call => callIds.has(call.id)).map(call => ({ id: call.id, name: call.name, args: call.args,
			output: call.output, isError: call.isError, runtime: call.runtime ? Object.fromEntries([
				'tool_name', 'lifecycle', 'progress', 'preview', 'agent_payload', 'deep_think_payload', 'shell_payload',
				'file_mutation_payload', 'browser_payload', 'generic_payload'
			].filter(key => Object.hasOwn(call.runtime, key)).map(key => [key, call.runtime[key]])) : undefined })),
		envelopes: envelopesFromEvents(scoped).filter(envelope => envelopeIds.has(envelope.id)).map(envelope => ({ id: envelope.id,
			blocks: (envelope.blocks ?? []).filter(block => block.text_block || block.thinking_block || block.tool_call_block || block.tool_result_block) })),
		thinking: [...deltas].map(([key, chunks]) => ({ key, chunks: [...chunks].sort(([left], [right]) => BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0) }))
	};
	const memberIds = new Set(observation.members.map(member => member.rowId));
	const rows = dom.rows.filter(row => row.rootId === observation.foldId && memberIds.has(row.turnId));
	const display = rows.map(row => ({ id: row.turnId, kind: row.kind, status: row.status, toolName: row.toolName,
		payload: row.payload, thinking: row.kind === 'thinking' ? row.processText : undefined }));
	return { source: sha256(JSON.stringify(canonical(source))), display: sha256(JSON.stringify(canonical(display))), present: rows.length > 0 };
}

function beginFoldObservation(records, sessionId, foldId, dom) {
	const fold = dom.folds.find(item => item.id === foldId);
	if (!fold?.expanded) { return undefined; }
	const members = foldOwners(records, sessionId, foldId, dom);
	if (!members.length) { return undefined; }
	const observation = { sessionId, foldId, members, openedRecordCount: records.length, advanced: false, regressed: false, contentChanges: [] };
	const baseline = foldFingerprints(records, observation, dom);
	return { ...observation, sourceFingerprint: baseline.source, displayFingerprint: baseline.display };
}

function advanceFoldObservation(observation, records, dom) {
	const fold = dom.folds.find(item => item.id === observation.foldId);
	if (!fold) { return observation; }
	if (!fold.expanded) { observation.regressed = true; }
	// Only newly created content can extend ownership. Learning an already
	// existing row after the click is not evidence of a post-click increment.
	for (const member of foldOwners(records, observation.sessionId, observation.foldId, dom)) {
		if (!observation.members.some(prior => prior.rowId === member.rowId)
			&& member.firstRecord >= observation.openedRecordCount) { observation.members.push(member); }
	}
	const next = foldFingerprints(records, observation, dom);
	if (next.present && next.source !== observation.sourceFingerprint && next.display !== observation.displayFingerprint) {
		observation.advanced = true;
		observation.contentChanges.push({ recordCount: records.length, source: next.source, display: next.display, expanded: fold.expanded });
		// Keep a pending source change until its DOM content actually catches up.
		observation.sourceFingerprint = next.source;
		observation.displayFingerprint = next.display;
	}
	return observation;
}

function verifyFoldCoverage(observations) {
	check(!observations.some(item => item.regressed), 'process-fold-expansion-reset-after-selection');
	check(observations.some(item => item.advanced), 'process-fold-content-increment-uncovered');
}

function verifyFiles(workspace, fixture, denied = false) {
	for (const [name, expected] of Object.entries(fixture.inputs)) {
		check(fs.readFileSync(exactFile(workspace, name), 'utf8') === expected, 'task-modified-its-oracle-input');
	}
	for (const [name, expected] of Object.entries(fixture.outputs)) {
		const file = exactFile(workspace, name);
		if (denied) { check(!fs.existsSync(file), 'denied-tool-actually-wrote-output'); }
		else { check(fs.existsSync(file) && jsonEqual(readJson(file), expected), 'independent-output-oracle-failed'); }
	}
	if (fixture.caseId === 'U03') { check(!fs.existsSync(exactFile(workspace, fixture.missingName)), 'failed-read-created-missing-file'); }
}
function verifyPermissionDelivery(records, requestId, allow, fixture, workspace) {
	const requests = records.map(record => (record.decoded ?? record).permission_request).filter(item => item?.request_id === requestId);
	check(requests.length === 1 && requests[0].tool_name === 'file_write', 'real-permission-request-not-correlated');
	const calls = toolFacts(records).filter(call => call.name === 'file_write' && exactArgumentPath(workspace, call.args, fixture.outputName));
	check(calls.length === 1 && calls[0].terminals.length > 0, 'permission-decision-not-delivered-to-real-tool');
	exactWriterContent(calls[0].args, fixture.outputs[fixture.outputName]);
	check(allow ? !calls[0].isError : calls[0].isError && /permission|denied|rejected|拒绝/iu.test(calls[0].output || ''), 'permission-outcome-disagrees-with-ui-decision');
	verifyFiles(workspace, fixture, !allow);
	return calls[0].id;
}

function createMatrixScenario(env = process.env) {
	const identity = validateIdentity(env, readJson(env.UA_REAL_EDITOR_ORACLE_FILE));
	const repo = path.resolve(__dirname, '../../..');
	const caseRoot = path.dirname(path.resolve(env.UA_REAL_EDITOR_RESULT_FILE || ''));
	check(path.isAbsolute(env.UA_REAL_EDITOR_RESULT_FILE || '') && !isWithin(identity.workspace, caseRoot), 'result-file-not-private');
	check(isWithin(caseRoot, identity.oracleFile), 'oracle-file-not-in-case-root');
	const port = Number(env.UA_REAL_EDITOR_PORT);
	check(Number.isInteger(port) && port > 0 && port < 65536 && port !== 50061, 'matrix-port-not-isolated');
	const home = path.resolve(env.UNIVERSE_AGENT_HOME || '');
	const lock = readJson(path.join(home, 'server.lock'));
	check(isWithin(caseRoot, home) && lock.port === port && lock.bind === '127.0.0.1' && Number.isInteger(lock.pid), 'matrix-engine-lock-not-private');
	check(fs.realpathSync(home) === home && (fs.statSync(home).mode & 0o077) === 0, 'matrix-engine-home-not-owner-only-real-directory');
	const expectedFile = path.join(caseRoot, 'display-oracle.expected.json');
	const eventFile = path.join(caseRoot, 'editor-session-events.jsonl');
	const domFile = path.join(caseRoot, 'editor-dom-observations.json');
	const resultFile = path.resolve(env.UA_REAL_EDITOR_RESULT_FILE);
	const provenanceFile = path.join(caseRoot, 'editor-dom-frame-provenance.json');
	const token = crypto.randomBytes(24).toString('hex');
	const result = { schemaVersion: 1, campaignId: identity.campaignId, cellId: identity.cellId, caseId: identity.caseId,
		nonce: identity.nonce, status: 'failed', actualModel: null, actualProtocol: null, modelProfile: null,
		assertions: REQUIRED_ASSERTIONS[identity.caseId].map(id => ({ id, passed: false })),
		evidence: { domFile, eventFile, oracleFile: expectedFile, provenanceFile }, thinking: { status: 'uncovered' } };
	const budgetConfig = validateBudgetIdentity(env, identity, caseRoot);
	const budget = createBudgetController(identity, budgetConfig, { changed: state => Object.assign(result, state) });
	result.evidence.budgetProgressFile = budgetConfig.progressFile;
	result.evidence.cleanupBudgetFile = budgetConfig.cleanupFile;
	const op = (label, callback) => budget.operation(label, callback);
	const pause = (ms, label) => op(label, remaining => new Promise(resolve => setTimeout(resolve, Math.min(ms, remaining))));
	const records = [];
	const samples = [];
	const episodes = [];
	const selectedFolds = new Map();
	const explicitlyOpenedFolds = new Set();
	const priorFoldObservations = [];
	const visibility = new Map();
	let context;
	let wireType;
	let sessionId;
	let tapInstalled = false;
	let mainProvenanceInstalled = false;
	let rendererProvenanceInstalled = false;
	let mainEvidence = null;
	let rendererEvidence = null;
	const priorRendererEvidence = [];
	let domSampleOrdinal = 0;
	let lastDomHash;
	let lastOrdinal = 0;
	let lastThinkingOrdinal = 0;
	let foldAdvanced = false;
	let foldRegressed = false;
	const fixtures = identity.caseId === 'U07'
		? ['U01', 'U02', 'U08', 'U09', 'U10', 'U06'].map(id => prepareFixture(identity.workspace, id, `u07-${id}`))
		: [prepareFixture(identity.workspace, identity.caseId)];
	for (const fixture of fixtures) { verifyPromptDoesNotContainAnswer(fixture); }
	writeJson(expectedFile, { schemaVersion: 1, source: 'independent-random-file-oracle', identity, fixtures });
	fs.writeFileSync(eventFile, '', { flag: 'wx', mode: 0o600 });
	writeJson(domFile, { schemaVersion: 1, source: 'actual-default-editor-dom', samples: [] });
	const pass = id => {
		const item = result.assertions.find(entry => entry.id === id);
		check(item, `assertion-not-in-frozen-scene:${id}`);
		item.passed = true;
	};
	function provenanceArtifact() {
  const renderers = [...priorRendererEvidence, ...(rendererEvidence ? [rendererEvidence] : [])];
  const renderer = { rendererAttestations: renderers.map(item => ({ realm: item.realm, executionContext: item.executionContext, modules: item.modules })), realms: renderers.map(item => item.realm), acquisitions: renderers.flatMap(item => item.acquisitions), modules: renderers.flatMap(item => item.modules).filter((item, index, all) => all.findIndex(other => other.role === item.role && other.url === item.url && other.sha256 === item.sha256) === index),
   inputs: renderers.flatMap(item => item.inputs), paints: renderers.flatMap(item => item.paints), diagnostics: renderers.flatMap(item => item.diagnostics) };
  return provenance.artifact(identity, mainEvidence, renderer, records, samples);
 }
 async function diagnosticOp(label, callback) {
  try { return await op(label, callback); }
  catch (error) { throw diagnosticError(error); }
 }
 async function installRendererObserver() {
  rendererProvenanceInstalled = true;
  await diagnosticOp('provenance-renderer-current-context-install', () => provenance.observeRenderer(context.page, repo, identity.provenanceModules, {
   token, mainGate: mainProvenanceInstalled, realm: crypto.randomBytes(16).toString('hex'), factory: provenance.createRuntime.toString(),
   isActive: () => rendererProvenanceInstalled }));
 }
 async function collectProvenance(restore = false) {
  if (mainProvenanceInstalled) {
   mainEvidence = await diagnosticOp('provenance-main-read', () => context.code.driver.evaluateElectronMain(provenance.readMain, { token, restore, allowMissing: restore }));
   if (restore) { mainProvenanceInstalled = false; }
  }
  if (rendererProvenanceInstalled) {
   rendererEvidence = await diagnosticOp('provenance-renderer-read', () => context.page.evaluate(provenance.readRenderer, { token, restore, allowMissing: restore }));
   if (restore) { rendererProvenanceInstalled = false; }
  }
 }
 function persist() {
  writeJson(provenanceFile, provenanceArtifact());
		Object.assign(result, budget.snapshot());
		writeJson(domFile, { schemaVersion: 1, source: 'actual-default-editor-dom', samples, episodes,
			visibilitySamples: Object.fromEntries(visibility), foldAdvanced, foldRegressed,
			foldObservations: [...priorFoldObservations, ...selectedFolds.values()] });
		writeJson(resultFile, result);
	}
	async function drain(restore = false) {
		const tapped = await op(restore ? 'cleanup-tap-restore' : 'tap-drain', () => context.code.driver.evaluateElectronMain(drainMainTap, { token, restore }));
		check(tapped.errors.length === 0, 'raw-tap-capture-failed');
		for (const frame of tapped.frames) {
			check(frame.ordinal > lastOrdinal, 'raw-tap-response-order-not-monotonic');
			lastOrdinal = frame.ordinal;
			const bytes = Buffer.from(frame.bytesBase64, 'base64');
			const decoded = wireType.toObject(wireType.decode(bytes), { longs: String, enums: String, bytes: String, oneofs: true });
			const record = { source: 'actual-electron-main-session-stream', ...frame, sha256: sha256(bytes), decoded };
			records.push(record);
			if (decoded.thinking_delta || envelopesFromEvents([record]).some(envelope => (envelope.blocks ?? []).some(block => text(block.thinking_block?.thinking).trim()))) {
				lastThinkingOrdinal = frame.ordinal;
			}
			const started = decoded.turn_lifecycle?.turn_started;
			if (started) {
				result.observedModels = [...new Set([...(result.observedModels ?? []), started.model_id])];
				result.observedModelProfiles = [...new Set([...(result.observedModelProfiles ?? []), started.model_profile_id])];
			}
			fs.appendFileSync(eventFile, `${JSON.stringify(record)}\n`, { mode: 0o600 });
		}
		if (restore) { tapInstalled = false; }
	}
	async function sample(open = true) {
		await drain();
		const rawOrdinalBefore = lastOrdinal;
		const thinkingOrdinalBefore = lastThinkingOrdinal;
		const dom = await op('dom-sample', () => context.page.evaluate(readMatrixDom));
		dom.sampleOrdinal = ++domSampleOrdinal;
		// Keep both cuts. Only bytes already drained before the DOM read can
		// establish source-before-display; the later drain is an upper bound.
		await drain();
		await collectProvenance();
		for (const row of dom.rows) {
			if (row.visible) { visibility.set(row.turnId, dom.at); }
			row.visibilityVerified = visibility.has(row.turnId);
		}
		for (const observation of selectedFolds.values()) {
			advanceFoldObservation(observation, records, dom);
			foldAdvanced ||= observation.advanced;
			foldRegressed ||= observation.regressed;
		}
		const paintReady = dom.rows.map(row => {
   const frame = mainEvidence?.frames.findLast(item => row.provenance && jsonEqual(item.cursor, row.provenance.cursor));
   return !!frame && frame.rawOrdinal <= rawOrdinalBefore;
  });
  const signature = sha256(JSON.stringify({ ...dom, at: undefined, sampleOrdinal: undefined, thinkingOrdinalBefore, paintReady }));
		if (lastDomHash !== signature) {
			check(samples.length < 4000, 'dom-evidence-limit-exceeded');
			samples.push({ ...dom, rawOrdinal: rawOrdinalBefore, rawOrdinalBefore, rawOrdinalAfter: lastOrdinal }); lastDomHash = signature;
		}
		if (open) {
			for (const fold of dom.folds) {
				if (!selectedFolds.has(fold.id)) {
					const header = context.page.locator(`article[data-root-id=${JSON.stringify(fold.id)}] .conversation-process-fold-header`).first();
					if (await op('fold-operable', remaining => header.getAttribute('aria-disabled', { timeout: remaining })) === 'true') { continue; }
					if (!explicitlyOpenedFolds.has(fold.id)) {
						if (fold.expanded) { await op('fold-close-for-selection', remaining => header.click({ timeout: remaining })); }
						await op('fold-open-selection', remaining => header.click({ timeout: remaining }));
						explicitlyOpenedFolds.add(fold.id);
					}
					await drain();
					const opened = await op('fold-open-dom-sample', () => context.page.evaluate(readMatrixDom));
					const baseline = beginFoldObservation(records, sessionId, fold.id, opened);
					if (baseline) { selectedFolds.set(fold.id, baseline); }
				}
			}
			const headers = context.page.locator('article.conversation-timeline-item button.conversation-process-fold-tool-header[aria-expanded="false"]');
			for (let index = 0; index < await op('tool-detail-count', () => headers.count()); index++) {
				const header = headers.nth(index);
				if (await op('tool-detail-operable', remaining => header.getAttribute('aria-disabled', { timeout: remaining })) !== 'true') {
					await op('tool-detail-open', remaining => header.click({ timeout: remaining }));
				}
			}
			const thinking = context.page.locator('article.conversation-timeline-item .conversation-process-fold-thinking-header[aria-expanded="false"]');
			for (let index = 0; index < await op('thinking-detail-count', () => thinking.count()); index++) {
				if (await op('thinking-detail-operable', remaining => thinking.nth(index).getAttribute('aria-disabled', { timeout: remaining })) !== 'true') {
					await op('thinking-detail-open', remaining => thinking.nth(index).click({ timeout: remaining }));
				}
			}
		}
		return dom;
	}
	async function until(predicate, code) {
		for (;;) {
			budget.assert(code);
			const dom = await sample();
			if (await op(`predicate:${code}`, () => predicate(dom))) { return dom; }
			await pause(100, `poll:${code}`);
		}
	}
	async function inspectVisibleRows() {
		// Scroll each concrete rendered row into view and record that observation.
		// A row absent from the virtualized DOM cannot be passed from an entries list.
		const required = expectedDisplayIds(records.filter(record => record.decoded.session_id === sessionId));
		let dom;
		let allPresent = false;
		for (let attempt = 0; attempt < 80; attempt++) {
			await op('history-scroll-to-start', () => context.page.locator('.conversation-timeline-viewport').first().evaluate(element => { element.scrollTop = 0; }));
			await pause(50, 'history-scroll-render');
			dom = await sample();
			if (required.every(id => dom.rows.some(row => row.turnId === id))) { allPresent = true; break; }
		}
		check(allPresent, 'real-history-row-missing-from-rendered-window');
		for (const row of dom.rows) {
			const target = context.page.locator(`article.conversation-timeline-item [data-turn-id=${JSON.stringify(row.turnId)}][data-kind]`).first();
			await op('inspect-row-scroll', remaining => target.scrollIntoViewIfNeeded({ timeout: remaining }));
			await sample();
		}
		return sample();
	}
	async function setPermission(label) {
		const select = context.page.locator('.conversation-lens-dock-permission select').first();
		await op('permission-select-visible', remaining => select.waitFor({ state: 'visible', timeout: remaining }));
		await op('permission-select', remaining => select.selectOption({ label }, { timeout: remaining }));
	}
	async function runEpisode(fixture, followup = false) {
		budget.expect('episode', `${fixture.caseId}${followup ? ':followup' : ''}`);
		const prompt = followup ? fixture.followup : fixture.prompt;
		const expected = followup ? fixture.followupTokens : fixture.finalTokens;
		const start = records.length;
		const sampleStart = samples.length;
		await setPermission(['U04', 'U05'].includes(fixture.caseId) ? 'Ask' : 'Permit');
		await op('composer-fill', remaining => context.page.locator('[data-testid="conversation-composer-input"]').fill(prompt, { timeout: remaining }));
		await op('composer-send', remaining => context.page.locator('[data-testid="conversation-composer-send"]').click({ timeout: remaining }));
		let requestId;
		let cancelledCallId;
		if (fixture.caseId === 'U04' || fixture.caseId === 'U05') {
			await until(dom => {
				const request = records.slice(start).map(record => record.decoded.permission_request).find(item => item?.tool_name === 'file_write');
				const seat = dom.pending.find(item => item.requestId === request?.request_id && item.pending && item.visible && !item.inFold);
				if (!seat) { return false; }
				requestId = request.request_id;
				check(!fs.existsSync(exactFile(identity.workspace, fixture.outputName)), 'permission-tool-executed-before-decision');
				return true;
			}, 'real-permission-seat');
			const seat = context.page.locator(`.conversation-lens-confirmation-seat[data-turn-id=${JSON.stringify(requestId)}]`);
			await op('permission-deliver-decision', remaining => seat.getByRole('button', { name: fixture.caseId === 'U04' ? 'Allow' : 'Skip', exact: true }).click({ timeout: remaining }));
		}
		if (fixture.caseId === 'U06') {
			await until(dom => {
				const running = dom.rows.find(row => row.kind === 'tool' && row.status === 'running' && row.cancelCallId);
				const actual = toolFacts(records.slice(start)).find(call => call.id === running?.cancelCallId && call.starts.length > 0 && call.terminals.length === 0);
				if (!actual || !running.visible) { return false; }
				cancelledCallId = actual.id; return true;
			}, 'real-cancellable-tool-start');
			await op('tool-cancel', remaining => context.page.locator(`.conversation-process-fold-tool-cancel[data-tool-call-id=${JSON.stringify(cancelledCallId)}]`).click({ timeout: remaining }));
		}
		await until(dom => {
			const scope = records.slice(start);
			const complete = scope.some(record => record.decoded.turn_lifecycle?.turn_completed);
			return complete && !dom.overlay && !dom.busy;
		}, 'real-turn-durable-terminal');
		const dom = await inspectVisibleRows();
		const scope = records.slice(start).filter(record => record.decoded.session_id === sessionId);
		check(scope.length > 0, 'no-same-session-real-events');
		if (fixture.caseId !== 'U06') { check(!dom.rows.some(row => row.kind === 'error'), 'unexpected-error-row-in-real-turn'); }
		verifyWholeOrder(records.filter(record => record.decoded.session_id === sessionId), dom);
		const episode = { caseId: fixture.caseId, label: fixture.label, followup, promptSha256: sha256(prompt), start, end: records.length, sampleStart,
			requestId, cancelledCallId, sessionId, assertions: {} };
		if (fixture.caseId !== 'U06') { episode.answer = verifyVisibleAnswer(scope, dom, fixture, prompt, expected, !followup); }
		else {
			const user = dom.rows.filter(row => row.kind === 'user' && normalize(row.text).includes(normalize(prompt)));
			check(user.length === 1 && user[0].persistent && (user[0].visible || user[0].visibilityVerified), 'cancel-user-not-visible-once');
			check(!dom.busy && !dom.overlay && !user[0].inFold, 'cancel-left-overlay-busy-or-folded-user');
			check(dom.rows.filter(row => row.kind === 'tool').every(row => row.order > user[0].order), 'cancel-process-order-precedes-user');
		}
		const hasOwnCalls = toolFacts(scope).some(call => call.envelopes.length > 0);
		const calls = hasOwnCalls ? verifyToolDom(scope, dom) : [];
		check(hasOwnCalls || followup && episodes.some(item => item.label === fixture.label && !item.followup && item.toolCallIds.length >= 2), 'required-real-tool-work-not-observed');
		episode.toolCallIds = calls.map(call => call.id);
		for (const call of calls) {
			let args;
			try { args = JSON.parse(call.args || '{}'); } catch { check(false, 'real-tool-arguments-not-json'); }
			if (call.name.startsWith('file_')) {
				for (const key of ['file_path', 'path', 'directory']) {
					if (typeof args[key] === 'string' && args[key]) {
						const file = path.resolve(identity.workspace, args[key]);
						check(file === identity.workspace || isWithin(identity.workspace, file), 'tool-read-outside-private-task-workspace');
					}
				}
			}
		}
		if (fixture.caseId === 'U01') {
			const answer = dom.rows.find(row => row.turnId === episode.answer.finalEnvelopeId);
			check(/[\p{Script=Han}]/u.test(answer.text) && answer.markdown?.code && answer.markdown?.strong && answer.markdown?.heading, 'chinese-markdown-not-rendered-as-production-dom');
			const deltas = scope.map(record => record.decoded.streaming_delta).filter(item => text(item?.text_delta).trim());
			check(deltas.length > 0 && samples.slice(sampleStart).some(item => item.rows.some(row => row.kind === 'assistant' && !row.persistent && deltas.some(delta => row.text.includes(delta.text_delta)))), 'real-text-delta-not-observed-in-live-assistant-dom');
		}
		if (fixture.caseId === 'U02' && !followup) {
			const reads = calls.filter(call => call.name === 'file_read' && [fixture.inputName, fixture.otherName].some(name => text(call.args).includes(name)));
			check(reads.length >= 2 && new Set(reads.map(call => call.id)).size >= 2, 'same-name-independent-tool-call-ids-not-observed');
		}
		if (fixture.caseId === 'U03') { check(calls.some(call => call.isError && text(call.args).includes(fixture.missingName)), 'real-tool-failure-not-observed'); }
		if (requestId) {
			episode.permissionCallId = verifyPermissionDelivery(scope, requestId, fixture.caseId === 'U04', fixture, identity.workspace);
			const seat = dom.pending.find(item => item.requestId === requestId);
			check(seat && !seat.pending && seat.text.includes(fixture.caseId === 'U04' ? 'Allowed' : 'Skipped'), 'permission-seat-does-not-show-delivered-decision');
		}
		if (cancelledCallId) {
			const call = calls.find(item => item.id === cancelledCallId);
			check(call && (call.runtime?.lifecycle === 'TOOL_LIFECYCLE_CANCELLED' || /cancel(?:led|ed)|取消/iu.test(call.output || '')), 'cancel-not-confirmed-by-engine-terminal');
			episode.cancelledRowId = call.envelopes[0].rowId;
		}
		if (['U08', 'U09', 'U10'].includes(fixture.caseId)) {
			episode.route = verifyRoute(fixture.caseId, scope, fixture);
			const routeRows = calls.filter(call => episode.route.callIds.includes(call.id)).map(call => dom.rows.find(row => row.turnId === call.envelopes[0]?.rowId));
			check(routeRows.length === episode.route.callIds.length && routeRows.every(Boolean), 'route-process-not-correlated-in-dom');
			if (fixture.caseId === 'U08') {
				check(episode.route.childTools.every(tool => routeRows.some(row => row.payload.includes(tool.tool_name) && row.payload.includes(path.basename(JSON.parse(tool.args_json || '{}').file_path || '')))), 'child-process-details-not-visible-under-owning-spawn');
			} else if (fixture.caseId === 'U09') {
				check(['durability', 'latency'].every(dimension => routeRows.some(row => row.payload.includes(dimension))), 'deep-think-dimension-process-not-visible');
			} else { check(episode.route.states.every(state => dom.rows.some(row => row.turnId === state.envelopeId && (row.visible || row.visibilityVerified))), 'loop-iteration-owned-records-not-visible'); }
		}
		if (!followup && fixture.caseId !== 'U05') { verifyFiles(identity.workspace, fixture); }
		const live = samples.slice(sampleStart).some(item => item.rows.some(row => !row.persistent && row.busy || row.kind === 'tool' && row.status === 'running'));
		check(live, 'live-ui-process-never-observed-before-durable-terminal');
		budget.assert('episode-assertions');
		episodes.push(episode);
		budget.next();
		persist();
	}
	async function finalizeIdentity() {
		const started = records.map(record => record.decoded.turn_lifecycle?.turn_started).filter(Boolean);
		check(started.length > 0 && started.every(item => item.model_id === identity.model), 'actual-engine-model-fallback-or-missing');
		check(started.every(item => item.model_profile_id === identity.modelProfile), 'actual-model-profile-fallback-or-missing');
		result.actualModel = started[0].model_id;
		result.modelProfile = started[0].model_profile_id;
		pass('model-identity'); pass('profile-identity');
		const requestsFile = path.resolve(env.UA_REAL_EDITOR_PROVIDER_REQUESTS_FILE || '');
		check(isWithin(caseRoot, requestsFile), 'provider-wire-evidence-not-private');
		const requests = readJson(requestsFile).filter(item => item.model);
		check(requests.length > 0 && requests.every(item => item.model === identity.model && item.protocol === identity.protocol
			&& item.status >= 200 && item.status < 300 && item.responseModelStatus === 'verified'
			&& Array.isArray(item.responseModels) && item.responseModels.length > 0 && item.responseModels.every(model => RESPONSE_MODEL_ALIASES[identity.model].includes(model))), 'actual-provider-protocol-or-response-model-not-proven');
		result.actualProtocol = requests[0].protocol;
		result.evidence.providerRequestsFile = requestsFile;
		pass('protocol-identity');
		await collectProvenance();
  const provenanceEvidence = provenanceArtifact();
  writeJson(provenanceFile, provenanceEvidence);
  check(provenanceEvidence.status !== 'invalid', 'dom-frame-provenance-invalid');
  verifyThinkingProvenance(records, samples, provenanceEvidence);
  pass('dom-frame-provenance');
		const thinking = verifyThinkingDom(records, samples);
		if (thinking.observed) {
			result.thinking = { ...thinking, status: 'observed', source: 'actual-session-stream' };
		} else {
			const capability = identity.thinkingCapability;
			check(capability?.status === 'not-provided' && path.isAbsolute(capability.evidenceFile || '') && /^[0-9a-f]{64}$/.test(capability.sha256 || ''), 'thinking-capability-uncovered');
			check(sha256(fs.readFileSync(capability.evidenceFile)) === capability.sha256, 'thinking-na-evidence-mismatch');
			result.thinking = { status: 'not-applicable', evidenceFile: capability.evidenceFile, sha256: capability.sha256 };
		}
	}
	async function runGuarded(callback, ctx) {
		context = ctx;
		try { return await callback(); }
		catch (error) {
			result.status = error?.code === 'dom-frame-provenance-unavailable' || String(error?.code || '').endsWith('-uncovered') || String(error?.code || '').startsWith('thinking-capability') ? 'uncovered' : 'failed';
			result.failureCategory = error?.code || 'scenario-runtime-failure';
			try {
				budget.beginCleanup(false);
				await collectProvenance(true);
				if (tapInstalled) { await drain(true); }
				budget.finishCleanup();
			} catch { result.tapCleanupFailed = true; }
			if (result.observedModels?.length === 1) { result.actualModel = result.observedModels[0]; }
			if (result.observedModelProfiles?.length === 1) { result.modelProfile = result.observedModelProfiles[0]; }
			persist();
			throw error;
		}
	}
	return {
		id: `universe-agent-real-editor-${identity.cellId}-${identity.caseId}`,
		title: `Real MiMo ${identity.cellId} ${identity.caseId} conversation display`,
		source: 'dev/plans/mimo-real-conversation-matrix.md', scenarioPath: __filename,
		workspacePath: identity.workspace, stepPauseMs: 0,
		userSettings: { 'universeAgent.connection.autoConnect': true, 'universeAgent.conversation.autoOpen': true },
		steps: [
			{ id: 'matrix-production-stream', title: 'Capture the new session through the actual production main stream', run: ctx => runGuarded(async () => {
				budget.expect('setup');
				await op('setup-editor-layout', remaining => ctx.workbench.editorShell.waitForLayout(candidate => candidate.hasWorkbench && !candidate.agentsWindow, remaining));
				await op('setup-loopback-connection', remaining => ctx.page.getByRole('status', { name: 'Engine connection: Engine · Loopback' }).waitFor({ state: 'visible', timeout: remaining }));
				const protobuf = require(path.join(repo, 'node_modules/protobufjs'));
				const protoRoot = path.resolve(env.UA_REAL_EDITOR_PROTO_ROOT || '');
				check(path.isAbsolute(env.UA_REAL_EDITOR_PROTO_ROOT || ''), 'frozen-proto-root-missing');
				const root = await op('setup-frozen-proto-load', () => new protobuf.Root().load(path.join(protoRoot, 'session_service.proto'), { keepCase: true }));
				wireType = root.lookupType('agentservice.SessionStreamEvent');
				result.proto = { root: protoRoot, files: Object.fromEntries(['session_service.proto', 'message_envelope.proto', 'common.proto', 'agent_service.proto']
					.map(name => [name, sha256(fs.readFileSync(path.join(protoRoot, name)))])) };
				result.capture = await diagnosticOp('setup-main-tap-install', () => ctx.code.driver.evaluateElectronMain(installMainTap, { token, packageJson: path.join(repo, 'package.json'), address: `127.0.0.1:${port}` }));
				tapInstalled = true;
    mainProvenanceInstalled = true;
    await diagnosticOp('provenance-main-install', () => ctx.code.driver.evaluateElectronMain(provenance.installMain, { token, packageJson: path.join(repo, 'package.json'),
     helperFile: path.join(__dirname, 'universe-agent-real-editor-provenance.cjs'), repo, address: `127.0.0.1:${port}`,
     identity: Object.fromEntries(['campaignId','cellId','caseId','nonce'].map(key => [key, identity[key]])), modules: identity.provenanceModules }));
    mainProvenanceInstalled = true;
    await installRendererObserver();
				await op('setup-new-owned-session', remaining => ctx.page.locator('.conversation-lens-session-new .monaco-button').first().click({ timeout: remaining }));
				await until(() => {
					const ids = new Set(records.filter(record => record.decoded.hello).map(record => record.decoded.session_id));
					if (ids.size !== 1) { return false; }
					sessionId = [...ids][0]; return Boolean(sessionId);
				}, 'new-ui-session-raw-hello');
				result.capture.sessionIdSha256 = sha256(sessionId);
				// The runner records its step evidence between callbacks. Charge that
				// interval to episode 1 instead of leaving an unbudgeted gap.
				budget.next();
				persist();
				return 'actual UI-owned SessionEventStream raw bytes captured; no extra subscription';
			}, ctx) },
			{ id: identity.caseId, title: `Required ${identity.caseId} real message, process and terminal checks`, run: ctx => runGuarded(async () => {
				for (const fixture of fixtures) {
					await runEpisode(fixture);
					if (fixture.followup) { await runEpisode(fixture, true); }
				}
				if (identity.caseId === 'U07') {
					budget.expect('history');
					const before = await inspectVisibleRows();
					const selected = await op('history-selected-session', () => ctx.page.locator('.conversation-lens-session-select select').first().evaluate(element => element.options[element.selectedIndex].text));
					await op('history-switch-new', remaining => ctx.page.locator('.conversation-lens-session-new .monaco-button').first().click({ timeout: remaining }));
					await op('history-switch-back', remaining => ctx.page.locator('.conversation-lens-session-select select').first().selectOption({ label: selected }, { timeout: remaining }));
     await collectProvenance();
     if (rendererEvidence) { priorRendererEvidence.push(rendererEvidence); rendererEvidence = null; }
     rendererProvenanceInstalled = false;
					await op('history-reload', remaining => ctx.page.reload({ waitUntil: 'domcontentloaded', timeout: remaining }));
					await op('history-loopback-connection', remaining => ctx.page.getByRole('status', { name: 'Engine connection: Engine · Loopback' }).waitFor({ state: 'visible', timeout: remaining }));
     await installRendererObserver();
					priorFoldObservations.push(...selectedFolds.values());
					selectedFolds.clear(); explicitlyOpenedFolds.clear(); visibility.clear();
					await until(dom => !dom.busy && !dom.overlay && dom.rows.some(row => row.turnId === before.rows[0]?.turnId), 'history-durable-rows');
					const after = await inspectVisibleRows();
					verifyHistory(before, after);
					pass('history-identity'); pass('history-status');
					budget.next();
				}
				budget.expect('finalization');
				await op('finalization-identity-thinking', () => finalizeIdentity());
				verifyFoldCoverage([...priorFoldObservations, ...selectedFolds.values()]);
				for (const id of COMMON_ASSERTIONS.filter(id => !['model-identity', 'protocol-identity', 'profile-identity'].includes(id))) { pass(id); }
				if (['U04', 'U05'].includes(identity.caseId)) { pass('permission-delivered'); }
				if (identity.caseId === 'U06') { pass('cancel-terminal'); }
				if (['U08', 'U09', 'U10'].includes(identity.caseId)) { pass('route-owned-terminal'); }
				budget.assert('finalization-display-assertions');
				budget.beginCleanup(true);
				await collectProvenance(true);
				await drain(true);
    budget.assert('cleanup-final-thinking-reverify');
    const finalProvenance = provenanceArtifact();
    writeJson(provenanceFile, finalProvenance);
    check(finalProvenance.status !== 'invalid', 'dom-frame-provenance-invalid');
    const finalThinking = verifyCapturedThinking(records, samples, finalProvenance);
    if (finalThinking.observed) { result.thinking = { ...finalThinking, status: 'observed', source: 'actual-session-stream' }; }
    budget.assert('cleanup-final-thinking-reverified');
				budget.finishCleanup();
				result.evidence.budgetProgressFile = budgetConfig.progressFile;
				result.evidence.cleanupBudgetFile = budgetConfig.cleanupFile;
				result.status = 'passed'; result.sceneContractVerified = true;
				persist();
				return JSON.stringify({ caseId: identity.caseId, episodes: episodes.length, realFrames: records.length, assertions: result.assertions });
			}, ctx) }
		]
	};
}

module.exports = { REQUIRED_ASSERTIONS, RESPONSE_MODEL_ALIASES, validateIdentity, prepareFixture, verifyPromptDoesNotContainAnswer,
	envelopesFromEvents, envelopeText, toolFacts, verifyRoute, verifyVisibleAnswer, verifyAssistantDom, verifyToolDom,
	verifyHistory, verifyWholeOrder, verifyBodyText, verifyFiles, verifyPermissionDelivery, canonicalTaskFile, toolOutputMatches,
	thinkingFacts, verifyThinkingDom, verifyThinkingProvenance, verifyCapturedThinking,
	beginFoldObservation, advanceFoldObservation, verifyFoldCoverage, readMatrixDom, installMainTap, drainMainTap,
	createMatrixScenario, budgetForCase, validateBudgetIdentity, claimCleanupBudget, createBudgetController,
	normalize, jsonEqual, sha256, check, diagnosticError };
