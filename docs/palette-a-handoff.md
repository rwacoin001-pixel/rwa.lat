# 交接：配色方向 A + 新引导页（预览中）

更新：2026-10-24 · 线上 Worker `81b10e46`（tag `palette-a-p1v6-1e05658`，main `1e056583`，BUILD_ID `5vYZXvivFG07IE4w7RS0Q`）

接手前请先读完本文。所有改动目前**只在打开过 `?palette=a` 的设备上生效**，普通用户看到的仍是旧版（米色 + 古铜金）。

---

## 1. 用户和工作方式（必须遵守）

- **用简单中文回复**：短句、常用词。用户在学中文。
- **改完直接上线**：合并 main → 推送 → 构建 → 部署到 a-reit.com，然后告诉用户线上版本和回退版本。不用先问。
  - 以下仍要先问：生产数据库迁移、环境变量和密钥、永久删除、强推。
- 用户在**真机手机**上看效果。每次交付都给出可以直接打开的链接。
- 用户审美要求高，参考 **dribbble.com/Radium**（Cosmin Capitanu）：
  - 磨砂卡片，配一块饱和的色块。
  - **写实质感的抠图主角**、大标题、大数字、小控件。
  - 状态切换时：标题滚动、色块变形、小物体环绕主角。
  - 丝滑的弹簧动效。
- 用户否定过的做法：
  - 手机实时 3D 抽象物体（"low"）。
  - 玩具感渲染、发灰的图。
  - 卡片上方留大块空白；主角或标语放到卡片外。
- 文案不承诺收益。邀请奖励只写"你可以获得奖励"，并注明"以平台规则为准"。不要写"你们都能得到"。

## 2. 背景：做了什么、为什么

1. 用户觉得原配色"土"（米色 + 古铜金 + 衬线体，像老银行）。选了**方向 A：冷白 + 品牌绿 `#19C7AA`**（深色模式是石墨色加绿）。品牌标语定为 **「好资产，一目了然」**。
2. 公司业务从"RWA 代币化"转向**商业空间和工业地产信托（REIT）**，同时保留资产组合（篮子）、考拉量化、AI 助手等功能。文案要覆盖全部产品，不能只讲地产。
3. 为了不影响线上用户，全部做成**预览开关**：
   - `?palette=a` 打开，`?palette=off` 关闭。
   - 开关状态存在 `localStorage['rwa.palette']`。

## 3. 开关和样式是怎么实现的

| 作用 | 文件 |
|---|---|
| 首屏前读取开关，给 `<html>` 设置 `data-palette="a"`；配色 A 下改用新的首页大图预加载 | `lib/document-preferences-bootstrap.ts` |
| 全局令牌：`--pal-*`、导航栏、底栏、AI 球、提示条、头像、手表 | `styles/palette-a.css`（在 `app/layout.tsx` 里导入） |
| 各页面模块：在原模块文件末尾追加 `:global(html[data-palette='a']) .xxx { ... }` 覆盖规则 | 例如 `components/maison/maison.module.css`、`components/screens/P04-HomeMaison.module.css`、`components/screens/P02-Login.module.css`、`components/system-state.module.css` 等 |
| React 里判断是否在预览中 | `lib/palette-preview.ts` → `usePaletteA()` |
| 预览专用文案（标语、引导页） | `lib/palette-a-copy.ts`（中文、英文；其他语言暂时回退到英文） |
| `<img>` 换图：把旧路径映射到新路径 | `lib/palette-media.ts` + `components/palette-media.tsx`（用 MutationObserver 替换 src/srcset） |
| 新素材 | `public/media/palette-a/**` |

**写覆盖规则时注意优先级**：
- 很多原规则是 `:global(.rwa-mobile[data-theme='dark']) .root`（0,3,0），你的覆盖必须更具体。
- 深色模式请用 `:global(html[data-palette='a'] .rwa-mobile[data-theme='dark']) .root`。

## 4. 引导页（登录前首次打开）

- 入口在 `components/screens/P02-Login.tsx`：
  - 配色 A 下，如果 `localStorage['rwa.onboarded.v2']` 不是 `'1'`，或网址带 `?guide=1`，就渲染 `<Onboarding>`。
  - 邀请码状态 `invite` 由登录页传进引导页，所以在引导页填的邀请码会直接带到注册流程。
