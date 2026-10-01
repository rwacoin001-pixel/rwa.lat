# 独立 PDF 渲染服务

正式环境在独立容器执行 `node apps/api/dist/generated-documents/pdf-renderer.server.js`，复用 API 构建镜像。

API 配置 `DOCUMENT_PDF_SERVICE_URL=http://pdf_renderer:3001` 和至少 32 字符的随机 `DOCUMENT_PDF_SERVICE_SECRET`。渲染容器仅配置相同密钥及 `DOCUMENT_PDF_EXECUTABLE_PATH=/usr/bin/chromium`；不得复制 API 的数据库、钱包、存储或 AI 环境变量。

渲染容器与 API 连接独立的 Docker `internal: true` 网络；API 同时保留业务网络。渲染容器不发布主机端口，不连接业务网络；非 root、只读根目录、`cap_drop: [ALL]`、`no-new-privileges:true`，仅 `/tmp` 使用 512 MB 临时目录，内存上限 1 GB，CPU 上限 0.75。每份文件结束后清理浏览器目录。

Chromium 在该独立容器内使用 `--no-sandbox`，由容器和无外网网络提供隔离；API 的限制保持不变。正文只来自系统转义后的正式模板，禁用 JavaScript、拦截所有资源请求；服务请求限制 1 MB，输出限制 25 MB，单次只处理一份 PDF。禁止把任意网页、上传 HTML、URL 或脚本送入该服务。

`GET /health` 用于内网健康检查。`POST /render` 需要共享密钥，返回 PDF；失败不会记录正文、用户资料或密钥。生成队列仍保存原有快照、租约、幂等和失败状态；渲染成功不代表资金成交或税务资料已经核实。

发布前检查私有数据库备份、迁移和服务健康；以非业务模板实测 `%PDF-` 文件，再验收已有队列。密钥仅保存服务器权限为 600 的配置文件，不进入 Git。
