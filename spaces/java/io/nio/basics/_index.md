---
title: NIO 基础：I/O 模型、Buffer 与 Channel
description: 从等待模型和缓冲区状态进入文件通道，再按工作负载理解性能与持久化。
type: doc
tags:
  - Java
  - NIO
  - NIO.2
order: 10
date: 2026-09-24
---

# NIO 基础：I/O 模型、Buffer 与 Channel

本目录按“等待模型 → 数据状态 → 传输进度 → 性能选择”组织。先理解机制，再运行实验；需要查某个状态或方法时直接进入对应文章。

适合已经能阅读 Java 方法、循环和异常处理代码的读者。若还不清楚字节与字符的区别，或不知道为什么要关闭打开的资源，先补充[流与编码](../../files/streams/)；进入本目录不要求先掌握网络协议或异步编程。

## 阅读顺序

| 文章 | 解决的问题 | 实验与练习 |
| --- | --- | --- |
| [I/O 模型](./models.md) | NIO/NIO.2 的范围，阻塞、非阻塞、就绪与完成的区别 | [第 1–6 题](../interview/models-buffers.md) |
| [ByteBuffer 状态与解码](./buffers.md) | flip/compact、共享视图、字节序和增量解码 | BufferLab；[第 7–12 题](../interview/models-buffers.md) |
| [Channel 与文件传输](./file-channel.md) | 部分读写、文件位置、分散聚集和锁 | ChannelCopyDemo；[第 24–29 题](../interview/files.md) |
| [性能与持久化边界](./performance.md) | direct、transferTo、mmap 及写入保证 | 结合工作负载说明收益与代价 |

前两篇建立状态模型，第三篇把模型落实到完整读写循环；最后一篇讨论何时值得优化，以及性能优化不能代替哪些可靠性保证。BufferLab 与 ChannelCopyDemo 各自保留在对应原理文章中，方便同时观察代码、输出与解释。

## 从基础进入具体方向

- 网络事件循环：[Selector](../selector/)。
- 路径、遍历、属性和监听：[NIO.2 文件系统](../filesystem/)。
- 提交操作与接收完成结果：[异步通道](../async-channels/)。
- 还不熟悉流与编码：[文件操作基础](../../files/streams/)。

## 资料与版本

原理以 Java SE 25 官方 API 为依据；BufferLab 与 ChannelCopyDemo 使用 Java 11 已有 API，可通过 javac --release 11 检查。初始实验于 2026-09-24 在 macOS、JDK 26.0.1 验证；Java 21 的虚拟线程、Java 22 的 Arena 映射等能力在正文单独说明，不把平台实现当成跨平台保证。
