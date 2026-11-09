---
title: "十六路审查 2026-11-07 r16：入口、其余扩展与工具链方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 1、weaken 1、drop 0。r16-1 让 wiki.py archive --apply 的回滚只撤回本次建出和搬入的内容，存在判断不再跟随符号链接；r16-2 让合并冲突装饰补跑扫描期间被跳过的刷新。2026-11-07 只读审查须小改，已改稿；同日已实施（未编译，Python 回滚测试 10 个全过），代码审查可接受。"
---

# 十六路审查 2026-11-07 r16：入口、其余扩展与工具链方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无（两条都是维护类修复，不对应产品需求。r16-1 改的是仓库自有文档工具 `scripts/wiki/wiki.py`，它不属于默认编辑器窗口里的产品，产品范围见 `docs/product/vision.md` 第 35 行。r16-2 改的是上游内置扩展 merge-conflict 的冲突标记高亮；`docs/product/requirements.md` 里 PRD-005 只管 Sources 三个列表，PRD-009 只管 Diff，PRD-010.4 只管内置扩展的许可证与来源保留，没有一条为编辑器里的冲突标记高亮立验收。）

只改下面两条。r16-1 停在 `scripts/wiki/wiki.py` 的归档执行、回滚与 `move_file_without_overwrite`，`scripts/wiki/` 下两份说明和一份新的本地测试；r16-2 停在 `extensions/merge-conflict/src/mergeDecorator.ts`、一份新的扩展测试和 `.vscode-test.js` 里的测试登记。两条都要在 `dev/progress/upstream-min-patch.md` 记账，提交时登记 `dev/plans/INDEX.md`，见「实施前提与提交」。

核对基线是 HEAD `841ea38816d`。审查后复核时 HEAD 未变，`scripts/wiki/`、`scripts/tests/`、`extensions/merge-conflict/`、`.vscode-test.js` 与 `dev/progress/upstream-min-patch.md` 都没有新的提交或未提交改动，行号按当前工作区。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r16-1 | weaken | 中→低 | 成立，但比稿里的「中」轻。执行前已存在的目标在 `archive_plan` 第 1873–1876 行报 `archive-collision`（悬空符号链接也算，`archive_destination_conflict` 第 1965 行用 `os.path.lexists`），`archive_apply` 在第 2069–2070 行不写任何文件就返回。不经并发写入时，回滚第 2159–2164 行搬回的只会是本次第 2179 行建出的目标：`ensure_parent`（第 2130–2138 行）只建上级目录，权限类失败不留下目标，循环中途和改写阶段失败时目标都是本次建的。坏分支要求在同一次运行的计划检查与第 2179 或 2185 行之间，有别的写入方建出恰好 `archive/<原路径>`；审查补出的悬空链接被替换（第 2032、2038、2040 行）同样只发生在这个窗口里。同一路径的两次 `--apply`，后一次要在前一次第一次改名之前通过第 2072 行重读、第 2076 行清单核对和第 2095 行的源文件 `stat`，又要在前一次第 2179 行之后才执行自己的 `os.mkdir`，两步之间只有第 2098–2115 行写临时文件，两次运行须在毫秒以内对齐。这时搬回的是同一批文档，内容不丢；前一次改写过的链接成为断链，本机提交钩子 `.git/hooks/pre-commit` 跑 `scripts/wiki/wiki.py check --staged`，按 `broken-link` 报错（`scripts/wiki/reference.md` 第 212、219 行）。`archive --apply` 只由人手动执行，`.git/hooks/pre-commit` 与 `.git/hooks/commit-msg` 只跑 `check --staged` 与 `remind --staged`。同名文件被替换，需要第三方在窗口内往该路径写入同名而内容不同的条目。没有测试或文档把现行搬回定为预期：`scripts/tests/` 没有归档测试，`reference.md` 第 274 行只承诺尝试回滚并报告回滚不完整。上游 ProjectWiki 的 `59f518b`（2026-11-02）已修同一缺陷，本仓副本来自 `98aa1b2140f`（2026-10-31），旧审查、`dev/plans/`、`dev/progress/deferred-gaps.md`、`archive/`、`dev/archive/` 里没有承接它的方案。 |
| r16-2 | hold | 低 | 见下文 |

### r16-1

问题类：`wiki.py archive --apply` 在提交阶段因目标路径已被别处占用而失败时，回滚把不属于本次的目标内容搬进源路径并删掉目标，报告仍写已回滚；`move_file_without_overwrite` 判断目标是否存在时跟随符号链接，悬空链接会被直接替换。

核对：发现稿引用的第 2176–2186、2156–2168、1873–1876、2197–2206 行与当前工作区一致。目录分支 `os.mkdir(destination)` 抛 `FileExistsError` 后，`rollback` 的 `file_moved` 为假、`destination.exists()` 为真，于是把目标里的每个条目改名进源目录并删掉目标；源目录已不存在时先在第 2161 行重建。单文件分支因目标已存在失败、源文件又已被移走时，第 2161 行在原路径建出同名空目录，第 2162 行对文件 `os.listdir` 失败后才报回滚不完整。`move_file_without_overwrite` 第 2032、2038 行用 `Path.exists()`，它跟随符号链接：目标是悬空符号链接时两处都判为不存在，第 2035 行 `os.link` 因 `EEXIST` 失败后落到第 2040 行的 `os.rename`，链接被直接替换。工作区快照把指向文件的符号链接也算文档（第 364–367 行的 `is_file` 跟随链接）；本机 Linux 的 `link()` 本来就不跟随符号链接，加 `follow_symlinks=False` 是为了让 macOS 和 BSD 上行为一致。`os.link` 成功而 `os.unlink(source)` 失败时（源目录不可写的 `EACCES`，或粘滞位目录里文件不属于当前用户的 `EPERM`），第 2038 行见目标存在就抛错，目标上留下本次建的硬链接；HEAD 的回滚只因第 2162 行对文件 `os.listdir` 失败才偶然报出回滚不完整。降级理由见判定表。

