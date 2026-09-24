---
title: 字节流与读写：正确处理 EOF、短读和缓冲
description: 理解流的职责，手写二进制复制，并区分创建、覆盖和追加。
type: doc
tags:
  - Java
  - 文件操作
  - I/O
order: 10
date: 2026-09-24
---

# 字节流与读写：正确处理 EOF、短读和缓冲

本文解决“怎样完整、准确地传输字节”。文本的解码与逐行处理见[字符编码](./encoding.md)；示例中的关闭语法见[资源管理](./resources.md)。复制方法使用 Java 8 可用 API，末尾的 writeString 片段需要 Java 11。

## 先按职责区分路径、操作工具和读写资源

| 层次 | 常见类型 | 核心职责 |
| --- | --- | --- |
| 路径描述 | `File`、`Path` | 表示位置，不等于创建或打开文件 |
| 文件系统操作 | `Files`、`File` 的部分方法 | 创建、删除、移动、列目录、读取属性 |
| 字节传输 | `InputStream`、`OutputStream` | 读写原始字节，适用于任意文件内容 |
| 字符传输 | `Reader`、`Writer` | 按 Java 字符单元处理文本 |
| 字节与字符转换 | `InputStreamReader`、`OutputStreamWriter` | 解码与编码，连接两类流 |
| 缓冲 | `BufferedInputStream`、`BufferedOutputStream`、`BufferedReader`、`BufferedWriter` | 减少细碎读写，提供逐行等便利方法 |
| 随机访问和通道 | `RandomAccessFile`、`FileChannel`、`ByteBuffer` | 定位、分块读写、映射、传输、锁等 |

