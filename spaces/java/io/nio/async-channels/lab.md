---
title: 异步文件读取实验：从提交到资源关闭
description: 运行一次有界异步文件读取，观察完成通知、异常传播、Buffer 访问边界和执行资源清理。
type: doc
tags:
  - Java
  - NIO.2
  - 异步
order: 20
date: 2026-09-24
---

# 异步文件读取实验：从提交到资源关闭

本实验使用 Java 11+ API。先读[完成模型与 Buffer 所有权](./model.md)，再通过一个完整程序检查成功和失败路径。

## 完整实验与运行方式

下面的实验刻意只提交**一次读取，最多读取 8 字节**。它展示 Buffer 所有权、完成与失败通知、同步等待边界和资源关闭；它不是“异步读取整个文件”的工具。

保存为 `AsyncFileRead.java`。不传参数时，程序创建并清理自己的临时文件；传路径时，仅以只读方式访问该文件。第二个参数可指定文件偏移量。

```java
import java.nio.ByteBuffer;
import java.nio.channels.AsynchronousFileChannel;
import java.nio.channels.CompletionHandler;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class AsyncFileRead {
    // 这里只桥接结果；调用方负责 channel、buffer 和 executor 的生命周期。
    static CompletableFuture<Integer> readOnce(
            AsynchronousFileChannel channel, ByteBuffer buffer, long offset) {
        CompletableFuture<Integer> result = new CompletableFuture<>();
        try {
            channel.read(buffer, offset, result,
                    new CompletionHandler<Integer, CompletableFuture<Integer>>() {
                        @Override
                        public void completed(Integer count,
                                              CompletableFuture<Integer> target) {
                            target.complete(count);
                        }

                        @Override
                        public void failed(Throwable error,
                                           CompletableFuture<Integer> target) {
                            target.completeExceptionally(error);
                        }
                    });
        } catch (RuntimeException error) {
            // 参数或提交阶段也可能直接抛出异常，尚未进入异步完成路径。
            result.completeExceptionally(error);
        }
        return result;
    }

    static String hex(ByteBuffer buffer) {
        StringBuilder output = new StringBuilder();
        while (buffer.hasRemaining()) {
            if (output.length() > 0) {
                output.append(' ');
            }
            int value = Byte.toUnsignedInt(buffer.get());
            output.append(Character.forDigit(value >>> 4, 16));
            output.append(Character.forDigit(value & 15, 16));
        }
        return output.toString();
    }

    static void shutdownAndAwait(ExecutorService executor) {
        executor.shutdown();
        boolean interrupted = false;
        try {
            while (!executor.isTerminated()) {
                try {
                    executor.awaitTermination(1, TimeUnit.SECONDS);
                } catch (InterruptedException error) {
                    interrupted = true;
                }
            }
        } finally {
            if (interrupted) {
                Thread.currentThread().interrupt();
            }
        }
    }

    public static void main(String[] args) throws Exception {
        Path temporary = null;
        ExecutorService ioPool = Executors.newFixedThreadPool(2);
        try {
            Path path;
            if (args.length == 0) {
                temporary = Files.createTempFile("nio2-read-", ".txt");
                Files.writeString(temporary, "NIO.2 async file\n",
                        StandardCharsets.UTF_8);
                path = temporary;
            } else {
                path = Path.of(args[0]);
            }
            long offset = args.length > 1 ? Long.parseLong(args[1]) : 0L;
            try (AsynchronousFileChannel channel = AsynchronousFileChannel.open(
                    path, Set.of(StandardOpenOption.READ), ioPool)) {
                ByteBuffer buffer = ByteBuffer.allocate(8);
                CompletableFuture<Integer> result = readOnce(channel, buffer, offset);
                System.out.println("已提交一次读取，最多 8 字节");
                int count = result.get(); // CLI 在这里等候；完成回调没有阻塞。
                if (count == -1) {
                    System.out.println("已到文件末尾");
                } else {
                    buffer.flip(); // 只有正常完成后，才重新访问 buffer。
                    System.out.println("本次读取字节数 = " + count);
                    System.out.println("字节（十六进制）= " + hex(buffer));
                }
            } // 无论成功、失败还是等待被中断，都先关闭 channel。
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw error;
        } finally {
            shutdownAndAwait(ioPool); // channel 已关闭，再结束自建线程池。
            if (temporary != null) {
                Files.deleteIfExists(temporary);
            }
        }
    }
}
```

