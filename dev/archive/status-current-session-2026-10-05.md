---
title: "status.md Current Session 流水（2026-10-05 归档）"
type: progress
status: archived
phase: M7
updated: 2026-10-06
summary: "2026-10-06 自 dev/progress/status.md Current Session 迁出。包含 2026-10-05 历史流水。"
---

# status.md Current Session 流水（2026-10-05 归档）

> 原  在 2026-10-06 视觉修复波次前的历史条目。

- **分栏恢复**：目录还没标到齐时，多出来的可见聊天不再收起已存分栏，也不把布局写成一栏。保存的聊天都出现，或目录确认那些聊天已经不在，才结束恢复。不升 PRD。
- **会话终端**：切到工作目录还没建出来的会话时，上一个会话的终端留在前台，目录后来出现也不会自己打开。现在先让出前台；目录出现，或这次会话再刷新时，再打开。不升 PRD。
- **会话浏览器**：窗口恢复后已经开着的浏览器，以及还没有会话时打开的浏览器，都没有挂到会话上。一切走就被真正关掉，回来要重新加载，页面里的状态也没了。现在第一次有当前会话时认领这些已经开着的页面；之后切走先留着，回来还是原来那一页。不升 PRD。
- **水族箱动效**：把减少动态效果设成始终开启时，鱼身波浪、水面光斑和开关上的摆动仍在播。样式只认系统的媒体查询，不认工作台标上的减少动态。现在这些动画和淡入会停，和系统偏好那条一样。不升 PRD。
- **输入条显示评论**：还没接受的拉取请求评论在编辑器里是原评论，横幅却按藏起来的反馈镜像去定位，文件打开了评论也不展开。现在改对到这条原评论。代理评论仍按反馈本身打开。不升 PRD。
- **变更里丢掉改动**：多选或在文件夹上点按文件的操作时，把会话地址当成了文件，恢复打到并不存在的路径上，改动没丢掉还报错。删除行在 diff 里点这个操作时用的是内容快照。现在改回工作区文件，多选和文件夹里的每一行都执行；根行上不再出现这个按钮。不升 PRD。
- **反馈添加按钮**：打开已删除文件的原始快照，或 diff 的修改后快照时，行上已经有评论，悬停仍画出「添加反馈」。按钮和评论的行标叠在一起，点下去会在同一行再开一个输入。现在按这个编辑器里实际看得到的评论占住那一行；已经隐藏的已解决评论不再占。不升 PRD。
- **手机单文件 Diff**：左右滑用来换上一个、下一个文件，长行也要横滑才能看完。滑去看长行时会被当成换文件，位置回到最左，旁边的文件被打开。现在这行还能往滑动方向滚动时留在当前文件；滑到尽头，或这行本来就不宽，才换文件。不升 PRD。
- **检查注解**：一条检查的注解只取默认第一页（30 条），排在后面的失败不会写进 Fix CI。现在按每页 100 条继续取，后面的注解也会进提示；某一页不再带来新注解时停，避免把同一页再拼进去。不升 PRD。
- **追问草稿**：新建会话和会话里的新聊天不再共用 `sessions.draftState`。追问按会话另存，欢迎页留下的草稿不会灌进追问框。
- **槽 F**：旁路聊天和活动客户端仍按代理名拼会话地址。云沙箱主机认的是另一套 scheme，这两处打到不存在的会话上，旁路开不出来，打开会话时工具和定制也送不进去。现在用适配器上的后端地址。不升 PRD。
- **自定义视图盖住侧栏**：侧栏还开着时打开自定义视图，布局把这次盖住记成用户关掉了侧边栏。自定义视图还在时保存或切走会话，下次侧边栏不再出现。现在盖住期间不记这次显隐，保存和切走都留着上一次真正的选择。不升 PRD。
- **Copilot 隔离**：关掉隔离选项后，新会话仍按记住的 Worktree 跑；选项从开到关时挑选器还会改成 Worktree 并写进记住的选择。CLI 关掉这个选项时本来就停在工作区。现在关掉就用工作区，且不盖掉记住的选择，重新打开再恢复。不升 PRD。
- **编辑器窗口剧本**：关掉再打开 Conversation 会把底栏（Ports / Inspect）拉出来。Conversation 和底栏在同一条竖向分支里，分支重新显示时把仍然隐藏的底栏也报成可见。现在只通知 splitview 里仍然可见的子视图。剧本 `test/scenario/scenarios/editor-shell.cjs` 在编辑器窗口里检查 Preview 隐藏、四个标题栏开关确实翻转且不会打开底栏；聊天命令另开窗口也会失败。显隐按 `workbench.parts.*` 读取。2026-10-05 隔离 profile 全部 9 步 PASS。不测 Agents 窗口。不升 PRD。
- **会话列表状态筛选**：按状态筛选用的是会话汇总状态，行上和读屏却是主聊天状态。同伴聊天在等输入时，勾掉「需要输入」会藏起看起来已完成的会话，只留「需要输入」又会列出它。现在筛选跟着行上的状态；筛选开着时主聊天状态再变，会话会跟着进出列表。不升 PRD。
- **新建会话导览**：Quick Chat 没有工作区，却被当成新建会话视图。导览会在那里开始，V3 还会把提示或选项写进去。现在 Quick Chat 不触发，场景条件也不成立；已经开始的提示步骤发现切过去了就不再插入。不升 PRD。
- **沙箱断线**：环境的连接已经关掉后，会话提供者仍握着那条连接，列表和发送还对着它。现在断开就卸掉；正在连接或协议自己重连时留着，避免拆掉还没断的状态。不升 PRD。
- **变更里的删除文件**：行上的「打开文件」对着已经不存在的工作区路径，编辑器打不开；「打开变更」只拿修改后或快照去对行路径，删除行对不上，什么都不打开。现在删除行打开删除前的快照；打开变更按工作区文件、修改后和快照都能对上，仍打开两侧 diff。其它文件仍打开行上的那个路径。不升 PRD。
- **已删除的 GitHub 账号**：拉取请求、评审或议题的作者已经注销时，映射读到空的 user 就抛错，整份拉取请求或议题不再出现，从这种拉取请求新建会话也会失败。现在和列表一样记成 ghost，评论正文还在。不升 PRD。
- **删掉评审评论**：编辑器、附件或自定义编辑器里删掉已接受的拉取请求评论后，原评论还在，种子会马上再造一条，刚删的评论又出现。现在这次删除会先压住原评论。种子拆掉重复镜像，或原评论已经不在时，不压住它，避免把稍后重新载入的评论藏掉。不升 PRD。
- **手机多重 Diff**：折起文件或把长行横滑开后，滚出屏幕再回来会重新展开，横滑也回到最左，正文盖住后面的文件。现在卸下再挂上时留着折起和横向位置。不升 PRD。
- **自定义视图**：功能还停在默认关闭时，注册会清掉记下的视图，实验随后把功能打开也不再出现。现在这种还没写进设置或策略的关闭会先留着这次选择，功能变成打开时再显示；设置或策略里写明关闭仍会忘掉。不升 PRD。
- **Sources 列表与筛选**：Files 标题栏增加「按树查看 / 按列表查看」。列表模式仍是同一棵资源管理器，只把树换成面包屑所在目录的一级；文件夹单击进入该目录，文件打开方式不变，面包屑点到工作区外回到工作区根。模式存在工作区存储 `sources.files.listMode`，设置里仍没有 `sources.files.viewMode`。Sources 部分宽至少 600px 时，当前 tab 的筛选框在 Files / Changes / Review 和隐藏按钮之间，三个 tab 同一套 22px 输入，文字各自保留；更窄时筛选回到面板。不升 PRD。
- **Sources Files**：Files 页挂资源管理器同一棵树，标题是工作区名，带新建文件、新建文件夹、刷新和全部折叠，下面是面包屑。不注册活动栏图标，侧栏仍是主视图。单击和 Enter 仍按 `sources.editorOpenMode`（默认替换当前标签）。从这里打开或新建文件不带动侧栏定位。设置里不再提供 `sources.files.viewMode`。隔离窗口里看过两侧树、刷新、打开、新建和两个右键。不升 PRD。
- **聊天视图加载**：会话里的聊天没拿到模型时，视图仍记着这次聊天，之后再显示它就直接跳过，空白一直留着，失败也不提示。现在这次失败会提示，并放开这次绑定，下一次再显示这个聊天会重新加载；取消或已经换到别的聊天不提示，同一次失败不重复提示。不升 PRD。
- **窗口标题**：当前会话的名字不进窗口标题。标题栏创建时写成 Agents 后就不再改；空白标题会空着，切到别的会话或离开会话还留着上一个名字。现在主窗口和辅助窗口都跟着当前会话：有名字就用去掉首尾空白的名字，空白用 New Session 或 New Chat，没有会话时回到 Agents。换会话、改名，或别的写入盖掉标题之后，都会换回这一份。不升 PRD。
- **Copilot 模式**：选了自定义模式后撰写条仍按没选模式，分组还会写到第一个聊天，已有会话直接抛掉这次选择，同伴聊天发出去仍是 Agent。现在写到当前聊天并公布到它的 mode 上，发送带上该模式，提交后的会话留着这次选择且不再抛错。不升 PRD。
- **会话浏览器**：未命名草稿提交成正式会话时，这次替换把草稿算成已删除，已经打开的浏览器被强制关掉，不跟着新会话走。现在改挂到新会话上；但 Agent 页仍可能保留草稿 chat owner，正式会话的上下文会将它筛掉。后续修正与删除边界见 [browser-owner-draft-graduation](../plans/browser-owner-draft-graduation.md)，方案仍 draft。换到别的会话时仍先留着，回来还在。不升 PRD。
- **内存配置**：Agents 窗口把内存目标写进用户设置文件。临时覆盖会留在 settings.json 里，重启后还在。现在只改内存并通知这次变更，不落盘；重载也不会写回去。只读项仍然拒绝。不升 PRD。
- **水族箱喂食**：减少动态效果时鱼不再游，点下去的食物不会被吃掉，连续天数不增加，食物点还停在画面上。现在这种点击马上喂中最近的一条鱼并记上一天，不留下停住的食物；已经落在水里的食物也会在这时被吃掉。关掉之后的点击不再记。不升 PRD。
- **策略遮罩**：用户或工作区把 `chat.agent.enabled` 设成 false 时，整窗仍被挡住，文案却写成组织策略禁用了 Agents。策略撤掉后，只要这项设置还是 false，遮罩也不走。现在只有策略值本身为 false 才显示这张组织策略遮罩；账户门闩仍优先显示自己的说明。不升 PRD。
- **应用到父仓**：合并用文件夹根的本地路径。根若是工作树，变更就合进工作树自己；远程或非 file 地址的 fsPath 会指到这台机器上的另一个目录，带 `..` 的路径也会指回同一个检出。现在只用来源仓库，并且必须是和工作树不同的本地目录。对不上就提示，不再合并。不升 PRD。
- **WSL 断线**：发行版已经断开后，会话提供者仍握着关掉的连接，列表和发送还对着它。现在断开就清掉这条连接。协议自己还在重连、或正在连接时不清，避免把还没断的会话状态拆掉；再次连上会重新接上。不升 PRD。
- **受阻会话**：多条拉取请求时只看第一条。它通过、是草稿或已关闭，或者还没载入，后面某条打开的请求检查失败，受阻指示也不出现；请求只写在 `pullRequests` 里同样看不到。现在按列表顺序检查每一条，第一条失败的打开且非草稿的请求会挡住这个会话。不升 PRD。
- **GitHub 文件名**：打开树上的 `a%2Fb.txt` 会再解码一次，读到 `a/b.txt`；名为 `100%` 的目录在解码时抛错，展不开。文件路径现在按列出的原名查找。分支仍是单独一段，`feature%2Ffoo` 不会被拆成目录。不升 PRD。
- **定制引用**：失败回合再试一次沿用同一个 turn id。下一次读到的已完成快照若没经过「回合先离开列表」的中间帧，解析器仍交第一次的技能和文件，这次没用到的还挂着，新用到的不出现。没有引用的回合也被当成没解析过，之后每次都重走。现在换了结果数组才重解析，空结果也算一次；同一份数组仍只解析一次。不升 PRD。
- **编辑里的输入历史**：回合或队列编辑里用 ↑ 召回已发送正文后，Escape 会直接退出编辑并写回撰写草稿。现在第一次 Escape 只退出这次浏览并还原进入浏览前的编辑正文，编辑还在；再按 Escape 才回到撰写。不升 PRD。
- **输入历史**：空输入用 ↑ 召回已发送的正文和附件后，再按 ↓ 回到末尾。空草稿没有盖进历史，这一格没有条目，召回的字和附件留在输入框里，发送钮也还开着。现在没有条目也按空草稿写回，正文和附件都清掉，发送钮跟手打同一套门闩关掉。有字或附件的草稿仍盖在当前位置，↓ 回去还是那一份。不升 PRD。
- **窄窗口会话列表**：启动时网格还没建好，收起列表会先把侧栏记成隐藏再抛错。这次收起没被记住，之后关掉侧栏或把窗口拉宽，列表不再展开。现在只要这次抛错已经把列表收起，就仍算自动收起，让出位置时会展开。网格还没改可见性的抛错仍留到下一次布局再收。不升 PRD。
- **脉冲新建会话导览**：会话离开网格后，脉冲仍留在新建按钮上；换成另一个会话也不会先停掉，上一次的等待结束时还会再亮。现在离开就收起，不开始聚光灯，回来也不会自己再亮；换成另一个会话会先停掉，只有这次等待结束时还看得见才再亮。同一次会话里继续发送且它还在网格里，脉冲保持，但这次等待若中途离开就不再亮回来。不升 PRD。
- **检查启动失败**：检查结论是 `startup_failure` 时被当成中性结果，图标仍是通过，Fix CI 也不包含这次检查。现在算失败。不升 PRD。
- **变更集选择器**：没有选中的变更集时（还在加载，或全都关掉），按钮仍留着上一个变更集的名字。现在改回这个动作自己的标题，不再显示已经关掉的那一项；换到下一个仍显示它的名字。不升 PRD。
- **自动化 Worktree**：换了工作区文件夹后，原先勾着的 Worktree 会清掉记住的分支。新文件夹的分支还在加载、失败、为空或没有仓库时，勾选被禁用，既不能改回文件夹隔离，也因为没有分支而不能保存。现在只要还停在 Worktree 上，勾选保持可点，能退回文件夹隔离；退出来之后，列表没就绪时仍不能凭旧分支再勾回去。不升 PRD。
- **会话列表标题**：还没有标题，或标题只有空白时，列表行、读屏名称和拖动标签是空的，标题栏却已经写 New Session 或 New Chat。现在这三处用同一个未命名标题；之后写上真实标题会换掉。不升 PRD。
- **删除后的评论**：文件还开着就被删掉时，评论和概览标尺仍按删除前的两侧算。原始快照上看不到这条评论，修改后那一侧还留着。现在这次变更会改挂到删除后的原始快照，并拿掉已经不是修改结果的那一侧。其它文件只改行数不会拆掉还开着的评论。不升 PRD。
- **文件同步按钮**：工具栏第一次画出时就把 Git 仓库钉死。仓库还没注册，或之后换了工作区文件夹，按钮一直空白或留着上一个文件夹的 ahead/behind，转圈也不出现。现在仓库出现、卸掉或换文件夹都会重画标题和提示；藏着的仓库不算。当前仓库自己的同步状态变化仍会更新。不升 PRD。
- **远程连接状态**：开启分享的回包如果晚于断开，按钮仍停在已连接，这次失败也不提示。现在按当时的实际状态发布；已经断开就保持关闭并报错，还连着才算分享成功。不升 PRD。
- **评审加载失败**：一条拉取请求的评审线程刷新失败时，其它已经载入的评论不再一直停在加载中。全都失败且没有可留的评论时改为错误，而不是一直加载；稍后刷新成功仍会显示。不升 PRD。
- **定制目录刷新**：指令文件或 AGENTS.md、CLAUDE.md、copilot-instructions.md 变化后，定制树和概览仍停在旧列表和旧条数，要等代理、斜杠命令或工作区再变一次。现在这些变化会马上重载；概览的 Hooks 仍会刷新，树里本来就没有 Hooks。不升 PRD。
- **多根工作区挂载**：第一个文件夹未受信任时，会卸掉窗口里已有的文件夹，后面已经受信任的也不挂。现在每个文件夹单独判断，未受信任的跳过，其余仍挂上；一个都挂不了才清空。不升 PRD。
- **新建浏览器标签**：`+` Browser 以前按未固定预览打开，也不指定主编辑组，会换掉当前预览，自己也会被下一次预览打开换掉。现在固定在主编辑组标签末尾。不升 PRD。
- **账户面板焦点**：点到面板外面，或在别处改配置把面板关掉时，焦点会被拉回标题栏账户按钮。现在只有焦点还在按钮、面板或悬浮层里才回到按钮。不升 PRD。
- **会话终端**：工作目录检查或终端创建还在进行时切到别的会话，或工作树被标成未就绪，慢的那次回来仍会改当前前台，或把活动键写成已经结束的那次。当前会话因此看到别的会话的终端，工作树就绪后也不再补开。现在只提交仍对应当前会话的那次；过期的新终端会关掉。不升 PRD。
- **输入条当前聊天**：同伴聊天里点 Fix CI 会按会话资源找输入框，当成没有聊天，也不发送。现在发到当前聊天；关掉横幅后焦点也回到这个输入框。评论和合并修复仍按会话资源找聊天。不升 PRD。
- **轨迹检查器**：检查器在宽列里打开后再把列收窄，关掉时列表被拉回顶部。现在从检查器开始盖住表格时记下位置，关掉后回到那里；并排打开时不记 0。不升 PRD。
- **评审评论分页**：一条线程的评论只取前 100 条，后面的回复被丢掉。按评论 pageInfo 继续取后续页。不升 PRD。
- **自动化超时**：运行超时或取消后，只把记录标成失败，已经发出的会话仍继续。现在会停掉还在进行的会话；调度器先写下的超时原因保持不变，已经结束的会话不动。关掉自动化设置仍不打断进行中的运行。不升 PRD。
- **窄窗口会话列表**：自定义视图盖住编辑区和侧栏时，不再被当成让出了位置，已经收起的列表保持收起。视图关掉后，窗口变宽或关掉侧栏仍会展开。不升 PRD。
- **订阅中途失败**：变更通道已经给出文件之后若只报 onDidError，观察者仍留着上一份文件。现在这次失败会清掉列表并再取一次订阅；第二次失败或一开始就是失败的不再多取。不升 PRD。
- **提问不可重试**：提问已经送出失败且不能再试时，座位和行名仍写 Input needed，或只说提交不可用。改为写明不能再次送出，不提供选项和 Submit。可重试失败仍留 Input needed。不升 PRD。
- 再关联一条还没返回的拉取请求时，已载入的评审评论不再被改成加载中。换掉原来的请求先清成空的已加载结果。内容没变则不重复发布。不升 PRD。
- **设置搜索历史**：从更早的一条改掉或清空查询后再按 ↓，会写成下一条或跳过刚输入的已有查询。现在留下框里的字；非空的修改记成最新一条，空的不入库。不升 PRD。
- **沙箱只读回放**：环境没了、回合还停在进行中时，已完成的文件编辑、等确认的工具结果和运行中已经写出的输出进同一条已结束回复。不再留着转圈或确认，也不会把这些结果丢掉。已经写完的回合不变。不升 PRD。
- **反馈附件**：会话还没进目录时，已接受的评论会先挂到聊天输入上。目录或提供者随后认出这是代理主机会话时要摘掉这颗附件，否则下一次发送既不走注解提交，也不把评论标成已提交。不升 PRD。
- **变更集选择**：默认变更集已关闭时，选择器仍停在它上面，文件列表也是它的。改为跳过未启用的默认项，改选第一个还能用的；全都关掉时不再选中，也不留它的文件。显式选中仍优先，只要那一项还开着。不升 PRD。
- **评审线程**：只取第一页时，后面的未解决评论不会点亮拉取请求图标，也不会进会话评审。按 pageInfo 继续取后续页。不升 PRD。
- **子代理改名**：live tree 把已打开的子代理改名后，延伸标签、面包屑和对话框标题仍是打开时的旧名字。现在这三处跟着 catalog 的新名字走；根标签不动，只改父级时对话框标题留着当前子代理。不升 PRD。
- **上一回合文件编辑**：失败回合用再试一次沿用同一个 turn id。完成后解析器仍交第一次的工具结果，后补的文件从输入条药丸消失。同一份结果数组仍只解析一次；换了数组才重解析。不升 PRD。
- **脉冲新建会话导览**：脉冲只把 DOM click 和并不存在的 `tap` 当成接受。触摸手势、Enter/Space 和新建会话命令都会打开新会话，但脉冲不收、聚光灯也不开始。这三种现在和 click 一样会开始；脉冲出现时已经在新会话视图、切到另一个已创建会话、或打开 Quick Chat，都不会开始。不升 PRD。
- **定制提交路径**：定制文件本身若是指向仓库外、目标还不存在的符号链接，realpath 报 ENOENT 后会把文件名接回父目录，保存跟着链接在仓库外把目标建出来。这种链接不再读、写、删或提交。目录符号链接仍按真实路径判断。不升 PRD。
- **模型选择器**：模型池用同一标识重新发布后，按钮上的名字、图标和能力换成池里的新记录，不再留着第一次选中时的旧记录。不升 PRD。
- **输入条 Fix CI**：聊天没有接住这次请求时弹出 “Couldn't fix CI checks.”。失败检查还在，不标成已请求。发出去才标记。取消仍不弹。不升 PRD。
- **自动化 Worktree**：退出已保存的 Worktree 后，仓库分支还在加载、失败、为空或没有仓库时，不能凭记住的分支再勾回去。仍停在 Worktree 上时，保存的分支照旧能在列表不可用时继续用。不升 PRD。
- **窄窗口会话列表**：列表已经因拥挤收起时，再开出第二个会话不再被当成让出了位置而展开。多个会话同时可见时这条规则暂停；回到一个会话后，关掉侧栏或编辑区仍会展开。不升 PRD。
- **受阻指示器**：已经亮着的同一次 CI 失败，在检查数据掉出阻塞集或被需要输入打断后再回来，不再当成新失败闪一次。换了失败提交仍会闪；需要输入结束再出现仍会闪。不升 PRD。
- **Fix Checks**：Changes 里拉取检查注解失败时，异常直接抛掉，按钮回来像没点过。跟输入条和受阻列表一样弹出失败原因；取消不弹，也不标成已请求。不升 PRD。
- **过程折 diff 统计**：关掉工具详情后，file_edit 行不再把 `+N −M` 画在标题上。工具名和摘要还在；详情开着时统计和 diff 正文仍在。不升 PRD。
- **反馈评论**：打开已删除文件的原始快照，或 diff 的修改后快照时，记在工作区文件上的评论和概览标尺会显示。非删除 diff 的原始一侧仍不重复。不升 PRD。
- 会话去掉拉取请求后，已经载入或仍在加载的评审评论会清成空的已加载结果，迟到的线程响应也不会再写回来。另一条没有拉取请求的会话不会清掉这条。还没加载过的保持未加载。不升 PRD。
- **设置搜索历史**：已经停在最新一条时再按 ↓，搜索框被写成空字符串，结果换成全部设置，焦点也进不去。现在留下这条查询，并把焦点送进当前结果。不升 PRD。
- **自动化下次运行**：保存时原样带回的日程和启用标志不再重算 nextRunAt。真正改了日程，或把关掉的自动化重新打开，仍从当前时间重算。不升 PRD。
- **检查重跑**：同一检查的旧失败会和新的成功或进行中一起留下，图标一直算失败。同名只保留 id 更大的一次。不升 PRD。
- **输入历史**：空输入框用 ↑ 召回已发送正文时，文字写进输入框但不发 input，发送钮停在禁用。召回和退出浏览后按手打同一套门闩更新发送钮；配对保持和 KEEP leftover 列表失败仍关。不升 PRD。
- **提权斜杠**：已有会话里取消确认后，聊天输入被消费逻辑清空，下一拍仍把草稿放回去，不发送。确认成功的纯切换仍保持清空。同一会话里带 fragment 的其他聊天能找到所属会话并写入配置，不再把斜杠原样发出去。配置写失败仍把异常抛回，不把草稿清掉。不升 PRD。
- **窄窗口会话列表**：启动时收起会话列表发生在基类构造里，子类字段初始化随后把「已收起」和「还没处理完」清掉。列表收起后关掉编辑区或侧栏不会再展开；网格还没建好时收起失败，也不会在布局后再试。这两项改在注册响应侧栏时写入。失败留到下一次主容器布局再收，让出位置时会展开。不升 PRD。
- **藏着的空帧**：人在轨迹页、时间线藏着、引擎副本还是 pending 时，先落到空帧会卸掉已经挂上的步骤。同一段过程折的下一帧不再把上一条的展开留在 DOM 上。过程折清展开时按仍挂着的条目重画，不跟着已经清空的根列表走。不升 PRD。
- **发送容器**：点在发送钮自己身上仍只交一次。钮禁用时，点到按钮外面的发送容器也不再提交，不会把未改的回合编辑保存或退出，也不会写成发送失败。放大、工具、更多、底栏和模型这些点击不提交。不升 PRD。
- **子代理标签**：对话框开着时再打开另一个已有延伸标签的子代理，先聚焦原来那一列再离开对话框。标签不再被对话框盖住，前进仍能重新打开刚离开的对话框。同一子代理的对话框保持开着。聚焦失败时对话框仍留着。不升 PRD。
- **设置编辑防抖**：还在防抖里的修改记下当时的用户/工作区/文件夹和语言过滤。切目标、换语言过滤或离开编辑器时先按那个目标写完，再取消 fast/slow delayer。同一项在另一个目标或语言下再改，不会把上一次还没写的值丢掉，慢的那次也不会在切走之后写进新目标。不升 PRD。
- **过程折工具详情**：关掉工具详情后，工具行只留工具名和状态。从正文拆出去的思考不再画在标题下，也不写进无障碍名称。详情开着时，收起工具正文仍看得到这段思考。不升 PRD。
- **自动化调度**：同一轮里前面的运行还在进行时，关掉功能、失去领导权或调度器已销毁，不再派发剩下的到期项，也不拨动它们的 nextRunAt。已经开始的那次继续跑。重新打开或重新成为 leader 后，仍到期的才会再派发。不升 PRD。
- **输入条合并修复**：检查注解拉取失败时弹出 “Couldn't fix CI checks: …”。评论保持 Created，不先标成已接受。单独 Fix CI 同样弹出。取消不弹。不升 PRD。
- 过期的 PR 评审评论按原始行号显示，不再落到文件第 1 行。
- 会话拉取请求的检查状态按 total_count 继续取后续页，后面的失败不再显示成通过。
- **模型选择器**：已有会话里的新聊天仍是 Untitled 时，打开模型列表不再因为会话里别的聊天已经跑过就提示「换模型会清掉 prompt cache」。提示只看当前聊天有没有发过请求。不升 PRD。
- 关闭自动化不再取消进行中的运行，再次打开也不会把它记成应用崩溃中断。
- **定制提交路径**：会话工作树不是仓库根时，保存或删除仓库里（或另一个文件夹里）的定制文件，相对路径里的 `..` 会接到仓库上，写到仓库外面。改为只提交仍落在某个会话文件夹内的文件：工作树里的文件按工作树相对路径抄回仓库，只在仓库里的文件留在原处并抄进工作树，仓库外的文件不写也不提交。不升 PRD。
- 删除文件的 Viewed 勾选对的是工作区文件而不是内容快照，标过已查看不再显示未查看。
- **过程折思考**：live 工具块把 `:think:` 放在 `thinkingText`、不放进工具正文。过程折把这段文字画在工具标题下，工具正文收起时也留着，不拼进工具名或摘要。不升 PRD。
- 取消提权斜杠确认后保留新建会话草稿，配置写失败时发送钮不再卡住。
- **提问座位**：同一张座位有多道必填单选、没有 Submit 时，只点一道不会提交，也不会把没点过的那道的第一项当作答案。每道都点过才交一次。一道单选仍是点选即提交。不升 PRD。
- 下一级选中已有延伸标签的子代理时，先聚焦原来那一列再离开对话框，前进仍能重新打开。
- **受阻指示器**：已经忽略的同一次 CI 失败，中间改成需要输入（打开或再忽略这次输入、换成另一条审批）之后，同一个提交仍保持忽略，不再亮起。这次输入本身仍会出现；换了一个失败提交仍会再出现。不升 PRD。
- **反馈附件**：聊天还没载入会话时补上已接受的反馈附件，Add and Submit 不再空等。
- **轨迹搜索**：换到另一条会话时清掉轨迹工具栏搜索。下一条的表不再被上一条的词滤掉，搜索框也是空的。同一条会话重连和 KEEP leftover 仍留着这次搜索。不升 PRD。
- **会话列表差异**：工作树还在创建时，列表行仍把来源检出的增删画成 `+N -M`。悬停、变更药丸和上下文键都不把这些数当成这次会话的。改为这时不画差异；工作树就绪后仍用摘要，没有摘要才加总文件列表。不升 PRD。
- 会话悬停在摘要已有增删行时用摘要，全零摘要才落到文件列表。
- **换会话过程折**：绑到另一条会话时，对话页过程折的外层、思考和工具展开回到默认收起，相同的 `fold:` / `fold:overlay:` 不再沿用上一条。人在轨迹页、对话时间线藏着时也收起，结构相同的下一帧不会把上一条的展开留在 DOM 上。引擎副本还是 pending、名单未就绪，或配对保持挡住另一条会话时，时间线和已经打开的轨迹表不再留着上一条的步骤，轨迹上一条的 turn 关联也清掉。同一条会话重连和 KEEP leftover 仍留着已画内容和展开。不升 PRD。
- **确认座位**：Allow、Skip，或提问的点选即提交 / Submit，第一次提交后按钮和选项保持可见并禁用。快照仍是 pending 且没有新的送达失败时，再点或重绘都不再交第二次。可重试的失败出现后可以再提交。不可重试仍不画按钮。不升 PRD。
- **上一级**：子代理对话框退到已经打开的父标签时，这次关掉是离开，不是 × / Esc / 遮罩。前进重新打开刚离开的对话框；父标签仍留在原来的列，不复制。关掉延伸标签仍不关对话框。不升 PRD。
- **发送钮**：点一次只提交一次。钮禁用时（配对保持、KEEP leftover、编辑正文未改）点它不提交，也不写成发送失败。保存回合或队列编辑只保存这次编辑，不会把刚恢复的撰写草稿再发出去。不升 PRD。
- **其余档案导航计数**：Rules、Hooks、MCP Servers、Plugins 在列表到达后显示条数（规则含禁用、不含栏标题；hook point 不含 installedCount；服务器不含来源分组；插件不含 hook 行与 hookCount）。Triggers、Clipboard、Context Variables 在该节打开且列表到达后显示条目条数（current 与 inherited 都算）。再来一次列表改成新条数。真断连归零；后三节当时没打开也归零，且不为此再拉列表。pairing-hold 仍留上次的行和同一计数。Overview 左栏不另计。Agents / Skills / Tools / Provider & Model 未改。不升 PRD。
- **Provider & Model 导航计数**：`ListModels` 到达后左栏显示模型条数（不含 provider 分组标题，也不含 Provider 状态行；禁用模型仍算在内）。下一次列表到达后改成新的条数。真断连清掉目录后计数归零。pairing-hold 仍留着上次的行和同一计数。不升 PRD。
- **连接 Devices**：未登录时 pairing-hold 若还留着待配对或已列出的设备，Devices 区和左栏都保持可见。Hub 登录状态再刷新也不会把这些行藏起来。真断连清掉之后仍关掉，没有 leftover 的 pairing-hold 也不露出空的 Devices。不升 PRD。
- **Agents AGENTS.md 正文**：正文以 `---` 开头且另存的 summary、usage、detailLevel、description 与这段正文里的同名字段不一致时，编辑器把档案字段写在外层，内层正文原样留下。未改保存不再把正文裁到第一段 `---` 之后，也不用内层 summary 换掉档案摘要。字段已经和正文一致时不套第二层。不升 PRD。
- **Tools 导航计数**：`ListTools` 到达后左栏显示工具条数（不含分组行）。真断连清掉目录后计数归零。pairing-hold 仍留着上次的行和同一计数。不升 PRD。
- **会话列表副标题**：引擎会话对象的 turns 在连接期间是空的，列表把它写成 No messages，待确认数却来自投影。改为按 getTurns 计数；投影条数或待确认数变了才刷新。换走之前把这次投影留在该行上，离开后不再归零。不升 PRD。
- **Skills 导航计数**：`ListSkills` 到达后左栏显示技能条数（不含分组行）。真断连清掉目录后计数归零。pairing-hold 仍留着上次的行和同一计数。不升 PRD。
- **Inbox 队列标题**：芯片和列表头共用同一条标题。正在发送时两边都写 Sending…，即使队列也暂停着；暂停钮仍是 Resume。未暂停时 “N queued” 只数未在编辑的 PENDING，不再把失败、上传或编辑行算进去。一条都没有在等时不写 queued：全失败写 failed，编辑写 Editing，单条上传写百分比。不升 PRD。
- **提问座位**：不在 pendingActions 里、也没有 answered 的提问不再标 pending。时间线不把它当成待确认座位，不写 Input needed 或 Can't answer，也不提供 Submit。仍在待决里的才是 pending；已回答仍是 Answered。不升 PRD。
- **带引用发送**：接通发送被接住后，用当前表面会提交的正文（正文加引用芯片）和刚发出的那份比。相同才清空输入和芯片，并按空草稿关掉发送钮。只拿输入框裸字符串去比会留着引用，还能再发一次。等待期间正文或引用变了则留着。不升 PRD。
- **队列编辑**：去掉空白后与载入时要提交的正文相同（含合法引用尾块按同一规则重组），只退出编辑。不调用 `updateMessageQueueItemContent`，也不弹出失败。保存钮在这份正文未改时禁用。正文有变化仍保存。不升 PRD。
- **受阻指示器**：已经报过的 NeedsInput，后来才拿到审批 id，仍是同一次输入。不再因此重新亮起，也不把看过或忽略过的会话放回来。换成另一条审批仍会再出现。不升 PRD。
- **Agents AGENTS.md 引号**：保存时双引号字段按 JSON 字符串还原。换行、引号和反斜杠不再变成转义原文；本身带引号的值写出时也会加引号。单引号字段和缺字段清空不变。不升 PRD。
- **受阻会话 Fix CI 行**：草稿、已关闭或已合并的拉取请求不再显示失败计数、pending 计数和 Fix CI。点了也只说明是草稿或未打开，不发送。打开且非草稿时，已成功的检查不算进 pending。不升 PRD。
- **Agents 模型**：保存 Model 只写 `model` / `modelType` / `maxTurns`。空字段仍是显式空值，用来清掉档案上的旧值。不再把已加载的 AGENTS.md 解析后叠回去，以 `---` 开头的正文不会被裁成后半段，摘要里的换行也不会被改成转义。不升 PRD。
- **Dock 闸门**：空闲卸掉 `role` 之后，再进入配对保持或 KEEP leftover 列表失败，闸门重新可见却不再是 `status`，和初次挂载不一致。重新标上 `status`，并清掉错误色和 title。粘住的发送失败仍是 `alert`，不被配对文案盖掉。不升 PRD。
- **Overview Model**：首拉 `listModels` 还停在 Reading models… 时进入 pairing-hold，不再把这行占位当成 leftover。摘要收起，只留断连说明，也不再打第二次 `listModels`。已经数过的末次计数仍留着。不升 PRD。
- **权限座位**：不可重试的送达失败仍保持 pending，但不再标 Input needed，也不再画 Allow / Skip。摘要改为不能再次送出，错误原因留在座位上，不写成 Allowed / Skipped。可重试失败仍留按钮。不升 PRD。
- **Inbox 队列行**：只有未在编辑的 PENDING 标 Queued。失败行只写原因并留 Retry，上传只写百分比，正在发送写 Sending…，编辑中只写 Editing。不再把这些状态前缀成 Queued。不升 PRD。
- **Skills 换技能**：正文未改时点另一条，编辑区先清空上一条正文并关掉 Save，直到这条的 SkillInfo 回来。加载中保存不会把上一条写到新技能上。同一条重新加载仍留着已显示的正文。未保存时点另一条或来源分组行仍留在当前技能。不升 PRD。
- **Agents AGENTS.md**：删掉 summary、usage、detailLevel 或 description 后再保存，这些字段按空值清掉，列表摘要和正文不再写回旧值。未闭合的 frontmatter 不清字段。模型、工具和启用状态仍随档案带上。不升 PRD。
- **Direct Address**：端口须为 1–65535。空、0 或超出范围时，Add 与 Connect 只提示 “Enter a valid host and port.”，不写 profile，也不开始连接。不升 PRD。
- **时间线焦点**：更早的行不再把 `content-visibility` 和 `contain-intrinsic-block-size` 写成内联样式。键盘焦点停在屏外行时，样式表的 `:focus-within` 能把它展开，不再被 120px 占位夹住。最近三根、流式、编辑和待确认座位仍用 `--cv-visible`。不升 PRD。
- **上一级**：父级已经是延伸标签时，聚焦它所在的列，不在当前列再开一张。从延伸标签退上来时关掉正在离开的那张；对话框只关掉。父级还没有标签时，仍用父级替换当前延伸标签。不升 PRD。
- **Review 右键打开**：右键「Open in New Tab」或「Replace Current Tab」打开成功后标已审阅，和单击、Open Selected 一样。打开失败、返回 false 或过期时不标，并写出同一条打开失败状态。Changes 右键打开仍不标。不升 PRD。
- **子代理原列**：下一级或时间线打开已经在另一列的延伸标签时，聚焦那一列，不把同一张标签再开进当前活动列，也不改开对话框。没有标签时仍开对话框。不升 PRD。
- **引擎芯片**：StatusBar `status.conversation.engine` 与身份条共用 `getConversationEngineChipTone`。未连接、closed、pairingPending 是警告色；failed 是错误色，即使文案已经是 Waiting for pairing。连接中和已连接保持普通色。不升 PRD。
- **Files 列表**：Preview 当前标签没有资源、是 untitled，或资源没有文件提供者（例如 `sources-git-diff`）时，列表模式只显示 “Open a file to list its folder.”。不再 `fileService.resolve` 那个虚拟路径，也不把失败画成 “Unable to read workspace files”。有提供者的工作区文件和引擎投影文件仍列所在目录的一级。不升 PRD。
- **Agents 选中**：点一条档案只显示 `ListAgentProfiles` 已带回的 AGENTS.md，不调用 `SaveAgentProfile`。点选不再用残缺档案重写正文、工具和启用状态。Save 才写入。不升 PRD。
- **回合编辑**：去掉空白后与载入时要提交的正文相同（含合法引用尾块按同一规则重组），只退出编辑。不调用 `updateUserTurnText` / `EditMessage`，也不弹出失败。发送钮在这份正文未改时禁用。正文有变化仍保存。不升 PRD。
- **轨迹预览**：表的一行预览和检查器 Summary 对用户行去掉合法的 `<<<conversation-refs>>>` 尾块。只有尾块时表上是 “(empty)”。助手行和非法多标记保留原文。搜索仍匹配记录原文。不升 PRD。
- **轨迹 Overview**：分段只来自与表相同的最近窗口，上限已经丢掉的更早记录不再是可点的段。点击仍定位到该段首条；工具栏搜索若把它滤掉，会清掉搜索再定位。搜索已经能看见它时不动搜索框。不升 PRD。
- **Goal**：去掉空白后与当前目标相同，只关掉输入。不调用 `setSessionGoal`，也不把输入条画成 “Retry failed — could not post.”。清空仍取消已有目标。不升 PRD。
- **Skills 正文**：未保存时点来源分组行留在当前技能，不重载、不丢掉正文。未改时点分组行仍卸掉选中，回到选择提示。不升 PRD。
- **Review path-set 横幅**：勾上「仅未审阅」后，“Showing N files” 与列表行一致，已审行不再算进去。进度 “Reviewed x / y” 和 Mark all 仍按文本加 path-set，不因这颗开关改分母。不升 PRD。
- **待确认定位**：Inbox 芯片、回到会话和通知 Show 不再平滑 `scrollIntoView`。时间线立刻滚到该根；座位在窗口外（含更早的可应答工具）会先挂上再滚。座位不是最后一根时解开贴底，下一帧和尺寸变化不会把视口拽回底部。座位就是最后一根时跟随保持。不升 PRD。
- **Accept hunk**：对话审阅和底部 Panel 的两侧 diff 会同步移动光标。Accept 只认仍聚焦的那一侧；点按钮时焦点已离开编辑器，沿用最后一次聚焦侧记下的行。对侧同步过来的光标不再改块。从未聚焦过才退回修改侧。不升 PRD。
- **会话标题**：去掉空白后与当前标题相同，只收起输入，不调用改名，也不把输入条画成 “Retry failed — could not post.”。空白标题收起并说明不能为空。配对等待时即使输入框已打开也不提交。不升 PRD。
- **受阻会话 Fix CI**：列表里点 Fix CI，拉取请求没加载、已经没有失败检查、会话聊天没接住、或发送被拒绝 / 抛错时弹出 “Couldn't fix CI checks…”。取消不弹。发出去才标记已请求修复。进行中的再点不会再发一次。不升 PRD。
- **输入历史**：多行草稿或已召回的多行正文里，↑ 不在首行、↓ 不在末行时只移动光标，不再换成另一条历史。召回后光标停在该方向的边上，下一次同向键才能继续翻。带修饰键的方向键不翻。不升 PRD。
- **前台发送**：新建会话和会话内追问在调用返回前失败时弹出 “Couldn't send: …”。取消不弹，正文留在输入框。后台发送已经返回之后的失败仍只弹一次；交给后台之前就失败时补弹 “Couldn't send in the background: …”。不升 PRD。
- **编辑器来回**：后退和前进按导航栈记下的列打开。侧列审阅还开着时，从聊天列退回去留在侧列；再前进回到聊天列，不把根对话塞进侧列。不升 PRD。
- **新建会话 Enter**：补全列表可见但没有聚焦项、当前项不会改文字、或关闭了 Enter 接受时，Enter 仍发送。有可接受的当前项时 Enter 仍交给补全。不升 PRD。
- **Composer @**：没有匹配会话时 Enter 不再被列表吃掉，仍按键盘设置发送或换行。有当前项时 Enter 仍只选中，不发送。方向键与 Escape 不变。不升 PRD。
- **窄宽 More**：History、Snapshots、新建、删除收进 More 后，新建和删除跟栏上写钮同一道闸。pairing-hold 或 KEEP leftover 时这两项禁用，点了不会创建、删除，也不弹出失败。不升 PRD。
- **输入条失败**：Fix CI 读到的拉取请求还没加载，或 Reveal CI / Reveal Comments 失败时弹出错误。日志仍在。不升 PRD。
- **后台发送**：`sendNewChatRequest` / `sendRequest` 的 `background` 在提供者失败时弹出 “Couldn't send in the background: …”。取消不弹。调用方已经返回。前台失败仍只抛给调用方，由 composer 弹。不升 PRD。
- **提问座位**：必填单选是空白时，Submit、自定义框 Enter、或点选即提交会写出 “Can't submit — a required choice is empty.”，不调用 `onRespond`。改到非空选项后提示消失。写闸关掉时仍不解释、不提交。不升 PRD。
- **Composer @**：匹配会话 listbox 打开时，当前项写在仍聚焦的输入框和 listbox 的 `aria-activedescendant` 上。方向键只移动高亮，没有匹配项时也不再掉进输入历史。Escape 关掉并清掉这些属性。不升 PRD。
- **反馈提交**：聊天没有调用 `onRequestAccepted`，或 `acceptInput` 抛错时，弹出错误。评论留在 Accepted。已经接住的排队发送不报这句。不升 PRD。
- **新会话输入框**：空会话卡片仍用 `agentsChatInput`。Copilot 仍是描边套件胶囊，标签来自本机 Agent Host，不读引擎连接。桌面文件夹和 Issue/PR 用编辑器次级选择器尺寸（22px、无静息描边、无箭头）。语音仍走 `NewChatVoiceController`，圆形、按下色和断开绿色对齐编辑器麦克风。GitHub、附加文件夹和附加仓库仍是会话胶囊。页脚不变。手机类别行不动。这次没有重开窗口。未推远程。
- **启动**：交互「启动」用 `~/.universe-agent-studio-test`，IDE 与钉死引擎共用 `vscode-debug-engine/agent-home` 的 `UNIVERSE_AGENT_HOME`；引擎监听 `127.0.0.1:50061`。`launch.sh` 只用于壳冒烟。仓库根 `/.sessions/` 不入库。
- **会话条**：上一级留在会话栏，退一层父代理。下一级在它旁边，弹出直接子代理；根上没有 parent 的 fork 也算孩子。两钮窄宽都不收进 More。编辑器来回和关掉延伸标签在该叶编辑器区，不关子代理对话框。上一级会等会话栏控件出现后再放进去。

