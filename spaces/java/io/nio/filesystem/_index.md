---
title: NIO.2 文件系统：路径、操作与目录监听
description: 按路径模型、Files 操作、完整文件实验与 WatchService 分篇学习 NIO.2 文件系统。
type: doc
tags:
  - Java
  - NIO.2
  - 文件系统
order: 30
date: 2026-09-24
---

# NIO.2 文件系统：路径、操作与目录监听

本目录把 NIO.2 文件系统分成路径模型、具体操作、完整实验和目录监听。路径对象与文件状态分开；路径归一化与链接解析分开；原子移动与持久化分开；目录事件与完整历史分开。

适合已经了解基本文件读写和 `try-with-resources`、准备从 `File` 转向 `Path` / `Files` 的读者。学完后应能选对路径与遍历 API，解释链接和失败语义，并区分文件状态、目录通知与业务上的“处理完成”。

## 推荐阅读顺序

| 文章 | 解决的问题 |
| --- | --- |
| [Path 与文件系统](./paths.md) | 路径属于哪个 FileSystem、Provider 如何参与操作，以及词法路径与真实路径的区别 |
| [Files 操作与目录遍历](./operations.md) | 创建与追加、异常、访问者、链接、属性和原子移动怎样表达操作意图 |
| [Nio2FilesLab 文件实验](./lab.md) | 在临时目录中验证创建、读写、复制、移动、跳过子树和清理 |
| [WatchService 目录监听](./watch.md) | WatchKey 生命周期、完整监听器、事件溢出与重新扫描 |

初次学习按表中顺序阅读；希望先看到运行结果，可以从实验进入，再回到操作篇解释输出。面试复习集中在[文件系统与性能问答](../interview/files.md)，原理文章不再重复一组问答。

## 与其他专题的分工

NIO.2 对应 JSR 203，范围包括文件系统访问、异步 I/O、Socket 配置和组播等；它没有把所有文件调用变成异步调用。本目录研究文件系统部分，异步请求与完成通知见[异步通道](../async-channels/)。[JSR 203](https://jcp.org/en/jsr/detail?id=203)

- 流、编码与关闭责任：见[流与编码](../../files/streams/)，这里仅保留目录资源特有的生命周期。
- File 旧 API 与迁移：见[File 文件操作](../../files/file/operations.md)。
- 大文件、发布协议、上传与解压：见[文件处理工程场景](../../files/practice.md)。
- 通道位置、文件锁与映射：见[FileChannel](../basics/file-channel.md)和[性能与持久化](../basics/performance.md)。

## 资料与版本

内容依据 Java SE 25 的 API 契约，完整实验使用 Java 11+。`Path.of`、`Files.readString`、`Files.writeString` 是 Java 11 增加的便捷方法；NIO.2 的主体来自 Java 7，`Files.walk`、`find`、`list`、`lines` 则从 Java 8 提供。每篇保留对应的官方资料链接，使用时应核对目标 JDK 与文件系统支持的能力。
