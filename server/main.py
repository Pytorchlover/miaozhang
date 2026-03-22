"""
AI 记账小程序后端服务
使用 FastAPI + LangChain 1.x + LangGraph 1.x 构建
"""

import os
import json
import sqlite3
import re
import base64
import requests
from datetime import datetime, date
from typing import Optional, Literal
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# LangChain 1.x
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.output_parsers import JsonOutputParser
from langchain_deepseek import ChatDeepSeek

# LangGraph 1.x
from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

# 加载环境变量
load_dotenv()

# ============ 百度OCR配置 ============
BAIDU_API_KEY = os.getenv("BAIDU_API_KEY")
BAIDU_SECRET_KEY = os.getenv("BAIDU_SECRET_KEY")

# 缓存 access_token（百度token有效期30天）
_cached_token = {"token": None, "expires_at": 0}

def get_baidu_access_token():
    """获取百度OCR access_token（带缓存）"""
    import time
    global _cached_token

    # 如果缓存有效且未过期，直接返回
    if _cached_token["token"] and time.time() < _cached_token["expires_at"]:
        return _cached_token["token"]

    url = "https://aip.baidubce.com/oauth/2.0/token"
    params = {
        "grant_type": "client_credentials",
        "client_id": BAIDU_API_KEY,
        "client_secret": BAIDU_SECRET_KEY
    }
    try:
        response = requests.post(url, params=params)
        result = response.json()
        token = result.get("access_token")
        if token:
            # 缓存25天（百度30天有效期，提前5天刷新）
            _cached_token["token"] = token
            _cached_token["expires_at"] = time.time() + 86400 * 25
            return token
    except Exception as e:
        print(f"获取百度access_token失败: {e}")
    return None

# 启动时验证 API 配置
if not BAIDU_API_KEY or not BAIDU_SECRET_KEY:
    print("⚠️ 警告: 百度OCR API未配置，OCR功能将不可用")

# ============ 配置 ============
DATABASE_PATH = "accounting.db"
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

