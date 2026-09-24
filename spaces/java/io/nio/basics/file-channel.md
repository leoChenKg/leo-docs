---
title: Channel 与文件传输：部分读写、位置与并发
description: 运行 FileChannel 复制实验，掌握传输进度、双重游标、分散聚集和文件锁。
type: doc
tags:
  - Java
  - NIO
  - NIO.2
order: 30
date: 2026-09-24
---

# Channel 与文件传输：部分读写、位置与并发

本文解释通道实际推进了多少数据，以及文件位置和 Buffer 状态怎样协作。先读[ByteBuffer](./buffers.md)；完整 ChannelCopyDemo 使用 Java 11 已有 API，并在独立临时目录中验证二进制复制。

## 通道类型与能力边界

| 通道 | 常见用途 | 关键边界 |
| --- | --- | --- |
| `FileChannel` | 文件读写、定位、映射、文件锁 | 不能注册到 Selector，没有 `configureBlocking(false)` |
| `SocketChannel` | TCP 连接的字节读写 | 新建时默认阻塞，可改为非阻塞 |
| `ServerSocketChannel` | 接受 TCP 连接 | accept 得到新的 SocketChannel |
| `DatagramChannel` | UDP 数据报 | 必须按数据报语义处理，不能照搬 TCP 字节流模型 |
| `Pipe.SourceChannel/SinkChannel` | 管道读写 | 单向端点，可参与选择 |
| `SeekableByteChannel` | 可定位字节通道的接口 | 不承诺具有 FileChannel 的映射和锁能力 |

只有属于 `SelectableChannel` 体系、并处于非阻塞模式的通道，才能用于 Selector。`FileChannel` 是 NIO 但不属于这个体系，正好证明了 NIO 与非阻塞不能画等号。[SelectableChannel](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/SelectableChannel.html)

另外，不是所有 Channel 都双向。某个 FileChannel 是否可读可写，取决于打开选项；管道的 source/sink 各负责一个方向。

### read 与 write 的返回值决定程序是否正确

对于字节流通道的读取，典型处理是：

| 返回值 | 表示什么 | 应用动作 |
| --- | --- | --- |
| `n > 0` | 本次放入 Buffer 的字节数 | 处理已到达字节，保留未完成数据 |
| `n == 0` | 本次没有传输字节 | 检查是否有容量；非阻塞网络等待下次就绪 |
| `n == -1` | 流结束 EOF | 结束输入，处理残留数据和输出收尾 |

写入返回本次从 Buffer 消费的字节数，可能小于 `remaining()`，也可能为 0。不能把一次 `write(buffer)` 当作“全部发送完毕”。

```java
// 方法内片段：适用于同步写文件等场景，out 为已打开的 FileChannel。
while (buffer.hasRemaining()) {
    int written = out.write(buffer);
    if (written == 0) {
        throw new java.io.IOException("写入没有进展，停止以避免空转");
    }
}
```

这里“无进展就抛异常”是教学示例选择的保守策略，不是在说 0 必然代表通道故障。真实非阻塞 Socket 必须保存余下数据、等待可写事件，不能在同一线程里无休止重试。

## 完整实验：FileChannel 二进制复制

这个例子使用临时文件，先生成数据，再通过 1 KiB Buffer 分批复制，最后按字节验证结果。故意让文件大小超过 Buffer，保证会执行多次读取。

保存为 `ChannelCopyDemo.java`：

```java
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;

public class ChannelCopyDemo {
    static long copy(Path source, Path target) throws IOException {
        // 示例创建新目标，避免意外截断已有文件或源文件。
        try (FileChannel in = FileChannel.open(source, StandardOpenOption.READ);
             FileChannel out = FileChannel.open(target,
                     StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            ByteBuffer buffer = ByteBuffer.allocate(1024);
            long total = 0;
            while (true) {
                int n = in.read(buffer);
                if (n == -1) {
                    return total;
                }
                if (n == 0) {
                    throw new IOException("读取没有进展");
                }

                // 刚读入 n 字节，要先把可消费边界限定为这 n 字节。
                buffer.flip();
                while (buffer.hasRemaining()) {
                    int written = out.write(buffer);
                    if (written == 0) {
                        throw new IOException("写入没有进展");
                    }
                    total += written;
                }
                // 只有本轮数据全部写出，才可以复用整块缓冲区。
                buffer.clear();
            }
        }
    }

    public static void main(String[] args) throws IOException {
        Path directory = Files.createTempDirectory("nio-copy-");
        Path source = directory.resolve("source.bin");
        Path target = directory.resolve("target.bin");
        try {
            byte[] expected = new byte[10_003];
            for (int i = 0; i < expected.length; i++) {
                expected[i] = (byte) (i % 251);
            }
            Files.write(source, expected);
            long copied = copy(source, target);
            boolean equal = Arrays.equals(expected, Files.readAllBytes(target));
            if (copied != expected.length || !equal) {
                throw new AssertionError("复制结果不匹配");
            }
            System.out.println("复制字节数 = " + copied);
            System.out.println("内容完全一致 = " + equal);
        } finally {
            Files.deleteIfExists(target);
            Files.deleteIfExists(source);
            Files.deleteIfExists(directory);
        }
    }
}
```

