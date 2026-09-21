export type Arch = 'arm64' | 'x64';
export type GateResult = 'pending' | 'pass' | 'fail';
export type Phase = 'trigger' | 'build' | 'artifact' | 'prepare' | 'release' | 'client';

export interface FlowStep {
  phase: Phase;
  owner: string;
  title: string;
  explanation: string;
  input: string;
  output: string;
  action: string;
  command?: string;
  gate?: string;
  blocked?: string;
}

export const phases: { id: Phase; label: string }[] = [
  { id: 'trigger', label: '发起任务' }, { id: 'build', label: '编译打包' },
  { id: 'artifact', label: '上传与公证' }, { id: 'prepare', label: '回测与发版准备' },
  { id: 'release', label: '配置与放量' }, { id: 'client', label: '客户端更新' },
];

// 所有版本、构建号、地址和结果都是本地示意值，不对应实际发布记录。
export function getExample(arch: Arch) {
  const suffix = arch === 'arm64' ? '-arm64' : '';
  return {
    arch,
    version: '0.0.2',
    build: '90002',
    oldVersion: '0.0.1',
    oldBuild: '90001',
    commit: 'demo-commit-B（示意）',
    file: `yuanfudao-student-0.0.2.90002${suffix}.dmg`,
    oldFile: `yuanfudao-student-0.0.1.90001${suffix}.dmg`,
    buildCommand: `pnpm build:student:mac${arch === 'arm64' ? ':arm64' : ''}`,
    urlField: arch === 'arm64' ? 'urlArm64' : 'url',
    buildField: arch === 'arm64' ? 'buildNumberArm64' : 'buildNumber',
  };
}

