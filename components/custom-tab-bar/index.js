// 自定义底部导航栏组件
Component({
  properties: {
    current: {
      type: String,
      value: 'chat'
    }
  },

  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      if (path) {
        // 使用 reLaunch 可以切换到任意页面
        wx.reLaunch({ url: path });
      }
    }
  }
});