```sh
javac --release 11 -encoding UTF-8 ChannelCopyDemo.java
java ChannelCopyDemo
```

预期输出 `复制字节数 = 10003` 和 `内容完全一致 = true`。

这段代码有五个值得观察的点：

1. Path 描述位置，FileChannel 持有打开后的资源，ByteBuffer 保存当前批次。
2. 内层循环保证完全写出本轮数据，外层循环继续读取下一批。
3. 最后一批不足 1024 字节；`flip()` 把 limit 限定到实际长度，避免写出旧数据。
4. `try-with-resources` 在正常返回和异常路径都会关闭通道。
5. `readAllBytes` 只用于这个 10,003 字节小实验的验证；复制本身的内存用量不随文件大小线性增长。

真实业务只需复制文件时，先考虑 `Files.copy`。这里手写循环的目的是理解状态变化，不是宣称它更快。这个例子也不复制属性、不保证持久化、不处理并发修改源文件，失败后可能留下部分目标文件，不能直接当作事务式文件发布工具。

## 文件位置、分散聚集与并发

### 通道位置和 Buffer 位置是两套游标

`FileChannel.position()` 表示当前文件位置，`buffer.position()` 表示这批数据在内存中的消费或填充位置。常规 `read(buffer)` 会影响两者；`read(buffer, offset)` 使用显式文件偏移，不改变通道的当前文件位置，但仍会推进 Buffer 的 position。

文件偏移是 `long`，而 ByteBuffer 的 position/limit 是 `int`。这也是大文件不能理所当然地“一次装进一个 ByteBuffer”的原因。

FileChannel 支持多线程使用，但这不等于共享位置的每组复合操作都是原子的。例如多个线程先 `position(offset)` 再 `read(buffer)`，中间可以被其他线程改变位置。需要并行访问不同区间时，优先考虑显式偏移，并让各操作拥有独立 Buffer；实际是否并行执行仍取决于实现。[FileChannel](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileChannel.html)

### 分散读和聚集写省掉什么

假设协议有固定头部和消息体。聚集写可以把两个 Buffer 交给一次通道调用，避免先拼成一个大数组：

```java
// 方法内片段：socket 为 SocketChannel；本次调用仍可能只写出一部分。
ByteBuffer header = ByteBuffer.allocate(4);
ByteBuffer body = java.nio.charset.StandardCharsets.UTF_8.encode("hello");
header.putInt(body.remaining()).flip();
socket.write(new ByteBuffer[] {header, body});
```

分散读相反，把输入依次填入多个 Buffer。它们优化的是数据组织与调用方式，**不会自动解析协议，也不会保证一次填满所有 Buffer**。如果头部包含可变消息体长度，通常仍需先收齐并解析头部，验证长度，再安排后续读取。[ScatteringByteChannel](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/ScatteringByteChannel.html)、[GatheringByteChannel](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/GatheringByteChannel.html)

### 文件锁与线程锁不是同一层机制

`lock()` 和 `tryLock()` 用于协调文件区域访问。文件锁以整个 JVM 为持有主体，不适合替代同一 JVM 内的 `synchronized` 或 `Lock`。共享锁能否保持共享、锁是否强制约束不合作的其他进程，取决于系统与文件系统；应按合作协议设计。[FileLock 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileLock.html)

## 下一步与自测

网络通道遇到写入 0 时，需要保存余下数据并等待后续机会，完整状态机见[Selector 回声实验](../selector/server.md)。传输优化与映射见[性能与持久化边界](./performance.md)，面试练习见[第 24–36 题](../interview/files.md)。