不变量：

- 回滚撤回本次运行做过的事：本次替换过的改写文件、本次 `os.mkdir` 建出的目标目录、本次改名进目标的条目、本次单文件移动后的目标文件、本次 `os.link` 建出的硬链接。不是本次建出或搬入的路径，回滚不改名、不删除、不覆盖。
- 本次由 `ensure_parent` 建出的上级目录（`created_dirs`）照现状尽力删除；删不掉（例如里面有别人的条目）时不报错，也不算在下面「全部撤回」的判定里。
- 判断某个路径上是否已有条目时一律不跟随符号链接：用 `os.path.lexists`，或以 `os.link` 的 `EEXIST` 为准。悬空符号链接算已存在，不被替换。
- 目录归档的 `os.mkdir(destination)` 失败时，回滚不读取目标目录的内容，不在源路径新建目录，不删除目标；源目录保持原样。
- 单文件归档的 `move_file_without_overwrite(source, destination)` 失败时，回滚不碰目标路径，也不在源路径新建任何东西。
- 搬回只按本次记下的条目名进行，不覆盖源目录里已有的同名条目；遇到同名就把本次的条目留在目标里。子目录条目走回退分支，残余窗口见「明确不改什么」。
- 目标目录只在本次建出、并且搬回后已空时删除；目标里还有别人的或搬不回的条目时不删。
- 源目录只在本次已经把它删掉（`source_removed` 为真）时重建；那时源路径已被别处占用，就不往里并入，本次的条目留在目标里。
- `move_file_without_overwrite` 移动的是路径本身：源路径是符号链接时，移动后目标仍是这个符号链接，不变成它所指文件的硬链接。
- `os.link` 已成功、随后删除源文件失败时，目标上的硬链接是本次建的：核对它与源文件仍是同一个文件后删掉，再抛原错误；核对不符或删不掉时，报告必须指出目标上留有这条链接或已被替换。
- 回滚没能把本次改动（上级目录除外）全部撤回时，报告一定同时带 `archive-rollback-failed`，错误里写出留下的路径；全部撤回时只有 `archive-apply-failed`。
- 成功路径、准备阶段失败路径、计划阶段的 `archive-collision` 判定，以及报告字段 `writes`、`after_check`、`next_steps` 不变；不新增 `Finding` 规则名。

要动的符号：`archive_apply` 的局部状态（新增 `destination_created` 与 `moved_entries`）、执行段、`except` 段与嵌套函数 `rollback`；`move_file_without_overwrite` 的存在判断、`os.link` 参数、失败分支与硬链接清理。文件：`scripts/wiki/wiki.py`（`move_file_without_overwrite` 第 2030–2040 行，状态变量第 2123–2128 行，`rollback` 第 2140–2174 行，执行段第 2176–2196 行，`except` 段第 2197–2206 行）。说明：`scripts/wiki/reference.md` 第 274 行，`scripts/wiki/README.md`「测试」一节第 85 行之后。测试：新增 `scripts/tests/test_wiki_archive_rollback.py`。记账：见「实施前提与提交」第 4 步。

改法：

1. 执行段的目录分支：`os.mkdir(destination)` 返回后立即把 `destination_created` 置为真。逐个条目 `os.rename(source / entry, destination / entry)` 成功后，才把条目名追加到 `moved_entries`；改名抛错的那个条目不记。`os.rmdir(source)` 成功后置 `source_removed`，与现在相同。
2. 执行段的单文件分支不变：`move_file_without_overwrite` 返回后才置 `file_moved`。
3. `move_file_without_overwrite`（第 2030–2040 行）按下面改：
   - 第 2032 行的预检改用 `os.path.lexists(destination)`。
   - 第 2035 行改为 `os.link(source, destination, follow_symlinks=False)`，调用前用 `os.lstat(source)` 记下设备号与 inode。本机 Linux 的 `linkat` 支持不跟随源链接；若某个平台对 `follow_symlinks=False` 抛 `NotImplementedError`，按不支持硬链接处理，走下面的回退分支。
   - `os.link` 本身失败时：错误码是 `EEXIST`，或此时 `os.path.lexists(destination)` 为真，就作为 `FileExistsError` 抛出，不回退；其他错误码（例如 `EPERM`、`EXDEV`、`ENOTSUP`，文件系统不支持或不允许硬链接）才回退到 `os.rename(source, destination)`，与现在相同。
   - `os.link` 成功而 `os.unlink(source)` 失败时：用 `os.lstat(destination)` 核对目标仍是同一设备号与 inode，相同就用 `os.unlink(destination)` 删掉，再抛原错误；不同或删除失败时不再动目标，抛出的错误带上目标路径（例如挂在异常对象的一个属性上）。
   - 清理用模块函数 `os.unlink(destination)`，不用 `Path.unlink()`。本机是 Python 3.10.12，pathlib 经 `_NormalAccessor` 调用，它在导入时已绑定 `os.unlink`、`os.mkdir`、`os.rename`（`pathlib._NormalAccessor.unlink is os.unlink` 为真），测试替换 `wiki.os.unlink` 拦不到 `Path.unlink()`。第 4 步新写的改名同样用 `os.rename`。
