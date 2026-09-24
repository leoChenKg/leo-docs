---
title: NIO 与 NIO.2 面试：42 题与场景练习
description: 按模型、网络、文件和异步分组复习，结合故障场景与代码题检查工程边界。
type: reference
tags:
  - Java
  - NIO
  - NIO.2
  - 面试
order: 50
date: 2026-09-24
---

# NIO 与 NIO.2 面试：42 题与场景练习

面试需要说明 API 解决什么问题、谁负责推进操作，以及遇到部分完成、异常和资源耗尽时怎么办。42 道问答按主题拆为四篇，另有一篇故障和代码练习；题号、答案与追问保留连续性，不代表企业出题频率统计。

## 复习优先级与题号

| 顺序 | 题组 | 重点 |
| --- | --- | --- |
| P0：先练熟 | [第 1–12 题：I/O 模型与 Buffer](./models-buffers.md) | API 范围、就绪/完成、position/limit、共享视图 |
| P0：先练熟 | [第 13–23 题：Selector 与网络](./network.md) | selectedKeys、OP_WRITE、分帧、背压与连接状态 |
| P1：完整覆盖 | [第 24–36 题：文件通道与文件系统](./files.md) | direct/mmap/force、Path/Files、原子移动与监听 |
| P1：完整覆盖 | [第 37–42 题：异步与现代 Java](./async.md) | pending、所有权、超时取消、执行资源与虚拟线程 |
| 综合练习 | [4 个故障场景与 3 道代码题](./scenarios.md) | 诊断空转、积压、泄漏和竞态，推演实际状态 |

资料基线为 Java SE 25 官方 API、JCP 与 OpenJDK JEP，初次核对日期为 2026-09-24。主体知识面向 Java 8/11/17/21，示例和现代能力分别标明最低版本；具体引用保留在各题和原理文章中。

已做过文件操作 40 题时，先查看[两套题库的对应关系](../../files/interview/#两套题库怎样配合)，重点补齐网络状态、共享视图、异步所有权和故障推理。本题库保留交叉主题的直接答案，便于独立自测；不要求重复背诵同一概念。

## 两分钟总述

> NIO 在 Java 1.4 引入，以 Buffer、Channel、Selector 和字符集处理为核心；NIO.2 在 Java 7 扩展文件系统 API 与异步通道。NIO 不是“非阻塞”的同义词：SocketChannel 默认阻塞，FileChannel 也不能注册 Selector。非阻塞网络通常用 Selector 等待就绪，再由应用调用 read/write，属于 Reactor 风格；异步通道先提交操作，再通过 Future 或 CompletionHandler 接收结果，属于完成通知、Proactor 风格。两种方式都必须处理部分读写、消息分帧、Buffer 所有权、背压和关闭。选择方案要看工作负载与现有框架；Java 21+ 的虚拟线程也使顺序阻塞代码成为值得评估的并发方案。

版本与范围依据 [JSR 51](https://jcp.org/en/jsr/detail?id=51)、[JSR 203](https://jcp.org/en/jsr/detail?id=203)；虚拟线程依据 [JEP 444](https://openjdk.org/jeps/444)。

回答时沿着“**定义 → 工作过程 → 例子 → 边界**”展开。比如说完 Selector 可以管理多个连接，还应补上“事件循环不能执行长时间阻塞业务、发送队列必须有界”，才把机制和工程问题连起来。

## 自测验收

先完成模型、Buffer 和网络题，再覆盖文件系统与异步；第二轮运行并修改实验观察结果，第三轮练故障排查与版本边界。

- 能手推 flip/compact，并识别 wrap 后多余的 flip。
- 能说明部分读写、EOF、OP_WRITE 与背压。
- 能区分分帧和字符解码、原子可见与持久化。
- 能处理目录资源、链接、监听溢出，以及异步 Buffer 的所有权。
- 能依据 JDK 版本讨论虚拟线程，说明优化机会的适用条件。

按薄弱点返回[NIO 专题入口](../)，每组题的开头都有对应原理链接。
