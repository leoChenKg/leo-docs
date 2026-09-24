---
title: 文件与 I/O
description: 按文件操作、NIO 与 NIO.2 两个专题学习 I/O，每个专题包含原理、示例和面试练习。
type: doc
tags:
  - Java
  - I/O
order: 10
date: 2026-09-24
---

# 文件与 I/O

学习文件操作时，先回答三个问题：文件在哪里、要对文件系统做什么、内容怎样读写。`File` 和 `Path` 描述位置；`File` 的部分方法以及 `Files` 执行文件系统操作；流、Reader/Writer 和 Channel 负责内容传输。

## 两个专题怎样衔接

| 专题 | 解决的问题 | 学习与练习 |
| --- | --- | --- |
| [文件操作](./files/) | 文件在哪里，怎样按字节或字符正确读写，如何关闭资源与处理失败 | 知识地图 → 流与编码 → File 类 → 工程场景 → 分组题库 |
| [NIO 与 NIO.2](./nio/) | 怎样管理缓冲区、等待多个连接、操作现代文件系统和接收异步结果 | 基础 → Selector / 文件系统 / 异步通道 → 分组题库与场景题 |

两个专题共用路径、编码和资源管理等基础，但不要求全部串行读完。网络与异步通道依赖 Buffer 和读写进度模型；Path、Files 的常规文件系统操作可以独立学习。两个目录都提供原理、示例和面试练习，可以在一个主题内完成学习和复习。

## 按当前任务选择阅读路径

- **建立文件操作基础**：从[知识地图](./files/overview.md)开始，按[流与编码](./files/streams/) → [File 类](./files/file/) → [工程场景](./files/practice.md)阅读。
- **编写现代文件系统代码**：从[NIO.2 路径模型](./nio/filesystem/paths.md)进入 [Files 操作](./nio/filesystem/operations.md)与[完整实验](./nio/filesystem/lab.md)，再按需学习目录监听；对照或维护旧接口时阅读 [File 类](./files/file/)。
- **理解网络与异步编程**：按[NIO 基础](./nio/basics/) → [Selector](./nio/selector/) → [异步通道](./nio/async-channels/)阅读。
- **准备面试**：使用[文件操作 40 题](./files/interview/)或[NIO 与 NIO.2 42 题](./nio/interview/)自测，再回到所属专题补齐薄弱点。

阅读前只需了解 Java 的类、对象、方法调用和基本控制流程。完整示例标明文件名与运行方法；用于说明 API 的片段和伪代码会单独标注。