4. `rollback` 的搬回部分（替换第 2156–2168 行）按下面的分支处理：
   - `file_moved` 为真：仍用 `move_file_without_overwrite(destination, source)` 搬回，与现在相同。这里若留下第 3 步的残留，由回滚自己的 `except` 记入错误，文案带上残留路径。
   - `destination_created` 为真且目标目录还在：若 `source_removed` 为真，先看源路径；源路径已存在（`os.path.lexists`）就记一条错误，不再搬回，也不删除目标；不存在才重建源目录。然后按 `moved_entries` 倒序逐个用 `move_file_without_overwrite` 搬回源目录：源目录里已有同名条目（悬空链接也算）时它抛 `FileExistsError`，就记错误、把本次的条目留在目标里，继续下一个；其他失败也记错误并继续。最后 `os.rmdir(destination)`，失败（目标非空等）记错误。
   - `destination_created` 为真但目标目录已不在：`moved_entries` 非空或 `source_removed` 为真时，照现有文案记 `archive directory destination disappeared before rollback`；两者都不成立时本次没有搬过东西，不记错误。
   - `destination_created` 与 `file_moved` 都为假：不碰目标，也不碰源路径。目录分支 `os.mkdir` 因目标已存在而失败、单文件分支因目标已存在而失败，都落在这里。
5. `except` 段：`rollback()` 返回的错误照旧进入 `archive-rollback-failed`。另外，捕获的异常若带有第 3 步的目标路径，把「目标上留有本次建出的硬链接或已被替换」这一条加进回滚错误。
6. 改写文件的恢复循环（第 2142–2155 行）仍在搬回之前执行，`created_dirs` 的清理（第 2169–2173 行）仍在最后执行，两段代码本身不改。
7. 说明同步：`scripts/wiki/reference.md` 第 274 行在「提交阶段失败会尝试按相反顺序回滚」之后补一句，写明回滚只撤回本次建出和搬入的内容；执行过程中目标被别处建出时不动目标、不改源路径；悬空符号链接算已存在；搬回时不覆盖同名条目，撤回不了的路径列在 `archive-rollback-failed`。第 286–287 行的规则表不改。`scripts/wiki/README.md`「测试」一节在第 85 行之后补一句新测试文件的本地跑法。这两份文件在 `docs/wiki.json` 第 231–250 行 `reconcile` 的 `wiki-rules` 里，由 `wiki.py` 第 1347–1367 行双向对账：文档反引号里形如 `xxx-yyy` 的名称必须是 `wiki.py` 某个 `Finding` 的规则名，否则报 `reconcile-missing-in-code`；代码里的新规则名没写进这两份文档，报 `reconcile-missing-in-doc`。所以新句子的反引号里只放已有的 `archive-apply-failed`、`archive-rollback-failed`，带连字符的普通词（例如 hard-link）不放进反引号，本条也不新增 `Finding` 规则名。

明确不改什么：

- 计划阶段：`archive_plan` 第 1873–1876 行的 `archive-collision` 判定、`archive_destination_conflict`、预览输出和 `plan_sha256` 的计算不变；执行前已存在的目标仍在第 2069–2070 行被拒绝且不写任何文件。
- 第 2071–2079 行的重读与目录清单核对、第 2080–2121 行的准备阶段与 `archive-prepare-failed` 不变。
- 正向搬移仍用 `os.rename`：目标目录刚由本次建出，正向覆盖不在本条。
- 不引入 `renameat2`。普通文件和符号链接靠 `os.link` 以 `EEXIST` 原子地拒绝已存在的目标，没有窗口。子目录不能建硬链接，不支持硬链接的文件系统上的文件也一样，这两种情况走回退分支：先用 `os.path.lexists` 确认目标不存在、再 `os.rename`，两步之间别处新建的同名条目仍会被替换（对子目录而言只可能是新建的空目录）。这个残余窗口只在回退分支上存在，不在本条。
- 不加条目级的 inode 身份核对（审查列为可选）。改写阶段的 `os.replace` 会换掉目标目录下直接子文件的 inode，身份核对要在每次替换后更新记录，上游用 `remember_replaced` 做这件事；同名条目在本次搬入后又被别处替换，窗口比本条修的更窄，不在本条。第 3 步硬链接清理前的身份核对不受改写影响，照做。
- `created_dirs` 的清理保持静默：上级目录里有别人的条目时删不掉，不报错，也不算回滚不完整。
- 改写文件恢复循环不加并发核对：别的进程在本次替换之后又改了同一个改写文件，不在本条。
- `archive-apply-failed` 与 `archive-rollback-failed` 的规则名、`archive-apply-failed` 的文案、失败时报告的 `writes=[]` 不变。
- 不整份同步上游 ProjectWiki 的 `wiki.py`。上游 `59f518b` 在 `relocation_apply` 里用 `destination_created`、`moved_entries` 与身份核对修了同一缺陷，本条照它的语义只移植回滚这一段。上游没有本仓 `9d4719459aa`、`cb784d97706` 加的 `GitContext` 隔离，`docs/decisions/wiki-adoption.md` 第 32 行也写明本仓用的是带本地扩展的工具副本；上游新增的 `move` 命令、`relocation_path_safe` 与改写文件身份核对不在本条。
- `scripts/tests/test_wiki_git_environment.py` 的全部方法保持通过。

