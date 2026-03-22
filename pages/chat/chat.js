// 聊天记账页面
const app = getApp();

Page({
  data: {
    messages: [],
    inputText: '',
    pendingImage: '',
    loading: false,
    scrollTop: 0,
    showWelcome: true,
    serverUrl: ''
  },

  onLoad() {
    this.setData({
      showWelcome: true,
      serverUrl: app.globalData.serverUrl
    });
  },

  quickAction(e) {
    const type = e.currentTarget.dataset.type;

    switch (type) {
      case 'screenshot':
        this.chooseImage();
        break;
      case 'income':
        this.setData({ inputText: '我的月收入是' });
        break;
    }
  },

  addUserMessage(content, image) {
    const messages = this.data.messages;
    messages.push({
      id: Date.now().toString(),
      role: 'user',
      content: content,
      image: image
    });
    this.setData({
      messages: messages,
      scrollTop: Date.now() + 1,
      showWelcome: false
    });
  },

  addAiMessage(content, type, data) {
    const messages = this.data.messages;
    messages.push({
      id: Date.now().toString(),
      role: 'ai',
      content: content,
      type: type || 'text',
      data: data
    });
    this.setData({
      messages: messages,
      scrollTop: Date.now() + 1,
      showWelcome: false
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ pendingImage: tempFilePath });
        this.processImage(tempFilePath);
      },
      fail: (err) => {
        console.error('选择图片失败', err);
        wx.showToast({ title: '请选择图片', icon: 'none' });
      }
    });
  },

  async processImage(imagePath) {
    this.addUserMessage('发送了一张付款截图', imagePath);
    this.setData({ loading: true, pendingImage: '' });

    try {
      const serverUrl = app.globalData.serverUrl;

      // 读取图片为 base64
      const imageBase64 = await this.readFileAsBase64(imagePath);

      // 调用 OCR 识别
      const ocrRes = await this.requestPromise({
        url: serverUrl + '/api/ocr_recognize',
        method: 'POST',
        data: {
          image: imageBase64,
          imageUrl: imagePath
        }
      });

      this.setData({ loading: false });

      if (ocrRes.success) {
        const data = ocrRes.data;
        this.addAiMessage('我识别到以下信息，请确认：', 'confirm', {
          amount: data.amount || '0',
          merchant: data.merchant || '未知商家',
          category: data.category || '其他',
          date: data.date || this.formatDate(new Date()),
          imageUrl: imagePath
        });
      } else {
        this.addAiMessage('抱歉，我无法识别这张图片。\n\n你可以：\n• 手动告诉我消费金额和内容\n• 重试上传更清晰的图片');
      }
    } catch (err) {
      console.error('OCR识别失败', err);
      this.setData({ loading: false });
      this.addAiMessage('识别失败：' + (err.message || '请重试') + '\n\n你可以手动告诉我消费内容。');
    }
  },

  // 读取文件并转为 base64
  readFileAsBase64(filePath) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: filePath,
        encoding: 'base64',
        success: (res) => {
          resolve(res.data);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  sendMessage() {
    const text = this.data.inputText.trim();
    if (!text) return;

    this.addUserMessage(text);
    this.setData({ inputText: '' });
    this.processUserInput(text);
  },

  async processUserInput(text) {
    this.setData({ loading: true });

    try {
      const serverUrl = app.globalData.serverUrl;

      const res = await this.requestPromise({
        url: serverUrl + '/api/save_transaction',
        method: 'POST',
        data: {
          action: 'chat',
          message: text,
          openid: app.globalData.openid,
          apiKey: app.globalData.deepseekApiKey
        }
      });

      this.setData({ loading: false });

      if (res.success) {
        if (res.type === 'confirm') {
          this.addAiMessage('请确认这笔支出：', 'confirm', res.data);
        } else {
          this.addAiMessage(res.message);
        }
      } else {
        this.addAiMessage(res.message || '处理失败，请重试。');
      }
    } catch (err) {
      console.error('处理失败', err);
      this.setData({ loading: false });
      this.addAiMessage('处理失败：' + (err.message || '请重试'));
    }
  },

  async confirmExpense(e) {
    const id = e.currentTarget.dataset.id;
    const messages = this.data.messages;
    const msgIndex = messages.findIndex((m) => m.id === id);

    if (msgIndex === -1) return;

    const msg = messages[msgIndex];
    if (!msg.data) return;

    this.setData({ loading: true });

    try {
      const serverUrl = app.globalData.serverUrl;

      const res = await this.requestPromise({
        url: serverUrl + '/api/save_transaction',
        method: 'POST',
        data: {
          action: 'confirm',
          data: msg.data,
          openid: app.globalData.openid
        }
      });

      this.setData({ loading: false });

      if (res.success) {
        messages.splice(msgIndex, 1);
        this.setData({ messages: messages });
        this.addAiMessage(res.message);

        if (res.alert) {
          this.addAiMessage(res.alert);
        }
      } else {
        this.addAiMessage('保存失败，请重试。');
      }
    } catch (err) {
      console.error('保存失败', err);
      this.setData({ loading: false });
      this.addAiMessage('保存失败：' + (err.message || '请重试'));
    }
  },

  cancelExpense(e) {
    const id = e.currentTarget.dataset.id;
    const messages = this.data.messages;
    const msgIndex = messages.findIndex((m) => m.id === id);

    if (msgIndex !== -1) {
      messages.splice(msgIndex, 1);
      this.setData({ messages: messages });
      this.addAiMessage('已取消。\n\n你可以重新发送截图或告诉我其他消费内容。');
    }
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
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