- **第 1 页 = 新版**：`components/onboarding/HeroIntro.tsx` + `HeroIntro.module.css`
  - Radium 风格的"状态卡片"，在 4 个产品之间切换：地产信托、资产组合、考拉量化、AI 助手。
  - 每个状态包含：写实抠图主角、3 个环绕的小物体（近处清楚、远处虚化，会绕到主角后面）、变形变色的色块、滚动的标题和编号、玻璃小部件（物业类型 / 圆环 / 走势线 / AI 提问气泡）。
  - 交互：左右滑动、点芯片、4.2 秒自动轮播（用户操作后暂停 6 秒）、按住主角会压扁回弹、手指或安卓陀螺仪视差。
  - 动效全部用 `motion/react` 的弹簧。
  - 用户刚要求：标语和主角都要**在卡片内**，卡片顶到顶栏下面。已在 `1e056583` 完成。
- **第 2–4 页 = 旧版，待重做**：`components/onboarding/Onboarding.tsx` + `OnboardingCanvas.tsx`
  - 实时 3D（@react-three/fiber + drei）：转盘、擦玻璃、液态金属。
  - 用户已经否定这种风格。下一步要按第 1 页的方法重做。
  - 第 4 页（邀请好友）上的邀请码输入框和"创建账户 / 我已有账户"按钮要保留。
- **安装提示**：`components/onboarding/AppOffer.tsx`，第 1 页显示条形，最后一页显示行形。按环境分三种：

  | 类型 | 环境 | 显示内容 |
  |---|---|---|
  | `apk` | 安卓上不能添加到主屏幕的浏览器（小米、华为、其他） | 下载 APK |
  | `pwa` | 安卓 Chrome | 添加到主屏幕（`promptInstall()` 从 `components/home/HomeInstall.tsx` 导出） |
  | `browser` | 安卓上的微信 / App 内置浏览器 | 提示"在浏览器打开" |

  - iPhone、已安装的网页 App、安卓 App 内、电脑上都不显示。
  - 点"下载"时会把邀请码复制到剪贴板。
  - 想在任何设备上预览，加 `&offer=apk`（或 `pwa` / `browser`）。
- **App 内粘贴邀请码**：`components/screens/InviteCodeField.tsx`。在安卓 App 里（UA 含 `RwaLatAndroidTrial/`），输入框为空时显示"粘贴"按钮。**这一项对所有用户生效。**

## 5. 素材流程（写实图）