# ============ 数据库 ============
def init_db():
    """初始化数据库"""
    conn = sqlite3.connect(DATABASE_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS user_financials (
            openid TEXT PRIMARY KEY,
            monthly_income REAL DEFAULT 0,
            daily_threshold REAL DEFAULT 0,
            weekly_threshold REAL DEFAULT 0,
            monthly_threshold REAL DEFAULT 0,
            social_class TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            openid TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT DEFAULT '其他',
            merchant TEXT DEFAULT '',
            transaction_type TEXT DEFAULT 'expense',
            note TEXT DEFAULT '',
            image_url TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()

def get_user_financial(openid: str) -> dict:
    """获取用户财务信息"""
    conn = sqlite3.connect(DATABASE_PATH)
    c = conn.cursor()
    c.execute("SELECT * FROM user_financials WHERE openid = ?", (openid,))
    row = c.fetchone()
    conn.close()

    if row:
        return {
            "openid": row[0],
            "monthly_income": row[1],
            "daily_threshold": row[2],
            "weekly_threshold": row[3],
            "monthly_threshold": row[4],
            "social_class": row[5]
        }
    return {
        "openid": openid,
        "monthly_income": 0,
        "daily_threshold": 0,
        "weekly_threshold": 0,
        "monthly_threshold": 0,
        "social_class": ""
    }

def save_user_financial(openid: str, monthly_income: float):
    """保存用户财务信息"""
    daily = monthly_income * 0.05
    weekly = monthly_income * 0.20
    monthly = monthly_income * 0.80

    conn = sqlite3.connect(DATABASE_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT OR REPLACE INTO user_financials
        (openid, monthly_income, daily_threshold, weekly_threshold, monthly_threshold, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (openid, monthly_income, daily, weekly, monthly))
    conn.commit()
    conn.close()

def add_transaction(openid: str, amount: float, category: str, merchant: str,
                    transaction_type: str = "expense", note: str = "", image_url: str = ""):
    """添加交易记录"""
    conn = sqlite3.connect(DATABASE_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO transactions
        (openid, amount, category, merchant, transaction_type, note, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (openid, amount, category, merchant, transaction_type, note, image_url))
    conn.commit()
    conn.close()

def get_transactions(openid: str, period: str = "month") -> list:
    """获取交易记录"""
    conn = sqlite3.connect(DATABASE_PATH)
    c = conn.cursor()

    today = date.today()
    if period == "day":
        start_date = today.isoformat()
    elif period == "week":
        start_date = (today - __import__('datetime').timedelta(days=7)).isoformat()
    else:
        start_date = date(today.year, today.month, 1).isoformat()

    c.execute("""
        SELECT id, openid, amount, category, merchant, transaction_type, note, image_url, created_at
        FROM transactions
        WHERE openid = ? AND date(created_at) >= ?
        ORDER BY created_at DESC
    """, (openid, start_date))

    rows = c.fetchall()
    conn.close()

    return [
        {
            "id": str(row[0]),
            "openid": row[1],
            "amount": row[2],
            "category": row[3],
            "merchant": row[4],
            "transaction_type": row[5],
            "note": row[6],
            "image_url": row[7],
            "createdAt": row[8]
        }
        for row in rows
    ]

def get_period_totals(openid: str, period: str = "month") -> dict:
    """获取周期内的收支总计"""
    transactions = get_transactions(openid, period)
    total_expense = sum(t["amount"] for t in transactions if t["transaction_type"] != "income")
    total_income = sum(t["amount"] for t in transactions if t["transaction_type"] == "income")
    return {"totalExpense": total_expense, "totalIncome": total_income}

def check_spending_alert(openid: str) -> Optional[str]:
    """检查是否超支"""
    financial = get_user_financial(openid)
    if not financial["monthly_income"]:
        return None

    month_expenses = get_period_totals(openid, "month")["totalExpense"]
    monthly_threshold = financial["monthly_threshold"]

    if month_expenses > monthly_threshold:
        return f"⚠️ 提醒：本月已消费 ¥{month_expenses:.2f}，超过了月预算 ¥{monthly_threshold:.2f}！"

    week_expenses = get_period_totals(openid, "week")["totalExpense"]
    weekly_threshold = financial["weekly_threshold"]
    if week_expenses > weekly_threshold:
        return f"💡 提示：本周已消费 ¥{week_expenses:.2f}，接近周预算 ¥{weekly_threshold:.2f}"

    return None

# ============ AI Agent ============

# 系统提示词
SYSTEM_PROMPT = """你是一个贴心的AI记账助手，名叫"小猫咪"。

你的职责：
1. 帮用户记录每一笔支出和收入
2. 根据用户的收入水平，提醒用户合理消费
3. 用温暖、可爱的语气和用户交流

收入规则：
- 日预算 = 月收入的 5%
- 周预算 = 月收入的 20%
- 月预算 = 月收入的 80%

分析用户消息时：
- 如果是支出，提取：金额、分类、商家（如果提到）、日期（如果提到，默认今天）
- 如果是收入，提取：收入金额
- 如果是设置月收入，记住收入并计算各种预算阈值
- 如果是闲聊或问候，用可爱的方式回复

支持的消费分类：餐饮、购物、交通、医疗、居住、娱乐、教育、通讯、其他

输出格式（务必严格按此格式，只返回JSON，不要其他内容）：
1. 支出确认：{"action": "expense", "amount": 金额, "category": "分类", "merchant": "商家或未知"}
2. 收入记录：{"action": "income", "amount": 金额}
3. 设置收入：{"action": "set_income", "amount": 金额}
4. 闲聊回复：{"action": "chat", "reply": "回复内容"}

金额必须是数字，不要包含货币符号。"""

def create_llm(api_key: str):
    """创建 LLM 实例"""
    return ChatDeepSeek(
        model="deepseek-chat",
        api_key=api_key,
        temperature=0.7,
        streaming=False
    )

def process_with_ai(message: str, openid: str, api_key: str) -> dict:
    """使用 LangChain + DeepSeek 处理消息"""

    # 获取用户财务信息
    financial = get_user_financial(openid)
    monthly_income = financial["monthly_income"]

    # 如果没有 API Key，用简单规则
    if not api_key:
        return simple_analyze(message, monthly_income)

    try:
        # 创建 LLM
        llm = create_llm(api_key)

        # 构建用户上下文
        user_context = f"""用户openid: {openid}
用户月收入: {monthly_income} 元
用户消息: {message}"""

        # 调用 LLM
        response = llm.invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_context)
        ])

        ai_content = response.content
        print(f"AI 响应: {ai_content}")

        # 解析 JSON
        return parse_ai_response(ai_content)

    except Exception as e:
        print(f"AI 调用失败: {e}")
        return simple_analyze(message, monthly_income)

def parse_ai_response(ai_content: str) -> dict:
    """解析 AI 响应"""
    try:
        # 提取 JSON（可能有markdown格式）
        content = ai_content.strip()
        if content.startswith("```"):
            # 去掉 markdown 代码块
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "action": "chat",
            "reply": ai_content if ai_content else "收到啦~还有什么要记账的吗？"
        }