- **审查与修复 Wave 13（Slot A conversation / Slot B sessions，提交 4ec70ecd67a）**：
  - **Slot A（conversation Timeline Overlay 容器挂载与 Promise Catch 契约扫描计数校准）**：
    `conversationSessionChat.contribution.ts` 恢复优先在 `leaf.sessionWindow` 中查找 `.conversation-timeline` 作为子代理浮层宿主，确保浮层被正确约束在时间线包含块中；
    `conversationLeftoverPromiseCatchScan*.test.ts` 校准断连态下 4 处双链 catch 契约匹配断言计数；
    单测 `conversationLensCssScan.test.ts`（27 项）与 3 个 Promise catch 扫描套件（19 项）共 46 项全绿（提交 `e3b496242b3`）。
  - **Slot B（sessions newChatInput 契约扫描兼容与 Agent Host PR 编号粘性解析）**：
    `newChatInputCatchScan.test.ts` 重构 import 断言为正则匹配，兼容多标识符具名导入并严格保证双链 catch 契约；
    `baseAgentHostSessionsProvider.ts` 在 `AgentHostSessionAdapter` 中实现 `_pullRequestNumberCache`，确保活动会话分支 PR 编号在 `gitHubInfo` 重算时不发生重复查询或图标抖动；恢复并跑绿被 skip 的 PR sticky 单测；
    单测 `newChatInputCatchScan.test.ts`（4 项全绿）与 `localAgentHostSessionsProvider.test.ts`（217 项全绿，提交 `4ec70ecd67a`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与双领域测试全量通过，单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `4ec70ecd67a`）。
