---
title: 文件操作面试题 18–25：路径、目录与文件系统
description: 通过 8 道问答辨析路径身份、创建与删除、复制移动、目录遍历和文件属性的保证与限制。
type: reference
tags:
  - Java
  - 文件操作
  - 面试
  - I/O
order: 20
date: 2026-09-24
---

# 文件操作面试题 18–25：路径、目录与文件系统

本篇重点是文件系统操作的保证与失败边界。回答时说明并发修改、符号链接和平台差异会怎样影响结果。

原理回顾：[File 路径模型](../file/paths.md)、[File 常用操作与失败处理](../file/operations.md)、[NIO.2 文件系统](../../nio/filesystem/)。

## 路径解析、文件系统与并发

### 18. 相对路径、绝对路径、normalize 和 toRealPath 有什么区别？

**参考答案：** 相对路径依赖工作目录等解析上下文；绝对路径包含完整定位所需信息，却不保证存在。`normalize()` 只整理路径名称，不访问文件系统；`toRealPath()` 要查询实际存在的路径，默认解析符号链接。遇到链接时，消除 `..` 可能改变路径实际指向，不能把纯字符串整理当作真实身份确认。[Path.normalize 与 toRealPath](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Path.html)

**易错点：** 工作目录通常不是源码目录，也不是 JAR 所在目录。`base.resolve(absoluteChild)` 返回绝对子路径；不能据此推断旧 `File(parent, child)` 的平台相关规则完全相同。

### 19. 先 exists 再 create/delete 为什么仍然可能失败？

**参考答案：** 检查与使用之间，其他线程或进程可以改变文件系统，这是 TOCTOU，即检查时间与使用时间之间的竞态。检查结果只能辅助展示，不能代替实际操作的异常处理。要求“不存在才创建”时应直接用 `CREATE_NEW`；删除应直接尝试并按业务需要选择 `delete` 或 `deleteIfExists`。[文件检查的竞态说明](https://docs.oracle.com/javase/tutorial/essential/io/check.html)

**追问：!Files.exists(path) 是否等于 Files.notExists(path)？** 不等价；无法确定状态时，两者可能都返回 `false`。也不能用一次 `isReadable` 检查来保证下一次打开成功。

### 20. mkdir、mkdirs、createDirectory、createDirectories 怎么选？

**参考答案：** `mkdir`、`createDirectory` 创建一级目录，父目录需要满足要求；`mkdirs`、`createDirectories` 可补齐缺失父目录。旧 `File` 方法以布尔值表达结果，NIO.2 方法通常通过异常说明失败。`mkdirs()` 返回 `false` 可能只是目录已存在；`createDirectories` 在目录已存在时通常可直接返回，但同名普通文件是错误。[创建目录教程](https://docs.oracle.com/javase/tutorial/essential/io/dirs.html)

**易错点：** 创建多级目录不是整棵树的事务，失败时可能已经创建了一部分。清理时也不能顺手删除其他业务共享的祖先目录。

### 21. 两个路径 equals，就一定是同一文件吗？符号链接和硬链接有何区别？

**参考答案：** 路径相等与文件系统对象身份是不同层次；相等的路径可以指向尚不存在的位置，不同路径可能因硬链接、符号链接等指向同一对象。符号链接保存另一个路径，目标不存在时可以成为悬空链接；硬链接是同一文件对象的另一个目录条目，受文件系统支持等限制。需要比较现有文件身份时可使用 `Files.isSameFile`，并处理 I/O 失败；它对相等 Path 可直接返回 true，也不能单独当存在性检查。[路径身份检查](https://docs.oracle.com/javase/tutorial/essential/io/check.html)、[链接教程](https://docs.oracle.com/javase/tutorial/essential/io/links.html)

**追问：NOFOLLOW_LINKS 是一个全局开关吗？** 不是，应逐个确认具体方法是否支持及如何处理链接；遍历选项 `FOLLOW_LINKS` 又是另一套参数。

### 22. Files.copy 能复制整个目录吗？复制失败会自动回滚吗？

**参考答案：** 复制目录本身不会递归复制子项；完整目录复制要遍历树并逐项处理。文件复制也不是通用事务，失败后可能留下不完整目标。目标已存在时默认失败，允许替换需明确选项；属性复制也只能依赖双方文件系统支持的范围。[复制文件与目录教程](https://docs.oracle.com/javase/tutorial/essential/io/copy.html)

**追问：复制符号链接时会复制谁？** 默认复制目标内容；`NOFOLLOW_LINKS` 请求复制链接本身。具体平台是否支持创建对应链接也要处理。

### 23. renameTo、Files.move 和 ATOMIC_MOVE 分别有什么保证？

**参考答案：** `File.renameTo` 平台差异较多且失败信息少；`Files.move` 支持选项并报告异常。`ATOMIC_MOVE` 请求原子的文件系统移动，不支持时抛 `AtomicMoveNotSupportedException`，例如跨文件存储移动可能不满足条件。指定 `ATOMIC_MOVE` 时其他选项被忽略；目标已存在时是替换还是失败取决于实现，不能以同时传入 `REPLACE_EXISTING` 推导出跨平台保证。[Files.move 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html#move(java.nio.file.Path,java.nio.file.Path,java.nio.file.CopyOption...))

**易错点：** 原子移动保证观察者不会看到中间移动状态，不等于断电持久性。如果业务要求严格原子性，不支持时不能悄悄改成普通移动后仍宣称原子。

### 24. 删除非空目录、遍历链接目录时，主要风险是什么？

**参考答案：** 删除树需要先删子项再删父目录，可用 `walkFileTree` 的 `visitFile` 与 `postVisitDirectory` 表达后序删除。遍历默认不跟随符号链接；启用跟随后，要考虑循环、范围越界和失败策略。目录随时可能变化，遍历结果也不是自动获得的稳定快照。[文件树遍历教程](https://docs.oracle.com/javase/tutorial/essential/io/walk.html)

**追问：walk().sorted(reverseOrder()).forEach(delete) 为什么不是所有场景的首选？** 排序会积累元素，异常控制不如 visitor 清楚；大目录还会增加内存压力。业务应先明确允许删除的根目录，再选择实现。

### 25. 文件大小、修改时间和权限可以当作绝对可靠的业务依据吗？

**参考答案：** 元数据有平台差异，也会随并发修改变化。文件大小是字节数，不是字符数；目录大小不能直接理解为整棵目录树内容总量。一次 `readAttributes` 可集中获取属性，但不能据此宣称得到应用所需的事务快照。POSIX 权限、DOS 属性、ACL 等视图还取决于文件系统支持。[文件属性教程](https://docs.oracle.com/javase/tutorial/essential/io/fileAttr.html)

**易错点：** 时间戳和大小相同不足以证明内容相同；完整性校验要结合内容比较或明确用途的摘要，并注意校验时文件是否仍在变化。

继续练习：[第 26–34 题：NIO 与版本边界](./nio.md)；返回[40 题入口](./)。
