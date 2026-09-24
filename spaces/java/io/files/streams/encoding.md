---
title: 字符编码与文本：UTF-8、分块解码和逐行读取
description: 区分字节、char 与码点，避免乱码、跨块解码错误和逐行读取误用。
type: doc
tags:
  - Java
  - 文件操作
  - I/O
order: 20
date: 2026-09-24
---

# 字符编码与文本：UTF-8、分块解码和逐行读取

本文解决“如何把文件字节正确解释成文本”。先掌握[读写循环](./reading.md)；短片段需放入类或方法，完整综合实验见[资源管理篇](./resources.md)。

## 文本也由字节存储，字符流负责解释它

磁盘上保存的是字节。所谓文本文件，是按照某种字符编码解释这些字节。字节流可以读取文本，也能处理图片、视频、压缩包；字符流在与字节源连接时，通过字符集进行解码或编码。

```text
文件字节 → InputStream → InputStreamReader(编码) → Reader → Java 字符
Java 字符 → Writer → OutputStreamWriter(编码) → OutputStream → 文件字节
```

编码是“字符到字节”，解码是“字节到字符”。把 UTF-8 字节按其他编码解释，可能乱码或报告错误；把图片经过 Reader/Writer 往返转换，则可能破坏二进制内容。

“字节流每次一个字节，字符流每次两个字节”是错误答案。两类流都有批量读取方法；Reader 的单位是 UTF-16 `char`，文件中一个字符占多少字节取决于编码。[Reader API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/Reader.html)

## 一个 char 不等于一个完整的 Unicode 字符

以下是方法体片段，需导入 `java.nio.charset.StandardCharsets`：

```java
String text = "A中😀";
System.out.println(text.getBytes(StandardCharsets.UTF_8).length); // 8 字节
System.out.println(text.length());                              // 4 个 char
System.out.println(text.codePointCount(0, text.length()));        // 3 个码点
```

其中 `A` 是 1 个 UTF-8 字节，`中` 是 3 个，`😀` 是 4 个。这里的 `😀` 在 Java 字符串中使用一对代理项，占两个 `char`。用户感知的一个字符还可能由多个码点组合，因此字节数、char 数、码点数和可见字符数要分别讨论。

## 默认编码要带版本条件回答

Java 17 及以前，依赖默认字符集的 API 常随平台和环境变化；JDK 18 的 JEP 400 将标准 Java API 的默认字符集设为 UTF-8，控制台相关行为等仍有边界。默认值变化不代表历史文件自动转码，也不能把已有 GBK 文件用 UTF-8 正确读取。

`Files.readString(path)` 本身就默认 UTF-8；不能说“所有不传 Charset 的方法在旧 JDK 都使用操作系统编码”。边界文件格式和跨系统接口仍适合显式指定 `StandardCharsets.UTF_8`。[Oracle Java 团队对 JEP 400 的说明](https://inside.java/2021/10/04/the-default-charset-jep400/)、[Files 文本读写契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html)

## 分块读取不可以随意分块解码

一次 `read(byte[])` 可能在一个 UTF-8 字符的中间结束。对每个 byte 块单独调用 `new String(block, UTF_8)`，会丢失解码器需要延续到下一块的状态。读文本优先交给 Reader；自己处理 ByteBuffer 时使用有状态的 `CharsetDecoder`，保留未完整解码的字节，并正确处理输入结束和 flush。

例如 `A中B` 的 UTF-8 字节是 `41 E4 B8 AD 42`。如果读取边界恰好落在 `E4 B8` 后面，两块分别包含什么？

| 输入阶段 | 本次收到的字节（十六进制） | 连续解码应得到什么 |
| --- | --- | --- |
| 第一块，后续还可能有输入 | `41 E4 B8` | 输出 `A`，保留尚未完整的 `E4 B8` |
| 第二块 | `AD 42` | 把先前保留的字节与 `AD` 接上，输出 `中B` |
| 输入真正结束 | 没有更多字节 | 结束解码并 flush；若仍有不完整序列，按错误策略处理 |

每块单独构造 String，相当于每次都把当前块当作完整文本；第一块缺少 `中` 的最后一个字节，第二块又从一个续接字节开始，之后把两个字符串拼起来也无法恢复原字节序列。使用 `CharsetDecoder` 时，**复用解码器和保留输入缓冲区中的剩余字节都需要做到**，不能认为解码器会替调用者保存所有未消费字节。[分步解码契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/charset/CharsetDecoder.html#decode(java.nio.ByteBuffer,java.nio.CharBuffer,boolean))

对非法字节的处理也不是所有构造方式都相同。严格导入可配置 `CodingErrorAction.REPORT`；需要容错则明确替换或忽略策略，并记录数据质量问题。[CharsetDecoder API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/charset/CharsetDecoder.html)

## 按行处理文本

以下是类内完整方法，需导入 `java.io.*`、`java.nio.file.*` 和 `java.nio.charset.StandardCharsets`，使用 Java 8+：

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

`readLine()` 返回不含行结束符的字符串；空行是 `""`，EOF 是 `null`。它避免一次装入整个文件，但仍需要容纳一整行：如果单行有几 GB，照样可能内存溢出。逐行重新写出还可能改变换行符，不能当成字节完全一致的复制。[BufferedReader](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/BufferedReader.html)

## 继续练习

用[第 7–12 题](../interview/streams.md)检查编码、空行、非法字节和二进制格式；超大日志、分段处理与内存限制见[工程场景](../practice.md)。
