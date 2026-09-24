---
title: Selector 回声服务器：有界缓冲、背压与半关闭
description: 运行完整回声服务器，沿连接状态理解部分写入、按需订阅可写事件、半关闭和资源清理。
type: doc
tags:
  - Java
  - NIO
  - 网络编程
  - Selector
order: 20
date: 2026-09-24
---

# Selector 回声服务器：有界缓冲、背压与半关闭

这个 Java 11+ 实验将每个连接的待发送内容限制在一个 8 KiB 缓冲区中，集中展示部分写入、背压和半关闭。开始前先读 [Selector 与 SelectionKey](./model.md)，客户端验证单独放在[下一篇](./client.md)。

## 完整服务器

服务器收到什么字节，就按原顺序回写什么字节。它不解析字符串，没有消息边界；我们用这个最小需求观察 I/O 状态，而不是混入业务逻辑。

每个连接的状态只有两项：一个固定大小的 buffer，以及“输入是否已经结束”。在每轮处理结束时，buffer 都处于写入模式，`[0, position)` 保存尚未发送的字节。

保存为 `SelectorEcho.java`：

```java
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.util.Iterator;

public class SelectorEcho {
    private static final int BUFFER_SIZE = 8 * 1024;

    private static final class State {
        final ByteBuffer pending = ByteBuffer.allocate(BUFFER_SIZE);
        boolean inputEnded;
    }

    public static void main(String[] args) throws IOException {
        int port = args.length == 0 ? 9090 : Integer.parseInt(args[0]);
        try (Selector selector = Selector.open();
             ServerSocketChannel server = ServerSocketChannel.open()) {
            server.configureBlocking(false);
            server.bind(new InetSocketAddress("127.0.0.1", port));
            server.register(selector, SelectionKey.OP_ACCEPT);
            System.out.println("Listening on 127.0.0.1:" + port);

            try {
                while (!Thread.currentThread().isInterrupted()) {
                    selector.select();
                    if (Thread.currentThread().isInterrupted()) break;

                    Iterator<SelectionKey> it =
                            selector.selectedKeys().iterator();
                    while (it.hasNext()) {
                        SelectionKey key = it.next();
                        it.remove();
                        if (!key.isValid()) continue;

                        if (key.isAcceptable()) {
                            acceptOne(server, selector);
                            continue;
                        }

                        try {
                            transfer(key);
                        } catch (IOException e) {
                            System.err.println("Connection failed: " + e);
                            close(key);
                        }
                    }
                }
            } finally {
                // 关闭 selector 不会替应用关闭已注册的连接。
                for (SelectionKey key :
                        selector.keys().toArray(new SelectionKey[0])) {
                    close(key);
                }
            }
        }
    }

    private static void acceptOne(ServerSocketChannel server,
                                  Selector selector) throws IOException {
        SocketChannel client = server.accept();
        if (client == null) return;
        try {
            client.configureBlocking(false);
            client.register(selector, SelectionKey.OP_READ, new State());
        } catch (IOException | RuntimeException e) {
            try {
                client.close();
            } catch (IOException closeError) {
                e.addSuppressed(closeError);
            }
            throw e;
        }
    }

    private static void transfer(SelectionKey key) throws IOException {
        SocketChannel channel = (SocketChannel) key.channel();
        State state = (State) key.attachment();
        ByteBuffer buffer = state.pending;

        if (key.isReadable() && !state.inputEnded && buffer.hasRemaining()) {
            int n = channel.read(buffer);
            if (n == -1) state.inputEnded = true;
        }

        if (key.isWritable() && buffer.position() > 0) {
            buffer.flip();
            channel.write(buffer); // 允许只发送部分字节，甚至返回 0。
            buffer.compact();      // 未发送内容留给下一次机会。
        }

        if (state.inputEnded && buffer.position() == 0) {
            close(key);
            return;
        }

        int interests = 0;
        if (!state.inputEnded && buffer.hasRemaining()) {
            interests |= SelectionKey.OP_READ;
        }
        if (buffer.position() > 0) {
            interests |= SelectionKey.OP_WRITE;
        }
        key.interestOps(interests);
    }

    private static void close(SelectionKey key) {
        key.cancel();
        try {
            key.channel().close();
        } catch (IOException e) {
            System.err.println("Close failed: " + e);
        }
    }
}
```

这个示例刻意限制每次选中一个连接时最多读一次、写一次，避免一个活跃连接在内部无限循环，占住其他连接的处理时间。监听通道每轮也只接受一个连接；实际系统可以改成带数量或时间预算的批处理。

保存后编译并启动：

```sh
javac -encoding UTF-8 SelectorEcho.java
java SelectorEcho 9090
```

程序监听 `127.0.0.1:9090`，端口占用时更换命令参数，并同步调整客户端。保持该终端运行，在另一个终端使用 [EchoClient](./client.md)验证。

## 沿连接状态拆解

服务器在处理 key 前执行 `it.remove()`，消费本次通知，并不注销连接。选择集合的完整语义见[模型篇](./model.md)。读写使用两个独立的 `if`：同一个 key 可以同时可读、可写，互斥分支可能让持续可读的连接迟迟无法推进输出。

### 新连接必须再次设置非阻塞