def simple_analyze(message: str, monthly_income: float) -> dict:
    """简单规则分析（无 API Key 时使用）"""

    # 匹配支出
    expense_match = re.search(r'花了?(\d+(?:\.\d+)?)', message)
    if expense_match:
        return {
            "action": "expense",
            "amount": float(expense_match.group(1)),
            "category": guess_category(message),
            "merchant": "手动输入"
        }

    # 匹配收入
    income_match = re.search(r'月收入.*?(\d+(?:\.\d+)?)', message)
    if income_match:
        return {
            "action": "set_income",
            "amount": float(income_match.group(1))
        }

    return {
        "action": "chat",
        "reply": f"收到啦~ 你可以告诉我'花了XX元'来记账哦！"
    }

# ============ 分类关键词 ============
CATEGORY_KEYWORDS = {
    "餐饮": ["吃饭", "午餐", "晚餐", "早餐", "外卖", "奶茶", "咖啡", "餐厅", "食堂", "美食", "快餐", "小吃", "餐饮"],
    "购物": ["买", "购物", "衣服", "淘宝", "京东", "超市", "商场", "拼多多", "商品"],
    "交通": ["打车", "地铁", "公交", "taxi", "开车", "加油", "停车", "油费", "交通"],
    "娱乐": ["电影", "游戏", "KTV", "唱歌", "酒吧", "剧本杀", "娱乐", "旅游"],
    "医疗": ["医院", "药店", "买药", "看病", "门诊", "医疗"],
    "教育": ["学费", "培训", "课程", "书", "文具", "教育"],
    "通讯": ["话费", "流量", "宽带", "网费", "通讯", "手机"],
    "居住": ["房租", "水电", "物业", "中介", "居住", "燃气"]
}

def guess_category(message: str) -> str:
    """猜测消费分类"""
    for category, words in CATEGORY_KEYWORDS.items():
        for word in words:
            if word in message:
                return category
    return "其他"

# ============ FastAPI 应用 ============
app = FastAPI(title="AI记账后端", version="1.0.0")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化数据库
init_db()

# ============ API 路由 ============

class SaveTransactionRequest(BaseModel):
    action: str
    message: Optional[str] = None
    data: Optional[dict] = None
    openid: str
    apiKey: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "AI记账后端服务", "version": "1.0.0"}

@app.get("/api/login")
async def login(code: Optional[str] = None):
    """获取 openid（测试用）"""
    openid = f"test_user_{code or datetime.now().timestamp()}"
    return {"success": True, "openid": openid}

