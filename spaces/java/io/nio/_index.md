---
title: NIO 与 NIO.2
description: 按基础、Selector、文件系统、异步通道和面试练习分主题学习 Java NIO。
type: doc
tags:
  - Java
  - NIO
  - NIO.2
order: 20
date: 2026-09-24
---

# NIO 与 NIO.2

本专题按缓冲区与文件通道、网络、文件系统和异步机制分工。学习通道时先理解等待模型和 Buffer 状态；只做 Path、Files 操作时，可以从文件系统目录直接进入。原理与完整实验相互衔接，面试问答集中管理。

## 五个主题与阅读顺序

| 顺序 | 主题 | 原理与实验 |
| --- | --- | --- |
| 1 | [NIO 基础](./basics/) | I/O 模型、Buffer 状态、Channel 传输、性能边界；BufferLab 与文件复制实验 |
| 2 | [Selector 网络编程](./selector/) | 就绪模型、事件循环、分帧与背压；完整回声服务器和客户端 |
| 3 | [NIO.2 文件系统](./filesystem/) | Provider、Path、遍历、属性与原子移动；文件实验和目录监听器 |
| 4 | [异步通道](./async-channels/) | 完成模型、Buffer 所有权、并发与取消；完整有界读取实验 |
| 5 | [42 道面试题与场景练习](./interview/) | 分组问答、4 个故障场景及 3 道代码题，附对应原理入口 |

这里的顺序便于完整浏览专题，不表示所有主题都是后一个主题的前置。开始前应了解 Java 基本语法、异常和 [try-with-resources](../files/streams/resources.md)；涉及文本时先掌握[字符编码](../files/streams/encoding.md)。

## 按当前目标选择路线

- **打基础**：I/O 模型 → Buffer → Channel，运行两个基础实验。
- **创建、遍历与移动文件**：[Path](./filesystem/paths.md) → [Files 操作](./filesystem/operations.md) → [文件实验](./filesystem/lab.md)，再按需要阅读目录监听。
- **按位置或批量传输文件内容**：Buffer → FileChannel → 性能边界；需要异步提交时再进入异步通道。
- **理解网络框架**：基础 → Selector 模型 → 回声实验 → 协议与并发边界。
- **采用异步 API**：先分清就绪和完成，再学习异步模型、实验与生命周期。
- **准备面试**：先做所属主题的题目，再沿原理链接补齐薄弱点，最后完成故障与代码题。

## 与文件操作专题的分工

[文件操作](../files/)负责流、编码、资源关闭、旧 File API 及文件处理场景；这里深入 Buffer、Channel、Selector、现代文件系统和异步机制。NIO 不等于全部非阻塞，NIO.2 也不等于只有异步。

正文保留官方来源与版本边界，完整程序标明文件名和运行方式；需要相互运行的服务器、客户端通过明确链接配对。学习时先预测输出和状态，再运行验证。
