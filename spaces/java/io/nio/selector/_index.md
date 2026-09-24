---
title: Selector 网络编程
description: 从就绪模型进入有界回声实验，再学习分帧、跨线程协作与 Reactor 架构。
type: doc
tags:
  - Java
  - NIO
  - 网络编程
  - Selector
order: 20
date: 2026-09-24
---

# Selector 网络编程

Selector 把多个网络连接的就绪等待集中到事件循环。本目录按“模型 → 服务器 → 客户端验证 → 工程扩展”拆开学习，完整代码保留在各自实验页，避免在多篇文章之间拼装。

前置知识是 [I/O 模型](../basics/models.md)和 [Buffer 状态](../basics/buffers.md)。完整实验使用 Java 11+，接口语义依据 Java SE 25 官方文档。

## 阅读顺序

| 文章 | 读完后能回答什么 |
| --- | --- |
| [Selector 与 SelectionKey](./model.md) | 就绪意味着什么，怎样理解 selectedKeys、返回值与部分读写 |
| [有界回声服务器](./server.md) | 怎样维护未发送数据、按需订阅 OP_WRITE、处理半关闭和背压 |
| [客户端与边界验证](./client.md) | 怎样验证跨缓冲区传输、空输入、半关闭，实验还缺哪些覆盖 |
| [事件循环的工程边界](./engineering.md) | 怎样处理连接状态、跨线程协作、协议分帧、负载与架构选择 |

## 面试复习与延伸

口述练习集中在 [网络与 Selector 题库](../interview/network.md)，排查与设计练习见 [场景题](../interview/scenarios.md)，本目录保留原理和实验依据。

理解就绪通知后，可继续比较 [NIO.2 异步通道](../async-channels/)的完成通知模型。
