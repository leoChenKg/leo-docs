---
title: Path 与文件系统：Provider、路径解析与 ZIP
description: 理解 Path 所属的 FileSystem、Provider 分工、词法归一化与真实路径，以及 ZIP 文件系统。
type: doc
tags:
  - Java
  - NIO.2
  - 文件系统
order: 10
date: 2026-09-24
---

# Path 与文件系统：Provider、路径解析与 ZIP

本文解决“路径属于哪个文件系统，以及路径计算是否会访问真实文件”。先掌握路径所属的环境，再选择 Files 操作；使用 Java 11+ 运行文中的方法体片段。

## Path、FileSystem 与 Provider 的职责

从旧的 `java.io.File` 迁移时，可以按职责拆开理解：

| 对象 | 负责什么 | 是否持有需要关闭的资源 |
| --- | --- | --- |
| `Path` | 某个文件系统中的路径 | 否 |
| `Files` | 创建、读写、复制、查询、遍历等静态操作 | 自身不是资源；部分返回值是 |
| `FileSystem` | 路径规则、根目录、属性能力、监听服务工厂 | 自行创建的文件系统通常需要关闭 |
| `FileSystemProvider` | 把通用操作落实到具体文件系统 | 通常由运行时管理 |
| 流、Channel、`DirectoryStream` | 打开后访问内容或目录 | 是 |

理解 Provider 的意义不在于马上实现一个 Provider，而在于避免假定所有 `Path` 都是本机磁盘路径。`Files` 的多数操作会交给路径关联的 Provider；默认 Provider 面向本机文件系统，其他 Provider 可以面向 ZIP 等存储。[FileSystemProvider API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/spi/FileSystemProvider.html)

```text
Path ──所属──> FileSystem ──由谁实现──> FileSystemProvider
  │                                      ↑
  └──────── Files 的操作通常委派到 ────────┘
```

## Path 的路径计算与真实文件访问

### 路径可以不存在

下面是一个 Java 11+ 的方法体片段，只做路径计算；在源文件顶部导入 `java.nio.file.Path` 即可使用：

```java
Path base = Path.of("notes");
Path file = base.resolve("java").resolve("nio.txt");
Path relative = base.relativize(file);
System.out.println(file);      // notes/java/nio.txt，分隔符随平台变化
System.out.println(relative);  // java/nio.txt
```

`resolve` 组合路径，`relativize` 计算相对路径，二者不会创建目录。`base.resolve(other)` 中，若 `other.isAbsolute()` 为 true，则返回 `other`；所以组合一个外部输入，并不自动把访问限制在 `base` 目录内。

| 方法 | 适合回答的问题 | 关键边界 |
| --- | --- | --- |
| `getFileName()` | 最后一个名称是什么 | 根路径可能没有文件名 |
| `resolve(...)` | 把后续路径接在哪里 | 绝对路径有独立语义 |
| `relativize(...)` | 从此路径怎样描述另一路径 | 不兼容的根或路径类型可能抛异常 |
| `normalize()` | 去掉路径中的冗余名称 | 只做词法计算，不访问文件系统 |
| `toAbsolutePath()` | 按当前环境解释成绝对路径 | 不证明存在，也不解析链接 |
| `toRealPath()` | 现存对象实际对应什么路径 | 访问文件系统，默认解析符号链接，不存在时抛异常 |

这些规则来自 [Path API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/Path.html)。两个路径的 `equals` 比较与“此刻是否指向同一个文件”是不同问题；后者可用 `Files.isSameFile`。

### normalize 不等于链接解析

假设 `/work/link` 是指向 `/data/project` 的符号链接。词法上，`/work/link/../x` 可以归约为 `/work/x`；实际沿链接进入 `/data/project` 后再取父目录，则可能指向 `/data/x`。这是“字符串更短”与“文件相同”的差别。

因此，上传目录等场景中，在先把 `base` 统一为绝对且归一化路径的前提下，`base.resolve(input).normalize().startsWith(base)` 只能帮助拒绝词法层面的越界；它不能单独解决符号链接或检查之后路径被替换的问题。`toRealPath(NOFOLLOW_LINKS)` 仍要求路径存在，也不会把“检查路径、再打开文件”变成原子操作。

Provider 支持时，`SecureDirectoryStream` 能让特定操作相对于已打开的目录执行，减少目录被并发替换造成的竞态；它并非所有平台都提供的通用能力。安全边界需要同时考虑输入校验、链接策略与实际打开方式。[SecureDirectoryStream API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/SecureDirectoryStream.html)

## 为什么 ZIP 里的路径也可以用 Files

JDK 的 `jdk.zipfs` 模块提供 ZIP 文件系统。下面是 Java 11+ 的方法体片段：`archive` 是指向已有 ZIP 文件的 `Path`，其中含有 `notes/nio.txt` 条目。片段需要导入 `java.nio.file` 包下的 `FileSystem`、`FileSystems`、`Files`、`Path`，以及 `java.nio.charset.StandardCharsets`；外层方法需处理或声明 `IOException`。如果使用裁剪过的运行时镜像，还应确认包含 `jdk.zipfs` 模块。

```java
try (FileSystem zip = FileSystems.newFileSystem(archive, (ClassLoader) null)) {
    Path inside = zip.getPath("/notes/nio.txt");
    System.out.println(Files.readString(inside, StandardCharsets.UTF_8));
}
```

同样的 `Files.readString` 可以工作，是因为 `inside` 带着所属文件系统，而非因为 Java 把 ZIP 路径变成了普通磁盘文件。ZIP 文件系统应及时关闭；`FileSystems.getDefault()` 返回的默认文件系统不能关闭。[ZIP 文件系统模块](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.zipfs/module-summary.html)、[FileSystem API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/FileSystem.html)

## 从路径进入实际操作

路径拼接不保证访问范围，词法相同也不保证文件身份。继续阅读 [Files 操作与目录遍历](./operations.md)，把路径交给明确的操作与链接策略；上传和解压场景见[文件处理工程场景](../../files/practice.md)。
