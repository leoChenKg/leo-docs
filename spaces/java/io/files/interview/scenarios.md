---
title: 文件操作面试题 35–40：手写代码与工程场景
description: 通过复制文件、大日志处理、代码找错、配置发布、上传路径和递归删除 6 个场景练习失败处理与边界设计。
type: reference
tags:
  - Java
  - 文件操作
  - 面试
  - I/O
order: 40
date: 2026-09-24
---

# 文件操作面试题 35–40：手写代码与工程场景

本篇把前 34 题用于具体实现。先独立写出代码或方案，再检查资源由谁关闭、失败后留下什么、并发时谁能修改状态。

代码除明确标为错误的片段外，均使用 Java 8 可用的 API；方法需要放入类中，并按题目说明补充 import。原理回顾：[正确读取](../streams/reading.md)、[编码](../streams/encoding.md)、[资源管理](../streams/resources.md)和[文件操作工程实践](../practice.md)。

## 手写、找错与场景设计

### 35. 手写一个不会覆盖目标文件的二进制复制方法

**题目：** 在 Java 8 中将源文件复制到一个尚不存在的目标路径，不把整个文件装进内存。说明失败后会留下什么。

**参考答案：** 下面是类内方法，需导入 `java.io.InputStream`、`OutputStream`、`IOException` 和 `java.nio.file` 中的 `Path`、`Files`、`StandardOpenOption`。目标父目录由调用方准备；`CREATE_NEW` 拒绝覆盖已有条目。

```java
static long copyToNewFile(Path source, Path target) throws IOException {
    try (InputStream in = Files.newInputStream(source);
         OutputStream out = Files.newOutputStream(
                 target, StandardOpenOption.CREATE_NEW,
                 StandardOpenOption.WRITE)) {
        byte[] buffer = new byte[16 * 1024];
        long total = 0;
        int n;
        while ((n = in.read(buffer)) != -1) {
            out.write(buffer, 0, n);
            total += n;
        }
        return total;
    }
}
```

关键是关闭资源、循环读到 EOF、只写本次的 `n` 字节、拒绝覆盖已有目标。源文件在复制期间变化时，结果不构成稳定快照；写入失败可能留下部分目标，本例将异常交给调用方决定保留诊断还是清理。若需要“完成前不暴露目标”，应使用临时文件发布方案。

**追问：测试至少覆盖什么？** 空文件、包含 `0xFF` 的二进制、长度不是缓冲区整数倍、目标已存在、父目录不存在和读取中途失败。只测一行英文文本不足以证明复制正确。

### 36. 10 GB 日志中统计包含 ERROR 的行，如何控制内存？

**题目：** 日志编码已知为 UTF-8，统计包含字面字符串 `ERROR` 的行数；不要把全部内容放进 List。

**参考答案：** 逐行读取并维护计数。以下是 Java 8 类内方法，需导入 `BufferedReader`、`IOException`、`StandardCharsets`、`Path` 与 `Files`。

```java
static long countErrorLines(Path path) throws IOException {
    long count = 0;
    try (BufferedReader reader = Files.newBufferedReader(
            path, StandardCharsets.UTF_8)) {
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.contains("ERROR")) {
                count++;
            }
        }
    }
    return count;
}
```

该算法不会保存全部行，内存主要受缓冲和最长行影响。实际日志应明确匹配规则：字面包含、日志级别字段和多行异常记录不是同一个任务。若一行可能占几 GB，仍需限制行长或按块增量识别。

**追问：直接 parallel() 是否必然加速？** 不一定。存储吞吐、文本解码和分割能力可能是瓶颈；先量测再决定并行，且不能让并发业务处理无限积压。

### 37. 找错：为什么这个读取代码既可能漏数据，也可能乱码？

**题目：** 以下为故意错误的方法内片段；`in` 为已经打开的 `InputStream`。

```java
byte[] bytes = new byte[in.available()];
in.read(bytes);
String text = new String(bytes);
```

**参考答案：** 第一行把无阻塞读取量当总长度；第二行忽略短读、EOF 和返回的有效范围；第三行依赖默认编码，还可能解码未填满数组的无效区域。此外片段没有说明谁负责关闭输入。应先确认任务是二进制还是文本、文件规模是否有上限，再选择循环复制、Reader 或有大小约束的整体读取。

