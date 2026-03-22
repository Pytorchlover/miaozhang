// AI记账小程序 - 入口文件
App({
  globalData: {
    userInfo: null,
    openid: '',
    // 云服务器地址
    serverUrl: 'https://spatialtemporal.xyz',
    deepseekApiKey: '',
    userFinancial: {
      monthlyIncome: 0,
      dailyThreshold: 0,
      weeklyThreshold: 0,
      monthlyThreshold: 0,
      socialClass: ''
    }
  },

  onLaunch() {
    // 获取 openid
    this.getOpenId();
    // 加载本地存储的设置
    this.loadSettings();
  },

  getOpenId() {
    // 演示用：使用测试 openid
    // 实际生产应该调用微信接口用 code 换 openid
    const openid = wx.getStorageSync('openid') || 'test_user_' + Date.now();
    this.globalData.openid = openid;
    wx.setStorageSync('openid', openid);
    console.log('openid:', openid);

    // 如果想用真实的 openid，取消下面注释：
    // this.fetchOpenId();
  },

  fetchOpenId() {
    wx.login({
      success: (res) => {
        if (res.code) {
          wx.request({
            url: this.globalData.serverUrl + '/api/login',
            data: { code: res.code },
            success: (result) => {
              if (result.data.success) {
                this.globalData.openid = result.data.openid;
                wx.setStorageSync('openid', result.data.openid);
              }
            }
          });
        }
      }
    });
  },

  loadSettings() {
    const apiKey = wx.getStorageSync('deepseekApiKey') || '';
    const financial = wx.getStorageSync('userFinancial') || {};

    if (apiKey) {
      this.globalData.deepseekApiKey = apiKey;
    }

    if (financial.monthlyIncome) {
      this.globalData.userFinancial = financial;
    }
  }
});
