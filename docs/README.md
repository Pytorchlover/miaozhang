# AI记账助手（miaozhang）微信小程序开发与部署完整指南

## 项目简介

miaozhang 是一款基于 AI 的微信小程序记账工具，主要功能包括：

- **截图 OCR 识别**：拍照上传收据，AI 自动识别金额、商户、分类
- **自然语言记账**：聊天式输入，如"今天中午吃火锅花了120元"
- **日历消费视图**：按日/周/月查看消费统计，支持日期筛选
- **智能预警提醒**：基于订阅消息的消费阈值预警
- **可爱治愈风格**：粉色系主题，猫咪吉祥物贯穿全站

**技术栈**：
- 前端：微信小程序原生开发（WXML + WXSS + JS）
- 后端：FastAPI + Python + LangChain/LangGraph
- AI：DeepSeek API（LLM 分析）+ 百度 OCR（票据识别）
- 数据库：SQLite
- 部署：Nginx + Gunicorn + SSL（Let's Encrypt）

## 界面预览

### 记账页面（聊天式 AI 记账）

![截图记账](images/截图记账.jpg)

### 账单页面（日历消费视图）

![账单页面](images/账单页面.jpg)

### 设置页面（阈值与订阅管理）

![设置页面](images/设置页面.jpg)

### 完整记账流程

![记账页面](images/记账页面.jpg)

---

## 一、环境配置

### 1.1 目录结构

```
wechatapp/
├── pages/                 # 小程序页面
│   ├── index/            # 首页（聊天记账）
│   ├── bill/             # 账单页面（日历 + 统计）
│   └── settings/         # 设置页面（阈值 + 订阅）
├── components/           # 自定义组件
│   └── calendar/         # 日历组件
├── server/              # 后端服务
│   ├── main.py          # FastAPI 主应用
│   ├── .env             # 环境变量（API 密钥）
│   └── ...
├── docs/                # 文档
└── app.js               # 小程序全局配置
```

### 1.2 配置服务端地址

编辑 `app.js`：

```javascript
// app.js
const app = getApp()
app.globalData.serverUrl = 'https://spatialtemporal.xyz'  // 你的域名
```

### 1.3 配置服务器环境变量

编辑 `server/.env`：

```bash
# DeepSeek API Key
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx

# 百度 OCR API
BAIDU_API_KEY=xxxxxxxxxxxxxxxx
BAIDU_SECRET_KEY=xxxxxxxxxxxxxxxx

# 微信小程序配置
WECHAT_APP_ID=wx################
WECHAT_APP_SECRET=################
```

> **安全提示**：切勿将 `.env` 文件提交到 Git 仓库！

---

## 二、后端部署

### 2.1 服务器要求

- Ubuntu 20.04+ / CentOS 7+
- Nginx 已安装
- Python 3.10+
- 域名已备案并解析到服务器 IP

### 2.2 安装 Python 依赖

```bash
cd server
pip install fastapi uvicorn gunicorn langchain langchain-deepseek langgraph httpx python-dotenv
pip install 'requests>=2.32.5'
```

### 2.3 启动后端服务

**开发模式**：
```bash
cd server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**生产模式（使用 Gunicorn）**：
```bash
cd server
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

**systemd 服务配置**（`/etc/systemd/system/miaozhang.service`）：
```ini
[Unit]
Description=miaozhang FastAPI Service
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/wechatapp/server
ExecStart=/usr/local/bin/gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable miaozhang
sudo systemctl start miaozhang
```

### 2.4 Nginx 反向代理配置

创建 `/etc/nginx/sites-available/miaozhang`：

```nginx
server {
    listen 80;
    server_name spatialtemporal.xyz;  # 你的域名

    # HTTP 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name spatialtemporal.xyz;

    # SSL 证书（Let's Encrypt 自动配置后如下）
    ssl_certificate /etc/letsencrypt/live/spatialtemporal.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spatialtemporal.xyz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # API 代理
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（如需）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件（可选）
    location /static/ {
        alias /path/to/wechatapp/server/static/;
        expires 30d;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/miaozhang /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2.5 配置 SSL 证书（Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d spatialtemporal.xyz
```

自动续期验证：
```bash
sudo certbot renew --dry-run
```

---

## 三、微信小程序配置

### 3.1 微信公众平台设置

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「开发」→「开发管理」→「开发设置」
3. 配置「服务器域名」：

```
request 合法域名：https://spatialtemporal.xyz
```

4. 填写「JS接口安全域名」和「网页授权域名」（如需）

