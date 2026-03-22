// 账单列表页面
const app = getApp();

Page({
  data: {
    periods: ['今日', '本周', '本月'],
    currentPeriod: '本月',
    currentPeriodType: 'month',
    totalExpense: '0.00',
    totalIncome: '0.00',
    balance: '0.00',
    dailyThreshold: '0.00',
    weeklyThreshold: '0.00',
    monthlyThreshold: '0.00',
    alertMessage: '',
    transactions: [],
    serverUrl: '',
    // 日历相关
    calendarData: [],
    selectedDate: '',  // 选中的日期
    filteredTransactions: []  // 筛选后的交易列表
  },

  onLoad() {
    this.setData({
      serverUrl: app.globalData.serverUrl
    });
  },

  onShow() {
    // 并行加载数据和阈值
    Promise.all([this.loadData(), this.loadThreshold()]);
  },

  async loadData() {
    const periodType = this.data.currentPeriodType;

    try {
      const serverUrl = app.globalData.serverUrl;

      const res = await this.requestPromise({
        url: serverUrl + '/api/get_transactions',
        method: 'GET',
        data: {
          openid: app.globalData.openid,
          period: periodType
        }
      });

      if (res && res.success) {
        // 为每条交易添加 dateStr 字段
        const transactions = (res.transactions || []).map(t => ({
          ...t,
          dateStr: this.formatDateStr(t.createdAt)
        }));

        // 只在有交易时构建日历数据
        const calendarData = transactions.length > 0
          ? this.buildCalendarData(transactions)
          : [];

        this.setData({
          transactions: transactions,
          totalExpense: (res.totalExpense || 0).toFixed(2),
          totalIncome: (res.totalIncome || 0).toFixed(2),
          balance: ((res.totalIncome || 0) - (res.totalExpense || 0)).toFixed(2),
          alertMessage: res.alertMessage || '',
          calendarData: calendarData
        });
      }
    } catch (err) {
      console.error('加载数据失败', err);
    }
  },

  async loadThreshold() {
    try {
      const serverUrl = app.globalData.serverUrl;

      const res = await this.requestPromise({
        url: serverUrl + '/api/calculate_threshold',
        method: 'GET',
        data: {
          openid: app.globalData.openid
        }
      });

      if (res && res.success) {
        this.setData({
          dailyThreshold: (res.daily || 0).toFixed(2),
          weeklyThreshold: (res.weekly || 0).toFixed(2),
          monthlyThreshold: (res.monthly || 0).toFixed(2)
        });
      }
    } catch (err) {
      console.error('加载阈值失败', err);
    }
  },

  onPeriodChange(e) {
    const index = e.detail.value;
    const periods = ['今日', '本周', '本月'];
    const periodTypes = ['day', 'week', 'month'];

    this.setData({
      currentPeriod: periods[index],
      currentPeriodType: periodTypes[index]
    });

    this.loadData();
  },

  onTransactionTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('查看交易详情:', id);
  },

  getCategoryEmoji(category) {
    const emojiMap = {
      '餐饮': '🍜',
      '购物': '🛒',
      '交通': '🚗',
      '医疗': '🏥',
      '居住': '🏠',
      '娱乐': '🎮',
      '教育': '📚',
      '通讯': '📱',
      '其他': '📦'
    };
    return emojiMap[category] || '📦';
  },

  getCategoryClass(category) {
    const classMap = {
      '餐饮': 'cat-food',
      '购物': 'cat-shopping',
      '交通': 'cat-transport',
      '医疗': 'cat-medical',
      '居住': 'cat-housing',
      '娱乐': 'cat-entertainment',
      '教育': 'cat-education',
      '通讯': 'cat-communication',
      '其他': 'cat-other'
    };
    return classMap[category] || 'cat-other';
  },

  // 格式化日期显示
  formatDateStr(dateStr) {
    if (!dateStr) return '';
    // createdAt 可能是 "2024-01-15 10:30:00" 或 "2024-01-15T10:30:00"
    return dateStr.split(' ')[0].split('T')[0];
  },

  // 构建日历数据
  buildCalendarData(transactions) {
    const dataMap = {};
    transactions.forEach(t => {
      // 后端返回的是 createdAt 字段，需要提取日期部分
      const createdAt = t.createdAt || t.dateStr || t.date || '';
      const date = this.formatDateStr(createdAt);
      if (!dataMap[date]) {
        dataMap[date] = {
          date: date,
          amount: 0,
          transactions: []
        };
      }
      dataMap[date].amount += t.amount;
      dataMap[date].transactions.push(t);
    });
    return Object.values(dataMap);
  },

  // 日历日期点击
  onCalendarDayTap(e) {
    const { date, hasExpense } = e.detail;
    console.log('点击日期:', date, '有消费:', hasExpense);

    // 根据选中日期筛选交易
    if (date) {
      const filtered = this.data.transactions.filter(t => t.dateStr === date);
      this.setData({
        selectedDate: date,
        filteredTransactions: filtered
      });
    }
  },

  // 清除日期筛选
  clearDateFilter() {
    this.setData({
      selectedDate: '',
      filteredTransactions: []
    });
  },

  // 封装 wx.request 为 Promise
  requestPromise(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        ...options,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error('请求失败: ' + res.statusCode));
          }
        },
        fail: (err) => {
          reject(new Error('网络请求失败'));
        }
      });
    });
  }
});