export function getSteps(arch: Arch): FlowStep[] {
  const e = getExample(arch);
  return [
    {
      phase: 'trigger', owner: '发布人员 → Downton', title: '选择要构建的包',
      explanation: '选择学生端、Mac 架构和 ONLINE 类型。提交后，Downton 只负责把参数转给 Jenkins，此时不会立即得到安装包。',
      input: `student / Mac ${arch} / ONLINE / feature-electron12`,
      output: 'Jenkins 中出现一个待执行的构建任务。', action: '提交构建参数',
      command: `POST /api/releaseTool/addBuild\n→ tutor-electron-student-mac / buildWithParameters\nBUILD_TYPE=ONLINE\nBranch=feature-electron12\nUSER_ROLE=student\narch=${arch}`,
    },
    {
      phase: 'trigger', owner: 'Jenkins → Mac Agent', title: '排队、分配构建机、检出代码',
      explanation: 'Jenkins 等待空闲 Agent，再在构建机工作区检出指定分支。构建号标识这次任务，Commit 标识本次使用的代码。',
      input: 'Downton 传入的参数 + Gerrit 源码仓库', output: `构建 #${e.build}；已检出 ${e.commit}。`,
      action: '分配 Agent 并检出代码', command: 'Agent: Tutor-macOS-Builder-2\nRepository: tutor-electron-student',
    },
    {
      phase: 'build', owner: 'Mac Agent → AppHub', title: '安装依赖，查询是否有可复用包',
      explanation: 'Job 准备 Node 22、清理旧输出并安装依赖，然后进入项目脚本，查询 AppHub。本次演示设定为未命中，因此需要新构建；命中时可直接复用已有包。',
      input: `产品 391 + Online + ${e.commit} + ${arch}`, output: '查询未命中，进入新包构建路径。',
      action: '安装依赖并查询 AppHub', command: `pnpm i\n${e.buildCommand}\n→ apphub_check_exist`,
    },
    {
      phase: 'build', owner: 'Mac Agent · 项目构建脚本', title: '生成构建标识，准备产品配置',
      explanation: '写入 AppHub 构建标识，准备学生端的名称、图标、平台和架构配置，然后做依赖后处理与类型检查。',
      input: '源码、依赖、student 配置', output: '应用构建配置准备完成，类型检查通过。',
      action: '准备配置并检查类型', command: 'apphub_write_buildid\npackage/pre-build.js\npnpm postinstall\npnpm check-types-build',
    },
    {
      phase: 'build', owner: 'Mac Agent · esbuild / Angular', title: '编译主进程、共享代码和页面',
      explanation: '主进程、共享代码与页面分别构建，再整理静态资源。到这里得到的是编译产物，还不是用户可以安装的 DMG。',
      input: 'TypeScript、页面代码、静态资源', output: '编译后的应用代码和页面资源。',
      action: '编译应用代码', command: 'build-main.js\nbuild-shared.js\nAngular production build\n→ 整理 dist 与静态资源',
    },
    {
      phase: 'build', owner: 'Mac Agent · electron-builder', title: '组合应用、打包并签名',
      explanation: '将 Electron 运行时、代码和资源组成 Mac 应用，按当前架构打包并执行签名处理。签名和下一环节的 Apple 公证不是同一件事。',
      input: `编译产物 + Electron ${arch} + 学生端配置`, output: e.file,
      action: '生成已签名安装包', command: `electron-builder → Mac ${arch}\n→ 应用与 DMG`,
    },
    {
      phase: 'artifact', owner: '上传脚本 → AppHub / 公证 Job', title: '上传文件，保存构建记录',
      explanation: '安装包和构建元数据进入 AppHub；Mac 正式包还准备应用 ZIP，触发独立公证 Job。主打包任务到这里成功结束，公证结果另看。',
      input: `${e.file} + 版本 / 构建号 / Commit / 架构`, output: 'AppHub Online 记录及下载地址；公证任务待完成。',
      action: '上传到 AppHub', command: 'script/package-upload.js\n→ script/upload.sh → apphub_uploader\n→ tutor-electron-student-mac-notarize',
    },
    {
      phase: 'artifact', owner: '独立 Jenkins 公证 Job', title: '查看 Mac 公证结果',
      explanation: '公证任务从专门仓库处理应用 ZIP。这里展开成功结果，便于继续演示；它不是主打包 Job 的一个同步子步骤。',
      input: '用于公证的应用 ZIP 地址', output: '本次演示中的公证任务成功。',
      action: '查看公证成功结果', command: 'tutor-electron-student-mac-notarize\n→ node index.js $url',
    },
    {
      phase: 'prepare', owner: '测试人员', title: '回测新安装包',
      explanation: '测试人员从 AppHub 获取本次包，安装并回测功能。请选择一个结果，看看流程是否能继续。',
      input: `AppHub 中的 ${e.file}`, output: '安装包回测通过，可以准备发版。',
      action: '确认安装包回测通过', gate: '安装包回测结果',
      blocked: '回测未通过：先修复问题并重新构建、回测。本演示停在这里；可重新开始，也可切换为“通过”继续查看后续步骤。',
    },
    {
      phase: 'prepare', owner: '发布人员 → Downton → CDN', title: '导入制品，转存发布文件',
      explanation: '按产品、分支、Commit 和架构导入 AppHub 包，再走正式送审上传入口，转存文件并写入发版记录。本例是 Mac，不提交金山和 360；Windows 在此处送审。',
      input: '已回测的 AppHub 制品地址', output: '发布 CDN 地址 + Downton 发版记录。',
      action: '导入包并转存 CDN', command: 'AppHub 制品 → 发布 CDN\n→ Downton 发版历史',
    },
    {
      phase: 'prepare', owner: 'Downton / Mars → 热更新 Job', title: '用同架构的旧包和新包生成补丁',
      explanation: '旧包取自 Mars 历史全量版本，新包取自 Downton 当前发版记录。交给独立热更新 Job 生成 ZIP 并上传，不会重新编译一遍完整应用。',
      input: `${e.oldFile} → ${e.file}`, output: `适用于 ${e.oldVersion} → ${e.version} / ${arch} 的热更新 ZIP。`,
      action: '生成并上传热更新包', command: `Node 18.20.5\npnpm hotupdate $old_package_url $new_package_url\n→ upload_planet.py`,
    },
    {
      phase: 'release', owner: '发布人员 → Mars', title: '录入新版本，先保持灰度 0%',
      explanation: 'Mars 从 Downton 最新记录辅助填写构建号和地址，人工核对版本、架构、完整包与补丁，检查地址后保存。这里是在配置升级，不是在生成安装包。',
      input: 'CDN 完整包 + 补丁 + 历史全量基准版本', output: `Mars 保存 ${e.version}；灰度 0%，待升级回测。`,
      action: '创建 Mars 版本', command: `${e.buildField}: ${e.build}\n${e.urlField}: 对应架构的 CDN 地址\n热更新基准: ${e.oldVersion}\n灰度: 0%`,
    },
    {
      phase: 'release', owner: '测试人员 · 旧版本客户端', title: '回测普通升级与热更新',
      explanation: '这次从旧版本开始：检查能否普通升级，能否使用对应补丁，以及是否选对架构。它与前面的新包功能回测不同。',
      input: `旧客户端 ${e.oldVersion} + Mars 新版本配置`, output: '普通升级与热更新回测通过。',
      action: '确认升级回测通过', gate: '升级回测结果',
      blocked: '升级回测未通过：先检查版本配置、包地址和补丁，修复后重新回测，暂不灰度。演示可选择“通过”查看后续。',
    },
    {
      phase: 'release', owner: '发布人员 → Mars', title: '开启 30% 灰度',
      explanation: 'Mac 升级回测通过后，人工把灰度调整到 30%。如果是 Windows，还要确认金山和 360 审核通过。',
      input: '升级回测通过的版本', output: '灰度从 0% 变为 30%，进入观察期。',
      action: '开启 30% 灰度', command: 'Mars → 灰度配置 30%',
    },
    {
      phase: 'release', owner: '发布人员 / 产品 → Mars', title: '观察运行情况，再确认全量',
      explanation: '关注 Sentry 和使用情况，达到发版要求并与产品确认后，再开 100%。演示用一次确认代替真实的观察等待，不计算灰度命中或虚构监控数据。',
      input: '灰度观察结果 + 产品确认', output: 'Mars 全量 100%；随后维护最低版本、ChangeLog、Tag 和发版记录。',
      action: '确认观察正常并全量', gate: '观察与确认结果',
      blocked: '仍有异常或尚未确认：保持当前演示的 30% 状态，不推进全量；真实处理方式需要根据具体问题决定。',
    },
    {
      phase: 'client', owner: '客户端 → 版本服务 → 文件服务', title: '客户端查询并获取更新',
      explanation: '以当前架构、已符合升级条件的旧客户端为例：版本服务返回升级信息，客户端判断补丁基准是否匹配，选择适用的更新文件。',
      input: `${e.oldVersion} / ${arch} 客户端 + 已全量版本 ${e.version}`, output: `本例客户端使用对应补丁更新至 ${e.version}。`,
      action: '模拟客户端更新', command: '查询 tutor-app-version\n→ 检查版本、架构与补丁基准\n→ 下载适用文件并更新',
    },
    {
      phase: 'client', owner: '流程结束', title: '这一次构建与发布已走完',
      explanation: '代码先变成编译产物，再变成安装包；安装包上传并回测后，才进入发布配置与放量。你可以回退查看任一步，或重新选择架构再走一次。',
      input: '完整包、热更新包与发布配置', output: '示例客户端已升级；全量不代表所有真实用户都已安装。',
      action: '',
    },
  ];
}

