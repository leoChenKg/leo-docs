---
title: NIO 面试题 1–12：I/O 模型与 Buffer
description: 练习等待模型、就绪与完成，以及缓冲区状态、视图和字节边界。
type: reference
tags:
  - Java
  - NIO
  - NIO.2
  - 面试
order: 10
date: 2026-09-24
---

# NIO 面试题 1–12：I/O 模型与 Buffer

先口述 API 的模型，再推演 Buffer 的具体状态。复习安排见[42 题入口](./)；原理见[I/O 模型](../basics/models.md)、[ByteBuffer](../basics/buffers.md)与[直接缓冲区](../basics/performance.md)。

## I/O 模型：第 1–6 题

### 1. BIO、NIO、AIO 与 NIO.2 有什么关系？

BIO、AIO 是常见讨论标签；NIO/NIO.2 是 Java API 的演进范围，不能把这两类分类完全对齐。传统阻塞流常被称为 BIO；NIO 同时提供阻塞文件通道和可配置的网络通道；AIO 常指 NIO.2 的异步通道。NIO.2 还包含大量同步文件操作，例如 `Files.copy`。

**追问：**把阻塞 read 扔进业务线程池，调用方也不等待，算不算异步？对调用方可以是异步封装，但工作线程仍可能阻塞；不能因此宣称底层用了内核异步 I/O。

### 2. 同步与阻塞是不是同一个概念？

不是。本专题中，“同步读写”表示调用方执行 read/write 并取得本次传输结果；“阻塞”描述无进展时调用是否等待。非阻塞 read 可以同步返回 0；异步 read 则在提交后通过结果对象或回调通知完成。术语存在不同语境，面试先说清正在讨论 API、线程还是内核。

### 3. Selector 的 select 会阻塞，为什么还叫非阻塞 I/O？

网络通道的读写配置为非阻塞，避免一个连接拖住循环；`select()` 集中等待许多连接的事件，让空闲时的线程休息。两者职责不同。`selectNow()` 不等待，反复调用它却不做任何节流或工作，会造成轮询空转。[通道包概览](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/package-summary.html)

### 4. Reactor 和 Proactor 的核心差异是什么？

Reactor 响应“可以尝试操作”的就绪事件，再执行读写；Proactor 风格响应“提交的操作已经完成”的结果。Java Selector 适合前者，异步通道适合后者。这里说的是应用组织方式，不是承诺每个操作系统都提供同一种底层异步机制。

### 5. NIO 一定比传统 I/O 快吗？

不一定。NIO 的重要收益是控制 Buffer、批量等待连接、随机访问与某些优化路径；它也带来状态机和队列管理成本。少量连接、小文件、顺序文本处理时，流式 API 可能更清晰。比较要固定数据量、并发数、活跃比例和延迟目标，再看吞吐、尾延迟、CPU 与内存，不能只比较类名。

### 6. 一个线程为什么能处理很多连接？

因为大量连接处在等待状态，线程只推进当前可处理的连接。它没有让一个 CPU 核同时执行许多业务。CPU 密集计算、阻塞数据库调用、同步文件读写一旦直接放进循环，都会推迟其他连接；通常要卸载到有界执行器，并把结果安全地交回事件循环。

## Buffer：第 7–12 题

### 7. position、limit、capacity、mark 分别是什么？

capacity 是容量；limit 是有效访问边界；position 是下一次相对读写的位置；mark 用来保存可恢复的位置。有效关系为 `0 <= position <= limit <= capacity`，mark 存在时还满足 `0 <= mark <= position`。绝对访问如 `get(0)` 不推进 position；通道传输按 Buffer 当前 position 进行。[Buffer API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/Buffer.html)

### 8. flip、clear、rewind、compact 怎么区分？

| 方法 | position | limit | 对已有内容的影响 |
| --- | --- | --- | --- |
| `flip()` | 0 | 旧 position | 划定刚填充的数据，供消费 |
| `clear()` | 0 | capacity | 不擦除字节，但丢弃本轮有效范围 |
| `rewind()` | 0 | 保持不变 | 准备重复消费同一有效区域 |
| `compact()` | 原 remaining | capacity | 把未消费字节移动到开头 |

**最常见错误：**读到半帧或只发出部分数据后直接 clear。正确选择取决于是否还有必须保留的字节；compact 本身不识别协议。

### 9. ByteBuffer.wrap 后为什么通常不能 flip？

`wrap(byte[])` 已经把整个数组作为有效区域，position 为 0。马上 flip 会令 limit 也变为 0。`wrap(array, offset, length)` 则有非零起始位置，capacity 仍是整个数组长度；想得到以 0 开始的局部视图，可以再 slice。

### 10. slice、duplicate、只读视图是否复制数据？

它们共享内容，但拥有独立的位置状态。只读视图只限制从该视图写入，不阻止其他可写视图修改内容；也不自动保证线程安全。ByteBuffer 的 slice/duplicate 字节视图按契约使用大端序，延续原自定义字节序时要显式设置。[ByteBuffer API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/ByteBuffer.html)

### 11. direct buffer 的优势和代价是什么？

它给 JVM 直接使用原生 I/O 内存的机会，减少部分中间复制；不保证所有场景更快。分配与回收通常更贵，内容可能在普通 GC 堆之外，仍占用进程内存。应测量后复用，控制总量；不能把“堆使用正常”当成排除内存问题的依据。

**追问：**能对所有 ByteBuffer 调用 array 吗？不能，先看 `hasArray()`；direct 或只读视图未必提供可访问数组。

### 12. 每次 read 后直接 new String 为什么可能乱码？

一次 read 可能只读到 UTF-8 字符的一部分。解决方式是先收齐独立编码的完整消息再解码，或持续使用 CharsetDecoder，保留末尾未消费的字节。`UNDERFLOW` 也可能表示缺少后续字节；真正 EOF 还需完成最终 decode 与 flush。[CharsetDecoder API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/charset/CharsetDecoder.html)

继续练习[第 13–23 题：Selector 与网络](./network.md)。
