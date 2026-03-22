// OCR 服务封装
import { callFunction } from './api';

/**
 * 调用 OCR 识别
 */
export async function recognizeReceipt(imageUrl: string): Promise<{
  success: boolean;
  data?: {
    amount: string;
    merchant: string;
    category: string;
    date: string;
  };
  message?: string;
}> {
  try {
    const res = await callFunction('ocr_recognize', { imageUrl });
    return res.result;
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'OCR识别失败'
    };
  }
}

/**
 * 识别结果分类建议
 */
export function suggestCategory(merchant: string): string {
  const merchantLower = merchant.toLowerCase();

  const categoryMap: { [key: string]: string[] } = {
    '餐饮': ['餐厅', '饭店', '餐饮', '美食', '咖啡', '奶茶', '小吃', '快餐', '火锅', '烧烤'],
    '购物': ['超市', '商城', '天猫', '京东', '淘宝', '苏宁', '唯品会', '拼多多', '商店', '商场'],
    '交通': ['交通', '地铁', '公交', '打车', '滴滴', '停车', '加油', '过路', '火车', '飞机'],
    '医疗': ['医院', '药店', '医疗', '门诊', '诊所', '药品'],
    '居住': ['水电', '燃气', '物业', '房租', '住房', '租金'],
    '娱乐': ['电影', 'KTV', '娱乐', '游戏', '旅游', '门票', '演出'],
    '教育': ['教育', '培训', '学费', '课程', '书店', '文具'],
    '通讯': ['话费', '流量', '宽带', '通讯', '手机']
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => merchantLower.includes(k))) {
      return category;
    }
  }

  return '其他';
}
