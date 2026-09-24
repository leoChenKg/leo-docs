---
title: File 文件操作：查询、创建、遍历与迁移
description: 掌握 File 查询与修改操作的返回值，识别布尔失败、目录列举和改名的边界，并通过对照表迁移到 Path 与 Files。
type: doc
tags:
  - Java
  - 文件操作
  - File
order: 20
date: 2026-09-24
---

# File 文件操作：查询、创建、遍历与迁移

以下方法作用于文件系统的当前状态。先理解[路径模型](./paths.md)，再将返回值与实际操作意图一起判断；不要把路径对象的不可变性理解成文件系统状态不变。

本篇代码用于单独说明方法契约，均为方法内片段，不能按出现顺序拼成一个程序。公共类型需要导入 `java.io.File`、`java.io.IOException`、`java.nio.file.Files` 和 `java.nio.file.Path`；其他导入在片段旁标明，涉及受检异常时由所在方法捕获或声明。片段沿用 Java 8 可用 API，使用 `Path.of` 的位置另标 Java 11+。若希望直接编译运行并自动清理产物，使用[完整 FileLab](./lab.md)。

## 查询方法与“返回值不够明确”的问题

把查询理解成“此刻做了一次观察”，不要理解成对象创建时冻结的属性。

| 方法 | 常规用途 | 需要注意的返回值 |
| --- | --- | --- |
| `exists()` | 查询目标是否存在 | `false` 不能给出完整失败原因 |
| `isFile()` | 查询是否为普通文件 | 不是“是否叫某种扩展名” |
| `isDirectory()` | 查询是否为目录 | 不能据此保证下一次列目录成功 |
| `length()` | 普通文件的字节数 | 不存在时为 `0`；目录结果没有可移植的业务含义 |
| `lastModified()` | 修改时间，毫秒时间戳 | 不存在或 I/O 错误时为 `0L`；不能仅凭 0 断言是哪种情况 |
| `canRead()` / `canWrite()` / `canExecute()` | 可访问性提示 | 不保证下一次操作一定成功 |
| `isHidden()` | 平台对“隐藏”的判断 | Unix 点号名称与 Windows 隐藏属性不是同一种规则 |

假设两个 File 对象分别指向不存在的路径与空文件，它们的 `length()` 都可能是 `0`。这个方法没有携带“成功读到长度”和“没找到目标”的完整区分，因此不能写成 `length() == 0` 就判定存在且为空。

`length()` 的单位是**字节**，与字符串长度不同。编码与字符计数见[字符编码](../streams/encoding.md)，14 字节的具体观察见[FileLab](./lab.md)。

需要明确错误原因时，可改用会报告异常的 `Files.size(path)`，或者一次读取基本属性：

```java
// 方法内片段；导入 java.nio.file.Files、java.nio.file.attribute.BasicFileAttributes
BasicFileAttributes attrs = Files.readAttributes(
    file.toPath(), BasicFileAttributes.class);
System.out.println(attrs.size());
System.out.println(attrs.lastModifiedTime());
System.out.println(attrs.isRegularFile());
```

