// 设置页面
const app = getApp();

Page({
  data: {
    apiKey: '',
    monthlyIncome: '',
    dailyThreshold: '',
    weeklyThreshold: '',
    monthlyThreshold: '',
    subscribed: false,
    isManualMode: false  // 是否手动设置阈值
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

    // 判断是否手动模式：检查是否有手动设置的标志
    const isManualMode = wx.getStorageSync('thresholdManualMode') || false;

    this.setData({
      apiKey: apiKey,
      monthlyIncome: financial.monthlyIncome ? financial.monthlyIncome.toString() : '',
      dailyThreshold: financial.dailyThreshold ? financial.dailyThreshold.toString() : '',
      weeklyThreshold: financial.weeklyThreshold ? financial.weeklyThreshold.toString() : '',
      monthlyThreshold: financial.monthlyThreshold ? financial.monthlyThreshold.toString() : '',
      isManualMode: isManualMode
    });
  },

  onApiKeyInput(e) {
    this.setData({ apiKey: e.detail.value });
  },

  // 月收入输入 - 自动计算阈值
  onIncomeInput(e) {
    const value = e.detail.value;
    this.setData({ monthlyIncome: value });
    if (value) {
      const income = parseFloat(value);
      if (!isNaN(income)) {
        this.setData({
          dailyThreshold: (income * 0.05).toFixed(2),
          weeklyThreshold: (income * 0.20).toFixed(2),
          monthlyThreshold: (income * 0.50).toFixed(2)  // 修改为50%
        });
      }
    }
  },

  // 手动阈值输入
  onDailyThresholdInput(e) {
    this.setData({ dailyThreshold: e.detail.value });
  },

  onWeeklyThresholdInput(e) {
    this.setData({ weeklyThreshold: e.detail.value });
  },

  onMonthlyThresholdInput(e) {
    this.setData({ monthlyThreshold: e.detail.value });
  },

  // 切换手动/自动模式
  toggleThresholdMode() {
    const newMode = !this.data.isManualMode;
    this.setData({ isManualMode: newMode });
    wx.setStorageSync('thresholdManualMode', newMode);

    if (!newMode) {
      // 切换回自动模式，重新根据月收入计算
      this.onIncomeInput({ detail: { value: this.data.monthlyIncome } });
    }
  },

  saveSettings() {
    const apiKey = this.data.apiKey.trim();
    const monthlyIncome = parseFloat(this.data.monthlyIncome) || 0;
    const dailyThreshold = parseFloat(this.data.dailyThreshold) || 0;
    const weeklyThreshold = parseFloat(this.data.weeklyThreshold) || 0;
    const monthlyThreshold = parseFloat(this.data.monthlyThreshold) || 0;

    if (apiKey) {
      app.globalData.deepseekApiKey = apiKey;
      wx.setStorageSync('deepseekApiKey', apiKey);
    }

    // 保存财务信息
    app.globalData.userFinancial = {
      monthlyIncome: monthlyIncome,
      dailyThreshold: dailyThreshold,
      weeklyThreshold: weeklyThreshold,
      monthlyThreshold: monthlyThreshold,
      socialClass: ''
    };
    wx.setStorageSync('userFinancial', app.globalData.userFinancial);

    // 如果是手动模式，保存阈值到服务器
    if (this.data.isManualMode && dailyThreshold > 0) {
      this.saveThresholdsToServer(dailyThreshold, weeklyThreshold, monthlyThreshold);
    }

    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  // 保存阈值到服务器
  saveThresholdsToServer(daily, weekly, monthly) {
    const openid = app.globalData.openid;
    wx.request({
      url: app.globalData.serverUrl + '/api/save_threshold',
      method: 'POST',
      data: {
        openid: openid,
        daily: daily,
        weekly: weekly,
        monthly: monthly
      },
      success: (res) => {
        console.log('阈值保存成功', res);
      }
    });
  },

  requestSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: ['9OeMu-Bzw8Yt4vbibXQZbJ7iwzVfCGX6BrCp9BGJEro'],
      success: (res) => {
        if (res['9OeMu-Bzw8Yt4vbibXQZbJ7iwzVfCGX6BrCp9BGJEro'] === 'accept') {
          this.setData({ subscribed: true });
          wx.setStorageSync('subscribed', true);
          wx.showToast({ title: '订阅成功', icon: 'success' });
        } else {
          wx.showToast({ title: '您拒绝了订阅', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('订阅失败', err);
        wx.showToast({ title: '订阅失败', icon: 'none' });
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