本地验证：

- 位置与跑法：`scripts/wiki/` 下没有测试目录。`scripts/wiki/README.md` 第 77 行写明工具的完整行为测试在 ProjectWiki 仓库、不随工具复制，第 85 行记的本地入口是 `scripts/tests/test_wiki_git_environment.py`。新测试照这个先例放进 `scripts/tests/test_wiki_archive_rollback.py`，跑法补进 README 同一节（改法第 7 步）。
- 写法：用 `unittest`，照 `test_wiki_git_environment.py` 用 `sys.path` 引入 `wiki`，在临时目录建示例项目（`docs/wiki.json` 登记 knowledge、process 与 `archive` 角色根；需要 Git 时初始化临时仓库并清掉继承的 `GIT_*` 环境），不碰本仓。用 `archive_report` 取 `plan_sha256`，再直接调用 `archive_apply`。
- 打桩：替换 `wiki.os.mkdir`、`wiki.os.rename`、`wiki.os.link`、`wiki.os.unlink` 或 `wiki.move_file_without_overwrite`。在 Python 3.10 下这只拦得到以 `os.<函数>` 形式调用的地方：第 2179 行的 `os.mkdir(destination)`、第 2181 行的 `os.rename`、`move_file_without_overwrite` 里的 `os.link` 与 `os.unlink`，以及改法第 3、4 步新写的 `os.unlink(destination)` 与 `os.rename`。`ensure_parent` 的 `Path.mkdir()` 不受影响，这正是想要的。
- 新增断言：
  - 目录归档、执行中目标被别处建出：包一层 `wiki.os.mkdir`，对目标路径先真建出目标并写入与源目录同名、内容不同的 `README.md`，再让原调用因已存在而失败。报告含 `archive-apply-failed`，不含 `archive-rollback-failed`；源目录的 `README.md` 仍是原内容；目标目录和另一方写的 `README.md` 原样还在。对照上游 `tests/test_move.py` 的 `test_directory_collision_and_partial_rollback_preserve_other_files`。
  - 同一目录被抢先归档：包一层 `wiki.os.mkdir`，对目标路径先完成一次完整搬移（建目标、搬入全部条目、删源目录），再让原调用失败。之后归档目录内容完整，原路径不存在、没有被重建，报告不含 `archive-rollback-failed`。
  - 部分搬移后回滚遇到源目录同名：目录里放 `a.md`、`b.md`，包一层 `wiki.os.rename`，只在正向搬 `b.md` 的那次调用里先在源目录放一个同名的 `a.md` 再抛错。分两种情况：放的是新写的普通文件，或是一个悬空符号链接。报告都含 `archive-rollback-failed`；源目录里放的那个 `a.md` 原样保留；本次搬走的 `a.md` 仍在目标里，没有覆盖源目录那份；目标目录因非空而保留。对照上游 `test_partial_move_rollback_refuses_source_collision`，本仓不要求失败报告的 `writes` 非空。
  - 单文件归档时目标已被别处占用：包一层 `wiki.move_file_without_overwrite`，在调用原函数之前分三种情况占住目标：写出一个普通文件、把源文件整个移到目标、建一个悬空符号链接。报告都不含 `archive-rollback-failed`；原路径不是目录；目标保持被占住时的样子（悬空链接仍是链接，指向不变）。
  - 直接调用 `move_file_without_overwrite`：目标是悬空符号链接时抛 `FileExistsError`，链接与源文件都不变；把 `wiki.os.link` 换成抛 `OSError(errno.EPERM)`、走回退分支时同样抛错且链接不变；`wiki.os.link` 抛 `EEXIST` 时不调用 `os.rename`。源路径是指向别处文件的符号链接时，移动后目标仍是符号链接、`os.readlink` 不变，被指向文件的 `st_nlink` 仍是 1。
  - 硬链接清理：包一层 `wiki.os.unlink`，让删除源文件抛 `PermissionError`。只失败这一次时，目标上的硬链接被删掉，源文件仍在，报告不含 `archive-rollback-failed`。删除目标也失败时，报告含 `archive-rollback-failed` 并写出目标路径，源与目标是同一 inode。删除源文件失败之前目标已被换成另一份文件时，那份文件不被删，报告含 `archive-rollback-failed`。对照上游 `test_fallback_unlink_failure_preserves_foreign_or_reports_remaining_link`。
  - 防回归：目录与单文件各做一次成功归档，`writes` 列出移动与改写，`after_check` 为 `passed` 或 `passed_with_warnings`，源路径不存在、目标路径存在。改写阶段第二次 `os.replace` 抛错时，目录与单文件都完整回滚：源内容与归档前逐字节相同，目标不存在，报告不含 `archive-rollback-failed`。对照上游 `test_late_failure_rolls_back_rewritten_moved_file_and_directory`。
- 在本仓根目录跑 `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/tests/test_wiki_archive_rollback.py scripts/tests/test_wiki_git_environment.py`。
- 文档门禁：`python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`；后者包含改法第 7 步说的规则名对账。

### r16-2

问题类：合并冲突装饰的扫描还没完成时同一文档又改了一次，进行中的那次因版本不同丢掉结果，因进行中而被跳过的那次也不会再跑，装饰停在上一轮，直到下一次文档改动或可见编辑器变化。