素材都在 G 盘：`G:\Media\a-reit-palette-a\`，下面是 `art/v4`、`art/v5`、`art/web`、`art/agy`、`tools/` 等。

1. **出图，按顺序尝试**：
   - **Antigravity 命令行**：`C:/Users/30396/AppData/Local/agy/bin/agy.exe -p "<提示词>" --model gemini-3.8-flash-high`
     - 提示词里必须写"Call your image generation tool exactly once… Do not run terminal commands, do not copy or move files"，否则它会请求权限然后失败。
     - **不要加 `--dangerously-skip-permissions`**，会被安全分类器拦截。
     - 生成的图在 `~/.gemini/antigravity-cli/brain/<id>/<名字>_<时间戳>.jpg`，命令返回后还要等一会儿才出现。
     - 有额度限制。2026-10-24 白天用完了，大约在 10:00 UTC 恢复。
   - **ChatGPT 网页版**（侧边浏览器）：
     - 需要用户自己登录。登录时会遇到 Cloudflare 的"验证你是真人"，**只能让用户点**。
     - 免费版每天只能出 2–3 张。
     - 图片是 blob 地址，用表单 POST 传到本机接收器：`G:\Media\a-reit-palette-a\art\recv.cjs`（端口 4600，launch 配置名 `img-recv`）。图片存到 `art/web/`。
   - Codex 命令行的出图模型（gpt-6-astra / gpt-6.1-sol）现在被 ChatGPT 账号拒绝，不要再试。
2. **写实图提示词要点**：
   - "Hyper-realistic commercial product photograph… rich vivid colour, high contrast…"
   - 纯白或浅灰背景。
   - 物体要有颜色，比如薄荷玻璃、橡木、金色、绿色耳机。全白全灰的物体会显得灰。
3. **抠图**：用 rembg 虚拟环境 `G:/Dev/rembg-venv`，需先设置环境变量 `U2NET_HOME=G:/Dev/u2net`。
   - 命令：`G:/Dev/rembg-venv/Scripts/python.exe G:/Media/a-reit-palette-a/tools/cut.py <输入> <输出.webp> 760 [--fill]`
   - `--fill` 用来补回物体内部被误抠的部分，例如篮子里的球。
4. **调色**（可选）：`python -I G:/Media/a-reit-palette-a/tools/grade.py <输入> <输出> 1.3 1.14`，提对比、饱和和清晰度。
5. **品红背景抠图**：旧方法，`tools/key.py`。现在不用。

## 6. 本地预览和测试

- launch 配置在 `.claude/launch.json`：
  - `palette-mock-api`：`D:/rwa-lat-builds/palette-mock/mock.cjs`，端口 4499。
  - `palette-a-dev`：Next dev，端口 3975。
  - `node_modules` 是指向 `D:/rwa-lat-worktrees/auth-legal-sheets/node_modules` 的目录链接。
- 假登录：在 localStorage 里写入
  - `rwa.session = {"sessionToken":"preview-local","userId":"9f1c0001-5b2e-4c71-9a3d-7e6400000001","sessionId":"preview","loggedInAt":"<当前 ISO 时间>"}`
  - 没有 `loggedInAt` 会被隐私锁屏拦住。
  - 看引导页要先删掉 `rwa.session`。
- **侧边浏览器隐藏时会暂停渲染**（3D 和 ResizeObserver 都不跑），所以用无头 Chrome 脚本（SwiftShader 支持 WebGL）：
  - `tools/page-shot.mjs <输出.jpg> <网址> <light|dark> [等待毫秒]`：单张截图。
  - `tools/frames.mjs <目录> <网址> <主题> <chip|swipe> [张数]`：连拍，看动效。
    - 加 `SLOW=0.15` 可以慢放 JS 时间，但启动画面也会变慢。
  - `tools/guide-shot.mjs`：旧版 4 页引导的完整走查。
- 电脑窗口太宽会被 `lib/desktop-redirect.ts` 跳转到外部网站，测试时用手机尺寸。

## 7. 上线流程

1. 在工作树 `D:\rwa-lat\.claude\worktrees\project-design-color-refresh-13d941` 提交（分支 `claude/project-design-color-refresh-13d941`）。
2. 合并到 main：在主检出目录 `D:/rwa-lat-worktrees/auth-legal-sheets` 里执行 `git merge --ff-only <分支>`，然后 `git push origin main`。
   - 那个目录里有别人未提交的 `apps/api/.../community-internal.controller.ts`，**不要动**。
3. 构建和部署：先设置代理 `HTTPS_PROXY=http://127.0.0.1:7897` 和 `NODE_OPTIONS=--max-old-space-size=8192`，然后运行：

   ```
   node scripts/build-production.mjs frontend
   node node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy -- --tag <标签> --message <说明>
   ```

   - 不要用 `require-merged-release.mjs`：它会因为上面那个未提交的文件而失败。
4. 核对：`node node_modules/wrangler/bin/wrangler.js deployments list` 查看当前版本，再用 curl 确认新素材返回 200。
5. 每次部署记下回退版本。本轮的版本链：`76f55153` → `91c66360` → `81b10e46`（当前）。

## 8. 待办（按优先级）

1. **用户在等第 1 页（`81b10e46`）的反馈**。认可后，按同样方法重做引导第 2–4 页，内容可以是：
   - 看清每一份：来源 · 费用 · 风险
   - 邀请好友（保留邀请码和按钮）
   - 可选：安装 App 一页
2. 重出鲜艳版**编织篮**和**玻璃球**，替换 `public/media/palette-a/onboard-v4/hero-basket.webp` 和 `hero-orb.webp`（现在是调色版）。
3. 齿轮小物体两次都没出成功，现在用叶子和玻璃珠代替。
4. 用户决定把配色 A 设为默认后，要做：
   - 把各模块里的 `:global(html[data-palette='a'])` 覆盖规则合并进基础样式，去掉开关。
   - 修改 `app/layout.tsx` 的网页标题和描述（目前还是"以智能科技提升投资体验"）。
   - 更新 `DESIGN.md`。它现在写着"不要改配色"，已经过时。
5. 全站文案还写着"真实资产 / RWA"，要改成新定位：首页分区、市场页、恒序系列等。见 `lib/*copy*.ts`。
6. 邀请海报（canvas 绘制，`lib/referral-poster-renderer.ts`）还是旧的暖色，没改。
7. 引导页只写了中文和英文，其他 5 种语言暂时用英文。

## 9. 相关提交

`7f412b03` 首页和资产页配色 → `410c7c2f` 全站和配图 → `2fefc0af` 第 2 轮细节 → `baa21be7` 第 1 版引导和极简登录 → `0534a551` 实时 3D 引导（已否定）→ `c3235bfa` / `326d67c6` / `4ba24d0e` / `8377b11c` / `1e056583` 第 1 页 Radium 风格的多次迭代。
