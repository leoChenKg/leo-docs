---
title: ByteBuffer：状态、共享视图与增量解码
description: 通过 BufferLab 推演 position 和 limit，并处理视图共享、字节序及跨块字符。
type: doc
tags:
  - Java
  - NIO
  - NIO.2
order: 20
date: 2026-09-24
---

# ByteBuffer：状态、共享视图与增量解码

本文从缓冲区状态解释完整与部分数据如何共存。先理解[I/O 模型](./models.md)，再运行 Java 11+ 的 BufferLab；文本编码的通用基础见[字符编码](../../files/streams/encoding.md)。

## 先区分通道视角与缓冲区视角

`channel.read(buffer)` 是“从通道读”，同时也是“向 Buffer 写”。`channel.write(buffer)` 是“向通道写”，同时也是“从 Buffer 读”。很多 `flip` 错误来自把这两个视角混在一起。

```text
文件 / Socket ── channel.read ──> Buffer ── get / 解析 ──> 应用
应用 ── put ──> Buffer ── channel.write ──> 文件 / Socket
```

Buffer 没有一个自动切换的“读模式开关”。所谓填充态、消费态，是应用通过位置和边界形成的使用约定。

| 属性 | 含义 | `ByteBuffer` 中的单位 |
| --- | --- | --- |
| `capacity` | 已有容量，创建后不变 | 字节 |
| `position` | 下一次相对读写的位置 | 字节索引 |
| `limit` | 当前允许访问区域的终点，不含该位置 | 字节索引 |
| `mark` | 可供 `reset()` 返回的标记，可未定义 | 字节索引 |

有效状态满足 `0 <= position <= limit <= capacity`；mark 已定义时还需 `0 <= mark <= position`。`remaining()` 等于 `limit - position`。其他类型的 Buffer 以对应元素计数，例如 `IntBuffer` 的容量单位是 `int`，不是字节。[Buffer 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/Buffer.html)

## 用 8 个字节推演 flip、compact 与 clear

先向容量为 8 的 Buffer 放入 `A B C D E`，再消费前两个字节：

| 操作后 | position | limit | capacity | 下一步可处理的区域 |
| --- | --- | --- | --- | --- |
| `allocate(8)` | 0 | 8 | 8 | 可填充 8 字节 |
| `put(ABCDE)` | 5 | 8 | 8 | 可继续填充 3 字节 |
| `flip()` | 0 | 5 | 8 | 可消费 `ABCDE` |
| 两次 `get()` | 2 | 5 | 8 | 尚未消费 `CDE` |
| `compact()` | 3 | 8 | 8 | `CDE` 移到开头，后面可继续填充 |
| `put(FG)` | 5 | 8 | 8 | 内容开头是 `CDEFG` |
| 再次 `flip()` | 0 | 5 | 8 | 可消费 `CDEFG` |

记忆时直接记状态变化：

- `flip()`：把旧 position 设为新 limit，再让 position 回到 0。
- `clear()`：position 回到 0，limit 回到 capacity；它不擦除底层字节。
- `rewind()`：只让 position 回到 0，保留 limit，适合重新消费同一段数据。
- `compact()`：保留未消费字节并移到开头，把 position 放在这些字节之后，为接收后续数据腾空间。

这些操作会丢弃旧 mark。`mark/reset` 只记录和恢复位置，不会回滚已经写入的内容。

## 完整实验：观察状态而不是背方法名

保存为 `BufferLab.java`：

```java
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

public class BufferLab {
    private static void state(String label, ByteBuffer b) {
        System.out.printf("%s: position=%d, limit=%d, capacity=%d%n",
                label, b.position(), b.limit(), b.capacity());
    }

    public static void main(String[] args) {
        ByteBuffer b = ByteBuffer.allocate(8);
        b.put("ABCDE".getBytes(StandardCharsets.US_ASCII));
        state("put", b);
        b.flip();
        state("flip", b);
        System.out.println("已消费 = " + (char) b.get() + (char) b.get());

        // CDE 还没处理，不能 clear 后直接覆盖它们。
        b.compact();
        state("compact", b);
        b.put("FG".getBytes(StandardCharsets.US_ASCII));
        b.flip();
        System.out.println("下一段 = " + StandardCharsets.US_ASCII.decode(b));

        // clear 只是改变边界；绝对 get 不移动 position。
        b.clear();
        System.out.println("clear 后原字节仍在 = " + (char) b.get(0));

        ByteBuffer original = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN);
        original.putInt(0x01020304).flip();
        ByteBuffer view = original.slice().order(original.order());
        view.put(0, (byte) 9); // 修改共享内容，不改变 original 的位置。
        System.out.println("共享字节 = " + original.get(0));
        System.out.println("原位置 = " + original.position());
    }
}
```