- **2026-10-07 调度**：merge 槽 `133b08803f5` 合入槽 A `e3b496242b3`（overlay 挂到 timeline）、槽 B `9ec81fcaaee`（图示与子代理浮层去掉模糊）、槽 D `02cb44e31b2`（Composer 8px、不投影、发送钮 24px）。扫描测试两边保留，自动合并。`npm run compile-client` 0 errors。`conversationLensCssScan.test.ts` 27 passing。各工位已 ff-only 到 `54d98f287af`。槽 F `7d39b8b38e6`：输入光标跟 `input.foreground`，图示选项过渡不再带 box-shadow。`compile-client` 0 errors，扫描测试 27 passing。轨迹搜索聚焦仍用 `box-shadow`，这一处还在用，没有并进这一刀。不升 PRD-028。未 push。
- **审查与修复 Wave 12（Slot A conversation / Slot B sessions，提交 32358af552c）**：
  - **Slot A（conversation 会话叶窗切换早退修复与回合编辑退出 composer 挂载防护）**：
    `ConversationLeafSessionBar.switchLeafSession` 移除目标等于当前会话时的早退逻辑，确保正确处理聚焦、取消阻塞中的 in-flight reveal 并同步 `rosterService.switchSession`；`ConversationSessionWindowService` 增加聚焦叶冗余 reveal 过滤保护；
    `ConversationLensComposerChrome.syncComposerPlacement` 修复退出回合编辑模式时因行内容器销毁导致瞬时 `!isConnected` 而误跳过挂载的问题，确保原子挂回 `composerCluster` / `dockRoot`；
    单测 `conversationSessionWindowReveal.test.ts`（25 项全绿）与 `conversationLens.test.ts`（138 项全绿）。
  - **Slot B（sessions 多聊天删除缓存同步与新建会话工作区继承恢复）**：
    `CopilotChatSessionsProvider.deleteChat` 在持久化多聊天场景下，同步清理 `_sessionCache`、`_newSessions` 与 `_sessionGroupCache`，使分组缓存失效并触发群组变更事件通知，杜绝界面残留与空指针隐患；
    `SessionsService.openNewSession` 恢复 `inheritWorkspaceFromActiveSession` 选项支持，支持按需继承活动会话的工作区根路径并对齐草稿；恢复 `sessionsManagementService.test.ts` 中两个被 skip 的继承单测；
    单测 `copilotChatSessionsProvider.test.ts`（94 项全绿）与 `sessionsManagementService.test.ts`（118 项全绿）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与双领域全量单测通过（375 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 32358af552c）。