核对：第 180 行的版本比较只由 fork 提交 `16c20bb8615`（2026-09-25，「修合并冲突装饰过期写回」）加入，提交只改这一处，没有测试。`Delayer.trigger`（`extensions/merge-conflict/src/delayer.ts` 第 44–49 行）在定时器回调里放行，`documentTracker.ts` 第 72–78 行的任务这时才读取文档；任务完成到第 179 行的 await 继续执行之间只有微任务，扩展宿主不会在其间处理新的文档改动，所以走到第 180 行时，结果总是对应当前版本，版本不一致时丢掉的正是最新结果。被跳过的调用在第 171–173 行直接返回，`finally`（第 234–236 行）不补跑。`merge-conflict.decorators.enabled` 默认开启（`extensions/merge-conflict/package.json` 第 146–150 行，`services.ts` 第 62–63 行），扩展以 `onStartupFinished` 激活，默认编辑器窗口可达。`extensions/merge-conflict` 没有测试文件；`dev/plans/`、`dev/progress/deferred-gaps.md`、`archive/`、`dev/archive/` 里没有涉及该扩展的旧审查。

不变量：

- 一次 `applyDecorations` 进行期间，同一编辑器上因 `updating` 已置位而被跳过的调用，在进行中的那次结束后至少补跑一次。
- 编辑器仍可见、因版本不一致而放弃写入的那次，结束后也补跑一次。
- 每次进行中的调用结束后最多补跑一次；补跑期间再被跳过的调用由补跑结束时再补，没有新的跳过就停止。连续改动停下后，最后一次补跑读到的是最终文本。
- 不把与写入时文档版本不一致的扫描结果写到编辑器上：第 180 行的版本比较保留。
- 同一编辑器同一时刻最多一个 `applyDecorations` 在等扫描，`updating` 的语义不变。
- 扫描期间编辑器变为不可见时不补跑、不写装饰；它再次可见时由 `onDidChangeVisibleTextEditors`（第 38–41 行）重新应用。
- `dispose` 之后不再发起补跑；`dispose` 时仍在等扫描的那次结束后也不补跑。
- 进行期间没有被跳过的调用、版本也没变时，不多扫描一次。

要动的符号：`MergeDecorator.applyDecorations`（第 163–237 行）、`MergeDecorator.dispose`（第 127–135 行）、字段 `updating`（第 17 行），新增一个以 `vscode.TextEditor` 为键、记「需要补跑」的集合字段和一个「已释放」标记字段。文件：`extensions/merge-conflict/src/mergeDecorator.ts`。测试：新增 `extensions/merge-conflict/src/test/mergeDecorator.test.ts`，并在 `.vscode-test.js` 的 `extensions` 列表（第 24–97 行）登记 `merge-conflict`。记账：见「实施前提与提交」第 4 步。

改法：

1. 新增两个字段：与 `updating` 一样以 `vscode.TextEditor` 为键、记下需要补跑的编辑器的集合，以及「已释放」标记。
2. 第 171–173 行因 `updating` 已置位而返回之前，把该编辑器记入需要补跑。第 164 行编辑器为空、第 166–168 行装饰关闭而提前返回的路径不记。
3. 第 180–182 行：编辑器已不在 `vscode.window.visibleTextEditors` 里时照旧返回，不记补跑；编辑器仍可见而版本不一致时，先记入需要补跑再返回。
4. `finally`（第 234–236 行）先 `updating.delete(editor)`，再看需要补跑：记有该编辑器时先把它移出；已释放，或编辑器已不在 `vscode.window.visibleTextEditors` 里，就到此为止；否则调用一次 `this.applyDecorations(editor)`，不 await，与 `begin`、`applyDecorationsFromEvent`、`configurationUpdated` 现有的调用方式一致。
5. `dispose`：先置「已释放」标记并清空需要补跑的集合，再照现在的逻辑释放装饰类型。

明确不改什么：

- `documentTracker.ts` 第 49 行的 `delayExpireTime`（0）、共享的 `ScanTask` 与 `delayer.ts` 的 `Delayer` 不变；扫描仍在定时器触发时读取文档。
- 第 180 行的可见性判断与版本比较保留，不回退 fork 提交 `16c20bb8615`。
- 无冲突时第 184–187 行的 `removeDecorations`、装饰类型注册、`configurationUpdated` 不变；`dispose` 只多出置标记与清空集合两步，释放装饰类型的逻辑不变。
- `codelensProvider.ts` 与 `commandHandler.ts` 对 `getConflicts` 的调用不变。
- 不把 `merge-conflict` 加进 `scripts/test-integration.sh` 的固定清单。
- `extensions/merge-conflict` 目前没有测试文件，没有既有测试名需要保持；编译与 ESLint 不新增问题。

本地验证：

