# 腾讯云个人部署备忘

这份备忘是给“自己长期用”的部署方式准备的，目标是三件事：

1. 页面能直接打开使用。
2. 页面需要登录后才能进入。
3. 后面升级、换服务器、迁移数据时，不需要重新摸索。

## 当前方案

- 部署位置：腾讯云轻量应用服务器
- 运行方式：Docker Compose
- 访问方式：先用公网 IP 访问
- 登录保护：开启项目自带后台登录
- 新闻搜索：同一套 Compose 内运行私有 SearXNG，只允许股票项目容器内网访问
- 主页入口：从个人主页加一个入口，点击后跳转到股票分析页面

这样做的原因很简单：

- Docker 部署最省心，环境不容易乱。
- 以后换服务器时，迁移代码和数据都更直接。
- 先用公网 IP，可以跳过域名和备案这一步。
- 先不开定时任务，先把“能稳定打开和手动使用”做好。

## 服务器上的关键目录

假设项目部署在：

```text
/opt/daily_stock_analysis
```

重点目录：

- `data/`：数据库和业务数据
- `logs/`：运行日志
- `reports/`：生成的分析报告
- `longbridge_tokens/`：可选的令牌缓存
- `.env`：运行配置

这些目录比 Docker 镜像本身更重要。以后迁移服务器，主要迁移的也是这些内容。

## 第一次部署的大致步骤

1. 准备好服务器，安装 Docker 和 Docker Compose。
2. 把项目代码放到 `/opt/daily_stock_analysis`。
3. 放好 `.env`。
4. 确认下面这几个配置：

```env
WEBUI_HOST=0.0.0.0
API_PORT=8000
ADMIN_AUTH_ENABLED=true
SCHEDULE_ENABLED=false
SEARXNG_BASE_URLS=http://searxng:8080
SEARXNG_PUBLIC_INSTANCES_ENABLED=false
SEARXNG_SECRET=<执行 openssl rand -hex 32 生成>
```

5. 构建并启动 `server` 服务。
6. 打开 `http://服务器IP:8000` 检查页面是否能访问。
7. 确认登录页出现，再设置或重置后台密码。

## 为什么要开 `ADMIN_AUTH_ENABLED=true`

因为这次部署不是只在本机跑，而是要放到云服务器上。  
只要能通过公网访问，就默认要加登录保护，不然任何知道地址的人都能打开。

## 以后怎么更新项目

这里分成两件事：

1. 你自己的代码怎么更新到服务器
2. 你本地仓库怎么和上游项目同步

### 最常用的一条线

以后你自己日常改项目，通常走这一条：

```text
本地改代码 -> push 到 GitHub -> 服务器 pull -> 重建镜像 -> 重启容器
```

注意：

- 这不是前端开发里的“热更新”
- 现在这套是 Docker 镜像部署
- 所以服务器想真正跑到新代码，通常要重新 build

原因很简单：

- `git pull` 只是更新了服务器磁盘上的源码
- 现在容器里跑的是“旧镜像里的代码”
- 不重新构建镜像，容器不会自动变成新代码

## 日常更新操作手册

下面这套命令，就是以后最常用的标准流程。

### A. 本地改完代码后，先推到 GitHub

在本地执行：

```bash
cd /Volumes/KIOXIA+MAIWO/projects/daily_stock_analysis
git status
git add docker/docker-compose.yml docker/searxng/settings.yml docs/tencent-cloud-personal-deploy.md docs/CHANGELOG.md .env.example
git commit -m "chore: add self-hosted SearXNG deployment"
git push origin main
```

说明：

- `git status`：先看有没有未处理的改动
- `git add ...`：只把本次部署相关文件加入暂存区，避免把本地临时文件一起提交
- `git commit`：生成一次提交记录
- `git push origin main`：把本地改动推到你自己的 GitHub

### B. 登录服务器

```bash
ssh tencent-dsa
```

### C. 进入服务器项目目录

```bash
cd /opt/daily_stock_analysis
pwd
```

正常应当看到：

```text
/opt/daily_stock_analysis
```

### D. 拉取最新代码

```bash
git pull origin main
```

如果你想先确认一下当前仓库状态，也可以先看：

```bash
git remote -v
git branch --show-current
```

### E. 重新构建镜像

```bash
docker compose -f docker/docker-compose.yml build
```

第一次构建会慢很多。  
后面如果只是改业务代码，Docker 会尽量复用缓存，通常会快不少。

### F. 重新启动容器

```bash
docker compose -f docker/docker-compose.yml up -d
```

### G. 检查容器状态

```bash
docker compose -f docker/docker-compose.yml ps
```

正常应该看到：

- `stock-server`
- `stock-searxng`
- `stock-web`

并且状态应当是 `Up`。

### H. 做一次健康检查

