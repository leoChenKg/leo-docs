---
title: Files 操作与目录遍历：意图、链接、属性和原子移动
description: 选择创建与追加选项、目录遍历和链接策略，并处理属性差异、竞争和原子移动边界。
type: doc
tags:
  - Java
  - NIO.2
  - 文件系统
order: 20
date: 2026-09-24
---

# Files 操作与目录遍历：意图、链接、属性和原子移动

本文解决“要执行什么操作、遍历哪些对象、失败怎样暴露”。路径计算前提见[Path 与文件系统](./paths.md)，可运行的整体演示见[Nio2FilesLab](./lab.md)。

下面的 Java 11+ 示例都是方法体片段，外层方法需处理或声明 `IOException`。可在源文件顶部导入 `java.nio.file.*`、`java.nio.charset.StandardCharsets` 和 `java.nio.file.attribute.BasicFileAttributes`；各片段的 `path`、`dir`、`target` 为按当前任务选定的 `Path`，文本内容为 `String`。

## Files 的调用要表达操作意图

### 创建、覆盖与追加是三种意图

| 意图 | 典型调用 | 需要预先想清楚的事 |
| --- | --- | --- |
| 创建父目录 | `Files.createDirectories(parent)` | 失败前可能已创建部分父目录 |
| 必须新建 | `CREATE_NEW` | 已存在应当报错，而非覆盖 |
| 完整覆盖内容 | `Files.writeString(path, text)` | 默认可能截断已有文件 |
| 追加内容 | `CREATE, APPEND` | 允许新建；未传 `CREATE` 时文件必须已存在 |
| 删除存在项 | `Files.deleteIfExists(path)` | 只忽略不存在，权限不足等仍可能失败 |

`CREATE_NEW` 把“检查不存在”和“创建”合并为原子操作，比先 `exists` 再 `create` 更适合处理竞争。`APPEND` 的“定位末尾并写入”是否整体原子，则由系统决定，不能据此推出多进程日志记录绝不会交错。[StandardOpenOption API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/StandardOpenOption.html)

下面的对照假定父目录已经存在：第一次调用要求 `path` 尚不存在；它成功后，第二次调用会把 `text` 再追加一次。

```java
// 需要全新文件：冲突应由异常报告。
Files.writeString(path, text, StandardOpenOption.CREATE_NEW);

// 接受已有文件：追加，不默认截断。
Files.writeString(path, text,
        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
```

读取全部内容只适合大小受控的数据；按块与按行读取见[流与编码](../../files/streams/)，大型日志的内存与并发策略见[工程场景](../../files/practice.md)。

### 布尔检查不能代替实际操作

`Files.exists` 返回 false 可能表示不存在，也可能表示无法判定；`notExists` 不是简单取反。即使检查返回 true，文件也可能在下一次操作之前被删除或替换。

因此，业务代码应直接尝试目标操作，并根据 `NoSuchFileException`、`FileAlreadyExistsException`、`AccessDeniedException` 等具体失败处理。Provider 不一定对每个失败都提供最具体的异常，最终仍需正确处理 `IOException`。[Files API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html)

## 遍历目录时，资源关闭与错误策略同样重要

### 单层目录与递归目录的选择

| API | 返回内容 | 适合的任务 |
| --- | --- | --- |
| `newDirectoryStream` | 单层目录项迭代器 | 按 glob 筛选，直接迭代 |
| `Files.list` | 单层 `Stream<Path>` | 组合过滤、映射、排序 |
| `Files.walk` | 深度优先的递归路径流 | 简单树状搜索 |
| `Files.find` | 结合路径和已读取属性筛选 | 避免为同一筛选重复查询属性 |
| `Files.walkFileTree` | 访问者回调 | 跳过目录、复制树、删除树、定制错误策略 |

`DirectoryStream` 是 `Iterable`，但只支持获取一次迭代器，并需要关闭。它的迭代不是冻结的目录快照，执行期间的变化是否可见没有统一保证。[DirectoryStream API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/DirectoryStream.html)