`Files` 是静态工具类，不是 `File` 的集合。`File` 和 `Path` 一般不需要关闭；流、Channel、目录流等打开资源需要管理生命周期。NIO.2 的 `Files.newBufferedReader` 返回传统 `BufferedReader`，两套 API 本来就可以协作。[Java I/O 概览](https://dev.java/learn/api/io/java-io/)

## 传统流体系还要认识这些成员

- `FileInputStream` / `FileOutputStream`：文件字节输入输出。
- `FileReader` / `FileWriter`：文件字符输入输出；注意所用构造器的编码规则。
- `ByteArrayInputStream` / `ByteArrayOutputStream`：内存字节数组输入输出，不直接操作磁盘。
- `DataInputStream` / `DataOutputStream`：按约定格式读写 `int`、`long` 等基本类型。
- `ObjectInputStream` / `ObjectOutputStream`：Java 对象序列化，涉及兼容性与反序列化风险。
- `PrintWriter` / `PrintStream`：格式化输出；错误处理方式与普通 Writer 不完全相同。
- `GZIPInputStream` / `GZIPOutputStream`、`ZipInputStream` / `ZipOutputStream`：压缩格式的流式处理。

面试不必背完继承树，但要知道各类在处理什么数据、是否转换编码、是否缓冲以及谁关闭底层资源。`java.io` 中的 I/O 流与 `java.util.stream.Stream` 不是同一套概念；`Files.lines` 将文件读取接入 Stream API，才把两者联系起来。

## read 返回的是实际数量，不是“已经读满”

`InputStream.read()` 用 `int` 返回 `0..255` 或 EOF 标记 `-1`。返回 int 是为了同时表达全部字节值和 EOF；先强转为 byte 再判断，会把合法的 `0xFF` 与 `-1` 混淆。

`read(byte[])` 返回本次实际读取的数量；一次短读不等于结束。正常正长度阻塞流读取应获得数据、EOF 或异常；零长度请求可以返回 0。通道接口另外允许返回 0，不能直接套同一条推断。[InputStream API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/InputStream.html)

下面是可以放进类内的完整方法，需导入 `java.io.*`、`java.nio.file.*`；调用者处理 `IOException`：

```java
static long copyBytes(Path source, Path target) throws IOException {
    // CREATE_NEW 防止意外覆盖已有文件，包括误把同一路径当作目标。
    try (InputStream in = Files.newInputStream(source);
         OutputStream out = Files.newOutputStream(
                 target, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
        byte[] buffer = new byte[16 * 1024];
        long total = 0;
        int count;
        while ((count = in.read(buffer)) != -1) {
            // 最后一块或中途短读时，只写本次有效区间。
            out.write(buffer, 0, count);
            total += count;
        }
        return total;
    }
}
```

核心是 `out.write(buffer, 0, count)`。写整个数组会把上次残留的数据也写出去。16 KiB 只是示例大小，不是性能最优值；这里已经批量读写，不能用“没包装 BufferedInputStream 就一定逐字节访问磁盘”来评价。

把缓冲区缩小到 4 字节，假设输入内容为 ASCII 字节 `ABCDEF`，两次读取分别返回 4 和 2，就能直接看到有效长度的作用：

| 这次读取 | `count` | 缓冲区中的值 | 这次应写出的内容 |
| --- | --- | --- | --- |
| 第一次 | `4` | `A B C D` | `ABCD` |
| 第二次 | `2` | `E F C D` | `EF`，后面的 `C D` 是上次留下的值 |
| 再读到 EOF | `-1` | 不再根据数组内容决定结果 | 停止，不调用 write |

若第二次仍调用 `out.write(buffer)`，输出就会成为 `ABCDEFCD`。**数组容量决定一次最多能装多少，read 返回值决定本次有多少有效字节。** 这里的 4、2 只是一次可能的读取过程，真实读取也可能拆成更多次；循环必须只依赖实际返回值。[InputStream 批量读取契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/InputStream.html#read(byte%5B%5D))

目标父目录必须存在；中途失败可能留下不完整目标文件。生产中的对外发布可先写临时文件，校验成功后再按业务要求移动；普通复制不自动获得事务性。

## available、ready 和 skip 都有自己的边界

| 常见错误 | 为什么错误 | 正确处理 |
| --- | --- | --- |
| `new byte[in.available()]` 当作整个文件缓冲 | available 估计无需阻塞可读的字节量，不承诺总长度 | 固定大小分块，或仅对大小受控文件整体读取 |
| `while (in.available() > 0)` | 0 不必然意味着 EOF | 根据 read 返回值停止 |
| `while (reader.ready())` | ready 表示就绪提示，不能证明读取结束 | 根据 read/readLine 返回值停止 |
| `in.skip(n)` 后直接当作跳过 n | 实际跳过量可能较少 | 检查返回值，或使用适合协议的精确读取/定位 API |
| 把 `mark/reset` 当作任意 seek | 流不一定支持，标记也可能失效 | 查询 markSupported；随机文件访问用定位 API |

读取固定长度二进制字段时，可用 `DataInputStream.readFully`，不足会抛 `EOFException`；`readNBytes` 到 EOF 时仍可能返回少于请求的数量，必须核对。`InputStream.transferTo` 是 Java 9+ 的便捷传输方法，不会自动关闭输入输出，也不承诺使用内核零拷贝。[DataInputStream](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/DataInputStream.html)



## 缓冲为什么有效，什么时候收益有限

缓冲的思路是把多次细碎请求合并为较大的底层读写。它通常减少方法调用或系统调用开销，但不能改变磁盘吞吐上限，也不保证每个场景都更快。已经按大块读写时，再套一层缓冲的收益可能有限。

下面是组合关系示例：

```java
// 方法内片段；path 为 Path，需 java.io.*、java.nio.file.*、java.nio.charset.*
try (BufferedReader reader = new BufferedReader(new InputStreamReader(
        Files.newInputStream(path), StandardCharsets.UTF_8))) {
    System.out.println(reader.readLine());
}
```

底层流负责取字节，转换层负责解码，外层负责字符缓冲和逐行读取。给已有接口逐层增加能力，是装饰器模式的典型应用。[流的装饰与组合](https://dev.java/learn/java-io/reading-writing/decorating/)

要区分三种“缓存”：Java 对象中的缓冲、操作系统页缓存、存储设备缓存。`BufferedOutputStream` 只直接管理自己的那层。Java 缓冲区不是越大越好，堆内存、并发任务数与读写大小要一起考虑。

## 创建、覆盖和追加

```java
// Java 11+ 方法内片段；path 为 Path
// 以下为三种独立用法，根据业务选择，不要求依次执行。
Files.writeString(path, "new", StandardCharsets.UTF_8,
        StandardOpenOption.CREATE_NEW); // 只能创建，不允许覆盖

Files.writeString(path, "replace", StandardCharsets.UTF_8);
// 默认创建或截断已有内容。

Files.writeString(path, "append\n", StandardCharsets.UTF_8,
        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
// 不存在则创建，存在则追加。
```

`WRITE` 本身不等于截断；`CREATE` 本身不等于“只能新建”。已有文件上仅以 WRITE 从开头写短内容，可能留下原先的尾部。`CREATE_NEW` 把检查不存在与创建组合为原子步骤，比 `if (!exists())` 后再打开更适合表达排他创建。[StandardOpenOption](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/StandardOpenOption.html)

## 验证与下一步

复制代码应验证空文件、单字节文件、非整块大小、主动制造的短读、目标已存在和缺失父目录；比较内容或摘要，不能只看文件长度。失败时对外发布文件的策略见[工程场景](../practice.md)。

继续阅读[字符编码与文本处理](./encoding.md)，或练习[第 1–17 题](../interview/streams.md)。