```sh
javac --release 11 -encoding UTF-8 BufferLab.java
java BufferLab
```

关键输出：

```text
put: position=5, limit=8, capacity=8
flip: position=0, limit=5, capacity=8
已消费 = AB
compact: position=3, limit=8, capacity=8
下一段 = CDEFG
clear 后原字节仍在 = C
共享字节 = 9
原位置 = 0
```

第一段实验说明“未消费”和“未填充”是两个不同区域。第二段说明视图共享内容，但有自己的游标。它们共同解释了为什么把 Buffer 传给其他代码时，必须说明数据所有权和允许修改的范围。

## wrap、slice、duplicate 最容易忽略的细节

`ByteBuffer.wrap(bytes)` 直接共享传入数组，不复制一份；它的初始 position 是 0，limit 是数组长度，通常已经适合消费，不能机械地再 `flip()`，否则 limit 会变成 0。

`wrap(bytes, offset, length)` 的 capacity 仍为整个数组长度，position 为 offset，limit 为 offset + length。需要一个以 0 开始的局部视图时，可以再 `slice()`。

`slice()` 共享当前剩余区域，`duplicate()` 共享整体内容，二者的 position、limit、mark 与原对象分离。`asReadOnlyBuffer()` 只禁止通过该视图写入；原来的可写视图仍可能改变共享内容。它们都不是深拷贝，也不自动提供线程安全。

`ByteBuffer` 初始字节序是大端序。新建 `slice()`、`duplicate()` 字节视图的字节序也按其契约初始化为大端序；需要延续自定义字节序时显式 `.order(original.order())`。`asIntBuffer()` 这类类型视图则采用创建时原 ByteBuffer 的字节序，不要混为一谈。[ByteBuffer API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/ByteBuffer.html)

对熟悉前端的读者，`ByteBuffer` 可以类比“字节存储 + DataView 风格数值访问 + position/limit 游标”；Java 的 `slice()` 共享底层存储这一点更接近 TypedArray 的 `subarray()`，不能套用复制数组的直觉。

## 增量解码怎样保留未完成字符

### 字节边界不等于字符边界

UTF-8 的一个中文字符通常占多个字节。假设“中”的字节是 `E4 B8 AD`，两次 read 分别读到 `E4 B8` 和 `AD`。每次都单独 `new String(chunk, UTF_8)`，就可能得到替代字符；网络没有承诺每次按完整字符返回。

有两种清晰做法：

- 先按协议收齐一条独立编码的完整消息，再解码消息内容。
- 对连续文本流维持同一个 `CharsetDecoder`，保留输入末尾未消费的字节，等待下一批继续解码。

增量解码的控制流程如下，**这是流程伪代码，不是可直接编译的程序**：

```text
向输入 ByteBuffer 填入新字节
flip 输入
反复 decoder.decode(input, output, endOfInput)
  OVERFLOW：消费 output，清空 output，继续 decode
  UNDERFLOW：当前字节已处理完或还缺后续字节，结束本轮
  error：按业务要求报告或处理错误
消费 output
compact 输入，保留未完成字符的尾部字节
真正 EOF：用 endOfInput=true 完成最后的 decode，再循环 flush
```

`UNDERFLOW` 不保证输入已经完全消费，可能留下不完整字符；`OVERFLOW` 表示输出空间不足。末尾 `decode(..., true)` 和 `flush()` 也要处理输出溢出。Decoder 默认报告非法编码，可显式配置替换或忽略；配置应由协议决定。[CharsetDecoder](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/charset/CharsetDecoder.html)

### 解码与消息边界分别处理

UTF-8 解码只把字节解释为字符，不能替代业务分帧；compact 也不识别消息。长度前缀、分隔符及 EOF 残帧处理统一见[网络协议与分帧](../selector/engineering.md)。


## 下一步与自测

用[第 7–12 题](../interview/models-buffers.md)检验共享内容和独立游标的区别，再完成[Buffer 代码题](../interview/scenarios.md)。继续阅读[Channel 与文件传输](./file-channel.md)，把状态变化放入读写循环。