### 3.2 订阅消息配置

1. 进入「功能」→「订阅消息」
2. 申请或选择现有模板，模板 ID 填写到 `pages/settings/settings.js`：

```javascript
// pages/settings/settings.js
data: {
    templateId: '9OeMu-Bzw8Yt4vbibXQZbJ7iwzVfCGX6BrCp9BGJEro'
}
```

### 3.3 AppID 与 AppSecret

编辑 `server/.env`：

```bash
WECHAT_APP_ID=wx################
WECHAT_APP_SECRET=################
```

> AppSecret 仅在服务端使用，切勿暴露在前端代码中。

---

## 四、开发调试

### 4.1 本地开发

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开项目，选择「本地项目」
3. 勾选「不校验合法域名」即可本地调试

### 4.2 体验版发布

1. 在微信开发者工具中点击「上传」
2. 登录微信公众平台，进入「版本管理」
3. 找到上传的版本，点击「提交审核」
4. 审核通过后，点击「发布」

> 体验版有效期为 **7天**，到期后需重新上传。

### 4.3 体验版分享

团队成员可通过以下方式访问体验版：

1. 开发者点击「版本管理」→「体验版」→ 生成二维码
2. 项目管理员在「成员管理」中添加体验成员
3. 体验成员扫描二维码即可访问

---

## 五、功能模块详解

### 5.1 OCR 票据识别流程

```
用户上传截图
    ↓
前端调用 wx.uploadFile 上传到 /api/ocr
    ↓
后端调用百度 OCR API 获取原始文字
    ↓
DeepSeek LLM 分析票据内容，提取金额/商户/分类
    ↓
返回结构化数据，前端展示确认
    ↓
用户确认后保存到数据库
```

### 5.2 消费预警逻辑

```
用户设置阈值（日/周/月）
    ↓
每次新增消费记录时调用 /api/calculate_threshold
    ↓
后端计算当前周期消费总额
    ↓
与用户设置的阈值对比
    ↓
超过阈值时调用 /api/send_alert 发送订阅消息
    ↓
用户收到微信服务通知
```

### 5.3 日历组件数据流

```
后端返回 transactions[]
    ↓
前端按日期分组 buildCalendarData()
    ↓
日历组件根据 expenseData 渲染日期标记
    ↓
用户点击日期 → onCalendarDayTap()
    ↓
过滤出该日期所有交易 → 显示详情
```

---

## 六、安全注意事项

### 6.1 敏感信息保护

| 内容 | 存放位置 | 说明 |
|------|---------|------|
| DeepSeek API Key | `server/.env` | 仅服务端使用 |
| 百度 OCR Key | `server/.env` | 仅服务端使用 |
| 微信 AppSecret | `server/.env` | 仅服务端使用 |
| 数据库 | `server/bill.db` | 包含用户 openid |

### 6.2 域名与证书

- 生产环境必须使用 **HTTPS**
- 定期检查 SSL 证书有效期
- 使用 Let's Encrypt 可自动续期

### 6.3 微信小程序安全建议

- 不在代码中硬编码任何 API 密钥
- request 域名必须已在微信公众平台配置
- 用户 openid 仅用于标识，不可泄露

---

## 七、常见问题

### Q1：体验版打不开，提示"当前页面不存在"？

检查「小程序后台」→「开发」→「开发管理」→「基本设置」中的 AppID 是否与项目一致。

### Q2：订阅消息收不到？

1. 确认用户已在设置页完成订阅操作
2. 检查模板消息 ID 是否正确
3. 确认微信公众平台的模板消息已添加

### Q3：OCR 识别金额不准确？

检查百度 OCR 控制台的「文字识别」用量，确保额度充足。DeepSeek 分析作为兜底方案。

### Q4：服务器端口被拒绝？

检查云服务器安全组/防火墙是否开放 80/443 端口。

### Q5：如何永久保存代码？

```bash
cd /Users/jikangyi/project/wechatapp
git init
git remote add origin git@github.com:Pytorchlover/miaozhang.git
git add .
git commit -m "feat: 初始化项目"
git branch -M main
git push -u origin main
```

---

## 八、后续优化建议

1. **数据导出**：支持将账单导出为 Excel/CSV
2. **多语言支持**：面向海外用户
3. **数据备份**：定期备份 SQLite 数据库
4. **性能优化**：对高频接口添加 Redis 缓存
5. **监控告警**：接入 Sentry 或自建日志系统

---

> 本项目仅供学习交流使用。请根据实际需求修改 API 密钥和相关配置。
