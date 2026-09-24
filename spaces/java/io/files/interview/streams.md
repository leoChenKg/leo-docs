---
title: 文件操作面试题 1–17：流、编码与资源管理
description: 检查读取契约、字符编码、缓冲、资源关闭和写入语义，掌握 17 道基础面试题的参考答案与追问。
type: reference
tags:
  - Java
  - 文件操作
  - 面试
  - I/O
order: 10
date: 2026-09-24
---

# 文件操作面试题 1–17：流、编码与资源管理

本篇检查文件读写的基础契约。先口述结论，再用追问检验边界；完整复习安排见[40 题入口](./)。

原理回顾：[字节读取与缓冲](../streams/reading.md)、[字符编码与文本处理](../streams/encoding.md)、[资源关闭与写入语义](../streams/resources.md)。

## 路径、流与读取契约

### 1. File、Path、Files 分别负责什么？new File 会创建文件吗？

**参考答案：** `File` 表示文件或目录的抽象路径，也提供一组传统文件系统操作；`Path` 描述某个文件系统中的路径；`Files` 提供创建、读写、遍历和属性等静态操作。`new File(...)` 和构造 `Path` 都不创建真实文件，也不打开句柄，因此路径对象不需要 `close()`。真正持有资源的是打开的流、通道、目录流等。[File 官方定义](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/File.html)

**追问：File 已经过时，是否不能再用？** 整个类没有被弃用。新代码通常使用 `Path + Files` 获得更完整的操作和错误信息；与旧接口交互可通过 `toPath()`、默认文件系统路径的 `toFile()` 适配。非默认提供者的 `Path` 不一定能转换成 `File`。

### 2. Java I/O 的四个基础抽象是什么？缓冲流是什么关系？

