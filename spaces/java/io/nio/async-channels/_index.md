---
title: NIO.2 异步通道：完成通知、并发与生命周期
description: 按完成模型、可运行实验和工程边界学习异步文件与 Socket 通道。
type: doc
tags:
  - Java
  - NIO.2
  - 异步
order: 40
date: 2026-09-24
---

# NIO.2 异步通道：完成通知、并发与生命周期

异步通道把“提交 I/O”和“接收完成结果”分开。学习重点是单次操作、业务任务、Buffer 和执行资源四层生命周期，而不仅是回调语法。

## 阅读路径

| 文章 | 解决的问题 |
| --- | --- |
| [完成模型与 Buffer 所有权](./model.md) | Future、CompletionHandler、显式文件偏移、部分完成、Socket pending 与状态机 |
| [异步文件读取实验](./lab.md) | 运行完整程序，跟踪提交、完成、失败、关闭和线程池回收 |
| [并发控制、取消与技术选择](./concurrency.md) | executor、通道组、背压、超时、取消、停机与虚拟线程 |

先读模型，再运行实验，最后检查工程边界。正文依据 Java SE 25 API 契约；实验使用 Java 11+ API，较新版本的能力单独标注。

## 前置知识与面试复习

需要先理解 [I/O 模型](../basics/models.md)和 [Buffer 状态](../basics/buffers.md)。对照 [Selector 的就绪模型](../selector/model.md)，确认“就绪通知”和“完成通知”分别由谁执行读写；[NIO.2 文件系统](../filesystem/)则介绍路径、遍历和属性，这些 API 不会因为属于 NIO.2 就自动异步。

学完后用[异步通道面试题](../interview/async.md)检查生命周期与并发语义，再做[综合场景题](../interview/scenarios.md)。
