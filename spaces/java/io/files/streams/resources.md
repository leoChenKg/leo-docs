---
title: 资源管理与写入保证：关闭、异常、刷新和持久化
description: 掌握 try-with-resources、惰性流生命周期，以及 flush、force 与原子性的区别。
type: doc
tags:
  - Java
  - 文件操作
  - I/O
order: 30
date: 2026-09-24
---

# 资源管理与写入保证：关闭、异常、刷新和持久化

本文解决“谁负责关闭资源，失败怎样暴露，写入完成究竟保证了什么”。先读[字节流](./reading.md)与[编码](./encoding.md)，末尾用一个完整程序串起三个基础主题。

## try-with-resources 的四条规则

1. 资源需要实现 `AutoCloseable`；多数 I/O 资源实现其子接口 `Closeable`。
2. 资源按声明顺序初始化，按**相反顺序**关闭。
3. 后面的初始化失败时，前面已成功初始化的资源也会关闭。
4. 业务代码与 close 都抛异常时，业务异常作为主异常，关闭异常通常附在 `getSuppressed()` 中；如果只有关闭失败，则关闭异常可以成为主异常。

手写 finally 容易忘记关闭、在第一个 close 失败后跳过其他资源，或者覆盖原始异常。TWR 是语言层面的资源管理结构，并非等待 GC 再清理。[Java 语言规范：try-with-resources](https://docs.oracle.com/javase/specs/jls/se25/html/jls-14.html#jls-14.20.3)、[官方教程](https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html)

包装流通常关闭最外层即可级联关闭底层；但资源所有权仍需明确。方法接收调用者传入的流时，不应无约定地关闭它；库方法返回惰性 Stream 时，需要把关闭责任交代清楚。

级联关闭的前提是外层包装已成功构造。若外层构造可能失败，例如 `ObjectInputStream` 读取流头失败，应先把底层流单独登记在 TWR 中，避免嵌套 `new` 尚未完成时泄漏已打开的资源。

## 这些惰性资源很容易遗漏

```java
// 方法内片段；path 为 Path，需 java.util.stream.Stream 等 import
try (Stream<String> lines = Files.lines(path, StandardCharsets.UTF_8)) {
    long count = lines.filter(line -> line.contains("ERROR")).count();
    System.out.println(count);
}
```

`Files.lines/list/walk/find` 的返回值需要关闭，执行 `count()` 或 `forEach()` 不等于自动 close。流创建阶段可能抛 `IOException`，迭代阶段的 I/O 异常还可能以 `UncheckedIOException` 暴露。

`BufferedReader.lines()` 又有细节：关闭它返回的 Stream 不应被当成会自动关闭 reader 的保证；让 reader 本身位于 TWR 中最清楚。不要在方法内关闭 reader 后，把它的惰性 lines Stream 返回给别人消费。

## 异常应该保留哪些信息

至少保留操作、路径与原始异常。需要时区分不存在、访问被拒绝、目录非空、空间不足等情况；具体异常种类取决于 Provider 的诊断能力，仍需兜底 `IOException`。不能用空 catch 把部分写入伪装成成功。

`PrintWriter` 的许多输出方法不向调用者传播 I/O 异常，而是记录错误状态，要检查 `checkError()`。对不能接受静默写入失败的文件输出，优先选择错误行为明确的 Writer。[PrintWriter API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/PrintWriter.html)

## flush、close、force 与原子性的区别

| 行为 | 主要解决的问题 | 不能据此保证 |
| --- | --- | --- |
| `write` 返回 | 本次调用完成到 API 规定的层次 | 文件已经抗断电持久化 |
| `flush()` | 将 Java 输出缓冲向下游推进 | OS 与设备缓存全部持久化 |
| `close()` | 结束使用，释放资源；许多输出包装会先刷新 | 所有输出都已获得断电恢复保证 |
| `FileChannel.force(...)` / `FileDescriptor.sync()` | 请求底层同步持久化 | 任意远程存储、硬件和目录更新都具有相同保证 |
| `ATOMIC_MOVE` | 路径移动的原子可见性 | 一整套业务更新事务或断电后一定保存 |

不是所有流都有自己的缓冲，`OutputStream.flush()` 的基类实现本身不做事。`flush()` 也不会关闭资源。若 writer 上方仍有未刷出的数据，先对底层 channel 调用 force，不能持久化那些尚未传给它的字节。[OutputStream.flush](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/OutputStream.html#flush())

`force(false)` 主要要求内容更新写入设备，`force(true)` 还要求元数据；操作系统有时即使传 false 也需同步某些元数据。对本地文件和非本地存储的保证不同。通过映射缓冲区修改文件时应查看映射对象的 force 契约，不能假定任意一次 FileChannel.force 会覆盖所有映射修改。[FileChannel.force](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileChannel.html#force(boolean))

**面试表述示范：**“我会先明确要求是进程内可见、其他读者看不到半成品，还是掉电后仍能恢复。Java 缓冲刷新、原子移动和持久化分别解决其中不同的问题。”

## 综合实验：编码、EOF 与关闭异常

下面的完整程序不修改磁盘文件，适合先验证三个面试关键点：字符计数、available 与 EOF、关闭顺序与 suppressed 异常。保存为 `FileInterviewTraps.java`，使用 Java 8+ 运行。

```java
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class FileInterviewTraps {
    static class Resource implements AutoCloseable {
        private final String name;

        Resource(String name) {
            this.name = name;
        }

        @Override
        public void close() throws IOException {
            System.out.println("close " + name);
            // 故意制造关闭失败，观察它是否覆盖业务异常。
            throw new IOException("close-" + name);
        }
    }

    public static void main(String[] args) throws IOException {
        String text = "A中😀";
        System.out.println("bytes=" + text.getBytes(StandardCharsets.UTF_8).length);
        System.out.println("chars=" + text.length());
        System.out.println("codePoints=" + text.codePointCount(0, text.length()));

        // 模拟“无法给出立即可读数量”的流，实际仍包含一个字节。
        try (InputStream input = new ByteArrayInputStream(new byte[]{(byte) 0xFF}) {
            @Override
            public int available() {
                return 0;
            }
        }) {
            System.out.println("available=" + input.available());
            System.out.println("read=" + input.read());
            System.out.println("eof=" + input.read());
        }

        try (Resource first = new Resource("A");
             Resource second = new Resource("B")) {
            throw new IOException("body");
        } catch (IOException error) {
            System.out.println("primary=" + error.getMessage());
            for (Throwable suppressed : error.getSuppressed()) {
                System.out.println("suppressed=" + suppressed.getMessage());
            }
        }
    }
}
```

```sh
javac -encoding UTF-8 FileInterviewTraps.java
java FileInterviewTraps
```

预期输出：

```text
bytes=8
chars=4
codePoints=3
available=0
read=255
eof=-1
close B
close A
primary=body
suppressed=close-B
suppressed=close-A
```

第一组输出验证“字节、char、码点不同”；第二组说明 available 为 0 不能当作结束，合法 `0xFF` 应通过 int 的 255 与 EOF 区分；第三组说明两项资源逆序关闭，业务异常没有被关闭异常覆盖。

## 继续练习

完成[第 13–17 题](../interview/streams.md)，重点口述逆序关闭、suppressed 异常和资源所有权。需要避免半成品配置、协调多个写入者时，继续阅读[工程场景](../practice.md)。