```java
// 方法体片段：只查当前目录中的 .java 文件。
try (DirectoryStream<Path> entries = Files.newDirectoryStream(dir, "*.java")) {
    for (Path entry : entries) {
        System.out.println(entry.getFileName());
    }
}
```

`Files.list`、`walk`、`find` 返回的 Stream 必须关闭，终止操作不等于关闭；`walkFileTree` 则由遍历器管理打开的目录。通用关闭规则及 `Files.lines` 见[资源管理](../../files/streams/resources.md)。[Files 资源说明](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html#walk(java.nio.file.Path,int,java.nio.file.FileVisitOption...))

另一个常见排错点是异常发生时机：创建流时可能直接抛 `IOException`；惰性遍历过程中才发生的 I/O 失败，可能从流操作中以 `UncheckedIOException` 抛出。只在创建流的那一行附近处理异常，不能覆盖后续消费过程。

### FileVisitor 是目录遍历的状态机

访问者的四个入口与目录结构直接对应：

| 回调 | 发生时机 | 典型行为 |
| --- | --- | --- |
| `preVisitDirectory` | 访问目录内部之前 | 创建目标目录、返回 `SKIP_SUBTREE` |
| `visitFile` | 访问文件项时 | 处理内容、累计统计、复制文件 |
| `visitFileFailed` | 无法读取属性或打开目录等 | 记录并继续，或抛出错误终止 |
| `postVisitDirectory` | 子项处理完毕或迭代失败后 | 删除空目录、检查 `exc` |

创建目录需要先于子项，删除目录需要晚于子项。这就是[文件实验](./lab.md)中清理动作放在 `postVisitDirectory` 的原因。若忽略它的 `exc`，可能把中途失败的遍历误当作完整处理。[FileVisitor API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/FileVisitor.html)

`SimpleFileVisitor` 省去四个方法都要实现的负担，但其默认错误处理是重新抛出异常。[文件实验](./lab.md)因此采用遇错即停；扫描工具如需“跳过坏文件”，应明确覆写 `visitFileFailed`，同时记录遗漏，而不是静默吞错。[SimpleFileVisitor API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/SimpleFileVisitor.html)

默认遍历不跟随符号链接。显式启用 `FOLLOW_LINKS` 后，要考虑遍历范围扩大和循环；检测到祖先目录循环时会向 `visitFileFailed` 传入 `FileSystemLoopException`。需要这类能力时可以对照 [Oracle 文件树遍历教程](https://docs.oracle.com/javase/tutorial/essential/io/walk.html)。

## 符号链接的默认行为要逐项确认

链接是一个独立的目录项；链接目标可能是文件、目录，也可能已经不存在。不同操作针对的对象并不相同。

| 操作 | 通常针对什么 |
| --- | --- |
| `readAttributes(path, BasicFileAttributes.class)` | 默认读取最终目标；传 `NOFOLLOW_LINKS` 可读取链接自身 |
| `walkFileTree` / `walk` | 默认不沿链接进入目标目录 |
| `Files.copy(link, target)` | 默认复制链接目标；指定 `NOFOLLOW_LINKS` 则复制链接 |
| `Files.move(link, target)` | 移动链接本身 |
| `Files.delete(link)` | 删除链接本身 |

复制目录只会创建对应的空目录，不会自动递归复制子项；复制整棵树需要明确遍历策略。[Oracle 复制教程](https://docs.oracle.com/javase/tutorial/essential/io/copy.html)、[移动教程](https://docs.oracle.com/javase/tutorial/essential/io/move.html)

这里的工程问题是“操作范围”。例如，备份工具是否应该展开链接目标，清理工具是否允许走出起始目录，都应该先定义，再选项；不能仅因为希望“遍历得更完整”就加入 `FOLLOW_LINKS`。

还要区分“遍历是否进入链接目录”和“后续判断是否解析链接”：`Files.walk(root)` 默认不跟随链接，但其后 `.filter(Files::isRegularFile)` 中的 `isRegularFile` 默认会跟随链接。如果只要真正的普通文件项，应显式传 `NOFOLLOW_LINKS`，或使用 `Files.find` 已提供的属性进行判断。

## 文件属性是带平台能力的视图

`BasicFileAttributes` 提供类型、大小、时间等基础属性；文件大小是字节大小，不一定等于占用磁盘空间；创建时间在不支持的文件系统上可能使用替代值。`fileKey()` 可能为 null，也不适合作为跨删除重建、跨环境永久稳定的业务 ID。[BasicFileAttributes API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/attribute/BasicFileAttributes.html)

```java
// 方法体片段：明确读取链接自身的属性。
BasicFileAttributes attrs = Files.readAttributes(
        path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
System.out.println("链接 = " + attrs.isSymbolicLink());
System.out.println("字节数 = " + attrs.size());
```

POSIX 权限、DOS 属性、ACL 属于不同视图，不能把某一平台的权限模型推广到所有 Provider。设置 POSIX 权限前，应先检查目标文件存储是否支持相应视图；创建时请求的权限还可能受 umask 等因素影响。[PosixFileAttributeView API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/attribute/PosixFileAttributeView.html)

## ATOMIC_MOVE 解决可见性切换，不承诺一切持久化

发布配置或索引时，常见思路是先写临时文件，再将其移动到正式路径。这样可以避免读者在写入过程中直接看到目标文件的半成品。

`Files.move(source, target, ATOMIC_MOVE)` 请求文件系统原子移动；不支持时抛出 `AtomicMoveNotSupportedException`。跨文件存储或跨 Provider 常常无法做到。指定该选项时，其他移动选项被忽略；目标已存在时究竟替换还是失败，由实现决定，不能仅加 `REPLACE_EXISTING` 就宣称所有系统都支持原子替换。[Files.move 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html#move(java.nio.file.Path,java.nio.file.Path,java.nio.file.CopyOption...))

下面是方法体片段，假定 `target` 是某个预先确定的目标文件路径，其父目录已存在且可写，`newContent` 是要发布的完整文本。临时文件放在目标父目录，以避免无意中跨越文件存储；这仍不保证 Provider 一定支持原子移动。

```java
Path parent = target.toAbsolutePath().getParent();
Path temporary = Files.createTempFile(parent, ".pending-", ".tmp");
try {
    Files.writeString(temporary, newContent, StandardCharsets.UTF_8);
    Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE);
} finally {
    Files.deleteIfExists(temporary);
}
```

这里有三项需要由业务决定：目标已存在时是否接受 Provider 的替换行为、不支持原子移动时是否允许降级、失败后临时文件是否保留以便重试。示例选择清理临时文件；要求严格原子性的流程不应偷偷回退到普通移动。

单独使用 `REPLACE_EXISTING` 只表达“允许替换目标”，不表达原子性。普通移动若中途抛出 `IOException`，不能假定源和目标已自动恢复原状；恢复逻辑需要重新核实文件状态。

原子性与崩溃后的持久性是两个需求：前者讨论其他访问者看到何种切换，后者讨论断电后数据和目录元数据是否仍存在。上述移动示例没有给出跨平台的断电持久化保证；需要此保证时，还要研究目标文件系统、写入刷新及目录元数据持久化协议。

文件锁不把多步文件操作变成事务，也不代替原子移动或路径安全校验。JVM 与进程协作的具体边界见[FileChannel 文件锁](../basics/file-channel.md)。

## 用实验验证操作顺序

运行[Nio2FilesLab](./lab.md)，观察“先创建目录再处理子项、先删除子项再删除目录”的顺序。需要观察目录变化时，再读[WatchService](./watch.md)；完成后用[文件系统问答](../interview/files.md)检查边界。
