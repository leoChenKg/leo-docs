---
title: NIO 性能与持久化：直接缓冲区、零拷贝和 mmap
description: 区分各类传输优化及其成本，并按工作负载判断性能与写入保证。
type: doc
tags:
  - Java
  - NIO
  - NIO.2
order: 40
date: 2026-09-24
---

# NIO 性能与持久化：直接缓冲区、零拷贝和 mmap

在理解[Buffer](./buffers.md)和[文件通道](./file-channel.md)后，再评估优化路径。本篇区分 API 契约、平台实现与测量结果，不把某一种机制当作所有场景的最佳方案。

阅读时分开两个问题：**数据经过哪些路径，哪些工作有机会减少**，以及**操作结束后到底获得什么保证**。前者对应 direct、transferTo 和映射，后者对应写入、持久化与原子替换；它们一起决定选型，但不是可以互相替代的“性能等级”。

## allocateDirect 的收益与代价

`ByteBuffer.allocate` 通常使用堆内数组；`allocateDirect` 允许 JVM 尽量直接使用该内存完成原生 I/O，减少某些中间缓冲区拷贝。直接缓冲区的内容可能位于普通 GC 堆之外，但对应 Java 对象仍有生命周期，内存也不是免费资源。

直接分配和释放成本通常较高，适合在收益经过测量后复用较大、较长寿命的 Buffer。不要每次请求都新建一个小 direct buffer，也不要把 Java 堆占用不高当成总进程内存一定不高。[直接缓冲区说明](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/ByteBuffer.html)

`direct` 不等于数据从磁盘到网卡完全没有复制，也不保证绕过操作系统页缓存。它解决的是其中一些内存传输环节。

## transferTo 与 transferFrom 提供优化机会

`FileChannel.transferTo(position, count, target)` 让文件到其他通道的传输有机会使用操作系统优化路径。它可能减少经过 Java 应用缓冲区的数据搬运，因而常出现在“零拷贝”讨论中。但 API 不保证每个平台、目标通道和数据规模都采用相同机制。

一次调用可能只传输部分数据甚至 0 字节。程序需要累计偏移和剩余长度；遇到 0 时应结合目标通道等待就绪、采用有界重试或回退复制，不能不加判断地循环到 CPU 满载。`transferTo` 不推进源 FileChannel 的当前位置。[transferTo 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileChannel.html#transferTo(long,long,java.nio.channels.WritableByteChannel))

“零拷贝”通常表示减少某些 CPU 参与的拷贝环节，讨论性能时要说明具体哪一层，不要把它理解成数据完全不用移动。

## mmap 把文件区域映射成内存访问

传统 `FileChannel.map` 返回 `MappedByteBuffer`，应用通过内存访问处理映射区域。它适合某些随机访问或重复访问场景；访问尚未驻留的页仍可能触发缺页和磁盘等待，不能据此称为非阻塞 I/O。

三种传统模式是只读、读写，以及修改不回写原文件的私有映射。关闭 FileChannel 不等于立刻解除已有映射。传统 MappedByteBuffer 没有 `close()`，映射生命周期及被截断文件的访问风险需要单独考虑。[MappedByteBuffer](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/MappedByteBuffer.html)

Java 22+ 还提供接收 `Arena` 的映射重载，返回 `MemorySegment`，可由可关闭 Arena 管理解除映射时机。因此“Java 没有任何受控释放文件映射的正式 API”是过时的泛化；需要区分传统 ByteBuffer 接口与现代外部内存 API。[FileChannel 的 Arena 映射重载](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileChannel.html#map(java.nio.channels.FileChannel.MapMode,long,long,java.lang.foreign.Arena))

## 写入成功、刷盘与原子替换分别回答什么

- `write` 返回：本次有多少字节被通道接受。
- `FileChannel.force`：请求把该通道文件更新按契约写到存储设备；本地与非本地设备、内容与元数据存在保证边界。
- `MappedByteBuffer.force`：针对映射内容的回写。
- `Files.move(..., ATOMIC_MOVE)`：讨论路径切换的原子可见性，不自动成为断电后持久化事务。

这些保证不能互相替代。生产中的可靠文件发布需要同时考虑写入完成、存储持久性、原子可见性和失败恢复，详见[文件系统操作](../filesystem/operations.md)。

## 按工作负载选择方案

| 任务 | 优先考虑 | 原因 |
| --- | --- | --- |
| 小配置文件读写 | `Files.readString/writeString`，Java 11+ | 代码清晰，注意整体内存占用 |
| 大文本逐行处理 | `BufferedReader` 或关闭式管理的 `Files.lines` | 流式处理，不必手动管理 UTF-8 尾字节 |
| 文件复制和目录操作 | `Files` | 使用明确的文件系统 API |
| 文件随机访问、分块处理 | `FileChannel` | 可显式定位、控制 Buffer |
| 构建大量连接的事件循环 | 非阻塞通道与 Selector | 控制事件、队列和背压 |
| 需要完成回调组织 I/O | 异步通道 | 将提交与完成分开处理 |
| 网络业务偏好顺序代码 | 评估 Java 21+ 虚拟线程与阻塞 API | 降低线程等待成本，仍需并发限制与资源预算 |

虚拟线程改变了“每连接一个平台线程”的成本模型；它没有改变 TCP 分帧、部分读写、超时、下游容量和连接数量限制。不要再把“高并发一定只能手写 Selector”当成普遍结论。虚拟线程的版本边界在[异步并发与现代 Java](../async-channels/concurrency.md)解释。

性能研究应先给出工作负载：文件还是网络、顺序还是随机、小请求还是大块传输、活跃连接比例、吞吐还是尾延迟。再测量 CPU、内存、GC、系统调用、磁盘/网络等待和队列积压。只比较 API 名称，得不出“NIO 一定比 IO 快”。

## 继续练习

用[文件通道与性能题](../interview/files.md)解释 direct、transferTo、mmap 与 force 的差异。配置发布与失败恢复的综合场景见[文件处理工程实践](../../files/practice.md)。