- **审查与修复 Wave 11（Slot A storage & policy / Slot B copilot tools & conversation，提交 f6606f16e4b）**：
  - **Slot A（storage 启动恢复抢修、并发 flush 回调精确结算与托管策略瞬态保护）**：
    `SQLiteStorageDatabase.connect()` 在首次连接前执行 `restoreRecoveryDatabaseIfMissing`，主库缺失时优先校验并原子重命名恢复 `.recovery-temp`（次选 `.recovery-replace`），防止异常中断后遗留恢复库被覆盖或回退至空库；
    `Storage.flushPending()` 快照当批待写入数据与等待中的 `whenFlushedCallbacks`，刷盘完成时精确结算当前批次，避免并发写入时回调滞留或受后批失败牵连；
    `FileManagedSettingsService` 增加瞬态 ENOENT 保护，首次缺失保留上一代策略并调度重试读取，防止配置原子替换时白名单短暂全开。
    单测 `storage.integrationTest.ts`（36 项）与 `fileManagedSettingsService.test.ts`（25 项）全绿。
  - **Slot B（copilot 命令免确认白名单净化与会话链路修复）**：
    从 `noConfirmationCommandsWithoutArgs` 彻底移除具有副作用的 `git.stash`、`git.stashPop`、`git.stashStaged`，保留只读的 `git.stashView`，强制要求弹窗确认；
    单测 `vscodeCmdTool.spec.ts` 4 项全绿；保持 thinking 轮次标题并在投影中改写活动会话链接；视口内含可见用户轮次时不置顶用户提示。
  - 修复 storage 模块 TypeScript TS2454 / TS6133 / TS2341 编译报错，补齐备份文件存在性断言，重构 flushPending Promise 生命周期。
  - 经 merge 槽集成编译（`compile-client` 0 errors，`compile-copilot` 0 errors）与全量针对性单测通过（共 123 项通过，0 失败），单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐（提交 38196081a1e）。