**参考答案：** 字节输入和输出分别使用 `InputStream`、`OutputStream`；字符输入和输出分别使用 `Reader`、`Writer`。文件、内存、网络可以是数据来源或目的地。`BufferedInputStream` 等包装已有流并增加缓冲，体现装饰器模式；`InputStreamReader` 在字节输入与字符读取之间承担解码桥梁。文本要确定编码，任意二进制复制用字节 API。[字节流教程](https://docs.oracle.com/javase/tutorial/essential/io/bytestreams.html)、[字符流教程](https://docs.oracle.com/javase/tutorial/essential/io/charstreams.html)

**易错点：** “字节流一次只能读一个字节”错误。它也有数组批量读写方法；“字符流只适用于中文”也错误，它适用于按字符解释的文本。

### 3. read() 为什么返回 int？read(byte[]) 能否一次填满数组？

**参考答案：** `InputStream.read()` 使用 `int` 同时表示 `0–255` 的无符号字节值和 EOF 标记 `-1`。批量 `read` 返回实际读取的字节数，可能少于请求长度；必须按返回值处理并循环到 EOF。对于长度大于零的请求，普通 `InputStream` 契约是读到至少一个字节、EOF 或抛异常；长度为零则返回 `0`。[InputStream.read](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/InputStream.html#read(byte[],int,int))

**追问：为什么不能先强转成 byte 再判断 -1？** 数据 `0xFF` 转成 Java 的 `byte` 也是 `-1`，会与 EOF 混淆。先用 `int` 判断，再使用字节值。

### 4. available() 是文件长度吗？返回 0 能证明读完了吗？

**参考答案：** 不是。它估计当前无需阻塞就能读取或跳过的字节数，不能用来分配容纳整个输入的数据数组；返回 `0` 也不能替代 EOF 判断。读完与否应看 `read` 的结果。查询普通文件大小可以使用 `Files.size`，但大小只是查询时的状态，不能替代读取循环。[available 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/InputStream.html#available())

**易错点：** 某个 `FileInputStream` 上的结果恰好符合预期，不构成通用 `InputStream` 的保证。

### 5. skip(n) 一定跳过 n 字节吗？mark/reset 能代替随机访问吗？

**参考答案：** `skip(n)` 返回实际跳过数量，可能不足甚至为零。需要读取固定长度二进制字段时，可使用 `DataInputStream.readFully`，不足会抛 `EOFException`。`mark/reset` 是否可用取决于流的支持情况及标记限制，不能当作任意定位文件的能力；随机访问使用 `RandomAccessFile` 或可定位通道。[InputStream.skip](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/InputStream.html#skip(long))、[readFully](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/DataInputStream.html#readFully(byte[]))

**追问：Java 11 的 readNBytes(n) 能保证返回 n 字节吗？** 不能，提前 EOF 时数组会更短。协议要求固定长度时仍要验证结果。

### 6. 加上 BufferedInputStream 就一定更快吗？

**参考答案：** 缓冲把许多小读写合并，通常能减少底层操作次数，尤其适合频繁读取少量数据。若应用已经使用大块数组、底层已有缓冲，继续包装不一定有明显收益；收益取决于数据大小、访问模式、文件系统和缓存状态。[缓冲流教程](https://docs.oracle.com/javase/tutorial/essential/io/buffers.html)

**追问：为什么不把缓冲区越开越大？** 并发数量乘以每个缓冲区大小才是总内存成本；超过实际需求后可能只增加内存占用。应比较吞吐、延迟、分配和资源占用，不能把一次热缓存测试当普遍结论。

## 字符编码、文本与二进制

### 7. 字节、char、Unicode 码点和用户看到的一个字符有什么区别？

**参考答案：** 字节是文件传输单位；Java 的 `char` 是一个 UTF-16 代码单元。基本多文种平面以外的码点需要一对代理项，即两个 `char`；一个显示字符还可能由多个码点组合。UTF-8 中一个码点可占 1–4 字节。因此 `Reader.read()` 的一次结果、字符串长度、文件字节数和视觉字符数不是同一件事。[Character 的 Unicode 模型](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Character.html)

**易错点：** “字符流每次读一个完整 Unicode 字符”不准确；需要按码点处理时要识别代理项，需要按显示字符处理时还涉及字素分段。

### 8. 本地正常、部署后乱码，优先检查什么？

**参考答案：** 检查生产者写入编码、消费者解码编码、默认字符集、实际文件来源及终端显示编码。Java 17 及以前的默认字符集可能随环境变化；JDK 18 起默认字符集改为 UTF-8，但兼容配置和具体 API 仍需区分。可靠做法是在文件协议中确定编码，并在读写边界显式传入，例如 `StandardCharsets.UTF_8`。[JDK 18 默认字符集变化](https://www.oracle.com/java/technologies/javase/18all-relnotes.html)

**追问：Files.readString(path) 不传编码，也是使用系统默认吗？** 不是，它默认 UTF-8；不要把所有省略 Charset 的方法都归为同一种规则。

### 9. 为什么不能把每次读到的 byte[] 单独 new String 后拼起来？

**参考答案：** 缓冲区边界可能把一个多字节编码序列切成两半。每次创建 `String` 都独立解码，前一块残留字节无法与后一块衔接，可能产生替换字符或错误。连续文本通常用 `InputStreamReader` 保持解码状态；手动使用 `CharsetDecoder` 时，要保留未消费字节并正确处理 `UNDERFLOW`、`OVERFLOW` 和输入结束。[CharsetDecoder 使用协议](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/charset/CharsetDecoder.html)

**易错点：** 即使每次都显式使用 UTF-8，也没有解决“编码序列被分块”的问题。

### 10. readLine() 读到空字符串是否表示 EOF？逐行复制能原样保留文件吗？

**参考答案：** 空字符串表示一个空行；`null` 才表示没有更多行。`BufferedReader.readLine()` 去掉行结束符；把返回结果再通过 `newLine()` 写出，会按运行平台生成换行，还可能给原本没有末尾换行的文件增加换行。因此原样复制使用字节复制，逐行处理用于业务需要解析文本的场景。[BufferedReader.readLine](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/BufferedReader.html#readLine())

**追问：逐行读取是否必然只占很少内存？** 单行可以非常长。若输入不可信或可能出现超长行，需要限制记录长度，或者设计增量解析器。

### 11. 遇到非法 UTF-8 字节时，Java 一定抛异常吗？

**参考答案：** 取决于所用 API 和解码错误策略，不能统一回答。`new String(bytes, charset)` 会替换不合法输入；需要拒绝损坏数据时，可创建 `CharsetDecoder` 并显式设置 `CodingErrorAction.REPORT`。同时区分非法输入与无法映射字符。`Files.newBufferedReader`、`Files.readString` 的严格读取行为也应按各自契约理解。[String 字节解码构造器](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/String.html#%3Cinit%3E(byte[],java.nio.charset.Charset))、[解码错误策略](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/charset/CharsetDecoder.html)

**易错点：** “没有异常”只能说明当前 API 没有报告失败，不能证明编码正确，也不能证明原始数据未被替换。

### 12. DataInputStream 与 ObjectInputStream 有什么区别？

**参考答案：** 前者按规定的二进制格式读取基本类型，必须与写入顺序、长度和字节序约定匹配；例如写入 `int` 后应按对应方式读回。后者恢复 Java 序列化对象图，涉及类兼容性、对象引用和反序列化行为。持久化格式要考虑版本演进，不应只因为实现方便就把任意对象图当长期文件协议。[DataInput](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/DataInput.html)、[对象流教程](https://docs.oracle.com/javase/tutorial/essential/io/objectstreams.html)

**追问：readUTF 就是读任意 UTF-8 文本吗？** 不是，它配合 `writeUTF` 使用带长度前缀的 modified UTF-8 格式。对于不可信对象序列化输入，还需控制允许的类型、深度和大小；优先选择适合信任边界的格式，不能认为存到文件里就可信。[反序列化过滤](https://docs.oracle.com/en/java/javase/17/core/serialization-filtering1.html)

## 资源关闭、异常与写入语义

### 13. try-with-resources 按什么顺序关闭？业务异常和 close 异常同时发生怎么办？

**参考答案：** 资源按声明顺序初始化，按相反顺序关闭。业务代码先抛异常时，它作为主异常，随后关闭资源产生的异常加入 suppressed 列表，可用 `getSuppressed()` 查看。若业务正常而关闭失败，首先发生的关闭异常成为主异常，后续关闭异常被抑制。初始化后面的资源失败时，前面已经成功初始化的资源也会关闭。[自动资源管理教程](https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html)

**追问：catch 中处理错误时，资源关了吗？** 与该 try-with-resources 关联的 `catch` 在资源关闭之后执行。抑制异常不是“没有发生”，排查写入失败时也要查看它。

### 14. flush、close 和 force/sync 有什么区别？

**参考答案：** `flush()` 推送对应缓冲层中的输出，但不等于已经持久化到设备；`close()` 释放资源，具体输出包装类通常还会完成必要的刷新。持久化需求要使用对应的 `FileChannel.force`、`FileDescriptor.sync` 等语义，并理解设备、文件系统和元数据的边界。如果上层还有应用缓冲，先把数据刷新到下层，再请求同步。[OutputStream.flush](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/OutputStream.html#flush())、[FileDescriptor.sync](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/io/FileDescriptor.html#sync())

**易错点：** 同步文件内容与原子替换文件名解决不同问题；一次 `force(true)` 不能自动让多个文件更新成为事务。

### 15. Files.lines、list、walk、find 返回的 Stream 要关闭吗？

**参考答案：** 要。它们与打开的文件或目录资源关联，应该放进 try-with-resources。`count()`、`collect()`、`findFirst()` 等终止操作不负责自动关闭这些资源，提前停止尤其不能省略关闭。惰性遍历还可能在消费阶段才暴露 I/O 错误，例如包装成 `UncheckedIOException`。[Files 的资源型 Stream 契约](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html#walk(java.nio.file.Path,java.nio.file.FileVisitOption...))

**追问：所有 Stream 都必须写 try-with-resources 吗？** 关键看资源来源；普通集合的流通常没有外部资源。本题讨论的是持有文件和目录资源的流。

### 16. writeString、newOutputStream 默认追加吗？CREATE 和 CREATE_NEW 有何区别？

**参考答案：** `Files.writeString` 和 `Files.newOutputStream` 不提供选项时按创建、写入、截断已有内容处理，不能当作追加。追加需显式使用 `APPEND`，需要不存在时创建还应加 `CREATE`。`CREATE` 允许打开已有文件；`CREATE_NEW` 要求新建，已有条目时失败，并原子地完成“检查不存在并创建”。[Files.newOutputStream](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Files.html#newOutputStream(java.nio.file.Path,java.nio.file.OpenOption...))、[StandardOpenOption](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/StandardOpenOption.html)

**易错点：** 指定自定义选项后不要继续假定所有默认选项仍会自动加入；`APPEND` 也不代表多进程写入的一整条业务记录必然原子。

### 17. 能依赖 GC 关闭文件吗？关闭最外层包装流是否足够？

**参考答案：** 不能依赖 GC 的时间来管理操作系统句柄，应明确资源所有权并及时关闭。对于标准 I/O 包装链，最外层关闭通常会沿链关闭底层资源，但需要查看具体类契约；如果包装对象构造失败，还要保证此前打开的资源得到释放。方法接收调用方传入的流时，也要约定由谁关闭，避免意外关闭共享输出或 `System.in`。[自动资源管理教程](https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html)

**追问：File.delete 返回 false 怎么排查？** 布尔值很难定位原因；改用 `Files.delete` 后结合具体异常、路径、权限、占用和目录状态判断。不要把所有异常都吞掉，也不要不分原因无限重试。

继续练习：[第 18–25 题：路径与文件系统](./filesystem.md)。
