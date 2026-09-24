---
title: NIO 的 I/O 模型：阻塞、非阻塞、就绪与完成
description: 区分 API 演进范围与等待模型，理解 Selector 和异步通道各自通知什么。
type: doc
tags:
  - Java
  - NIO
  - NIO.2
order: 10
date: 2026-09-24
---

# NIO 的 I/O 模型：阻塞、非阻塞、就绪与完成

本文建立 NIO 与 NIO.2 的概念边界。先明确一次调用返回什么，再选择 Buffer、Channel、Selector 或异步通道；具体类型的名称不能替代行为判断。

## NIO 与 NIO.2 的演进范围

NIO 通常展开为 **New I/O**。它在 Java 1.4 引入，对应 JSR 51，核心是缓冲区、通道、字符集处理和可选择的非阻塞网络通道。NIO.2 在 Java 7 引入，对应 JSR 203，重点扩展文件系统访问和异步 I/O；它延续 NIO 的体系，并不是另建一个 `java.nio2` 包。[JSR 51](https://jcp.org/en/jsr/detail?id=51)、[JSR 203](https://jcp.org/en/jsr/detail?id=203)

| 范围 | 主要 API | 主要解决的问题 |
| --- | --- | --- |
| 传统流与字符 I/O | `InputStream`、`OutputStream`、`Reader`、`Writer` | 顺序读写字节或字符，组合缓冲、解码等功能 |
| NIO 缓冲区 | `ByteBuffer`、`CharBuffer` 等 | 显式描述一块数据及当前消费位置 |
| NIO 通道 | `FileChannel`、`SocketChannel`、`DatagramChannel` | 在文件、网络等端点与 Buffer 之间传输数据 |
| NIO 选择器 | `Selector`、`SelectionKey` | 等待多个通道的就绪事件 |
| NIO 字符集 | `Charset`、`CharsetDecoder`、`CharsetEncoder` | 处理字节与 Unicode 字符之间的转换 |
| NIO.2 文件系统 | `Path`、`Files`、`FileSystem`、属性视图、`WatchService` | 描述路径、操作文件、遍历、访问元数据、监听目录 |
| NIO.2 异步通道 | `AsynchronousFileChannel`、`AsynchronousSocketChannel` 等 | 发起 I/O 后通过 Future 或回调获得完成结果 |

这些能力可以混用。`Files.newBufferedReader(path)` 返回传统的 `BufferedReader`；`FileInputStream.getChannel()` 可以取得文件通道。选择 API 的依据是问题本身，不是“新 API 应该全部替换旧 API”。[Channels 适配工具](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/Channels.html)

:::info 最先纠正的三个等号
NIO 不等于非阻塞；NIO.2 不等于只有异步；异步 API 不等于底层一定使用内核异步 I/O。先看具体类、具体方法及其调用方式。
:::

## 阻塞与非阻塞关注一次调用如何等待

假设客户端已经建立连接，但暂时没有发送数据：

- 阻塞读取：调用线程可能停在 `read` 中，直到获得数据、遇到 EOF 或出现异常。
- 非阻塞读取：如果现在不能读取数据，调用及时返回；对于有剩余空间的 `ByteBuffer`，`SocketChannel.read` 可返回 `0`。
- 异步读取：先发起读取操作，完成后再通过结果对象或回调得知字节数、EOF 或失败。

“同步”在并发和操作系统资料里有不同语境。本专题把“同步读写”用于这样的 API：调用方本次执行 `read/write`，并从这次调用取得已完成的字节数或错误。因此非阻塞通道的读写仍通常被称为同步 I/O；它不会因为返回 `0` 就在后台替你完成整次请求。

| 使用方式 | 调用方拿到什么 | 等待期间的典型行为 |
| --- | --- | --- |
| 阻塞 `SocketChannel.read` | 本次读取结果 | 当前调用可能等待数据 |
| 非阻塞 `SocketChannel.read` | 本次读取结果，可能是 `0` | 无进展就返回，由应用安排以后再试 |
| `selector.select()` | 一批就绪通道的信息 | 事件循环线程可阻塞等待任意相关事件 |
| `AsynchronousSocketChannel.read` | Future，或通过 handler 接收结果 | 发起操作后可继续工作 |
| 对上述 Future 立即 `get()` | 操作最终结果 | 调用 `get` 的线程仍可能等待 |

这里有个特别重要的区别：**非阻塞的是网络通道的读写；Selector 的等待本来就可以阻塞。** 让一个线程睡着等待许多连接的事件，正是为了避免它反复空转检查每个连接。[通道包概览](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/package-summary.html)

## 就绪通知与完成通知处理的是不同阶段

用同一个“接收请求”的任务比较：

```text
Selector 路径：注册关注可读 → 等待就绪 → 应用调用 read → 检查字节数 → 拼装请求
异步通道路径：提交 read   → 等待完成 → handler 得到字节数 → 拼装请求
```

Selector 常用于 **Reactor** 模式：有事件时，分发给相应处理逻辑，由应用发起读写。完成通知 API 适合表达 **Proactor 风格**：先提交操作，再处理结果。这是在说明程序组织方式，不能据此断言 JVM 在所有平台上使用同一种系统调用。

两者都只解决传输的一部分。读到 100 个字节，并不代表完整业务请求已经到齐；写完一个 Buffer，也不代表对端业务已经处理或数据已经持久化。

## 为什么传统 I/O 仍然有价值

“传统 I/O 每次只能读一个字节”是误解。`InputStream.read(byte[])` 能批量读取，`BufferedInputStream` 能缓冲；NIO 的区别是把 Buffer 状态和通道操作更直接地交给应用控制，而不是首次引入批量读取。[缓冲流官方教程](https://docs.oracle.com/javase/tutorial/essential/io/buffers.html)

简单文件处理、已有流式库、逐行文本解析，都可能更适合流和 Reader。需要随机定位、二进制协议、网络事件循环、文件映射时，再使用对应的 NIO 能力。

## 下一步与自测

继续阅读[Buffer 状态与解码](./buffers.md)，再用[第 1–12 题](../interview/models-buffers.md)检查 I/O 模型和状态推演。具体网络机制见[Selector](../selector/)，完成通知机制见[异步通道](../async-channels/model.md)。