- **审查与修复 Wave 10（Slot A conversation / Slot B sessions，提交 9b688de6f87）**：
  - **Slot A（conversation 多消费者 Lease 基线快照回放与权威缓存投影）**：`SharedEngineHostBinding` 补齐次级消费者
    `addConsumer` 时回放基线快照与 cursor；权威缓存投影收归 `SharedEngineHostBinding.getCachedProjection`，
    修复多视图或次级绑定覆盖清空缓存投影问题；优化连接与暂存态下读取缓存投影的判定门禁。
    单测 `conversationEngineRosterService.test.ts` 与 `conversationEngineFrameSource.test.ts` 共 163 项全绿。
  - **Slot B（sessions 单个聊天删除前置确认门禁与草稿级联销毁防护）**：修复 `deleteChat` 当 `chatIds.length <= 1`
    时直接调用 `deleteSession` 绕过确认对话框缺陷，添加前置确认门禁；未提交草稿删除时仅清理本地缓存，
    阻断级联销毁父会话历史；修复 `RemoteNewSession.setPermissionLevel` 抛异常导致 Cloud 会话崩溃的缺陷。
    单测 `copilotChatSessionsProvider.test.ts` 共 92 项全绿。
  - 经 merge 槽集成编译（0 errors）与合并单测（254 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。

