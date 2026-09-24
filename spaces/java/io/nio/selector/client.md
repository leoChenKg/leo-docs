---
title: 回声客户端：跨缓冲区传输与半关闭验证
description: 用完整客户端验证空输入、缓冲区边界和大数据传输，并明确超时与部分写入的覆盖边界。
type: doc
tags:
  - Java
  - NIO
  - 网络编程
  - Selector
order: 30
date: 2026-09-24
---

# 回声客户端：跨缓冲区传输与半关闭验证

本篇配合[有界回声服务器](./server.md)，使用 Java 11+ 运行验证。下面的客户端采用阻塞 Socket API。它用一个线程发送、另一个线程接收，默认校验 1 MiB 的二进制内容，远大于服务器的 8 KiB 缓冲区。

为什么不能简单地“先把所有字节写完，再开始读”？当数据足够大时，服务器可能在等待客户端接收回声，客户端却在等待服务器继续接收请求，两端都会被缓冲区容量限制。并行发送和接收避免这个实验自身制造僵局。

## 完整客户端

保存为 `EchoClient.java`：

```java
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Arrays;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;

public class EchoClient {
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 9090;
        int size = args.length > 1 ? Integer.parseInt(args[1]) : 1024 * 1024;
        byte[] expected = new byte[size];
        for (int i = 0; i < expected.length; i++) {
            expected[i] = (byte) (i * 31 + 7);
        }

        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("127.0.0.1", port), 5000);
            socket.setSoTimeout(10000);

            FutureTask<byte[]> receive = new FutureTask<>(
                    () -> socket.getInputStream().readAllBytes());
            Thread reader = new Thread(receive, "echo-reader");
            reader.start();

            socket.getOutputStream().write(expected);
            socket.shutdownOutput(); // 请求发完，仍然保留接收方向。

            byte[] actual = receive.get(15, TimeUnit.SECONDS);
            if (!Arrays.equals(expected, actual)) {
                throw new AssertionError("Mismatch: sent=" + expected.length
                        + ", received=" + actual.length);
            }
            System.out.println("Verified " + actual.length + " bytes");
        }
    }
}
```

## 运行与验证边界

将服务器和客户端保存在同一目录。先编译，在第一个终端启动服务器：

```sh
javac -encoding UTF-8 SelectorEcho.java EchoClient.java
java SelectorEcho 9090
```

再打开另一个终端，依次验证空输入、刚好填满、跨越边界和大数据：

```sh
java EchoClient 9090 0
java EchoClient 9090 8192
java EchoClient 9090 8193
java EchoClient 9090 1048576
```

预期每次都输出对应的 `Verified ... bytes`。也可以从多个终端同时启动客户端，观察同一个服务器进程处理多个连接。端口已占用时换一个端口，并同步调整客户端参数。

客户端的连接超时、读超时和 Future 等待超时用于缩短实验失败时的等待；`setSoTimeout` 不约束阻塞写入，所以这还不是一个具备端到端超时的生产客户端。

:::info 验证能说明什么
字节比较能验证大数据经过多轮读写后仍保持完整和有序；不能保证某次运行必然触发 `write() == 0` 或每一种部分写入路径。缓冲区大小、操作系统调度和客户端读取速度都会影响这些分支，需要慢读客户端或可控通道测试进一步覆盖。
:::

客户端将测试数据和完整响应放在内存中，是有限规模的数据正确性校验工具，不适合直接作为无限流或超大数据的生产客户端。它以服务器关闭输出结束读取，因此验证的是本实验约定的半关闭协议。

继续阅读[事件循环的工程边界](./engineering.md)，了解真实协议分帧与超时、容量限制；也可用[场景题](../interview/scenarios.md)练习解释故障原因。