// step 表示下一项待执行操作；已完成操作的结果完全由 step 推导，回退时不会残留后续产物。
export function getSnapshot(arch: Arch, step: number) {
  const e = getExample(arch);
  return {
    build: step >= 7 ? 'SUCCESS' : step >= 2 ? '构建中' : step >= 1 ? '排队中' : '未提交',
    commit: step >= 2 ? e.commit : '尚未检出',
    file: step >= 6 ? e.file : step >= 5 ? '编译产物，尚未打包' : '尚未生成',
    apphub: step >= 7 ? `Online / ${e.version} / #${e.build} / ${arch}` : '尚未上传',
    notarize: step >= 8 ? '成功（示意结果）' : step >= 7 ? '独立任务待完成' : '尚未触发',
    cdn: step >= 10 ? `CDN → ${e.file}（地址示意）` : '尚未转存',
    patch: step >= 11 ? `${e.oldVersion} → ${e.version} / ${arch} ZIP` : '尚未生成',
    mars: step >= 15 ? '已全量' : step >= 14 ? '灰度中' : step >= 12 ? '已创建，灰度 0%' : '未创建',
    gray: step >= 15 ? 100 : step >= 14 ? 30 : 0,
    client: step >= 16 ? `${e.version}（本例已升级）` : e.oldVersion,
  };
}

export function canAdvance(step: FlowStep, result: GateResult) {
  return !!step.action && (!step.gate || result === 'pass');
}