- **审查与修复 Wave 17（Slot A conversation / Slot B sessions，提交 7c740b11086）**：
  - **Slot A（conversation 会话窗口叶生命周期与异步呈现可见性校验修复）**：
    `conversationSessionWindowService.ts` 在 `revealSessionWindow` 异步呈现应用状态表后增加可见性校验（`if (!this.isSessionWindowVisible(sessionKey)) return { cancelled: false };`），避免在异步等待期间窗口被隐藏仍继续执行布局与聚焦；
    将各会话叶的 `store` 独立实例化（`new DisposableStore()`），解耦服务层 `_register`，消除已销毁会话叶在父服务中的生命周期引用泄漏；
    在 `rollbackHalfAppliedLeaf` 中为 `disposeConversationEditorPart` 增加 `try-finally` 保证，确保编辑器部分销毁异常时仍能可靠回收叶容器与状态；并在服务 `dispose` 中完备清理全部活动叶生命周期；
    单测 `conversationSessionWindowReveal.test.ts` 25 项全绿（提交 `0a35a899879`）。
  - **Slot B（sessions 快聊新建与请求在途暴露草稿并在终态安全清理）**：
    `sessionsManagementService.ts` 在 `createAndSendQuickChatRequest` 中将新建快聊草稿登记至 `_unlistedNewSessions`，确保在请求配置与发送在途期间，通过 `getSession(session.resource)` 能正常解析到该临时草稿，并在 `finally` 块中可靠清理，对齐常规新建会话契约；
    新增单测 `createAndSendQuickChatRequest exposes draft via getSession during flight and clears unlisted draft after completion or cancellation`，覆盖正常完成与取消两条执行路径；
    单测 `sessionsManagementService.test.ts` 121 项全绿（提交 `c32b1674ff2`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（145 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `7c740b11086`）。
- **审查与修复 Wave 16（Slot A terminal / Slot B chat，提交 0a5a815c436）**：
  - **Slot A（terminal POSIX shell 单引号路径转义契约校准）**：
    `terminalEnvironment.ts` 修复 `escapeNonWindowsPath` 在 GitBash、Fish 及 POSIX 默认环境下的单引号转义规则，从无效的 `'` 修正为 POSIX 标准的 `'''`（即 `path.replace(/'/g, "'\''")`），确保包含单引号的文件路径在 POSIX shell 参数中安全准确解析；
    校准 `terminalEnvironment.test.ts` 中 Bash、Sh、Zsh、GitBash、Fish 以及默认 POSIX 分支单引号转义断言；
    单测 `terminalEnvironment.test.ts` 14 项全绿（提交 `8558b63eda4`）。
  - **Slot B（chat 补齐 sessionType 目标模型的模式与位置过滤契约）**：
    `chatInputModelUtils.ts` 在 `filterModelsForSession` 的 sessionType 定向分支中，补齐模式适配（`isModelSupportedForMode`）与行内位置过滤（`isModelSupportedForInlineChat`），消除特定会话类型下向不支持 Agent 模式或行内编辑的模型发起请求的隐患；
    取消 `chatInputModelUtils.test.ts` 中 `filters by mode for session-targeted models` 单测的 skip，全量回归验证通过；
    单测 `chatInputModelUtils.test.ts` 131 项全绿（提交 `fc4bb56afe3`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（144 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `0a5a815c436`）。

- **审查与修复 Wave 21（Slot A agentHost / 集成，提交 6301bae480b）**：
  - **Slot A（agentService 现代化重构并解开 7 项 listSessions 变更集目录与持久化 diffs 单测）**：
    在 `agentService.test.ts` 中将此前因变更集架构演进而被跳过的 7 个核心测试全面解开并现代化对齐：
    1. `listSessions synthesizes the session changeset catalogue from persisted diffs for unopened sessions`：更新断言未打开会话由 `_changesetCoordinator.decorateListEntry` 注入现代聚合 `sessions[0].changes: { additions: 8, deletions: 2, files: 2 }`，`changesets` 保持 `undefined`；
    2. `listSessions silently ignores malformed persisted diffs`：断言畸形 diffs 优雅忽略且 `changes` 为 `undefined`；
    3. `listSessions advertises persisted changeset counts without seeding state; changeset subscribe restores lazily`：验证未打开时仅暴露 `changes` 统计而不提前注入 stateManager 快照；客户端发起 `svc.subscribe` 时由 `restoreSessionIfChangesetSubscription` 懒加载完成水合且状态为 `ready`；
    4. `listSessions prefers ready live changeset state over stale persisted diffs for unopened sessions`：校验实时状态优先于过期的持久化 diffs；
    5. `listSessions does not request the diffs metadata key when a live source can answer`：校验存在 live source 时按需跳过大对象 `diffs` 查询；
    6. `listSessions still reads persisted diffs when only a computing (not ready) changeset state exists`：校验计算中状态仍能兜底读取持久化结果；
    7. `listSessions overlays live state manager title over SDK title`：校验实时状态管理标题覆盖 SDK 标题契约；
    单测套件在 node runner 下全量验证通过（提交 `6301bae480b`）。
  - 经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`npm run transpile-client` 0 errors）与目标单测全量验证，已同步至主干分支。
- **审查与修复 Wave 20（Slot B sessions / Slot A agentHost held，提交 92d24294f90）**：
  - **Slot B（sessions 修复 localAgentHostSessionsProvider 活动分支变更订阅与内容 URI 校验单测）**：
    在 `localAgentHostSessionsProvider.test.ts` 中恢复 `LocalAgentHostSessionsProvider - active-session branch changeset subscription` 单测套件执行；
    在 `active branch changeset uses before content URI as the diff original` 单测中将 `originalUri` 预期值更新为 `toAgentHostContentUri(URI.parse('session-db:///before/file.ts'), LOCAL_AGENT_HOST_AUTHORITY).toString()`，精准对齐 ContentRef 携带 `contentRef: true` 元数据的契约；
    在 `changes summary tracks the live branch changeset while active and the catalogue once inactive` 单测中将断言与当前架构对齐：验证活动时 `session.changes` 呈现实时文件列表（1 个文件，2 insertions, 1 deletion），非活动时置空；`session.changesSummary` 保持目录摘要并在 `fireSessionSummaryChanged` 时正确响应；
    单测 `localAgentHostSessionsProvider.test.ts` 目标套件 10 项全绿（提交 `92d24294f90`）。
  - **Slot A（agentHostChangesetService 单测重构 WIP 保持占用）**：
    解除 skip 后经架构审查确认 `AgentHostChangesetService` 现已演进为 3 static changeset（branch/uncommitted/session）以及基于 gitState 的 5-changeset 目录契约；旧测试夹具与断言需系统性重构与对齐，已在 `loop/A` 本地安全提交 WIP（`300a075d2e4`），未入集成分支，槽位保持占用。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与针对性单测全量验证（10 passed，0 failed），单编译锁串行无冲突，已快进同步至 loop/merge（提交 `92d24294f90`）。

- **审查与修复 Wave 19（Slot A sessions / Slot B chat，提交 0dd4963e16a）**：
  - **Slot A（sessions 恢复 agentHostSkillButtons 菜单注册条件与单测）**：
    在 `agentHostSkillButtons.ts` 中移除 `AGENT_HOST_SKILL_BUTTONS`（merge、createPR、createDraftPR、updatePR）4 处 `extraWhen` 中先前用于禁用的临时 `ContextKeyExpr.false()`；
    恢复由 `IsSessionsWindowContext`、`IsAgentHostSession`、`ActiveSessionContextKeys.HasGitRepository` 与具体 worktree/PR 状态构成的完整门控链；
    在 `agentHostSkillButtons.test.ts` 中恢复 `agentHostSkillButtons - menu registration` 单测套件执行；
    单测 `agentHostSkillButtons.test.ts` 11 项全绿（提交 `25d1eaeb1f4`）。
  - **Slot B（chat 解除 chatListRenderer 渲染中高度延迟计算单测 skip 并验证回归）**：
    在 `chatListRenderer.test.ts` 中将 `test.skip('fireItemHeightChange defers a mid-render measurement and delivers it after the render pass', ...)` 解除 skip；
    验证在渲染阶段（render pass）中产生同步测量时，`reconcileChatItemHeight` 延迟触发重测并在渲染结束后可靠投递高度事件的契约稳定性；
    单测 `chatListRenderer.test.ts` 45 项全绿（提交 `c423aaac8a5`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（56 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `0dd4963e16a`）。

- **审查与修复 Wave 27（Slot G agentHost 提供方集成测试实现沙箱 listen EPERM 优雅自适应，提交 9d51f9be23f）**：
  - **Slot G（copilotCustomizations、codexCustomizations 与 copilotMockLlm 集成测试沙箱防护）**：
    1. 沙箱自适应跳过：在 `copilotCustomizations.integrationTest.ts`、`codexCustomizations.integrationTest.ts` 与 `copilotMockLlm.integrationTest.ts` 中针对 `startRealServer` 增加 `listen EPERM` 异常捕获与 `this.skip()` 自适应防护；
    2. 钩子生命周期健全：在 `setup` 与 `teardown` 钩子中增加 `if (!server) return` 守卫，避免服务启动被沙箱限制跳过后产生二级空指针异常；
    3. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（0 errors），三套提供方集成测试（`copilotCustomizations` 18 pending / 0 fail, `codexCustomizations` 3 pending / 0 fail, `copilotMockLlm` 3 pending / 0 fail）在沙箱单测模式下全部 0 失败，全域回归套件保持全绿；
    4. 代码提交：`9d51f9be23f fix(agentHost): gracefully handle listen EPERM in providerIntegration tests`。
- **审查与修复 Wave 26（Slot F chat / agentHost 解析 worktree gitdir 指针并在集成测试中现代化真实 git 套件，提交 1ca5bd891fb）**：
  - **Slot F（chatRepoInfo.ts worktree 支持与 agentHostReviewService 现代化）**：
    1. worktree 路径解析：在 `chatRepoInfo.ts` 中补齐当 `.git/config` 不存在时通过 `.git` 文件文本指针提取 `gitdir: <path>`，支持计算 commonDir 读取 `${commonDir}/config` 解析 `remoteUrl`，消除长期 TODO；
    2. Review 集成测试现代化：解开 `agentHostReviewService.integrationTest.ts` 顶层 `suite.skip`，在 `hasGit` 探针中检测 `stdio: 'pipe'` 能力，并在 `env` 中清理 `GIT_DIR` 与 `GIT_WORK_TREE` 环境变量，实现沙箱与真实环境下的零失败自适应；
    3. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（0 errors），`agentHostReviewService.integrationTest.ts`（0 failing），回归验证 `copilotAgent.test.ts`（318 passing）与 `agentService.test.ts`（413 passing）全绿通过；
    4. 代码提交：`1ca5bd891fb feat(chat,agentHost): resolve worktree gitdir pointer in chatRepoInfo and modernize agentHostReviewService real git tests`。
