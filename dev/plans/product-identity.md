---
title: "UniverseAgentStudio 产品身份方案"
type: plan
status: accepted
phase: M7
updated: 2026-09-02
summary: "落实 PRD-010：窗口名称、应用标识、数据目录、协议与跨平台图标统一为 UniverseAgentStudio；用户 2026-09-02 裁定以 Singular/logo/singularity.svg（Singularity 标识）为唯一品牌源，I3 解除阻塞"
---

# UniverseAgentStudio 产品身份方案

> **需求：** [PRD-010 产品身份](../../docs/product/requirements.md#prd-010-产品身份)。
> **父方案：** [M7 UI 完成波](m7-ui-completion-wave.md)。
> **既有裁定：** 产品名为 **UniverseAgentStudio**。**图标裁定（用户，2026-09-02）：** 显式授权以 Singularity 标识（`Singular/logo/singularity.svg`）作为 Studio 应用图标；§4.3 原「不混用 Hub / UnitServer 标识」规则据此改为「只用这一份源，不混用其他 UnitServer 变体」。
> **现状：** `product.json` 仍使用 Code - OSS 名称、`code-oss` application/data/protocol 标识及 Microsoft Code OSS 平台标识（`win32MutexName=vscodeoss`、`win32AppUserModelId=Microsoft.CodeOSS`、`darwinBundleIdentifier=com.visualstudio.code.oss`）。深链 handler `universeAgentDeepLink.contribution.ts` 已按 `universe-agent` scheme 实现，与本方案目标协议一致。

## 1. 目标

用户在窗口标题、桌面入口、任务切换、安装包、协议链接和数据目录上都能识别 UniverseAgentStudio；不残留会造成产品误认的 Code - OSS 主品牌。

## 2. 标识映射

| `product.json` 族 | 目标 |
|-------------------|------|
| `nameShort` | `UniverseAgentStudio` |
| `nameLong` | `UniverseAgentStudio` |
| `applicationName` | `universe-agent-studio` |
| `dataFolderName` | `.universe-agent-studio` |
| `sharedDataFolderName` | `.universe-agent-studio-shared` |
| `serverApplicationName` | `universe-agent-studio-server` |
| `serverDataFolderName` | `.universe-agent-studio-server` |
| `tunnelApplicationName` | `universe-agent-studio-tunnel` |
| `linuxIconName` | `universe-agent-studio` |
| `urlProtocol` | `universe-agent`（与 `UNIVERSE_AGENT_SCHEME` 常量一致；handler **路由逻辑不改**，只把常量 import 改到下沉后的 common 模块） |
| `win32MutexName` / `win32DirName` / `win32NameVersion` / `win32RegValueName` / `win32x64AppId` / `win32arm64AppId` / `win32x64UserAppId` / `win32arm64UserAppId` / `win32AppUserModelId` / `win32ShellNameShort` / `win32TunnelServiceMutex` / `win32TunnelMutex`（字段名以 `product.json` / `build/gulpfile.vscode.win32.ts:67,87,102` 为准） | I2 改为 UniverseAgentStudio 命名；GUID 生成新值，不复用 Code OSS GUID；`win32ShellNameShort` = `&UniverseAgentStudio`（加速键有意从 C 改为 U） |
| `darwinBundleIdentifier` / `darwinProfileUUID` / `darwinProfilePayloadUUID`、Appx `Publisher` / `PublisherDisplayName` | **不在 I2 / I3b 完成线**；归 **I6 发行标识定稿**（第一次正式打包前，由发布方提供反向域名与签名主体）。开发态保留上游占位值，仅用于本机开发；占位包不得当发行物 |
| `nameShort` 派生的 userData 目录 | `{appData}/UniverseAgentStudio`；开发态改 `userDataPath.ts` 硬编码为 `universe-agent-studio-dev` |

`universe-agent://settings/...` 深链因此与应用协议注册统一；现有 handler 的 fail-closed 路由不变。一致性断言放在 **node 层构建/单测**（直接读仓内 `product.json` 与导出常量 `UNIVERSE_AGENT_SCHEME`），不放 browser 单测——browser 的 `IProductService` 替身走 `product.ts` 回退，测不到仓内文件。I2 同时改 `product.ts` 回退里的 `code-oss` 字面值。知识层 `docs/glossary.md` 与 `commands.md:59`「深链不绑 `product.urlProtocol`」随 I2 改口。

## 3. 数据目录与迁移

### 3.1 两棵目录树（审查修正，2026-09-02）

`dataFolderName`（`~/.vscode-oss`）**不是**用户数据目录。运行时事实：

| 树 | 决定字段 | 内容 | 代码锚 |
|----|----------|------|--------|
| **userData** `{appData}/{nameShort}`；开发态（`VSCODE_DEV`）硬编码 `code-oss-dev` | `nameShort` + `userDataPath.ts` | `User/settings.json`、`keybindings.json`、`snippets/`、profiles、`globalStorage/state.vscdb`（含 vscode secret `secret://*` 与 UA 的 `StorageScope.APPLICATION`：Hub refresh `universeAgent.secret.hubRefresh.*`、客户端身份、engine trust、connection profiles） | `src/main.ts:57`、`platform/environment/node/userDataPath.ts:47-49,67-69`、`environmentService.ts:56`、`storageMain.ts:285-289`、`hubSessionStore.ts:260`、`clientIdentityStore.ts:139`、`engineTrustStore.ts:116`、`connectionProfileStore.ts:153` |
| **dataFolder** `~/{dataFolderName}` | `dataFolderName` | `extensions/`、`argv.json`、`policy.json` | `environmentService.ts:94-101,147,274` |

因此：I2 只改 `product.json` 不会让开发启动离开 `code-oss-dev`，仍会读写 Code OSS 的 secret 库。**I2 必须同时改 `userDataPath.ts` 的开发态名称**（如 `universe-agent-studio-dev`）与 `platform/product/common/product.ts:43-49,79-85` 的 `-dev` 后缀 / Web 回退（写死 `code-oss`）；这两个文件划入 C 所有权。

### 3.2 规则

- 不自动复制旧 userData 或旧 dataFolder，避免把上游登录、扩展 secret 与损坏状态无提示迁入。
- I5 显式迁移只拷 `User/settings.json`、`User/keybindings.json`、`User/snippets/`，profiles 只拷 profile 的这三类文件；**排除** `globalStorage/`、`state.vscdb`、`workspaceStorage/`。源路径**写死**旧名（开发 `code-oss-dev`、发行 `Code - OSS`），不读当前 `nameShort`，因此 I5 与 I2 无读取耦合、可并行。
- UniverseAgent connection trust、Hub refresh、客户端身份只从本产品 userData 读取；不得从 Code OSS 目录猜测导入。
- 命令行显式 `--user-data-dir` 继续优先。
- `serverDataFolderName` 改名影响 remote server 数据目录与 `scripts/code-server.sh`；`serverApplicationName` / `tunnelApplicationName` 影响 remote-cli 模板 `@@APPNAME@@` / `@@SERVERDATAFOLDER@@` 与 tunnel 二进制名（`codeTunnelCliProcess.ts:40`、`cli.ts:80`）。
- macOS `safeStorage` 按 bundle id 封密钥：bundle id 在 **I6** 定死后才允许产出面向用户的 macOS 包；此前的占位包只用于开发，换 id 后 `state.vscdb` 里的 Hub/secret 密文无法解密属预期，不做迁移。

## 4. 图标资产

### 4.1 I1 审计结论与裁定（2026-09-02）

| 来源 | 发现 | 处置 |
|------|------|------|
| `UniverseAgentDesktop/apps/desktop` | 没有打包图标（无 `.icns` / `.ico` / `build/icons`），只有 renderer 内的 `logo` JS 模块 | 不可作为应用图标源 |
| **`Singular/logo/singularity.svg`** | 512 viewBox 矢量：`#546E7A` 圆角方底（rx 112）、白色 stroke-width 3 线稿（外圆 r188、六边形、内三角、中心辐射线）、中心白点 r12；`aria-label="UnitServer"`；同仓 commit `ef47cda7` 纳入 | **唯一品牌源**（用户显式授权） |
| `Singular/logo/singular.svg` / `singular-white.svg` | **不是**主源反色：少中心点与三条辐射线 | **不使用**（会成为第二套几何）；浅底变体由入仓主源反色生成 |
| `Singular/logo/unitserver-*.svg`、`ExtServer/assets/unitserver-*.svg` | UnitServer 服务端标识族 | 不使用 |

**许可依据：** `Singular` 与本仓同一所有者；用户于 2026-09-02 显式授权把 Singularity 标识用作 UniverseAgentStudio 应用图标。方案不再要求额外许可证文件，但复制进本仓时在 `resources/README`（或 `ThirdPartyNotices` 旁）记一行来源与授权日期。

**结论：** I3 解除阻塞。开发态在 I3 落地前仍显示上游 `code.png` / `code.ico` / `code.icns`，About 与窗口标题须已是新名称。

### 4.2 生成规则

1. 源文件复制为 `resources/brand/universe-agent-studio.svg`（本仓内唯一矢量源；`aria-label` 改为 `UniverseAgentStudio`，几何与颜色不改）。所有产物只从这一份生成：
   - Linux：`resources/linux/code.png`（512）、`rpm/code.xpm`；另生成 `resources/linux/icons/hicolor/{16,24,32,48,64,128,256,512}/apps/universe-agent-studio.png` 并在 `gulpfile.vscode.linux.ts` 打包进 **deb/rpm**（snap 排除 icons，只放单张 `snap/gui/*.png`；今天 deb/rpm 也只有单张 pixmap，任务栏小尺寸无法验收）。
   - Windows：`resources/win32/code.ico`（16/24/32/48/64/128/256 多层）、`code_70x70.png` / `code_150x150.png`、Inno 向导位图 `inno-big-*.bmp` / `inno-small-*.bmp`。
   - macOS：`resources/darwin/code.icns`（16–1024 各档）。
   - Web/Server：`resources/server/code-192.png` / `code-512.png` / `favicon.ico`。
   - 应用内主图标：`src/vs/workbench/browser/media/code-icon.svg`（titlebar / Getting Started / banner 引用的 VS Code 丝带标）替换为主源导出；浅底变体由主源反色生成，不引用 `singular-white.svg`。
2. **小尺寸派生规则（脚本内写死，可复现）：** 输出尺寸 ≤ 48px 时使用「粗线版」——`stroke-width` 3 → 24（×8）；删除从圆心出发的三条辐射线（`<line x1="256" y1="256" …>`）；保留外圆、六边形、内三角；中心点 r 12 → 20。> 48px 使用原几何。派生是对同一 SVG 的确定性变换，不手绘第二个图形。
3. **工具链跨平台：** node 脚本 + `sharp`（SVG → PNG）+ `png-to-ico`（ICO）+ `@fiahfy/icns`（ICNS），进 devDependencies；**禁止**只依赖 macOS `iconutil`（Linux CI 不能跑）。`build/` 今天没有 icns/ico 生成先例，只消费现有文件（`build/lib/electron.ts:149,240`）。
4. 不从截图抠图，不拉伸单一低分辨率 PNG。
5. 只用 §4.1 指定的一份源；不混用其他 UnitServer 变体、Hub logo 或 Desktop renderer 内的 logo 模块。
6. 文件类型图标（`resources/*/{c,cpp,json,...}.icns|ico`）保持上游，不属于品牌切片。
7. 生成脚本进 `build/` 并可重复运行；重跑无 diff；产物变更与脚本同一提交。上游 `code.png` / `code.ico` / `code.icns` 若在本仓为 LFS 指针或缺失，脚本按「首次生成」处理。

## 5. UI 文案边界

- 产品主标题使用 UniverseAgentStudio。
- Engine、Hub、Conversation 是功能名，不与产品名拼成多套品牌。
- About、Welcome、空窗口、CLI `--help`、桌面文件、安装器名称同步更新。
- 第三方版权、MIT 许可证和上游 attribution 保留，不因换品牌删除。**可判定为：** 根 `LICENSE.txt`、`ThirdPartyNotices.txt` 不删改版权人；`product.json` `builtInExtensions[].metadata.publisherName` 保持 `ms-vscode`；不改 `extensions/*/package.json` 的 `publisher`。
- 内置扩展发布者、GitHub URL 等上游事实不做无依据改名。
- `build/lib/electron.ts:146-147` 的 `companyName` / `copyright` 元数据随 I3b 改为本产品；上游 attribution 保留在 notices 中而不是 exe 元数据里。

## 6. 切片

| 切片 | 内容 | 代码完成线 | 状态 |
|------|------|------------|------|
| I1 | 标识清单与资产来源审计 | 每个字段/资产有目标和来源；许可证明确 | **已完成**（§4.1）：字段映射齐；品牌源 = `Singular/logo/singularity.svg`，用户授权 |
| I2 | `product.json` 名称 / 目录 / 协议 / Windows 字段（§2 表，**不含** darwin* 与 Appx Publisher）+ `userDataPath.ts` 开发态目录名 + `product.ts` 回退 + 新建 `platform/product/common/universeAgentScheme.ts`（下沉 `UNIVERSE_AGENT_SCHEME`，handler 改 import） | 开发启动的 userData 目录**不再是** `code-oss-dev`；窗口标题显示新名称；深链交给既有 handler，**node 层测试**读仓内 `product.json` 与 common 常量断言一致（不 import browser contrib）；**必须重跑 gulp electron**（否则 `scripts/code.sh:20-26` 找不到 `.build/electron/universe-agent-studio`——Linux 用 `applicationName`，Darwin 才用 `nameLong`），之后 `scripts/code.sh`、`scripts/code-server.sh`、CLI `--help`、tunnel 二进制名、remote-cli 模板 `@@APPNAME@@` / `@@SERVERDATAFOLDER@@` 均为新名；`docs/glossary.md` / `commands.md:59` / `page-access-schemes.md` 改口 | — |
| I3a | 品牌源入仓 + 生成脚本 | `resources/brand/universe-agent-studio.svg` 与 `build/` 生成脚本；一次运行产出 §4.2 全部尺寸（含 hicolor 多尺寸、ICO 多层、ICNS、server、`code-icon.svg`），≤48px 粗线派生按 §4.2.2 规则 | — |
| I3b | Linux / Windows / macOS 资源接线 | `gulpfile.vscode.linux.ts` 打包 hicolor 多尺寸进 **deb/rpm**（snap `snapcraft.yaml:58` `prime: -usr/share/icons`，只放单张 `snap/gui/*.png`，snap 只验收大图缩放）；`code.desktop` / `code-url-handler.desktop` 占位（`@@NAME@@` 等）已由 `product.json` 派生；`resources/linux/{debian,rpm,snap}` 包名；`VisualElementsManifest.xml` 的 `ShortDisplayName`、Inno `code.iss` 位图；`resources/darwin` icns 与 `electron.ts:152-153` `darwinHelpBookFolder/Name`；`resources/server/manifest.json` 的 `name` / `short_name`；`electron.ts` companyName / copyright。**Appx Publisher 归 I6** | 依赖 I3a |
| I4 | 用户可见文案 | About、空窗口、CLI `--help`；**模板正文中非占位的 "Visual Studio Code" / "Code - OSS" 字面**：`code.appdata.xml`、`debian/control.template`、`debian/templates.template`（apt 仓库提示）、`rpm/code.spec.template`、`snap/snapcraft.yaml`、`server/manifest.json`、`win32/VisualElementsManifest.xml`；**Welcome / Onboarding 字面**（仅字符串替换，C 扩权、不改逻辑）：`contrib/welcomeOnboarding/…/onboardingVariationA.ts:192`、`contrib/welcomeWalkthrough/…/vs_code_editor_walkthrough.ts:47`、`issueReporterOverlay.ts:757`、`extensions.contribution.ts:965`。完成线 = 对**上述点名路径**跑 `rg -i "visual studio code|code - oss"` 零命中；`ThirdPartyNotices` / `LICENSE` / 上游 attribution 不在范围 | — |
| I5 | 显式迁移入口 | 新建 `contrib/universeAgentMigration/`（C 所有权，注册在 `workbench.desktop.main.ts`，不碰 P 的 UA 行；Web 省略）。触发：`storageService.isNew(StorageScope.APPLICATION)`（或尚无 `User/settings.json`）**且**旧目录（写死 `code-oss-dev` / `Code - OSS`）存在**且** `source !== dest`；弹一次通知 + 命令 `universeAgent.migrateFromCodeOss`，并记 `universeAgent.migration.offered` 标记不再弹；只拷 §3.2 三类文件；**不拷** `globalStorage` / `state.vscdb` / `workspaceStorage`；不出现入口视为 I5 未完成 | — |
| I6 | 发行标识定稿 | `darwinBundleIdentifier` / `darwinProfileUUID` / `darwinProfilePayloadUUID`、Appx `Publisher` / `PublisherDisplayName`、签名主体；**第一次正式打包前**由发布方提供；此前 macOS / Appx 只出开发包 | 发布方输入 |

I2、I3a、I4、I5 可并行（I5 源路径写死旧名，与 I2 无耦合）；I3b 在 I3a 之后；I6 独立于 M7 UI 波，属发行前门。

## 7. 验证与状态

测试/打包验证由 V 槽并行，失败记 D17，不阻塞其他 UI 槽。以下证据齐全后 PRD-010 才能升 `implemented`：

- Linux 实际窗口、桌面图标和 About；任务栏 16/24/32px 下图标可辨（hicolor 多尺寸 + 粗线派生生效）。
- Windows/macOS 至少完成产物检查；没有运行环境时标待验证。
- 全部平台产物由 `resources/brand/universe-agent-studio.svg` 经脚本生成，重跑脚本无 diff。
- `universe-agent://settings/engine` 打开正确页面；node 层 `product.urlProtocol` 与 handler 常量断言通过。
- 开发启动 userData 为 `universe-agent-studio-dev`，`state.vscdb` 为新建；旧 Code OSS secret 未被读取；I5 在 `isNew(APPLICATION)` 且旧目录存在时恰弹一次。
- 许可证和第三方 notices 保留（§5 可判定项）。

## 8. 开放项

- ~~Studio 应用图标品牌源~~ **已裁定（2026-09-02）**：用户选择选项 (b)，显式授权 Singularity 标识（`Singular/logo/singularity.svg`）作为 Studio 应用图标；§4 已按此改写，I3 拆为 I3a/I3b。
- Darwin 反向域名、Appx Publisher 与签名主体需发布方提供（I6）；**必须在第一次正式打包前定死**（§3.2）。此前只出开发包。

## 9. 规则 16

本方案 2026-09-02 经四轮审查后为 `accepted`。

**第一轮（本会话只读审查，2026-09-02）已改入：** I1 审计结论、深链常量一致性断言、I3 产物清单、server 目录改名影响；同日用户裁定图标源，§4/§6/§8 随之更新。

**第二轮（Cursor CLI `cursor-grok-4.6-high` `--mode ask`，2026-09-02）：Approve with changes**（1 Critical + 10 Important + 4 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 把 `dataFolderName` 当成用户数据/secret 目录；开发态 `code-oss-dev` 硬编码 | §3.1 写清两棵树；I2 加 `userDataPath.ts` / `product.ts`；I5 源路径写死、排除 `globalStorage` / `state.vscdb` |
| I1 I2 完成线漏 gulp electron / CLI / tunnel / remote-cli / `product.ts` 回退 | §6 I2 完成线补齐 |
| I2 `urlProtocol` 断言放 browser 单测不可靠 | §2 改为 node 层读仓内 `product.json` |
| I3 迁移入口无宿主 | I5 钉死为新 contrib + 一次性通知 + 命令 |
| I4 粗线派生不可复现；无跨平台工具链 | §4.2.2 写死参数；§4.2.3 指定 node 工具链 |
| I5 `singular-white.svg` 不是主源反色 | 删除引用，浅底变体由主源反色 |
| I6 三平台产物清单不完整；模板正文品牌残留 | I3b / I4 按文件列出；Linux 加 hicolor 多尺寸 |
| I7 notices 保留不可判定 | §5 写可判定项 |
| I8 GUID / bundle id 与 userData、safeStorage 的关系 | §2 表补全 win32*/darwin 字段；§3.2 / §8 写定死时点 |
| I9 应用内 `code-icon.svg` 未覆盖 | §4.2.1 纳入生成；看板 C 所有权补该文件 |
| I10 I5 与 I2 的并行前提 | I5 源路径写死旧名 |
| M1–M4 | glossary / commands 改口进 I2；`electron.ts` companyName 进 I3b；LFS 首次生成；`win32ShellNameShort` 加速键 |

**第三轮（同配置，附第二轮意见复核；2026-09-02）：Approve with changes**（0 Critical + 5 Important + 5 Minor）；第二轮 C1、I1–I10 全部 Resolved。处理：

| 意见 | 处理 |
|------|------|
| I1 I4 完成线的 rg 会打中 Welcome / Onboarding 等非 C 文件 | I4 改为点名路径零命中；Welcome/Onboarding 字面替换列入 I4 并扩权（仅字符串） |
| I2 I5 「userData 为空」永假、I2 前源 = 宿 | 触发改 `isNew(APPLICATION)` + 旧目录存在 + `source !== dest` + offered 标记 |
| I3 darwin* / Appx Publisher 在 I2/I3b 无合法值；win32 字段名不实、漏 Payload UUID | 拆出 I6 发行标识定稿；§2 表改真实字段名 |
| I4 snap 不进 hicolor；`templates.template` 漏 | I3b 写 snap 单图；I4 补 `templates.template` |
| I5 node 测试 import browser 常量破分层 | 常量下沉 `platform/product/common/universeAgentScheme.ts` |
| M1–M5 | I2 完成线补 gulp electron / remote-cli；I3b 补 HelpBook；I5 注册点；加速键有意 |
| X1 `page-access-schemes.md:959`「不绑 urlProtocol」 | 已改口 |

**第四轮（确认轮；2026-09-02）：Approve**（0 Critical / 0 Important / 3 Minor：hicolor 不进 snap、handler 只改 import、Linux 产物路径用 `applicationName`——均已改入）。**升 `accepted`。**
