// 设置页面
const app = getApp();

Page({
  data: {
    apiKey: '',
    monthlyIncome: '',
    dailyThreshold: '0.00',
    weeklyThreshold: '0.00',
    monthlyThreshold: '0.00',
    subscribed: false
  },

  onLoad() {
    this.loadSettings();
  },

  onShow() {
    this.checkSubscribe();
  },

  loadSettings() {
    const apiKey = app.globalData.deepseekApiKey || wx.getStorageSync('deepseekApiKey') || '';
    const financial = app.globalData.userFinancial;

    this.setData({
      apiKey: apiKey,
      monthlyIncome: financial.monthlyIncome ? financial.monthlyIncome.toString() : '',
      dailyThreshold: financial.dailyThreshold ? financial.dailyThreshold.toFixed(2) : '0.00',
      weeklyThreshold: financial.weeklyThreshold ? financial.weeklyThreshold.toFixed(2) : '0.00',
      monthlyThreshold: financial.monthlyThreshold ? financial.monthlyThreshold.toFixed(2) : '0.00'
    });
  },

  onApiKeyInput(e) {
    this.setData({ apiKey: e.detail.value });
  },

  onIncomeInput(e) {
    const value = e.detail.value;
    this.setData({ monthlyIncome: value });
    if (value) {
      const income = parseFloat(value);
      this.setData({
        dailyThreshold: (income * 0.05).toFixed(2),
        weeklyThreshold: (income * 0.20).toFixed(2),
        monthlyThreshold: (income * 0.80).toFixed(2)
      });
    }
  },

  saveSettings() {
    const apiKey = this.data.apiKey.trim();
    const monthlyIncome = parseFloat(this.data.monthlyIncome) || 0;

    if (apiKey) {
      app.globalData.deepseekApiKey = apiKey;
      wx.setStorageSync('deepseekApiKey', apiKey);
    }

    if (monthlyIncome > 0) {
      app.globalData.userFinancial = {
        monthlyIncome: monthlyIncome,
        dailyThreshold: monthlyIncome * 0.05,
        weeklyThreshold: monthlyIncome * 0.20,
        monthlyThreshold: monthlyIncome * 0.80,
        socialClass: ''
      };
      wx.setStorageSync('userFinancial', app.globalData.userFinancial);
    }

    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  requestSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: ['YOUR_TEMPLATE_ID'],
      success: (res) => {
        if (res['YOUR_TEMPLATE_ID'] === 'accept') {
          this.setData({ subscribed: true });
          wx.showToast({ title: '订阅成功', icon: 'success' });
        }
      },
      fail: (err) => {
        console.error('订阅失败', err);
        wx.showToast({ title: '请允许订阅', icon: 'none' });
      }
    });
  },

  checkSubscribe() {
    const subscribed = wx.getStorageSync('subscribed') || false;
    this.setData({ subscribed: subscribed });
  },

  openDeepSeek() {
    wx.showToast({ title: '请在浏览器打开DeepSeek官网', icon: 'none' });
  }
});