监听通道的非阻塞模式不会自动传给已接受的连接。`accept()` 返回的 `SocketChannel` 初始处于阻塞模式，所以程序明确调用 `client.configureBlocking(false)`，然后注册 `OP_READ`。非阻塞监听通道没有待接受连接时，`accept()` 返回 `null`。[ServerSocketChannel.accept](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/ServerSocketChannel.html#accept())

只有可选择的通道才能注册；注册时必须处于非阻塞模式。`FileChannel` 不属于 `SelectableChannel`，不能把普通文件注册到这个网络事件循环中。[SelectableChannel 官方契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/SelectableChannel.html)

### OP_WRITE 只在存在待发送字节时开启

可写事件表示当前状态值得尝试写入，并不表示“对端发来了一条写入请求”。一个正常连接经常有发送空间；若一直订阅 `OP_WRITE`，即使应用没有数据，selector 也可能持续返回，CPU 空转。

本例每次根据 `buffer.position()` 重建兴趣集合：有待发送字节就订阅 `OP_WRITE`，完全发完就取消它。若写入只完成一部分，`compact()` 会使剩余字节数量成为新的 position，因此下次继续关注可写。

另一种常见策略是新数据入队后先尝试立即写入；只有尚有剩余时才开启 `OP_WRITE`。两种策略都必须维护同一条规则：**有未完成的发送工作才等待可写通知。**

### 8 KiB 的上限就是这个实验的背压策略

如果客户端发送很快、读取回声很慢，服务器待发送数据会积累。这里不创建无限队列；buffer 满时移除 `OP_READ`，等写出一些内容后再恢复读取。

```text
客户端收得慢
    ↓
服务器发送进展减慢
    ↓
单连接 8 KiB 待发送缓冲区填满
    ↓
暂停该连接的 OP_READ
    ↓
接收侧缓冲区逐渐填满，TCP 流量控制向发送端传递压力
```

背压不会让远端立即停止发送，内核和网络中还可能有在途数据。它的价值是限制应用继续积累数据。本例的 8 KiB 只约束每连接的应用 buffer，不包含内核 socket 缓冲区、连接对象或所有连接的总内存。[TCP 的双向字节流与窗口机制](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.8.6)

完整系统还需要连接、业务队列和帧长度上限，见[工程边界](./engineering.md)。

### 读到 -1 后，先检查输出是否已经排空

客户端调用 `shutdownOutput()`，表示不再发送请求字节，但仍然接收回声。服务器最终读到 `-1` 时，只设置 `inputEnded`，不再订阅 `OP_READ`；如果 buffer 里还有待发送字节，继续发送，直至为空才关闭连接。

如果在 `read() == -1` 时立即关闭，就可能丢掉应用 buffer 中尚未写出的回声。反过来，保留 `OP_READ` 并不停读 EOF 也可能导致空转。TCP 支持分别结束两个方向，NIO 的 `shutdownInput()`、`shutdownOutput()` 也提供相应接口。[SocketChannel 的半关闭 API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/SocketChannel.html#shutdownOutput())

“应用 buffer 排空”指字节已经交给通道的发送路径，不等同于收到业务确认。需要可靠业务交付时，还要设计响应、确认、重试和幂等语义。

检查本例是否会陷入“既不读也不写”的停滞，可以枚举每轮结束时的状态：

| 输入状态 | 待发送字节 | 下一步 |
| --- | --- | --- |
| 未结束 | 0 | 关注 READ，等待输入 |
| 未结束 | 大于 0、小于 8 KiB | 关注 READ 和 WRITE |
| 未结束 | 等于 8 KiB | 只关注 WRITE，先腾出空间 |
| 已结束 | 大于 0 | 只关注 WRITE，排空最后的响应 |
| 已结束 | 0 | 关闭连接 |

因此，仍保留的连接总有推进方向；教学程序不会把一个有效连接留在 `interestOps(0)` 状态。复杂协议若主动暂停所有事件，必须另外记录由谁、在什么条件下恢复它。

### 资源关闭需要管理每个连接

`key.cancel()` 取消注册，不会替你关闭 channel；关闭 selector 也不会自动关闭所有已注册连接。本例先遍历并关闭 channel，再由 `try-with-resources` 关闭监听通道和 selector。[Selector.close](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/Selector.html#close())

在同一个 JVM 内，中断运行 main 逻辑的线程，会让阻塞的 `select()` 返回，循环检查中断状态后退出并执行 finally。命令行实验可用 Ctrl+C 停止进程，但进程被终止时不能把执行 finally 当作保证；生产服务通常提供明确的停止信号和连接排空期限。

## 实验边界

这个服务器演示了部分读写、有界缓存、按需订阅可写事件、EOF 后排空输出和资源清理。它没有实现连接上限、空闲超时、TLS、业务线程调度、每连接统计和优雅停机期限；固定小 buffer 以及每轮一次读写也是教学选择。

异常隔离也有明确范围：单个已连接通道的读写 `IOException` 会关闭该连接；接受连接、初始化或注册新连接时的异常会向外传播并结束这个教学服务器。生产服务应区分可恢复的单连接故障与服务级故障，并制定重试、限流或退出策略。

继续运行 [客户端与边界验证](./client.md)，再阅读[事件循环的工程边界](./engineering.md)。
