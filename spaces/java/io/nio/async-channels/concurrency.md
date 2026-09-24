---
title: 异步 I/O 的并发控制、取消与技术选择
description: 区分 executor 与通道组的职责，在提交入口实施背压，并正确处理等待超时、操作超时、取消和停机。
type: doc
tags:
  - Java
  - NIO.2
  - 异步
order: 30
date: 2026-09-24
---

# 异步 I/O 的并发控制、取消与技术选择

理解[完成模型与 Buffer 所有权](./model.md)后，还需要约束执行资源和未完成任务。本文集中说明 API 的工程边界；[完整文件实验](./lab.md)展示通道与自建线程池的关闭顺序。

## 线程池、通道组和背压分别管什么

### 网络通道的 AsynchronousChannelGroup

异步 Socket 和异步 ServerSocket 可以绑定到 `AsynchronousChannelGroup`，共享 I/O 事件处理和完成分发资源。处理器由组内线程执行；如果发起者本来就是组内线程且操作立即完成，处理器可能直接在该线程上被调用，因此不能假设每次都先排队、稍后才回调。[通道组与回调线程](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousChannelGroup.html)

开发时要先更新状态，再提交可能立即完成的下一次操作，避免回调看到旧状态。也不要把“通常异步调用”当作不可能重入的证明。

组的 `shutdown()` 禁止新通道加入，但不会自动关闭现有通道；它要等所属通道关闭、运行中的处理器结束等条件满足后才能终止。`shutdownNow()` 还会关闭现有通道，但也不强行中断正在执行的处理器。组关联的池由组管理，不应绕开组擅自关池。[组的终止规则](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousChannelGroup.html)

### 文件通道使用自己的 executor 配置入口

`AsynchronousFileChannel` 不通过 `AsynchronousChannelGroup` 管理，可以在 `open(path, options, executor, attrs)` 时指定 `ExecutorService`，也可以使用默认池。[异步文件实验](./lab.md)通过这个重载传入 `ioPool`。