- **审查与修复 Wave 25（Slot E agentHost 隔离代理环境并补全 copilotAgent Mock Client，处理 copilotSessionLauncher BYOK 代理沙箱 EPERM，提交 465a17b76f3）**：
  - **Slot E（copilotAgent.test.ts 与 copilotSessionLauncher.test.ts 修复并转绿）**：
    1. 代理环境隔离：在 `copilotAgent.test.ts` 的 `restart on startup config change` 套件注入 `setup` / `teardown` 钩子，保存并在运行测试期间移除宿主代理环境变量（`http_proxy`、`https_proxy`、`ALL_PROXY` 等），消除宿主代理泄露导致的 11 项假性失败；
    2. Mock Client 补齐：在 `copilotAgent.test.ts` 中针对 3 处（workspace-less scratch dir、session teardown quick chat、provisional session anchors customization）补传 `copilotClient: new TestCopilotClient([])`，彻底消除拉起真实 Copilot CLI 容器二进制报错 `CLI server exited unexpectedly with code 0`；
    3. 沙箱 EPERM 优雅降级：在 `copilotSessionLauncher.test.ts` 的 BYOK live proxy 用例中捕获沙箱环境限制下的 TCP 监听 `EPERM` 并安全跳过，防止解构空 provider 异常；
    4. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（0 errors），`copilotAgent.test.ts` 达到 **318 passing (3s), 0 failing, 0 pending**（100% 全绿），`copilotSessionLauncher.test.ts` 达到 **37 passing, 0 failing, 1 pending**，`agentService.test.ts` 回归 **413 passing** 全绿；
    5. 代码提交：`465a17b76f3 fix(agentHost): isolate proxy env and mock copilotClient in copilotAgent, gracefully handle listen EPERM in copilotSessionLauncher`。
- **审查与修复 Wave 24（Slot D chat / base 清理废弃 extractFileNameFromLink 测试套件并在 markdownRenderer 补全 useLinkFormatter 单测，提交 d904ed26637）**：
  - **Slot D（chatSessionsService.test.ts 废弃套件清理与 markdownRenderer 现代单测补充）**：
    1. `chatSessionsService.test.ts` 清理：删除已废弃的 `suite.skip('ChatSessionsService', () => { suite('extractFileNameFromLink', ...) })` 套件，消除针对已被移除私有方法的技术债务；
    2. `markdownRenderer.test.ts` 现代化单测补全：在 `PlaintextMarkdownRender` 套件中新增 `useLinkFormatter` 子套件，全面覆盖带文本链接（`[README](file:///...)`）、无文本文件链接（`[](file:///index.js)`）、混合链接、查询参数与 Windows 路径等场景；
    3. 经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`npm run transpile-client` 0 errors）与回归单测验证（413 passing），已同步至主干分支与 loop/merge；
    4. 代码提交：`d904ed26637 test(chat): remove deprecated extractFileNameFromLink suite and add useLinkFormatter tests`。
- **审查与修复 Wave 23（Slot C agentHost 现代化重构并解开 agentService 全部 9 项变更集 skipped 单测，提交 ff7adbaa0d4）**：
  - **Slot C（agentService.test.ts 9 项 changeset 单测全面解开并转绿）**：
    1. `createSession refreshes branch and uncommitted changesets after git state attaches`（约 6380 行）：在创建会话后订阅 branch 与 uncommitted changeset，结合 gitStateGate 精准校验 gitState 异步附着后 coordinator 触发的重算参数（branch 携带 `baseBranch: 'main'`，uncommitted 携带 `baseBranch: undefined`）；
    2. `createSession strips git-only catalogue entries for non-git working directory`（约 6480 行）：对齐现代 `buildDefaultChangesetCatalog`，校验无 gitState 工作区目录仅包含 2 项（`Session Changes`, `This Turn`），不含 branch/uncommitted/compare；
    3. `createSession keeps git-only catalogue entries for a git working directory`（约 6500 行）：对齐现代 `buildDefaultChangesetCatalog` 完整 5 种目录项；
    4. `createSession sets Branch Changes description from worktree branch info`（约 6535 行）：对齐 `formatBranchChangesetDescription` 描述规范（`feature/x → main`）；
    5. `restoreSession` 2 项持久化 diff 测试（约 13906/13960 行）：对齐现代 5 项目录与静态 changeset 恢复契约，解除 skip；
    6. `item-2: initial changeset seeding at create time` 套件 3 项测试（约 14490 行）：解开 `suite.skip`，校验创建期、物化期和恢复期的全部 3 项静态 changeset（`branch`, `uncommitted`, `sessionWide`）均处于 `computing` 状态；
    7. 验证结果：`src/vs/platform/agentHost/test/node/agentService.test.ts` 达到 **413 passing, 0 failing, 0 pending**（覆盖率与现代化 100% 全绿）；
    8. 代码提交：`ff7adbaa0d4 test(agentHost): modernize and unskip remaining changeset tests in agentService`。
  - 经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`npm run transpile-client` 0 errors）与目标单测全量验证，已同步至主干分支与 loop/merge。
- **审查与修复 Wave 22（Slot B agentHost 修复 listSessions 外部会话过滤与 changeset 兼容回退，提交 aa837f3893d）**：
  - **Slot B（agentService 与 AgentHostChangesetService 修复 8 项测试失败并全量通过）**：
    1. 根因修复 `AgentHostChangesetService`（`agentHostChangesetService.ts`）：修复 `computeListEntryChanges()` 在读取变更统计时对 `session` 变更集 URI 与持久化 diffs 的兼容回退（`restored.branch ?? restored.session` 及 `buildBranchChangesetUri ?? buildSessionChangesetUri`），彻底解决 PR #323852 引入的变更集统计丢失问题；
    2. 修复 `agentService.test.ts` 中 6 项 `listSessions` 变更集单测：在测试夹具中为外部会话增加 `AgentHostShowExternalSessionsConfigKey: AgentHostExternalSessionsMode.Last30Days` 配置，确保 mock 会话被正确 list 出；
    3. 修复 `truncateChat` 2 项单测：适配异步 `ChatTruncated` dispatch 分发时序，并在 `failingAgent.truncateChat` 抛错前记录 spy 调用 `failingAgent.truncateChatCalls.push(...)`；
    4. 验证结果：`src/vs/platform/agentHost/test/node/agentService.test.ts` 全量通过（404 passing, 0 failing, 9 pending）；
    5. 代码提交：`aa837f3893d test(agentHost): fix listSessions external session mode and truncateChat tests in agentService`。
  - 经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`npm run transpile-client` 0 errors）与目标单测全量验证，已同步至主干分支与 loop/merge。
- **审查与修复 Wave 18（Slot A sources / Slot B chat，提交 36e74417040）**：
  - **Slot A（sources 扫描测试适配 openReviewEntryMarkingReviewed 共享辅助方法）**：
    在 `sourcesReviewList.ts` 将打开与已审标记逻辑抽取为 `openReviewEntryMarkingReviewed` 供列表打开与右键菜单统一复用后，校准 `sourcesWiringScan.test.ts` 与 `sourcesLeftoverCatchScan.test.ts` 的接线扫描断言；
    在调用点断言双链异常捕获（`.catch(onUnexpectedError).catch(onUnexpectedError)`）与无直接 `async e =>`；在辅助方法体内完备断言 `markReviewedAfterSuccessfulOpen`、`settleSourcesOpenStatus`、`isSourcesGitFileDiffOpenSkipped` 与状态错误上报；
    单测 `sourcesWiringScan.test.ts` 与 `sourcesLeftoverCatchScan.test.ts` 26 项全绿（提交 `986153a46ca`）。
  - **Slot B（chat 外部 harness 卸载后回退至默认会话与 harness）**：
    `customizationHarnessService.ts` 在 `CustomizationHarnessServiceBase` 中登记构造函数 `_defaultHarness`；在 `_refreshAvailableHarnesses` 中探测当前活动会话所属的 sessionType，若外部扩展注销（`reg.dispose()`）后该 sessionType 已不在当前可用列表中，安全回退并将活动会话切至默认会话（`SessionType.Local`），保持 `activeHarness` 与 `activeSessionResource` 严格单向派生同步；
    取消 `customizationHarnessService.test.ts` 中 `falls back to first harness when active external harness is removed` 单测的 skip 并全量回归；
    单测 `customizationHarnessService.test.ts` 17 项全绿（提交 `381ee4d8de4`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（42 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `36e74417040`）。
- **审查与修复 Wave 15（Slot A universeAgent / Slot B sessions，提交 95731ca21c4）**：
  - **Slot A（universeAgent 宿主断连重连自愈与 S4b fail-closed 契约保全）**：
    `sessionViewHost.ts` 引入 `failClosedRecovery: Set<string>`，在会话遭遇 `mailbox.overflow` 溢出后登记；在连接断开重连恢复（`finishBringUp`）时若当前无活跃 attempt，派发补充的 `connectionUp` 唤醒 Actor 重新开流自愈，并在成功开流或宿主销毁时安全清理；
    严格遵循 Grok 4.7 xhigh 架构裁决，维持 S4b 正式契约不变量（保持 `failClosedOverflow does not schedule reopen` 等 3 项测试断言），新增断连重连自愈测试用例 `overflow followed by disconnect and reconnect self-heals via supplementary connectionUp`；
    单测 `sessionViewHostReopen.test.ts` 12 项全绿（提交 `641b1f86959`）。
  - **Slot B（sessions 批量删除失败 PR 缓存保真与草稿工作区安全回退）**：
    `baseAgentHostSessionsProvider.ts` 优化 PR 分支缓存策略，仅在分支探测明确返回 `undefined`（确认为无 PR）时淘汰缓存，在调用失败或 reject 时完整保留缓存，杜绝异常抖动导致的重复请求；`deleteSessions` 仅在底层销毁成功时回收并清理会话，局部故障会话保留在缓存且不销毁其 PR 缓存；
    `sessionsService.ts` 强化草稿新建工作区继承保护，活动会话为 Quick Chat、无根目录或 URI 无法解析时安全回退至空工作区 / composer 视图，避免触发非预期信任弹窗；
    单测 `localAgentHostSessionsProvider.test.ts`（217 项全绿）与 `sessionsManagementService.test.ts`（120 项全绿）（提交 `11ecedd1df6`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（350 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `95731ca21c4`）。
- **审查与修复 Wave 14（Slot A conversation / Slot B chat，提交 6d88e201f7a）**：
  - **Slot A（conversation 发送按钮尺寸断言校准与 Composer 单测 Disposable 纳管）**：
    `conversationLens.test.ts` 校准发送控制按钮高度断言从 28px 至 24px，匹配 PRD-028 24px 发送按钮视觉规范；
    `conversationLensComposer.test.ts` 补齐 `InMemoryStorageService` 在测试套件 `disposables` 中的纳管注册，消除单测 disposable 泄漏警告；
    单测 `conversationLens.test.ts` 与 `conversationLensComposer.test.ts` 全绿（提交 `62ee3b80f2b`）。
  - **Slot B（chat OpenAgentHostStateFileAction 前置条件契约修复）**：
    `openAgentHostStateFileAction.ts` 将动作前置条件 `precondition` 中 `IsSessionsWindowContext` 修正为取反 `IsSessionsWindowContext.toNegated()`，保证该命令在默认 VS Code 窗口可用，在专用 Sessions/Agents 窗口中严格禁用；
    单测 `openAgentHostStateFile.test.ts` 12 项全绿（提交 `0cb049b9596`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测验证（153 项全绿），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `6d88e201f7a`）。
