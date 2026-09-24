---
title: NIO 面试题 13–23：Selector 与网络状态
description: 检查注册、就绪集合、部分传输、分帧、背压和跨线程协作。
type: reference
tags:
  - Java
  - NIO
  - NIO.2
  - 面试
order: 20
date: 2026-09-24
---

# NIO 面试题 13–23：Selector 与网络状态

本组关注“事件到来后，程序怎样推进状态”。原理见[Selector 模型](../selector/model.md)、[回声服务器](../selector/server.md)与[工程边界](../selector/engineering.md)；统一安排见[42 题入口](./)。

## Selector 与网络：第 13–23 题

### 13. 哪些 Channel 可以注册 Selector？

只有 SelectableChannel 体系中的通道，并且注册时必须为非阻塞。典型例子有 SocketChannel、ServerSocketChannel、DatagramChannel 与 Pipe 的端点。FileChannel 不属于该体系。SocketChannel 默认阻塞，accept 返回的新连接也应显式设置非阻塞。[SelectableChannel](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/SelectableChannel.html)、[accept 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/ServerSocketChannel.html#accept())

### 14. SelectionKey 的 interestOps 和 readyOps 是什么？

interestOps 表示应用关心的操作，readyOps 表示选择器检测到的就绪操作。attachment 可保存每个连接的输入累积区、输出队列和协议状态。四类主要事件是 ACCEPT、CONNECT、READ、WRITE；每种通道只支持自己的 validOps。[SelectionKey API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/SelectionKey.html)

### 15. 收到 OP_READ，是不是一定有完整数据可读？

不是。它可能对应数据、EOF、远端停止写入或待处理错误；就绪信息也可能因外部事件变旧。仍须实际 read，并判断正数、0、-1 和异常；更不能据此确定业务消息边界。

### 16. read 返回 0、-1；write 返回 0 分别怎么处理？

读 0 表示本次未传输字节，先检查 Buffer 是否有空间；读 -1 表示输入结束。非阻塞写 0 表示本次没发出去，应保留数据等待后续机会。不能把读 0 当断开，也不能在写 0 时无限重试。正数也只代表本次实际传输量。[SocketChannel API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/SocketChannel.html)

### 17. 为什么处理 selectedKeys 后要 remove？

经典集合式 API 的 selectedKeys 不会在每轮自动全部清空。移除表示消费本次待处理项；不等于取消注册。`key.cancel()` 才请求取消注册，且不会替你关闭 channel。关闭 Selector 同样不会自动关闭已注册通道。[Selector API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/Selector.html)

**追问：**`select()` 返回值等于 selectedKeys.size 吗？不一定，前者是本次就绪集合得到更新的 key 数；集合里可能还保留此前未移除的 key。

### 18. 为什么不能长期监听 OP_WRITE？

大部分正常连接经常可写；即使应用没数据，仍持续订阅它就可能不断唤醒循环。发送队列为空时取消；有待发数据可先尝试写，未写完才订阅，后续排空后再取消。关注位反映“还有发送工作”，不能用来表示“这个连接曾经写过数据”。

### 19. TCP 粘包、半包该怎样回答？

TCP 是有序字节流，不保留 write 的边界。这是传输语义，不是 NIO 的缺陷。应用协议可用固定长度、分隔符或长度字段定义边界；解析器要能处理一个 read 多帧、一帧多次 read，以及 EOF 时残留半帧。长度字段还要验证上限、负数和溢出，避免不受控分配。[TCP 标准 RFC 9293](https://www.rfc-editor.org/rfc/rfc9293.html)

### 20. 背压是什么？为什么非阻塞也会内存溢出？

非阻塞只改变等待方式，不限制生产速度。如果请求或输出进入无限队列，下游处理慢就会累积内存。背压是在容量不足时减慢上游：设置每连接与全局字节预算，高水位暂停读取或拒绝任务，低水位恢复，并配置超时与连接数限制。只限制任务个数不够，还需考虑每个任务的字节大小。

### 21. 多线程如何把任务交回事件循环？

常见做法是先加入线程安全队列，再 `selector.wakeup()`，由循环取任务并更新连接状态。队列负责传递和内存可见性，wakeup 负责结束等待；多次 wakeup 可以合并，不能把它当作逐条消息计数。连接状态由循环集中修改，可以减少竞争，但仍需设计关闭与迟到结果的处理。

### 22. 非阻塞 connect 和 accept 有什么容易漏掉的状态？

connect 可能立即成功，也可能返回 false 表示尚未完成。后者需关注 OP_CONNECT，并用 finishConnect 判断成功、未完成或异常；成功后更新兴趣位。非阻塞 accept 没有可接受连接时可返回 null；接受到的 SocketChannel 初始仍是阻塞的。[连接契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/SocketChannel.html#connect(java.net.SocketAddress))

### 23. 对端半关闭和连接关闭有什么区别？

TCP 两个方向可以分别结束。客户端 shutdownOutput 后，服务端读完已到达数据再得到 EOF，但仍可把响应写回。服务端读到 -1 就立即关闭全部连接，可能丢掉待发送响应。典型策略是停止读、发送完已有输出，再按协议关闭；异常重置则按失败处理。

继续练习[第 24–36 题：文件通道与文件系统](./files.md)，或用[故障与代码题](./scenarios.md)检验事件循环。
