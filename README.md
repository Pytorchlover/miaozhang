# miaozhang

🐱 一款可爱的 AI 记账助手微信小程序

发送付款截图，AI 自动识别记账；智能监控消费，超阈值贴心提醒。

## 功能特性

### 核心功能
- 📸 **截图记账**：发送付款截图，百度 OCR + DeepSeek AI 自动识别金额、商家、分类
- 💬 **自然语言记账**：直接告诉 AI "今天午餐花了 35 元"
- 📅 **日历视图**：按日历查看每日消费明细
- 🎯 **消费预警**：根据月收入自动计算日/周/月三级预警阈值

### AI 能力
- 🤖 DeepSeek 大语言模型智能分析
- 🏷️ 自动识别商家并分类（餐饮、购物、交通等 9 类）
- 💕 温暖可爱的对话式交互
- 📊 智能财务规划建议

## 技术栈

### 前端
- 微信小程序原生开发
- 自定义组件（日历、底部导航）
- 粉色治愈系 UI 风格

### 后端
- Python 3.11 + FastAPI
- LangChain 1.x + LangGraph 1.x
- 百度 OCR 通用文字识别
- DeepSeek Chat API
- SQLite 本地存储

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Pytorchlover/miaozhang.git
cd miaozhang
```

### 2. 配置后端

```bash
cd server
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
BAIDU_API_KEY=your_baidu_api_key
BAIDU_SECRET_KEY=your_baidu_secret_key
```

安装依赖并启动：

```bash
pip install -r requirements.txt
python main.py
```

后端运行在 `http://localhost:3000`

### 3. 配置小程序

1. 打开微信开发者工具，导入项目
2. 在 `app.js` 中确认后端地址：
   ```javascript
   globalData: {
     serverUrl: 'http://localhost:3000'
   }
   ```
3. 编译运行

## 项目结构

```
wechatapp/
├── pages/                    # 页面
│   ├── chat/                 # 聊天记账页
│   ├── bill/                 # 账单日历页
│   └── settings/             # 设置页
├── components/                # 组件
│   ├── calendar/             # 日历组件
│   └── custom-tab-bar/       # 自定义底部导航
├── server/                   # Python 后端
│   ├── main.py               # FastAPI 主程序
│   ├── requirements.txt      # Python 依赖
│   └── .env.example          # 环境变量示例
└── utils/                    # 工具函数
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/login` | GET | 获取用户 openid |
| `/api/save_transaction` | POST | 保存交易/AI 对话 |
| `/api/get_transactions` | GET | 获取交易记录 |
| `/api/calculate_threshold` | GET | 计算预警阈值 |
| `/api/ocr_recognize` | POST | OCR 识别截图 |

## 消费预警规则

| 周期 | 阈值 | 说明 |
|------|------|------|
| 日 | 月收入 × 5% | 单日消费上限 |
| 周 | 月收入 × 20% | 单周消费上限 |
| 月 | 月收入 × 80% | 单月消费上限 |

## License

MIT