一次读取多个属性可减少分散查询；属性之间是否原子读取仍取决于实现。它同样不阻止其他进程在读取后修改文件。[文件属性教程](https://docs.oracle.com/javase/tutorial/essential/io/fileAttr.html)

:::warning 检查成功不等于操作必定成功
`exists()`、`canRead()` 的结果可能在下一行失效。NIO 的 `Files.exists()` 也会把“无法确定”折为 `false`，`Files.notExists()` 不是简单的取反。执行实际操作并处理失败，才是业务的最终判断。
:::

[存在性和访问性检查的边界](https://docs.oracle.com/javase/tutorial/essential/io/check.html)

## 创建文件和目录：区分 false 与异常

### createNewFile 只创建一个空文件

```java
// 方法内片段；调用者需要处理或声明 IOException
File file = new File("output", "report.txt");
boolean created = file.createNewFile();
System.out.println(created ? "这次新建成功" : "该路径已有对象");
```

前提是 `output` 已存在且允许访问。`createNewFile()` 不会递归创建父目录：这次成功创建空文件返回 `true`；该位置已有对象则返回 `false`；其他 I/O 失败可能抛 `IOException`。已有对象也可能是目录，因此 `false` 不能解释为“已经有一个符合需求的普通文件”。

这个方法内部的“检查不存在并创建”是原子操作。不要先写 `if (!file.exists())`，再误以为整个检查加创建过程是原子的；另一线程可以在两次调用之间抢先创建。也不要把 `createNewFile()` 当作完整的文件锁机制：锁的所有权、释放、崩溃恢复都需要另外设计。

### mkdir 和 mkdirs 的区别

| 方法 | 创建范围 | 已经存在时 |
| --- | --- | --- |
| `mkdir()` | 最后一层目录 | 通常返回 `false` |
| `mkdirs()` | 最后一层与缺失的祖先目录 | 通常返回 `false` |

`mkdirs()` 返回 `false` 也可能是失败，而且失败前可能已经建好部分父目录。成功与否不能仅按最终一位布尔值推断完整过程。

遗留代码中常见的“确保是目录”写法：

```java
File directory = new File("output/reports");
if (!directory.mkdirs() && !directory.isDirectory()) {
    throw new IOException("无法准备目录: " + directory.getAbsolutePath());
}
```

这里接受“本来就是目录”；若同名对象是文件则报错。它仍有并发变化窗口，不能保证后续写入必定成功。新代码通常更清楚：

```java
// Java 11+；Java 7/8 可将 Path.of 改为 Paths.get
Path directory = Files.createDirectories(Path.of("output", "reports"));
```

`Files.createDirectories` 允许目标已经是目录；无法满足要求时报告异常，同样不保证失败时自动回滚已创建的父目录。[目录创建教程](https://docs.oracle.com/javase/tutorial/essential/io/dirs.html)

### IOException 在这里意味着什么

`IOException` 是受检异常，调用处需要 `try/catch` 处理或在方法上 `throws IOException`。教程的 `main` 可以向外抛，让运行失败直接显示原因；实际服务应在合适的边界记录上下文，或转成业务错误，不能捕获后无声忽略。

`File` 的设计混合了“布尔值表示失败”和“抛出异常”两种形式。学方法时要一起记住返回值和异常契约，而不是背一句“文件操作失败都会抛异常”。

## 遍历目录：list、listFiles 和过滤器

`list()` 返回直接子项的名称数组，`listFiles()` 返回直接子项的 `File[]`；它们都不自动递归，也不保证顺序。`listFiles()` 的子路径是否绝对还取决于原来的目录路径。

```java
// 方法内片段；导入 java.util.Arrays、java.util.Comparator
File directory = new File("notes");
File[] entries = directory.listFiles();

if (entries == null) {
    throw new IOException("不是可列出的目录，或读取失败: " + directory);
}

Arrays.sort(entries, Comparator.comparing(File::getName));
for (File entry : entries) {
    System.out.printf("%s  %s%n",
        entry.isDirectory() ? "目录" : "非目录", entry.getName());
}
```

空目录返回长度为 0 的数组；目标不是目录或发生 I/O 错误可能返回 `null`。这解释了为什么 `for (File f : directory.listFiles())` 容易直接抛 `NullPointerException`。

过滤器有两个接口：

```java
// FilenameFilter 接收“父目录 + 名称”
File[] byName = directory.listFiles((dir, name) -> name.endsWith(".txt"));

// FileFilter 接收一个 File，便于组合文件类型与名称条件
File[] textFiles = directory.listFiles(
    entry -> entry.isFile() && entry.getName().endsWith(".txt"));
```

仅筛选后缀也会选中名为 `archive.txt` 的目录；第二种写法才排除这类目录。`endsWith(".txt")` 是大小写敏感的字符串判断，不会自动变成文件系统的大小写规则。过滤后的数组同样可能为 `null`。

大目录中，`File[]` 一次性装下所有子项会占用更多内存。可用 `Files.newDirectoryStream`、`Files.list` 按迭代方式处理。返回的目录资源必须关闭，遍历也不是对目录变化的事务快照。[目录列举教程](https://docs.oracle.com/javase/tutorial/essential/io/dirs.html)

### 递归遍历还要考虑符号链接

直观的递归算法是“遇到目录继续遍历，遇到文件处理”，但 `File.isDirectory()` 通常会跟随符号链接；链接可能指向祖先，造成循环，也可能指到预期目录之外。

需要遍历整棵树时，优先用 `Files.walkFileTree` 或 `Files.walk` 明确控制行为。默认不沿符号链接递归；显式启用 `FOLLOW_LINKS` 后，需要处理环路及访问失败。默认不递归跟随链接，不代表你在后续过滤器中调用的每个查询方法也自动使用 `NOFOLLOW_LINKS`。[文件树遍历教程](https://docs.oracle.com/javase/tutorial/essential/io/walk.html)

## 删除、改名和临时文件

### delete 删除的是文件系统中的条目

`file.delete()` 返回是否成功；删除目录时要求目录为空。它不会把对象变量设成 `null`，也不会递归清空目录；文件系统操作已经发生后，`file.getPath()` 仍返回原来的路径。

失败时只有 `false`，无法直接区分不存在、权限、目录非空或平台对打开文件的限制。需要诊断时使用：

```java
Files.delete(file.toPath());         // 不存在等问题会报告异常
Files.deleteIfExists(file.toPath()); // 不存在返回 false，其他失败仍可能抛异常
```

对符号链接使用 NIO 删除时，删除链接本身而不是它指向的目标。删除成功也不等同于安全擦除介质中的所有内容。[删除文件与目录教程](https://docs.oracle.com/javase/tutorial/essential/io/delete.html)

### renameTo 不会更新原来的 File 对象

```java
File source = new File("output", "draft.txt");
File target = new File("output", "final.txt");

if (!source.renameTo(target)) {
    throw new IOException("改名失败: " + source + " -> " + target);
}
System.out.println(source.getName()); // 仍然是 draft.txt
```

`source` 保存的路径没有被替换。后续要访问新位置，应使用 `target`。

`renameTo` 在跨文件系统、目标已存在、原子性方面都存在平台差异，必须检查结果。新代码可用 `Files.move` 表达覆盖或原子性要求，但两者的选项不能随意混为跨平台保证。[移动文件教程](https://docs.oracle.com/javase/tutorial/essential/io/move.html)

配置发布和移动失败策略统一见[工程实践](../practice.md)；`ATOMIC_MOVE` 与 `REPLACE_EXISTING` 的具体契约见[NIO.2 文件系统](../../nio/filesystem/operations.md)。

### 临时文件也需要明确清理

`File.createTempFile(prefix, suffix)` 会立即创建文件，和普通构造器不同。prefix 至少 3 个字符；suffix 为 `null` 时使用 `.tmp`。带 directory 的重载可以指定目录，不带时通常使用 `java.io.tmpdir`。

`deleteOnExit()` 注册 JVM 正常退出时的删除请求，不是立即删除，也不是异常退出或进程被强制终止后的保证。长期运行的服务不适合为大量短期文件只注册退出清理；应在用完后主动清理，并为失败留下可诊断信息。

`Files.createTempFile` 和 `Files.createTempDirectory` 是新代码常用的对应工具。系统临时目录的位置、权限与清理策略受环境影响，不要把“临时”理解成自动管理完整生命周期。

## File、Path 与 Files 怎样协作

Java 7 引入 NIO.2。`Path` 主要负责路径表达和组合，`Files` 提供文件系统操作；`File.toPath()` 是渐进迁移的入口。旧接口要求 `File` 时，可以在边界转换，新代码内部使用适合的 API。[官方迁移说明](https://docs.oracle.com/javase/tutorial/essential/io/legacy.html)

```java
File legacy = new File("notes", "hello.txt");
Path path = legacy.toPath();
File again = path.toFile();
```

转换不会创建或打开文件。`Path.toFile()` 主要用于默认文件系统；ZIP 等非默认 provider 的路径可能抛 `UnsupportedOperationException`。

| 要做的事 | File 风格 | NIO.2 风格 |
| --- | --- | --- |
| 描述路径 | `new File(...)` | `Path.of(...)` / `Paths.get(...)` |
| 组合子路径 | `new File(parent, child)` | `parent.resolve(child)`，注意绝对 child 的差异 |
| 判断普通文件 | `isFile()` | `Files.isRegularFile(path)` |
| 读取大小 | `length()` | `Files.size(path)` |
| 读取多种属性 | 多个方法分别查询 | `Files.readAttributes(...)` |
| 新建文件 | `createNewFile()` | `Files.createFile(path)`，已存在时通常报异常 |
| 创建多级目录 | `mkdirs()` | `Files.createDirectories(path)` |
| 删除 | `delete()` | `Files.delete` / `deleteIfExists` |
| 移动 | `renameTo(target)` | `Files.move(source, target, options)` |
| 复制 | 无直接对应方法 | `Files.copy(...)` |
| 列直接子项 | `listFiles()` | `Files.list` / `newDirectoryStream` |
| 递归遍历 | 自己组织递归 | `Files.walk` / `walkFileTree` |

这张表是用途对应，不保证返回值、异常与边界语义完全相同。尤其不要背成“`Files` 的所有方法都通过异常报告失败”；它的布尔查询仍有不确定性。

`Files.copy` 复制目录时默认不会把整棵子树递归复制，整树复制需要配合遍历。普通的复制操作也不保证原子完成。

详细的目录流、文件树遍历、符号链接选项和属性 API 统一见[NIO.2 文件系统](../../nio/filesystem/operations.md)。`Files.list`、`Files.walk` 等打开资源的关闭规则见[资源管理](../streams/resources.md)。

## 权限与磁盘空间只是当时的观测

`setReadable`、`setWritable`、`setExecutable`、`setReadOnly`、`setLastModified` 都需要检查返回值。`ownerOnly` 表达权限修改意图，具体能力取决于平台；不能把这些方法当成完整的 POSIX 权限或 ACL 接口。

`getTotalSpace`、`getFreeSpace`、`getUsableSpace` 面向路径所在的分区或存储空间，不是目录中文件大小之和。其中 usable 更接近当前进程可用量，但配额、权限和并发写入等因素都会影响结果。查到足够空间并不意味着已经预留了空间。[文件存储与属性教程](https://docs.oracle.com/javase/tutorial/essential/io/fileAttr.html)

## 从方法契约到运行观察

运行[FileLab](./lab.md)，重点观察两次创建的返回值、目录列举、改名前后对象名称与存在性。流读写和资源关闭的教学集中在[读写](../streams/reading.md)与[资源管理](../streams/resources.md)，本篇不再重复展开。

复习时使用[文件操作面试题](../interview/)，练习说明返回值、异常和平台相关边界。
