# 过程索引

进度汇总在 [status.md](progress/status.md)。单项工作的步骤在对应计划。新建计划要有状态行，写法见 [formats.md](../scripts/wiki/formats.md)。已结束的过程用下面的命令进入 [archive/](../archive/INDEX.md)，不手工搬：

```bash
python3 scripts/wiki/wiki.py archive <路径> --root .
python3 scripts/wiki/wiki.py archive <路径> --root . --apply --expect <校验值>
```

## 什么时候读

| 什么时候 | 读 |
|:---------|:---|
| 接续已有任务，看当前做到哪 | [progress/status.md](progress/status.md) 的当前段 |
| 某项工作的步骤 | [plans/INDEX.md](plans/INDEX.md) |
| 路线图与勾选 | [roadmap/INDEX.md](roadmap/INDEX.md) |
| 存量架构决策 | [decisions/INDEX.md](decisions/INDEX.md) |
| 并行看板 | [parallel/INDEX.md](parallel/INDEX.md) |
| 本目录怎么用 | [README.md](README.md) |
| 新归档 | [archive/INDEX.md](../archive/INDEX.md) |
| 历史归档 | [dev/archive/INDEX.md](archive/INDEX.md) |

`dev/archive/` 只留历史。新归档走 wiki archive，进仓库根的 `archive/`。登记表（计划索引、延期账）按编号或关键词搜索，不整篇读。