@app.post("/api/save_transaction")
async def save_transaction(req: SaveTransactionRequest):
    """保存交易 / AI 聊天"""
    print(f"收到请求: {req.action}, openid: {req.openid}")

    try:
        if req.action == "chat":
            result = process_with_ai(
                message=req.message or "",
                openid=req.openid,
                api_key=req.apiKey or DEEPSEEK_API_KEY
            )

            if result.get("action") == "expense":
                return {
                    "success": True,
                    "type": "confirm",
                    "data": {
                        "amount": str(result.get("amount", 0)),
                        "category": result.get("category", "其他"),
                        "merchant": result.get("merchant", "未知"),
                        "date": date.today().isoformat()
                    }
                }
            elif result.get("action") == "income":
                return {
                    "success": True,
                    "message": f"好的！已记录收入 ¥{result.get('amount')} 元~"
                }
            elif result.get("action") == "set_income":
                amount = result.get("amount", 0)
                save_user_financial(req.openid, amount)
                return {
                    "success": True,
                    "message": f"好的！已设置你的月收入为 ¥{amount} 元~\n我会帮你合理规划消费，有超支会提醒你哦！"
                }
            else:
                return {
                    "success": True,
                    "message": result.get("reply", "收到啦~")
                }

        elif req.action == "confirm":
            data = req.data or {}
            amount = float(data.get("amount", 0))
            category = data.get("category", "其他")
            merchant = data.get("merchant", "未知")
            transaction_type = "income" if category == "收入" else "expense"

            add_transaction(
                openid=req.openid,
                amount=amount,
                category=category,
                merchant=merchant,
                transaction_type=transaction_type
            )

            alert = check_spending_alert(req.openid)

            return {
                "success": True,
                "message": "已记录这笔支出~",
                "alert": alert
            }

        return {"success": False, "message": "未知操作"}

    except Exception as e:
        print(f"处理失败: {e}")
        return {"success": False, "message": f"处理失败: {str(e)}"}

@app.get("/api/get_transactions")
async def get_transactions_api(openid: str, period: str = "month"):
    """获取交易记录"""
    try:
        transactions = get_transactions(openid, period)
        totals = get_period_totals(openid, period)

        return {
            "success": True,
            "transactions": transactions,
            "totalExpense": totals["totalExpense"],
            "totalIncome": totals["totalIncome"],
            "alertMessage": check_spending_alert(openid) or ""
        }
    except Exception as e:
        print(f"获取交易记录失败: {e}")
        return {"success": False, "transactions": [], "totalExpense": 0, "totalIncome": 0}

@app.get("/api/calculate_threshold")
async def calculate_threshold(openid: str):
    """计算阈值"""
    financial = get_user_financial(openid)
    return {
        "success": True,
        "daily": financial["daily_threshold"],
        "weekly": financial["weekly_threshold"],
        "monthly": financial["monthly_threshold"]
    }

@app.post("/api/ocr_recognize")
async def ocr_recognize(req: Request):
    """OCR 识别 - 使用百度OCR + DeepSeek分析"""
    try:
        body = await req.json()
        image_data = body.get("image")
        openid = body.get("openid", "")
        api_key = body.get("apiKey", "") or os.getenv("DEEPSEEK_API_KEY")

        if not image_data:
            return {"success": False, "message": "没有图片数据"}

        # 检查API配置
        if not BAIDU_API_KEY or not BAIDU_SECRET_KEY:
            return {
                "success": False,
                "message": "百度OCR API未配置，请检查.env文件中的BAIDU_API_KEY和BAIDU_SECRET_KEY"
            }

        # 获取access_token
        access_token = get_baidu_access_token()
        if not access_token:
            return {"success": False, "message": "获取百度access_token失败"}

        # 调用百度OCR API
        url = f"https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token={access_token}"

        # 处理图片数据（可能是base64或URL）
        if image_data.startswith("data:image"):
            # base64图片，提取实际数据
            image_data = image_data.split(",")[1]

        payload = {
            "image": image_data,
            "detect_direction": "false",
            "probability": "false"
        }

        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }

        response = requests.post(url, data=payload, headers=headers)
        result = response.json()

        if "error_code" in result:
            return {
                "success": False,
                "message": f"百度OCR错误: {result.get('error_msg', result.get('error_code'))}"
            }

        # 解析OCR结果
        words_result = result.get("words_result", [])
        full_text = "\n".join([item.get("words", "") for item in words_result])

        print(f"OCR识别文本: {full_text[:200]}...")

        if not full_text.strip():
            return {
                "success": False,
                "message": "未识别到文字，请上传更清晰的图片"
            }

        # 用DeepSeek分析OCR结果
        analysis_result = analyze_receipt_text(full_text, openid, api_key)

        return {
            "success": True,
            "data": analysis_result,
            "message": "OCR识别成功"
        }

    except Exception as e:
        print(f"OCR 失败: {e}")
        return {"success": False, "message": str(e)}