**追问：改成 new String(bytes, UTF_8) 就修好了吗？** 只修复编码选择的一部分问题，长度、短读、资源所有权与输入规模问题仍在；逐块独立解码还会产生[第 9 题](./streams.md)的边界错误。

### 38. 更新配置文件时，怎样避免读者看到写了一半的内容？

**题目：** 多个读取者持续打开配置文件，写入者偶尔发布新版本。要求尽可能保持读取者观察到完整版本，并解释断电风险。

**参考答案：** 设计顺序是：在目标目录中创建临时文件，完整写入并校验；按持久性需求刷新上层缓冲并同步文件；关闭写入资源；请求原子移动发布；明确失败后的临时文件清理和重试规则。同目录提高处于同一文件存储的可能性，但仍必须处理不支持原子移动的情况。[移动文件教程](https://docs.oracle.com/javase/tutorial/essential/io/move.html)

不能笼统承诺“`ATOMIC_MOVE + REPLACE_EXISTING` 一定能替换已有配置”，目标存在时行为由实现决定。若部署平台不能保证所需替换语义，可以采用不可变版本文件加受控版本指针，或引入更合适的存储服务。原子可见性与断电后持久性要分别验证；目录项持久化也不能仅由一次文件刷新推导。

**追问：如果两个写入者同时更新？** 原子发布只避免半成品可见，不会自动防止丢失更新。还需单写入者、版本检查或适合部署环境的锁与事务机制。

### 39. 上传文件名为 ../../secret.txt，如何阻止目录越界？

**题目：** 服务允许用户上传文件，存放于指定目录。除了过滤 `../`，还要考虑什么？

**参考答案：** 最简单的业务设计是由服务生成保存名称，用户原名仅作为经过处理的元数据。若必须接收相对路径，先拒绝绝对路径，再用受信任根目录 `resolve`、`normalize`，并用 `Path.startsWith` 检查路径级包含关系；字符串前缀不足以表达目录边界。还要考虑符号链接、检查后替换的竞态、已有条目覆盖和权限。[Path 路径操作](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Path.html)

纯 normalize 不能防止链接把操作导向根目录外。应控制根目录及祖先的写权限和链接策略；在提供者支持时，可用相对已打开目录操作的 `SecureDirectoryStream` 处理部分竞态，具体方案取决于威胁模型和平台。[SecureDirectoryStream](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/SecureDirectoryStream.html)

**追问：对不存在的上传目标直接 toRealPath 是否可行？** 不可行，因为它要求目标存在；只检查父目录的真实路径仍不能消除之后被替换的窗口。

### 40. 手写递归删除目录，怎样表达顺序和失败策略？

**题目：** 删除调用方明确指定、可控制且不会被其他主体修改的一棵测试目录树；默认不跟随符号链接，任何删除失败立即报告。

**参考答案：** 通过 visitor 在文件访问时删除文件，目录访问结束后删除目录。以下是 Java 8 类内方法，需导入 `IOException`、`java.nio.file.*` 和 `java.nio.file.attribute.BasicFileAttributes`。只能对已经确认允许删除的目录使用；根目录验证属于调用方职责。

```java
static void deleteControlledTree(Path root) throws IOException {
    Files.walkFileTree(root, new SimpleFileVisitor<Path>() {
        @Override
        public FileVisitResult visitFile(Path file,
                                         BasicFileAttributes attrs)
                throws IOException {
            Files.delete(file);
            return FileVisitResult.CONTINUE;
        }

        @Override
        public FileVisitResult postVisitDirectory(Path directory,
                                                  IOException failure)
                throws IOException {
            if (failure != null) {
                throw failure;
            }
            Files.delete(directory);
            return FileVisitResult.CONTINUE;
        }
    });
}
```

`SimpleFileVisitor` 默认的访问失败行为会传播异常；这里也没有忽略目录遍历失败。此调用默认不跟随链接，访问到的链接作为条目删除。已成功删除的子项不会因为后续失败而恢复，因此这不是可回滚事务。[文件树遍历与后序删除](https://docs.oracle.com/javase/tutorial/essential/io/walk.html)

**追问：把根目录字符串检查一次，能安全删除攻击者可改的目录吗？** 不能。上述例子明确面向受控目录；敌对并发修改需要不同的权限、句柄相对操作和竞态防护设计，不能靠普通递归删除代码自动获得安全保证。

完成后返回[40 题入口](./)检查薄弱点；涉及可靠写入、并发和路径边界的推理，可回到[文件操作工程实践](../practice.md)。