编译与运行：

```sh
javac --release 11 -encoding UTF-8 AsyncFileRead.java
java AsyncFileRead
```

普通本地文件上典型输出如下；契约允许单次读取少于 8 字节，不应把每个平台的返回量写死在业务里：

```text
已提交一次读取，最多 8 字节
本次读取字节数 = 8
字节（十六进制）= 4e 49 4f 2e 32 20 61 73
```

这些字节对应 `NIO.2 as`，原文件后面仍有内容。用十六进制输出，可以避免把任意截断的 UTF-8 字节序列误认为完整文本。

### 为什么示例里的 get 不违背异步模型

命令行程序必须活到结果产生，才能展示结果并清理资源。主线程是演示的等待边界；I/O 完成处理器只转交结果。真实服务可以继续组合后续操作，不必在请求入口立即调用 `get()`。

这里没有给桥接 future 注册依赖回调。若后来添加 `result.thenApply(this::slowWork)`，`slowWork` 可能就在调用 `complete` 的 I/O 线程上运行。需要隔离耗时工作时，使用带显式业务 executor 的 `thenApplyAsync`，并处理提交被拒绝等失败。[CompletableFuture 的执行线程策略](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CompletableFuture.html)

`get()` 成功返回之后，才执行 `flip()` 和读取 Buffer；成功完成结果也是跨线程发布结果的同步边界。不要用随意增加的 `Thread.sleep(100)` 猜测 I/O 已经结束。[Future 的内存一致性说明](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Future.html)

### 失败和关闭沿着哪条路径传播

| 场景 | 实验中的路径 |
| --- | --- |
| 文件不存在 | `open` 直接抛异常，进入清理逻辑 |
| 偏移量为负 | 提交阶段抛 `IllegalArgumentException`，桥接 future 异常完成 |
| 提交后发生 I/O 错误 | `failed` 调用 `completeExceptionally`，`get` 抛 `ExecutionException` |
| 偏移量到达或超过文件末尾 | 正常完成，结果为 `-1` |
| 主线程等待时被中断 | 退出等待，关闭通道，保留中断状态并收尾 |

`failed` 不能只打印错误。否则外面的结果容器永远没有完成，调用方可能永久等候。实验的 cleanup 会等待自建池终止，不提供超时截止承诺；生产程序还应定义服务停机的最大等待时间和超时后的升级策略。

## 取消结果容器不等于停止读取

程序中的 `readOnce` 只把完成通知桥接到 `CompletableFuture`。取消这个 future 或给它设置 `orTimeout()`，不会自动取消已经提交的 `channel.read`；等待结束也不意味着 Buffer 可以复用。

程序在退出通道的资源作用域后，再关闭并等待自建 executor。关闭通道可以使尚未完成的操作失败，但不会回滚已经发生的 I/O。这个实验只有读取；若改为写入，还需要决定部分结果怎样清理或恢复。完整规则见[取消、超时与关闭](./concurrency.md#取消和超时都不表示撤销已经发生的-io)。

这些情况适合逐一验证：正常读取、空文件、偏移量到 EOF、负偏移量、文件不存在。把等待或关闭行为扩展到服务程序时，还应定义最大停机等待时间与超时后的处理策略。

## 继续学习

[并发控制与生命周期](./concurrency.md)解释本实验为什么选用自建 executor，以及如何在提交入口限制任务和内存。复习时做[异步通道面试题](../interview/async.md)和[综合场景题](../interview/scenarios.md)。