- 新增 `extensions/merge-conflict/src/test/mergeDecorator.test.ts`，写法照 `extensions/configuration-editing/src/test/completion.test.ts`（`import 'mocha'`，`suite` 与 `test`）。在 `.vscode-test.js` 的 `extensions` 列表加一项 `merge-conflict`，形状照相邻的 `configuration-editing`（第 55–59 行：临时目录作 `workspaceFolder`，`mocha.timeout` 60 秒），使 `extensions/merge-conflict/out/**/*.test.js` 被收进。
- 测试不调用 `begin`，不挂真实的文档或编辑器事件，直接驱动，避免依赖事件时序。用假的 `IDocumentMergeConflictTrackerService` 构造 `MergeDecorator`：`createTracker` 返回的 tracker 记下每次 `getConflicts` 收到的文档，每次返回一个由测试手动 resolve 的 promise；上下文传 `{ subscriptions: [] }`。用元素访问或 `as any` 设 `config`（`enableDecorations` 与 `enableEditorOverview` 为真）并调用 `registerDecorationTypes`，再调用 `applyDecorations(editor)` 拿到进行中的 promise。每个用例在 `setup` 新开一份无标题文档并 `showTextDocument`，在 `teardown` 调 `decorator.dispose()`，并用 `workbench.action.revertAndCloseActiveEditor` 关掉本用例打开的编辑器，免得弹保存确认。扫描一律以空数组结束，只统计这份文档上的调用。
- 时序：补跑在 `finally` 里同步发起，而 `applyDecorations` 在第一个 await 之前就调用了假的 `getConflicts`，所以 `await` 进行中的 promise 之后，补跑的那次调用已经记下，可以直接断言次数。断言「不再有调用」之前，先 resolve 最后一次扫描，再等一次 `setImmediate`，让微任务跑完。改文档用 `await editor.edit(...)`，随后先断言 `editor.document.version` 已变大再往下走。
- 新增断言：
  - 第一次扫描挂起时改一次文档，再调用一次 `applyDecorations`（模拟改动事件，被跳过）；resolve 第一次后共两次调用；resolve 第二次并等 `setImmediate` 后仍是两次。改前只有一次，这条失败。
  - 只改文档、不再调用：resolve 后因版本不一致补跑一次，共两次。改前一次，这条失败。
  - 只再调用一次、不改文档：resolve 后为被跳过的调用补跑一次，共两次。改前一次，这条失败。
  - 都不发生：resolve 后只有一次。
  - 再调用一次后，在同一编辑组打开另一份文档，有界等待（例如最多 5 秒、每 50 毫秒查一次）直到 `vscode.window.visibleTextEditors` 不再含这个编辑器，再 resolve：只有一次。
  - 再调用一次后调用 `decorator.dispose()`，再 resolve：只有一次。
- 本地入口：`npm run gulp compile-extension:merge-conflict` 编出 `extensions/merge-conflict/out/`，再跑 `npm run test-extension -- -l merge-conflict`；`.vscode-test.js` 第 140 行让它用本地 `scripts/code.sh` 起的开发版。需要全量时用 `npm run compile`。`scripts/test.sh` 只跑 `src/vs` 单测，跑不到扩展。对 `mergeDecorator.ts`、新测试文件与 `.vscode-test.js` 跑 ESLint，全量本地入口是 `npm run eslint`。

## 实施前提与提交

1. 签收后再实施。本轮只改稿，状态仍是草案。
2. 实施前重读要动的共享文件当前内容：`scripts/wiki/README.md`、`scripts/wiki/reference.md`、`.vscode-test.js`、`dev/progress/upstream-min-patch.md`、`dev/plans/INDEX.md`。别的会话有未提交改动时只追加本条的内容，不覆盖，也不暂存别人的改动。
3. r16-1 与 r16-2 互不依赖，分两次提交，每次只暂存本条的文件（`AGENTS.md`「方案与提交」）。
4. ADR-007 记账（`dev/decisions/007-upstream-sync.md` Decision 2、3）：自定义树之外、相对 `004a1fbb` 有差异的文件都要进 `dev/progress/upstream-min-patch.md` 的 A 表或 B 表，新增条目写明依据。实施提交里同步改这份清单，依据写本方案（签收后）：
   - r16-2：A 表新开一组「上游扩展缺陷修复」，收 `extensions/merge-conflict/src/mergeDecorator.ts` 与新增的 `extensions/merge-conflict/src/test/mergeDecorator.test.ts`。为何留 hook 写「修上游内置扩展自身的缺陷，没有贡献点可挂」，收缩条件写「上游合入同类修复后撤回本仓改动」。`mergeDecorator.ts` 自 `16c20bb8615` 起已在侵入面（`git diff --name-only 004a1fbb HEAD -- extensions/merge-conflict` 会列出它），清单一直没收，这次一并补上。`.vscode-test.js` 从本条起进入侵入面，记进 A 表「仓根配置」组（开发工具面）。
   - r16-1：`scripts/wiki/wiki.py`、`scripts/wiki/README.md`、`scripts/wiki/reference.md` 已在侵入面，新增的 `scripts/tests/test_wiki_archive_rollback.py` 也会进去，清单都没收。在「仓根配置」组补 `scripts/wiki/**`、`scripts/tests/**` 两条目录行；两个目录都是本仓新增的。实施时清单若已有覆盖它们的行，就不重复。
   - 清单自 2026-09-05 起没有更新，本步只补本方案碰到的路径，不负责让整份清单的 `comm -23` 输出归零；整份对齐按 ADR-007 另开切片。
5. 这份方案随第一次相关提交登记进 `dev/plans/INDEX.md`。它是会持续变长的登记表，按编号或关键词定位后追加一行，不整篇重排。
6. 提交前跑 `python3 scripts/check-docs-health.py`、`python3 scripts/wiki/wiki.py check --root .` 与 `python3 scripts/wiki/wiki.py remind --root .`；`remind` 给出 `[agent]` 时更新对应文档，或在提交说明最后一段写 `Docs-Reviewed: <名称> <理由>`。不用 `--no-verify`，本机的 `.git/hooks/pre-commit` 与 `.git/hooks/commit-msg` 会跑 `check --staged` 与 `remind --staged`。

## 审查