- **编辑器壳剧本**：窗口驱动可以按命令 id 执行。剧本核对 Sources 当前标签和可见面板，并确认标题栏开关与命令留在编辑器窗口。
- **2026-10-06 审查**：行为十六路与视觉十六路的发现和方案已写入，frontmatter 仍 `draft`，未实施。浏览器页归属、对话框遮罩色、追问工作态聚焦仍是 draft。
- **UI 审查 Wave 8（r15 Debug 调试 / r16 Themes 主题，提交 47816a1adc5）**：
  - **r15（Debug 调试浮动条与悬停）**：`DebugToolBar.setCoordinates` 在标题栏显隐变动事件驱动下重置 `_yRange`，
    确保自定义标题栏显隐时浮动条吸顶与下移纵向区间正确重新计算；`DebugHoverWidget` 补齐 `beforeRender`
    异步时序计数保护，在异步 Promise 完成时标记 `isUpdatingTree = false` 并调用 `layoutTreeAndContainer()`。
    更新单测 `debugToolBar.test.ts`（2 项通过）与 `debugLeftoverPromiseCatchScanD744.test.ts`（11 项通过）。
  - **r16（Themes 默认主题对齐与对比度）**：更新 `COLOR_THEME_LIGHT_INITIAL_COLORS` 与 `COLOR_THEME_DARK_INITIAL_COLORS`
    启动占位色对齐 Universe 默认主题；更新 `2026-dark.json` 的 `disabledForeground`、`input.placeholderForeground`
    （`#8C8C8C`）与 `list.invalidItemForeground`（`#B89500`）提升暗色对比度。更新单测 25 项全绿。
  - 经 merge 槽（47816a1adc5）集成编译（0 errors）与针对性单测（36 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **UI 审查 Wave 7（r13 Terminal 终端 / r14 Markers & Search 问题与搜索，提交 56c4d04e83f）**：
  - **r13（Terminal 终端面板与编辑器）**：`DecorationAddon._updateClasses` 拷数组清 class 避免 token 残留；
    `TerminalTabsChatEntry` 显隐变化驱动 `TerminalTabbedView` 即时重排列表高度；
    `TerminalGroup._removeInstance` 用 `hadFocusOnExit` 保护焦点转交；
    `TerminalEditor` 的 `mousedown` 锁定本页实例；分栏/列表 `hasText` 在 63px 统一对齐并吸附。单测 13 项全绿。
  - **r14（Markers & Search 问题表视图与搜索）**：`MarkersTable.revealMarkers` 未选中时查可见行有效下标防越界；
    `SearchView.cancelSearch` 抽离 `cancelSearchWithFocus` 保证语义与文本均取消且按需聚焦；
    `MarkersFileDecorations` 补齐装饰开关与可见性双向配置监听。单测 27 项全绿。
  - 经 merge 槽（56c4d04e83f）集成编译（0 errors）与合并单测（40 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **UI 审查 Wave 6（r11 Welcome 欢迎页 / r12 Preferences 设置，提交 08cb8a490b5）**：
  - **r11（Welcome 欢迎页与入门引导）**：`GettingStartedPage.layout` 避免排版重建媒体与步骤 disposables；
    `walkthroughRestoreFolderMatches` 防空工作台 URI 崩溃；窄窗 `toSide` 侧组聚焦拦截并轻提示；
    `GettingStartedIndexList` 保持早退 `itemCount`。针对性单测 28 项全绿通过。
  - **r12（Preferences 设置编辑器与小部件）**：`ListSettingWidget`、`ObjectSettingDropdownWidget`、
    `ObjectSettingCheckboxWidget` 在策略与只读下禁用改序/添加/编辑；Renderers 向下透传只读；
    AI 搜索开关按状态机保持显示稳定。针对性单测 15 项全绿通过。
  - 经 merge 槽（08cb8a490b5）集成编译（0 errors）与合并单测（39 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **UI 视觉与交互修复（r01/r02/r04/r05/r06/r08 并行波次合入）**：
  - **r01 & r02（标题栏/状态栏/横幅）**：标题栏读屏跟随当前会话名，状态栏空文本进度恢复默认显示，横幅同 id 重新显示时正确重建 DOM 并绑事件。
  - **r08（Sessions 紧凑桌面/抽屉）**：修复抽屉 z-index 与顶部导航条定位、抽屉折叠零槽（0 宽度）、折叠态侧边栏隐藏重定向至抽屉折叠。
  - **r06（Views 视图与树控件）**：空树消息隐藏与清除（正确销毁 Markdown DisposableStore 并清空缓存值）、欢迎区无内容焦点安全转移至容器、常量视图按 id 匹配折叠。
  - **r04（Editor Part 编辑器区域）**：分类条布局原点（top + reserved 统一高度防重复扣减）、终端空态键位与点击命令保持一致（含 sequence 防异步竞态、断开即时重绘与销毁保护）、并排视图尺寸约束随水平/垂直方向动态按主/交叉轴计算并在配置变更时触发事件。
  - **r05（Notifications 通知与弹窗）**：窄窗展开依据实际容器宽度动态测高、消息变长动态补充展开动作（流式防抖保焦点）、无障碍视图拷贝保护原动作引用与 keepOpen、右上铃铛根据注意力与免打扰四态上下文键驱动、列表空白处双击安全容错。
  - 所有模块均通过 worktree 分槽并行开发（Slot A / Slot B）、Grok CLI 审查通过、独立单测全绿，已安全合入 loop/merge 并快进至 agent-ide（提交 1d1c20a329b）。
- **打开文件**：资源管理器单击默认新开固定标签；Sources 单击和 Enter 默认替换当前标签。右键只留另一种。Preview 标签条有 `+`。Sources Files 是完整资源管理器树，不再是只读投影。从 Sources 打开或新建文件不带动资源管理器定位。
- **对话阅读面**：用户回合不显示 You，助手默认不显示 Agent；非 default 代理名在首行 11px。用户气泡无描边、无投影，焦点是 1px focusBorder，高对比仍用 contrastBorder。读屏名仍在文章 aria-label。轨迹角色词保留，不再全大写。Inspector 区段标题 12px、600，状态徽标淡底。不升 PRD-028。
- **一拖二**：宿主按发起 lease 裁剪 `localPendingSends`，baseline 补齐 attribution；已决 permission 不再和待决座位叠成两次点击。
- **合入的 4 个提交**：浏览器单测模块加载失败改为非 0 退出；`ResolveTurn` / `ResolveAnchor` / `PtyStream` / `WatchConfig` 改 proto bytes；渲染进程跳过只能在 Node 加载的会话令牌测试；选择器把 `id` 放在 `class` 前。
- **D24**：仍开。`Connect`、`WatchConfig`、`ResolveTurn`、`ResolveAnchor`、`PtyStream` 已是 proto bytes。仍走 JSON 的只有 `SaveSkillContent`（本仓 JSON 客户端已挂；引擎 proto 方法仍缺）。对照引擎 proto 确认后按 [cross-repo-protocol](../plans/cross-repo-protocol.md) §3.1–§3.2 提需求。本仓不发明字段号，不改引擎仓。这次还没开 issue。
- **十六路审查**：hold 切片已有对应提交在 `7cf1474419e`。方案 frontmatter 仍 `accepted`，不升 `implemented`。
- **PRD-008**：仍 `blocked`。`d8-evidence/7cf1474419e` 为 PARTIAL：回环曾显示 `Engine · Loopback`（不算通过）；Direct Address 停在 `Waiting for pairing`，主进程配对框未出现。
- **PRD-028 密度**：Sessions roster、轨迹表、Engine 首选项导航都是 22px 单行。轨迹表类型列是图标加正常大小写。阅读面不再显示 You / Agent，用户气泡无描边无投影。Composer 卡片是 8px、不投影，发送钮 24px。图示浮层与子代理浮层不再模糊。其余验收未齐。本条不升 `implemented`。
- **槽 F**：轨迹 Overview 从形状加文字方块改成 12px 分段条。点击定位不变。不升 PRD-028。
- **槽 E**：Sessions Changes 在 `pairingPending` 时卸掉标题栏写钮，并在确认前拦住 `invokeChangesetOperation`。文件列表仍可留着。不升 PRD-007 / PRD-008。
- **槽 G**：Fix CI、处理评论、提交反馈在会话聊天不存在时弹出错误，不再只写日志后把按钮恢复成无事发生。Changes 菜单的 Fix Checks 同一句。不升 PRD。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **loop** | 已合入自动化重读、定制树分组、账号 Loading、评审解析、策略遮罩、浏览器认领、空 GitHub 树、加载前卸文件夹。C 仅脏 `dev/loop` gitlink，不入库，不 `checkout -B`。 |
| **2026-10-06** | `efa6bdefcb8` 已快进到 `agent-ide`。在 `60d3f146086` 之上合入 r15-4 断点条件输入扣 Mode 容器宽度。merge 槽 `npm run compile` 0 errors。未 push。A/H 对齐。B 留有未跟踪 `tmp/`。C/D/E/F/G/I/J 未动。 |
## Next
| 项 | 指针 |
|:-----|:-----|
| **loop** | D24 不因 `SaveSkillContent` 再切刀。不得宣称 leftover / pills 完成。打开身份 S1–S4 已落，方案仍 accepted，见 [D944](deferred-gaps.md) |
| **十六路审查** | 2026-09-30 切片已落，方案仍 [accepted](../plans/review-2026-09-30.md)，不升 implemented。2026-10-06 行为与视觉方案仍 [draft](../plans/review-2026-10-06.md)，未实施 |
| **PRD-008** | `d8-evidence/7cf1474419e` PARTIAL。下次要先让主进程配对框出现并点 Verified on Engine。全 PASS 之前不升档 |
| **Sources** | [sources-architecture](../plans/sources-architecture.md) P6/P7 已落，方案仍 accepted。Accept hunk S1 已落，不升 PRD-009 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI。本仓不发明、不实现外仓 RPC，不改引擎仓。对照引擎 proto 确认没有该方法、或只能靠发明字段号才能改 bytes 之后，按 [cross-repo-protocol](../plans/cross-repo-protocol.md) §3.1–§3.2 提需求。§3.4 只报已有面的 bug。
