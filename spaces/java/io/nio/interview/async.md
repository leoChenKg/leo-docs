---
title: NIO 面试题 37–42：异步通道与现代 Java
description: 检查完成通知、pending 限制、Buffer 所有权、取消超时和虚拟线程。
type: reference
tags:
  - Java
  - NIO
  - NIO.2
  - 面试
order: 40
date: 2026-09-24
---

# NIO 面试题 37–42：异步通道与现代 Java

本组关注提交后谁拥有数据、何时能复用资源。原理见[异步完成模型](../async-channels/model.md)、[完整读取实验](../async-channels/lab.md)与[并发及生命周期](../async-channels/concurrency.md)；统一安排见[42 题入口](./)。

## 异步通道与现代 Java：第 37–42 题

### 37. Future 和 CompletionHandler 怎么选？

Future 提供等待、检查与取消入口；CompletionHandler 把成功和失败交给 completed/failed。立即调用 Future.get，在结果尚未完成时会阻塞等待，所以异步 API 不等于你的使用方式没有等待。handler 形式也要捕获提交阶段的同步异常，不能认为所有错误都会进入 failed。

### 38. AsynchronousSocketChannel 可以同时提交多少次读写？

同一时刻允许一个未完成 read 和一个未完成 write，因此读写可以同时挂起；不能把多个未完成同方向操作任意堆叠，否则可能出现 ReadPendingException/WritePendingException。协议通常采用读状态机加串行发送队列；异步网络通道本身不需要注册 Selector。[AsynchronousSocketChannel API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousSocketChannel.html)

### 39. 异步操作期间能 clear、复用或释放 Buffer 吗？

不能随意做。提交到完成之间应把这块 Buffer 的所有权留给操作；重复用于另一请求会造成数据竞争。一次完成仍可能只是部分字节，后续操作要接着剩余区域推进。文件异步通道使用显式 long 偏移，没有共享文件 position，也不保证多个并发操作按提交顺序完成。[AsynchronousFileChannel API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousFileChannel.html)

### 40. 等待超时、I/O 超时、cancel 是否一样？

不一样。Future.get(timeout) 只停止这次等待，不自动取消底层操作；异步 Socket 的超时重载约束操作本身，超时后还要遵守 Buffer 与通道状态的契约限制。取消是尽力请求，不回滚已发生的传输；cancel(true) 在某些实现中可能关闭通道，影响其他操作。不能在“等超时了”后立刻把同一 Buffer 借给别人。[AsynchronousChannel 取消契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousChannel.html)、[Future.get](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Future.html#get(long,java.util.concurrent.TimeUnit))

### 41. AIO 是不是不需要线程池？回调能做重活吗？

仍需执行线程来分发完成事件，具体底层还可能借助工作线程执行 I/O。网络通道可关联 AsynchronousChannelGroup；异步文件通道通过自己的 executor 参数配置。回调应短小，阻塞或耗时业务交给有界执行器，否则完成处理会被拖慢；提交端还要限制在途操作与 Buffer 总字节数。[AsynchronousChannelGroup API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousChannelGroup.html)

### 42. 有了虚拟线程，Selector 与异步通道还需要学吗？

需要。Java 21 的虚拟线程降低大量等待型任务使用顺序代码的线程成本，但协议、背压、内存、连接数与下游容量仍需控制，既有网络框架也仍可能使用事件循环。CPU 密集任务不会因为线程变轻就获得更多 CPU。Java 24 的 JEP 491 解决了在 synchronized 中阻塞导致的主要 pinning 问题，不能把 Java 21 的旧限制无条件套到新版本。[JEP 444](https://openjdk.org/jeps/444)、[JEP 491](https://openjdk.org/jeps/491)

最后完成[故障场景与代码题](./scenarios.md)，把契约用于排错。
