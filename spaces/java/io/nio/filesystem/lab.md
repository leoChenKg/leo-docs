---
title: Nio2FilesLab：创建、遍历与清理实验
description: 在程序自己的临时目录中验证 Files 读写、复制、移动、跳过子树和后序清理。
type: doc
tags:
  - Java
  - NIO.2
  - 文件系统
order: 30
date: 2026-09-24
---

# Nio2FilesLab：创建、遍历与清理实验

这个实验把 [Files 操作与目录遍历](./operations.md)串成一次可观察的执行过程，使用 Java 11+。先运行，再对照输出解释创建、复制、跳过目录和清理顺序。

## 先运行一次完整文件实验

保存为 `Nio2FilesLab.java`。程序仅在自己创建的临时目录中操作，最后清理该目录；不接收待删除路径参数。

```java
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.stream.Stream;

public class Nio2FilesLab {
    public static void main(String[] args) throws IOException {
        Path root = Files.createTempDirectory("nio2-files-");
        System.out.println("临时目录 = " + root);
        try {
            Path notes = Files.createDirectories(root.resolve("notes/java"));
            Path text = notes.resolve("nio.txt");
            Files.writeString(text, "你好，NIO.2\n", StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE_NEW);
            Files.writeString(text, "第二行\n", StandardCharsets.UTF_8,
                    StandardOpenOption.APPEND);

            System.out.println(Files.readString(text, StandardCharsets.UTF_8));
            Path copy = text.resolveSibling("copy.txt");
            Files.copy(text, copy);
            Files.move(copy, copy.resolveSibling("moved.txt"));

            Path cache = Files.createDirectory(root.resolve("cache"));
            Files.writeString(cache.resolve("ignored.txt"), "cache");
            try (Stream<Path> entries = Files.list(notes)) {
                entries.map(Path::getFileName).sorted().forEach(System.out::println);
            }

            long[] totals = {0, 0}; // 文件数、总字节数
            Files.walkFileTree(root, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult preVisitDirectory(
                        Path dir, BasicFileAttributes attrs) {
                    return dir.equals(cache) ? FileVisitResult.SKIP_SUBTREE
                            : FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(
                        Path file, BasicFileAttributes attrs) {
                    if (attrs.isRegularFile()) {
                        totals[0]++;
                        totals[1] += attrs.size();
                        System.out.println("统计 " + root.relativize(file));
                    }
                    return FileVisitResult.CONTINUE;
                }
            });
            System.out.println("文件数 = " + totals[0] + ", 字节数 = " + totals[1]);
        } finally {
            Files.walkFileTree(root, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)
                        throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc)
                        throws IOException {
                    if (exc != null) throw exc;
                    Files.delete(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        }
    }
}
```

```sh
javac -encoding UTF-8 Nio2FilesLab.java
java Nio2FilesLab
```

观察三件事：

1. `notes/java` 中保留原文件 `nio.txt` 和改名后的副本 `moved.txt`。
2. 统计结果是 2 个文件；`cache` 被跳过，清理时仍会删除。
3. `attrs.size()` 统计编码后的字节，中文字符不能按 Java 字符数直接换算。

进入 `finally` 清理之前，目录结构如下。注意 `cache/ignored.txt` 仍真实存在；`SKIP_SUBTREE` 只是本次统计跳过它，并没有删除它。

```text
临时目录/
├── notes/
│   └── java/
│       ├── nio.txt       原文件：25 个 UTF-8 字节
│       └── moved.txt     副本：25 个 UTF-8 字节
└── cache/
    └── ignored.txt      不进入本次统计
```

因此末尾的统计输出是 `文件数 = 2, 字节数 = 50`。这里的字节数来自固定的 UTF-8 文本与代码中的 `\n`；它不是“每个 Java 字符固定占几个字节”的推导。程序正常退出后，整棵临时目录被清理，不会保留这张树。

遍历顺序不应当成为测试断言。需要稳定输出时明确排序；示例只对目录列表排序，没有对整棵文件树做排序。

## 解释输出与继续练习

清理在 `finally` 中执行，`visitFile` 删除文件，`postVisitDirectory` 在子项处理后删除目录；统计阶段跳过的 `cache` 不会被清理阶段遗漏。示例采用遇错即停的策略，不是对外部任意目录的通用删除工具。

目录遍历不是事务快照，属性中的字节大小也不等于物理磁盘占用。相关边界见[Files 操作与目录遍历](./operations.md)；需要验证通知流程时，继续运行[WatchDirectory](./watch.md)。
