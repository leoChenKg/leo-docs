---
title: File 类：路径、操作与实验
description: 按路径模型、文件系统操作和完整实验理解 java.io.File，重点掌握返回值、平台差异与迁移边界。
type: doc
tags:
  - Java
  - 文件操作
  - File
order: 30
date: 2026-09-24
---

# File 类：路径、操作与实验

`File` 表示文件或目录的抽象路径，也提供部分传统文件系统操作。学习时先区分**路径对象、文件系统中的对象、打开的读写资源**，再观察各类方法会改变哪一层。

本目录按路径、操作、实验三个主题组织。初学时按顺序阅读，排查问题时直接查对应主题。

## 阅读顺序

| 文章 | 主要问题 |
| --- | --- |
| [路径模型与构造边界](./paths.md) | 构造器做什么；相对、绝对、规范和真实路径怎样区别；equals 比较什么 |
| [查询、创建、遍历与迁移](./operations.md) | 返回 false、null、0 各意味着什么；如何创建、列举、删除、改名；如何迁移到 Files |
| [FileLab：运行完整文件操作实验](./lab.md) | 在独立临时目录中验证构造、创建、查询、遍历、改名与清理 |

先读前两篇理解契约，再运行实验验证自己的预测；遇到遗留项目，也可以直接查对应操作。

## 与其他主题的分工

- 内容读写、缓冲与 EOF：[正确读取与写入](../streams/reading.md)。
- 字节、字符及乱码：[字符编码](../streams/encoding.md)。
- 流的关闭与异常处理：[资源管理](../streams/resources.md)。
- 大文件、并发、可靠发布和路径安全：[工程实践](../practice.md)。
- 按问题检查理解：[文件操作面试题](../interview/)。
- 系统学习 Path、Files、目录遍历和文件属性：[NIO.2 文件系统](../../nio/filesystem/)。

## 资料与版本

内容以 [Java SE 25 File API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/File.html) 和 [OpenJDK 25 源码](https://github.com/openjdk/jdk/blob/jdk-25-ga/src/java.base/share/classes/java/io/File.java)为主要依据。原实验于 2026-09-24 在 macOS、JDK 26.0.1 验证；平台现象不代表跨平台保证。

`FileLab` 使用 Java 8 可用的 API；标注 Java 11+ 的片段使用 `Path.of` 等较新方法。`File` 整个类没有被弃用，学习目标是理解它的边界，并在需要时通过 `toPath()` 与现代 API 协作。