文件通道对 executor 有约束：至少应支持无界任务队列，且不能在调用 `execute` 的线程上直接执行所提交任务。通道还开着时关闭该 executor，行为未指定。[文件通道 open 的 executor 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousFileChannel.html#open(java.nio.file.Path,java.util.Set,java.util.concurrent.ExecutorService,java.nio.file.attribute.FileAttribute...))

这意味着不要为了“限制内存”随便给 I/O 内部 executor 换成可能拒绝必要任务的有界队列，也不要配置 `CallerRunsPolicy` 来执行 I/O 内部任务。

### 背压应该在提交入口限制工作量

线程数少不等于系统负载有界。假设每个未完成任务占用一个 1 MiB Buffer，提交一万项任务就可能占用约 10 GiB 数据空间；即使只有两个线程真正工作，排队对象和 Buffer 也已经分配。

应用可以限制每个文件、每条连接或全局的未完成任务数量，在提交前取得配额，在所有终止路径归还配额。Socket 出站队列还需要按字节数设上限；队列满时暂停上游、拒绝请求或按业务协议降级。

配额等待不能阻塞 I/O 完成线程。如果处理器必须等待“别人完成后释放配额”，而释放配额本身又需要这个线程处理完成通知，就重新制造了死锁风险。

## 取消和超时都不表示撤销已经发生的 I/O

需要分清三个相似动作：

| 动作 | 它表达什么 | 不能推出什么 |
| --- | --- | --- |
| `future.get(timeout, unit)` 超时 | 调用者这次等待到期 | 底层操作自动停止 |
| 对操作的 `Future` 调用 `cancel(...)` | 尝试取消尚未完成的操作 | 已写入的字节被回滚、Buffer 可立即复用 |
| Socket 的带 timeout 读写重载超时 | I/O 操作以超时失败完成 | 连接与 Buffer 仍处于可安全重试的原始状态 |

第一行是 `Future` 的等待语义；第二行中底层 I/O 能否被取消由实现决定。尤其是 `cancel(true)`，实现可能通过关闭整个通道中断操作，从而让该通道其他未完成操作以 `AsynchronousCloseException` 结束。取消后应丢弃相关 Buffer，或保证通道仍打开时不访问它，不能仅凭 `isDone()` 就放回池中。[Future 超时等待](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Future.html)、[AsynchronousChannel 取消规则](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousChannel.html)

Socket 读写超时可导致 `InterruptedByTimeoutException`，Buffer 状态未定义，通道后续同方向操作也可能进入实现相关的错误状态。稳妥的应用策略通常是结束该连接、丢弃相关 Buffer，并由协议决定能否重试。[AsynchronousSocketChannel 超时边界](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousSocketChannel.html)

还有一个容易写错的参数：Socket 带 timeout 的读写重载中，`timeout <= 0` 表示**不设置操作超时**，不是“立即超时”；它和 `Future.get(0, unit)` 的限时等待语义不同。[Socket 超时参数](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousSocketChannel.html#read(java.nio.ByteBuffer,long,java.util.concurrent.TimeUnit,A,java.nio.channels.CompletionHandler))

对于“发送扣款请求后超时”这样的业务，重连并重发还可能重复执行。是否重试应由请求 ID、幂等约束和服务端确认协议决定，I/O API 无法替业务回滚。

[异步文件实验](./lab.md)里的桥接 `CompletableFuture` 还多一层边界：对它调用 `cancel()` 或 `orTimeout()`，只改变这个结果容器，不会自动传导到 `channel.read`。若要提供可取消的业务 API，必须另外设计底层操作取消、通道关闭和 Buffer 回收之间的关系。[CompletableFuture 取消语义](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CompletableFuture.html)

`close()` 可以使尚未完成的操作以 `AsynchronousCloseException` 结束，但关闭也不撤销此前已发生的写入。停机应明确谁拥有通道、何时停止提交、怎样等待终止，以及谁最终释放配额和内存。[AsynchronousChannel.close](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/AsynchronousChannel.html#close())

## 现代 Java 中还要不要选择回调式 I/O

Java 21 正式提供虚拟线程。对适配的阻塞网络操作，虚拟线程在等待时可以释放承载它的平台线程，让业务继续使用顺序的阻塞代码；这并不会把 API 改成 `CompletionHandler` 风格。[JEP 444](https://openjdk.org/jeps/444)

因此，在 Java 21+ 的请求型网络应用中，可以比较“虚拟线程 + 阻塞 API”与显式异步状态机的复杂度。异步通道仍适合需要完成事件、受控流水线或已有异步架构的场景；不能仅凭线程数量多就直接认定必须手写 Selector 或回调。

版本边界也要更新：JDK 24 的 JEP 491 消除了与 `synchronized` 相关的主要虚拟线程固定问题，不能继续把 Java 21 时的这项限制无条件套用到 Java 25。原生调用等仍可能带来其他限制。[JEP 491](https://openjdk.org/jeps/491)

虚拟线程不会提高磁盘物理吞吐，也不保证所有文件操作都能释放承载线程；JEP 444 明确讨论了文件系统等阻塞限制。两种方式都需要限制并发、内存和下游请求量，不能以“线程很便宜”替代容量规划。

选择时先观察业务：如果主要困难是大量等待中的独立请求，顺序代码通常容易维护；如果主要困难是缓冲区复用、协议流水线和精细调度，就评估事件驱动设计。最后在目标 JDK、操作系统、存储和实际负载上验证，而不是比较某个 API 名字看起来是否“更高级”。

## 继续学习

用[异步通道面试题](../interview/async.md)检查 pending、所有权、取消与回调线程，再做[综合场景题](../interview/scenarios.md)。如果选择事件循环而不是完成回调，继续阅读 [Selector 的工程边界](../selector/engineering.md)。