2026-11-07 只读审查的结论是须改稿（小改），没有 Critical。Important 两条都核实属实并已改。I1：`move_file_without_overwrite` 第 2032、2038 行用的 `Path.exists()` 跟随符号链接，目标是悬空链接时两处都判为不存在，`os.link` 因 `EEXIST` 失败后落到第 2040 行的 `os.rename`，链接被替换。r16-1 的问题类、核对、不变量与改法第 3 步改为 `os.path.lexists` 预检、`EEXIST` 直接按已存在抛出、只在其他链接失败时回退，「明确不改什么」改写残余窗口，本地验证补悬空链接用例。判定与严重度不变：执行前就在的悬空链接由 `archive_destination_conflict` 第 1965 行的 `os.path.lexists` 报 `archive-collision`，新情形同样只在并发窗口内出现。I2：ADR-007 要求自定义树之外相对 `004a1fbb` 有差异的文件进 `dev/progress/upstream-min-patch.md`；`mergeDecorator.ts` 自 `16c20bb8615` 起已在侵入面却没入账，`.vscode-test.js` 与新测试会新增侵入。新增「实施前提与提交」第 4 步，在实施提交里记账，不交给下次同步前的 `comm -23` 闸门；r16-1 碰到的 `scripts/wiki/`、`scripts/tests/` 按同一规则处理。Minor 已改：HEAD 在删除源文件因权限失败时留下硬链接，已写进核对段并由第 3 步清理；不变量收窄到与 `created_dirs` 的静默清理一致；「先检查再 rename」改写为只在不支持硬链接的回退分支上残留；`os.link` 加 `follow_symlinks=False`；清理用 `os.unlink(destination)`，因为本机 Python 3.10.12 的 `Path.unlink()` 走导入时绑定的 `_NormalAccessor`，替换 `wiki.os.unlink` 拦不到；改法第 7 步写明 `docs/wiki.json` 的 `wiki-rules` 双向对账，不新增规则名，反引号里只放已有规则名；r16-2 加「已释放」标记，`dispose` 后不补跑；r16-2 用例改为直接驱动 `applyDecorations`、等进行中的 promise、可见性用有界等待，不依赖真实事件时序；编译命令改为 `npm run gulp compile-extension:merge-conflict`；判定表里的钩子改为实际装上的 `.git/hooks/pre-commit`，它与模板 `scripts/wiki/hooks/pre-commit` 都跑 `check --staged`。不采纳：条目级 inode 身份核对（审查列为可选），理由见 r16-1「明确不改什么」。共性意见一并处理：本地验证只列本地入口，「覆盖需求」写明不对应产品需求的原因，「实施前提与提交」第 5 步写明提交时登记 `dev/plans/INDEX.md`。

## 实施记录（2026-11-07）

用户同意实施并要求不编译。r16-1 与 r16-2 都已落到代码。没有编译，没有跑 ESLint、docs-health、`scripts/test.sh` 或扩展测试。共享登记表（`dev/progress/upstream-min-patch.md`、`dev/plans/INDEX.md`）没有改，由父 agent 统一写；要写的内容见下文「记账」。

### r16-1（已实施）

改动文件：

- `scripts/wiki/wiki.py`：补 `import errno`。`move_file_without_overwrite` 改为用 `os.path.lexists` 预检；调用 `os.link(source, destination, follow_symlinks=False)`；`os.link` 报 `EEXIST` 或此时目标已被占用时抛 `FileExistsError`，不回退；其他失败（含 `NotImplementedError`）才回退到 `os.rename`。`os.unlink(source)` 失败时，先按 `os.lstat` 的设备号与 inode 核对，再用 `os.unlink(destination)` 收回本次的硬链接；核对不符或收不回时，抛出带 `partial_destination` 的错误。`archive_apply` 新增 `destination_created` 与 `moved_entries`。回滚只在本次建出目标时，按 `moved_entries` 倒序搬回，源路径已有同名条目（含悬空链接）就留在目标里并记错误，最后 `os.rmdir(destination)`。`except` 段把 `partial_destination` 记进回滚错误。规则名、`archive-apply-failed` 的文案和失败时的 `writes=[]` 都没变。
- `scripts/wiki/reference.md` 第 274 行：补一句，说明回滚只撤回本次建出和搬入的内容、不跟随符号链接、不覆盖同名条目。反引号里只放了已有的 `archive-rollback-failed`。
- `scripts/wiki/README.md`「测试」一节：补新测试的本地跑法。
- 新增 `scripts/tests/test_wiki_archive_rollback.py`：10 个测试方法，覆盖本地验证列出的各情形。

与方案的出入：

- 重建源目录直接用 `os.mkdir(source)`。源路径已被占用时由它抛 `FileExistsError`，记一条错误并停止搬回，不先用 `os.path.lexists` 判断再建。效果与方案相同，少了判断与创建之间的窗口。
- 方案核对段说第 2035 行的 `os.link` 默认跟随源路径上的符号链接，在本机不成立：CPython 在默认参数下调用 `link()`，而 Linux 的 `link()` 不跟随符号链接。`follow_symlinks=False` 照样加上，它让 macOS、BSD 这类 `link()` 会跟随链接的平台行为一致。对应的 `test_move_keeps_a_symlink_source_a_symlink` 在本机 HEAD 上也通过，是防回归用例，不是先红后绿。

