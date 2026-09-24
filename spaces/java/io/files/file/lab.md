---
title: FileLab：创建、遍历与改名实验
description: 运行 Java 8 可用的完整示例，在独立临时目录中观察 File 路径、文件创建、查询、列举、改名与清理。
type: doc
tags:
  - Java
  - 文件操作
  - File
order: 30
date: 2026-09-24
---

# FileLab：创建、遍历与改名实验

这个实验把[路径模型](./paths.md)与[文件系统操作](./operations.md)连接起来。先预测输出，再运行代码；重点是对象路径不变、文件系统状态会变化。

## 完整代码与运行方式

下面的 `FileLab` 在系统临时目录中创建独立实验目录；最终使用不跟随符号链接的文件树遍历清理自身产物。它不要求你提前创建目录，也不读取项目里的业务文件。

保存为 `FileLab.java`：

```java
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Arrays;
import java.util.Comparator;

public class FileLab {
    public static void main(String[] args) throws IOException {
        // 使用独立临时目录，避免覆盖已有业务文件。
        Path sandbox = Files.createTempDirectory("file-lab-");
        try {
            File directory = new File(sandbox.toFile(), "notes");
            File file = new File(directory, "hello.txt");

            System.out.println("仅构造 File 后 exists: " + file.exists());
            System.out.println("名称: " + file.getName());
            System.out.println("父路径: " + file.getParent());
            System.out.println("绝对路径: " + file.getAbsolutePath());

            if (!directory.mkdir()) {
                throw new IOException("创建目录失败: " + directory);
            }
            System.out.println("第一次 createNewFile: " + file.createNewFile());
            System.out.println("第二次 createNewFile: " + file.createNewFile());

            // File 只提供路径，文本读写由流完成；这里使用 NIO 的便捷工厂。
            try (BufferedWriter writer = Files.newBufferedWriter(
                    file.toPath(), StandardCharsets.UTF_8)) {
                writer.write("你好，File\n");
            }
            System.out.println("isFile: " + file.isFile());
            System.out.println("length（字节）: " + file.length());
            try (BufferedReader reader = Files.newBufferedReader(
                    file.toPath(), StandardCharsets.UTF_8)) {
                System.out.println("读取内容: " + reader.readLine());
            }

            File[] children = directory.listFiles();
            if (children == null) {
                throw new IOException("列举目录失败: " + directory);
            }
            Arrays.sort(children, Comparator.comparing(File::getName));
            for (File child : children) {
                System.out.println("子项: " + child.getName());
            }

            // 使用新对象表示新位置，原 File 保存的路径不会因改名而变化。
            File renamed = new File(directory, "renamed.txt");
            if (!file.renameTo(renamed)) {
                throw new IOException("重命名失败: " + file);
            }
            System.out.println("原 File 仍保存: " + file.getName());
            System.out.println("旧路径 exists: " + file.exists());
            System.out.println("新路径 exists: " + renamed.exists());
            if (!renamed.delete()) {
                throw new IOException("删除失败: " + renamed);
            }
            System.out.println("删除后 exists: " + renamed.exists());
        } finally {
            // 只清理本次创建的临时树；walkFileTree 默认不跟随符号链接。
            Files.walkFileTree(sandbox, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)
                        throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException error)
                        throws IOException {
                    if (error != null) {
                        throw error;
                    }
                    Files.delete(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        }
        System.out.println("临时目录已清理: " + !Files.exists(sandbox));
    }
}
```

运行：

```sh
javac -encoding UTF-8 FileLab.java
java FileLab
```

本机验证输出如下，已省略每次随机变化的临时路径：

```text
仅构造 File 后 exists: false
名称: hello.txt
第一次 createNewFile: true
第二次 createNewFile: false
isFile: true
length（字节）: 14
读取内容: 你好，File
子项: hello.txt
原 File 仍保存: hello.txt
旧路径 exists: false
新路径 exists: true
删除后 exists: false
临时目录已清理: true
```

可以按五个阶段阅读代码：

1. **准备路径**：先得到独立的临时根目录，再构造 `notes` 和 `hello.txt` 对应的 `File`。此时后两者都未创建。
2. **创建对象**：`mkdir()` 建立父目录；两次 `createNewFile()` 分别展示“这次新建”和“已经存在”。
3. **写入与观察**：writer 关闭后再读取长度和内容，避免尚未刷出的缓冲数据影响观察；UTF-8 明确了 14 字节的来源。
4. **列举与改名**：检查 `listFiles()` 的 null，显式排序，然后检查改名结果。原对象路径与新路径存在性一起展示“路径对象不变、文件系统变化”。
5. **结束清理**：`finally` 即使在主体抛异常时也执行；先删除文件，再在 `postVisitDirectory` 删除已空的目录。错误继续上抛，不把清理失败伪装成成功。

这里的 `SimpleFileVisitor<Path>` 是文件树访问回调：`visitFile` 处理文件，`postVisitDirectory` 在访问完子项后处理目录。示例只面向自身新建、没有外部并发修改的临时树；若业务主体和清理同时失败，正式项目还应保留两份异常信息，避免简单 finally 中的异常覆盖原始异常。


实验代码中的 NIO 只承担临时目录准备、明确编码的内容读写以及可靠报告错误的清理；路径对象、创建判断、目录列举和改名使用 `File`，便于观察两套 API 如何协作。

## 验证范围与下一步

原示例已在 macOS、JDK 26.0.1 编译运行，代码仅使用 Java 8 可用 API。临时目录的路径每次不同；`renameTo` 的表现仍受平台和文件系统影响，代码因此检查返回值。

实验中的字符编码、缓冲与关闭并非 `File` 自身能力。相关原理分别见[字符编码](../streams/encoding.md)和[资源管理](../streams/resources.md)；文件树回调见[NIO.2 文件系统](../../nio/filesystem/operations.md)。

接着使用[文件操作面试题](../interview/)检验理解，或回到[File 主题入口](./)。