def analyze_receipt_text(text: str, openid: str, api_key: str) -> dict:
    """使用DeepSeek分析票据文本，提取结构化信息"""

    # 获取用户财务信息用于参考
    financial = get_user_financial(openid)
    monthly_income = financial["monthly_income"]

    # 分类映射
    categories = ["餐饮", "购物", "交通", "医疗", "居住", "娱乐", "教育", "通讯", "其他"]

    prompt = f"""你是一个专业的账单识别助手。请从以下OCR识别的票据文本中提取信息。

OCR识别文本：
{text}

用户月收入: {monthly_income}元

请提取以下信息并以JSON格式返回：
{{
    "amount": 消费金额（数字，如 35.5），
    "merchant": 商家名称（如果无法识别则填"未知商家"），
    "category": 消费分类（必须是以下之一：{','.join(categories)}），
    "date": 消费日期（格式：YYYY-MM-DD，如果无法识别则使用今天日期：{date.today().isoformat()}）
}}

注意：
1. 金额必须是数字，不要包含货币符号
2. 如果文本中有多个金额，通常是总额
3. 根据消费内容和金额合理推断分类
4. 日期优先从文本中提取，无法识别时用今天日期

只返回JSON，不要其他内容。"""

    # 如果没有API Key，用简单规则分析
    if not api_key:
        return simple_parse_receipt(text)

    try:
        llm = create_llm(api_key)
        response = llm.invoke([
            HumanMessage(content=prompt)
        ])

        content = response.content.strip()
        print(f"DeepSeek分析结果: {content}")

        # 去掉可能的markdown代码块
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        result = json.loads(content)
        return {
            "amount": str(result.get("amount", "0")),
            "merchant": result.get("merchant", "未知商家"),
            "category": result.get("category", "其他"),
            "date": result.get("date", date.today().isoformat())
        }

    except json.JSONDecodeError:
        print("DeepSeek返回格式错误，使用简单规则")
        return simple_parse_receipt(text)
    except Exception as e:
        print(f"DeepSeek分析失败: {e}，使用简单规则")
        return simple_parse_receipt(text)


def simple_parse_receipt(text: str) -> dict:
    """简单的规则解析（无API Key时使用）"""
    # 提取金额（查找常见的金额模式）
    amount_patterns = [
        r'¥(\d+(?:\.\d{1,2})?)',
        r'总价[：:]?\s*(\d+(?:\.\d{1,2})?)',
        r'合计[：:]?\s*(\d+(?:\.\d{1,2})?)',
        r'实付[：:]?\s*(\d+(?:\.\d{1,2})?)',
        r'(\d+(?:\.\d{1,2})?)\s*元',
    ]

    amount = "0"
    for pattern in amount_patterns:
        match = re.search(pattern, text)
        if match:
            amount = match.group(1)
            break

    # 如果没找到，查找最大的数字
    if amount == "0":
        numbers = re.findall(r'\d+(?:\.\d{1,2})?', text)
        if numbers:
            amount = max(numbers, key=lambda x: float(x) if float(x) < 10000 else 0)

    # 使用统一的分类关键词
    category = "其他"
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                category = cat
                break
        if category != "其他":
            break

    return {
        "amount": amount,
        "merchant": "未知商家",
        "category": category,
        "date": date.today().isoformat()
    }

# ============ 启动 ============
if __name__ == "__main__":
    import uvicorn
    print("""
╔══════════════════════════════════════════╗
║     AI 记账小程序后端服务已启动         ║
╠══════════════════════════════════════════╣
║  本地地址: http://localhost:3000        ║
║  文档: http://localhost:3000/docs       ║
╚══════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="0.0.0.0", port=3000)