跑过的 Python 测试：

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/tests/test_wiki_archive_rollback.py -v`：10 个方法全部通过。
- 用 `git show HEAD:scripts/wiki/wiki.py` 把 HEAD 版本经管道读进内存，替换模块后再跑同一套测试（不写文件）：7 个方法失败（含子测试共 11 处），正是针对缺陷的用例；符号链接、无硬链接回退和成功或晚失败回滚三个方法在 HEAD 上也通过。
- `wiki.py --help`、对一个不存在的路径跑 `check-new` 都正常；用只读脚本按 `docs/wiki.json` 的 `wiki-rules` 模拟双向对账，两个方向都没有缺口。
- `scripts/tests/test_wiki_git_environment.py` 不是本条新增或改动的测试，没有跑。

### r16-2（已实施，未编译、未跑测试）

改动文件：

- `extensions/merge-conflict/src/mergeDecorator.ts`：新增 `pendingReapply`（`Set<vscode.TextEditor>`）与 `disposed`。被 `updating` 挡下的调用记入 `pendingReapply`。扫描回来时编辑器不可见照旧返回；仍可见但版本不一致时，先记入再返回。`finally` 删掉 `updating` 后，如果该编辑器在 `pendingReapply` 里、未释放且仍可见，就不等待地再调用一次 `applyDecorations`。`dispose` 先置 `disposed` 并清空集合，再照旧释放装饰类型。
- `.vscode-test.js`：在 `configuration-editing` 之后登记 `merge-conflict`（临时目录作 `workspaceFolder`，`mocha.timeout` 60 秒）。
- 新增 `extensions/merge-conflict/src/test/mergeDecorator.test.ts`：6 个用例。不调用 `begin`，用可控的假 tracker 直接驱动 `applyDecorations`；私有成员用元素访问；`ExtensionContext` 先写成 `Pick` 变量再断言，避开 `local/code-no-dangerous-type-assertions` 与 `local/code-no-any-casts`。

与方案的出入：

- 「扫描期间编辑器变为不可见」的用例改为用 `workbench.action.revertAndCloseActiveEditor` 关掉这个编辑器，再有界等待它离开 `visibleTextEditors`，不在同一编辑组另开一份文档。关掉编辑器同样让它不可见，也不留下第二份要在 `teardown` 收尾的无标题文档。
- 没有改 `extensions/merge-conflict/tsconfig.browser.json`。它继承 `tsconfig.json`，带 node 类型并包含 `src/**/*`，web 侧类型检查会一并检查新测试；esbuild 只从 `mergeConflictMain.ts` 打包，`.vscodeignore` 排除 `src/**` 与 `out/**`，测试不进产品包。configuration-editing 与 git-base 在浏览器 tsconfig 里排除了 `src/test/**`；若 web 类型检查对新测试报错，再按这个先例补 `exclude`。

### 记账（交父 agent 写）

- `dev/progress/upstream-min-patch.md` A 表新开一组「上游扩展缺陷修复」：为何留 hook 写「修上游内置扩展自身的缺陷，没有贡献点可挂」；依据写 ADR-007 与本方案 r16-2；收缩条件写「上游合入同类修复后撤回本仓改动」；路径 `extensions/merge-conflict/src/mergeDecorator.ts`（自 `16c20bb8615` 起已改）与 `extensions/merge-conflict/src/test/mergeDecorator.test.ts`（新增）。
- 同表「仓根配置」组追加 `.vscode-test.js`（依据本方案 r16-2），以及 `scripts/wiki/**`、`scripts/tests/**` 两条目录行（依据本方案 r16-1；两个目录都是本仓新增的，`wiki.py` 等文件此前已在侵入面但没入账）。
- `dev/plans/INDEX.md` 登记本方案。

### 之后要跑的本地验证

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/tests/test_wiki_archive_rollback.py scripts/tests/test_wiki_git_environment.py`
- `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`
- `npm run gulp compile-extension:merge-conflict`，再跑 `npm run test-extension -- -l merge-conflict`
- 对 `extensions/merge-conflict/src/mergeDecorator.ts`、`extensions/merge-conflict/src/test/mergeDecorator.test.ts` 与 `.vscode-test.js` 跑 ESLint（全量本地入口是 `npm run eslint`）

### 代码审查（2026-11-07）

只读代码审查的结论是可接受，只有 Minor，都已处理：

- 目录搬回原先是先 `os.path.lexists` 再 `os.rename`，两步之间有窗口：改为逐个调用 `move_file_without_overwrite`，普通文件和符号链接用硬链接原子地拒绝覆盖，只有子目录退回先检查再改名。`scripts/wiki/reference.md` 第 274 行、方案改法第 4 步、对应不变量和「明确不改什么」里的残余窗口已改成与代码一致。测试示例目录加了子目录 `notes/`，晚失败回滚用例借此覆盖子目录走回退分支。
- 硬链接清理改为只在 `st_nlink > 1` 时删除：源文件已被别处删掉、目的地上的链接成了唯一副本时，留下它并经 `partial_destination` 写进 `archive-rollback-failed`。硬链接用例新增「源文件已被删」一种情况。
- 方案核对段第 28 行改为：本机 Linux 的 `link()` 本来就不跟随符号链接，加 `follow_symlinks=False` 是为了让 macOS 和 BSD 上行为一致。
- `mergeDecorator.test.ts` 第 5 个用例在执行 `workbench.action.revertAndCloseActiveEditor` 之前先 `showTextDocument(document, editor.viewColumn)`，和 `teardown` 一致，避免焦点在别处时关错编辑器。

改完后跑 `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/tests/test_wiki_archive_rollback.py -v`，10 个方法全部通过；用只读脚本复核 `wiki-rules` 对账，两个方向都没有缺口。仍未编译，扩展测试仍未跑。