在服务器里执行：

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1/api/v1/auth/status
```

### I. 最后用浏览器检查

在浏览器打开：

```text
http://159.75.54.50
```

检查 3 件事：

1. 页面能打开
2. 登录页正常
3. 登录后主要功能没有明显报错

## 一套最短可用命令

如果以后你已经很熟了，服务器上最常用的就是这几条：

```bash
ssh tencent-dsa
cd /opt/daily_stock_analysis
git pull origin main
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
```

## 自建 SearXNG 新闻搜索

本项目的新闻搜索可以不配置 Tavily、SerpAPI、Brave、Bocha 等搜索 API Key，而是走同一套 Docker Compose 中的私有 SearXNG 服务。

SearXNG 是独立容器，不是合并到股票项目镜像里。它不开放公网端口，只通过 Docker 内网服务名 `searxng` 给 `stock-server` 和 `stock-analyzer` 访问。

服务器 `.env` 需要保留：

```env
SEARXNG_BASE_URLS=http://searxng:8080
SEARXNG_PUBLIC_INSTANCES_ENABLED=false
SEARXNG_SECRET=<执行 openssl rand -hex 32 生成>
```

首次生成密钥：

```bash
openssl rand -hex 32
```

更新部署后检查容器：

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs --tail=100 searxng
```

从股票项目容器内验证 SearXNG JSON 搜索：

```bash
docker compose -f docker/docker-compose.yml exec server curl 'http://searxng:8080/search?q=贵州茅台%20600519%20最新消息&format=json'
```

验证股票项目读取到 SearXNG 配置：

```bash
docker compose -f docker/docker-compose.yml exec -u dsa server python - <<'PY'
from src.config import Config
c = Config.get_instance()
print(c.searxng_base_urls)
print(c.searxng_public_instances_enabled)
PY
```

验证股票项目新闻搜索链路：

```bash
docker compose -f docker/docker-compose.yml exec -u dsa server python - <<'PY'
from src.search_service import SearchService
svc = SearchService(
    searxng_base_urls=["http://searxng:8080"],
    searxng_public_instances_enabled=False,
)
r = svc.search_stock_news("600519", "贵州茅台", max_results=3)
print(r.success, r.provider, len(r.results), r.error_message)
for item in r.results:
    print(item.title, item.url)
PY
```

## 如果更新后页面异常，先这样排查

### 看容器状态

```bash
docker compose -f docker/docker-compose.yml ps
```

### 看后端日志

```bash
docker logs --tail 100 stock-server
```

### 看入口层日志

```bash
docker logs --tail 100 stock-web
```

### 看健康检查

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1/api/v1/auth/status
```

## 如果这次更新失败，最简单的回退思路

如果只是这次新代码有问题，最稳妥的回退方式通常是：

1. 看最近几次提交
2. 找到上一个正常版本
3. 切回那个提交
4. 重新 build 和 up

命令示例：

```bash
cd /opt/daily_stock_analysis
git log --oneline -n 5
git checkout <上一个正常提交号>
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
```

注意：

- 这是“临时回退到旧代码运行”
- 后面如果还要继续正常更新，记得再切回 `main`

切回 `main`：

```bash
git checkout main
git pull origin main
```

## 本地仓库再说上游同步

这个仓库是你自己的 fork，后面如果上游项目更新了，推荐这样同步：

### 本地仓库先同步上游

如果还没加过上游仓库，先加一次：

```bash
git remote add upstream <原项目仓库地址>
```

平时更新流程：

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

意思就是：

- `upstream` 是原作者仓库
- `origin` 是你自己的仓库
- 先把上游更新合进来，再推回你自己的 GitHub

### 服务器再更新

服务器当前已经有标准 Git 仓库，可以直接 `git pull origin main`。  
如果以后服务器到 GitHub 的连接再次不稳定，再退回“本地同步到服务器”也可以，但优先建议先走标准 Git 更新流程。

## 换服务器时要迁移什么

不是“只迁 Docker 镜像”就够了。

真正要迁的是这几类东西：

1. 项目代码
2. `.env`
3. `data/`
4. `logs/`
5. `reports/`
6. `longbridge_tokens/`（如果你后面用到了）

Docker 镜像只是运行环境的一部分，业务数据并不应该只放在镜像里。

所以换服务器时，正确理解是：

- 镜像可以重新构建
- 代码可以重新同步
- 但数据目录和配置文件必须带走

## 最稳妥的迁移思路

旧服务器打包下面这些内容：

- `.env`
- `data/`
- `logs/`
- `reports/`
- `longbridge_tokens/`

然后在新服务器：

1. 装 Docker
2. 放代码
3. 还原这些目录和配置
4. 重新启动容器

这样迁移最稳。

## 个人主页入口怎么处理

个人主页只需要放一个入口卡片或按钮，直接跳到：

```text
http://服务器IP
```

这样最简单，也最适合现在这个阶段。

后面如果你想升级体验，再考虑：

- 换成域名
- 上 HTTPS
- 做二级域名入口

## 这套方案适合什么阶段

很适合你现在这个阶段：

- 想把全栈项目真的部署起来
- 想学一次完整的服务器部署流程
- 想控制成本
- 想先把项目跑通，而不是一开始就把域名、备案、自动化全部做满

先把它跑起来，后面再逐步升级，这是最划算的路径。
