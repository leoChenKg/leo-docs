---
title: NIO 面试题 24–36：文件通道与文件系统
description: 区分位置与性能机制，检查路径、目录资源、链接、原子移动和监听边界。
type: reference
tags:
  - Java
  - NIO
  - NIO.2
  - 面试
order: 30
date: 2026-09-24
---

# NIO 面试题 24–36：文件通道与文件系统

本组先回答文件传输与优化，再回答 NIO.2 文件系统。原理见[文件通道](../basics/file-channel.md)、[性能边界](../basics/performance.md)、[文件系统操作](../filesystem/operations.md)与[目录监听](../filesystem/watch.md)；统一安排见[42 题入口](./)。

## 文件通道与性能：第 24–29 题

### 24. FileChannel 的 position 与 Buffer 的 position 有何不同？

前者是文件偏移，后者是当前内存块游标。`read(dst, offset)` 不改变通道的共享文件位置，但会推进 dst.position。跨线程的 `position(x); read(b)` 是两个调用，不能当作原子事务；并行分块优先显式偏移与独立 Buffer。[FileChannel API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileChannel.html)

### 25. 分散读、聚集写有什么价值？

分散读把字节依次放进多个 Buffer；聚集写按顺序发送多个 Buffer，适合头部和正文分开保存，减少先拼成大数组的需求。仍然可能部分完成，也不会替你解码长度字段或识别消息边界。[ScatteringByteChannel](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/ScatteringByteChannel.html)、[GatheringByteChannel](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/GatheringByteChannel.html)

### 26. transferTo 是不是“零拷贝”？

它可能利用操作系统优化路径，减少经过应用缓冲区的复制，但 Java API 不承诺具体系统调用或完全没有数据移动。单次可能部分完成或返回 0，需累计偏移并处理无进展；transferTo 不推进源文件当前位置。TLS、目标通道种类等也会影响实际路径。

### 27. mmap 为什么快，又有什么风险？

映射使应用用内存访问处理文件区域，某些随机或重复访问可以受益；缺页仍可能等待磁盘。还要考虑映射大小、文件并发截断、页缓存压力与释放时机。关闭 FileChannel 不会立即解除传统 MappedByteBuffer 映射。Java 22+ 的 Arena/MemorySegment 映射重载提供另一种生命周期管理方式。[MappedByteBuffer](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/MappedByteBuffer.html)、[Arena 映射重载](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileChannel.html#map(java.nio.channels.FileChannel.MapMode,long,long,java.lang.foreign.Arena))

### 28. write 成功、force 和原子移动保证的是一回事吗？

write 报告本次传输量；force 按存储设备与方法契约请求持久化更新；ATOMIC_MOVE 讨论路径操作的原子性。它们不能互相替代。可靠发布文件通常涉及完整写临时文件、必要的持久化、同文件系统原子发布和故障恢复；不能仅凭“rename 成功”宣称断电后一定安全。

### 29. FileLock 能代替 synchronized 吗？

不能。文件锁面向进程之间对文件区域的协作，代表整个 JVM 持有；同 JVM 内重叠锁还可能抛 OverlappingFileLockException。共享锁支持情况、其他进程是否必须遵守锁，以及文件系统行为存在平台差异；线程互斥应用线程锁。[FileLock 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileLock.html)

## NIO.2 文件系统：第 30–36 题

### 30. Path、Files、FileSystem、FileSystemProvider 分别负责什么？

Path 表示某个文件系统中的路径；Files 提供操作入口；FileSystem 提供根目录、分隔符等上下文；Provider 把操作交给具体实现。因此 ZIP 内的 Path 也能使用不少 Files 方法。Path 本身不表示已经打开文件；非默认文件系统的 Path 也未必能 toFile。[FileSystemProvider](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/spi/FileSystemProvider.html)

### 31. normalize、toAbsolutePath、toRealPath 有什么区别？

normalize 做词法简化，不查询文件系统；toAbsolutePath 形成绝对路径，不保证存在；toRealPath 访问真实文件系统，通常解析链接并要求目标存在。含符号链接时，词法删除 `..` 可能改变实际指向。resolve 遇到绝对路径参数时会返回该参数代表的路径，不能当作始终限制在父目录下的拼接。[Path API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Path.html)

### 32. Files.exists 为 false，是否一定不存在？先 exists 再创建可靠吗？

false 也可能表示无法确定；exists 与 notExists 并非简单互为否定。检查与后续操作之间文件系统可以变化，形成 TOCTOU 竞争。需要“仅当不存在时创建”，使用 CREATE_NEW 等把条件交给操作本身，并处理异常；不要用一次预检查充当并发保证。[Files API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html)

### 33. Files.lines、list、walk、find 为什么要关闭？

它们返回的 Stream 可能持有打开的文件或目录资源，消费结束不等于自动 close。使用 try-with-resources；DirectoryStream 也同样管理。readAllBytes/readString 把整个内容读入内存，适合可控小文件，大文件应考虑流式处理。

### 34. Files.copy 是否递归复制目录？遍历默认跟随链接吗？

复制一个目录通常只创建目标目录，不递归复制内容；递归任务应明确遍历策略。walk/walkFileTree 默认不跟随符号链接，FOLLOW_LINKS 需要考虑循环、越界与失败处理。删除目录通常要先删除子项，再在 postVisitDirectory 删除目录本身。[walkFileTree 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html#walkFileTree(java.nio.file.Path,java.nio.file.FileVisitor))

### 35. ATOMIC_MOVE 加 REPLACE_EXISTING 是否保证原子覆盖？

不能跨平台这么保证。使用 ATOMIC_MOVE 时其他选项被忽略，目标已存在时替换还是失败由实现决定；不能原子移动则抛 AtomicMoveNotSupportedException。跨文件系统移动尤其不能假设支持。若业务必须原子发布，静默回退普通 move 就改变了保证。[move 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html#move(java.nio.file.Path,java.nio.file.Path,java.nio.file.CopyOption...))

### 36. WatchService 是否可靠记录每一次文件变化？

不保证。通知可能合并、重复、延迟或溢出；处理 OVERFLOW 时应重新扫描。处理事件后要 reset key，失败表示注册已失效。标准注册也不自动递归监听所有子目录，修改通知不表示写入完成。它适合触发状态刷新，不是天然的审计日志。[WatchService API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/WatchService.html)、[WatchKey API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/WatchKey.html)

继续练习[第 37–42 题：异步与现代 Java](./async.md)。
