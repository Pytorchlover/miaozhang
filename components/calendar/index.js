// 日历组件
Component({
  properties: {
    // 消费数据 { date: '2024-01-15', amount: 123.5, transactions: [...] }
    expenseData: {
      type: Array,
      value: []
    },
    // 选中日期
    selectedDate: {
      type: String,
      value: ''
    }
  },

  data: {
    year: 0,
    month: 0,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    days: [],
    firstDayPadding: 0,
    selectedDateStr: '',
    selectedDateTransactions: [],
    selectedDayTotal: '0.00'
  },

  lifetimes: {
    attached() {
      const now = new Date();
      this.setData({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        selectedDateStr: this.properties.selectedDate || this.formatDate(now)
      });
      this.generateCalendar();
    }
  },

  observers: {
    'expenseData': function() {
      this.generateCalendar();
    },
    'selectedDate': function(newDate) {
      if (newDate) {
        this.setData({ selectedDateStr: newDate });
        this.updateSelectedDayDetail();
      }
    }
  },

  methods: {
    // 格式化日期
    formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    // 生成日历数据
    generateCalendar() {
      const { year, month } = this.data;
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const daysInMonth = lastDay.getDate();
      const firstDayWeekday = firstDay.getDay();

      const today = new Date();
      const todayStr = this.formatDate(today);

      // 创建日期数组
      const days = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month - 1, i);
        const dateStr = this.formatDate(date);

        // 查找该日期的消费数据
        const expenseInfo = this.findExpenseByDate(dateStr);

        days.push({
          day: i,
          dateStr: dateStr,
          hasExpense: expenseInfo.hasExpense,
          expenseAmount: expenseInfo.amount,
          isToday: dateStr === todayStr,
          isSelected: dateStr === this.data.selectedDateStr
        });
      }

      this.setData({
        days: days,
        firstDayPadding: firstDayWeekday
      });

      // 不在这里调用updateSelectedDayDetail，由observer处理
    },

    // 查找某日期的消费
    findExpenseByDate(dateStr) {
      const expenseData = this.properties.expenseData || [];
      const found = expenseData.find(item => item.date === dateStr);
      if (found) {
        return {
          hasExpense: true,
          amount: (found.amount || 0).toFixed(0)
        };
      }
      return { hasExpense: false, amount: '0' };
    },

    // 更新选中日期详情
    updateSelectedDayDetail() {
      const selectedDate = this.data.selectedDateStr;
      if (!selectedDate) return;

      const expenseData = this.properties.expenseData || [];
      const found = expenseData.find(item => item.date === selectedDate);

      if (found && found.transactions) {
        const total = found.transactions.reduce((sum, t) => sum + t.amount, 0);
        this.setData({
          selectedDateTransactions: found.transactions,
          selectedDayTotal: total.toFixed(2)
        });
      } else {
        this.setData({
          selectedDateTransactions: [],
          selectedDayTotal: '0.00'
        });
      }
    },

    // 上一个月
    prevMonth() {
      let { year, month } = this.data;
      month--;
      if (month < 1) {
        month = 12;
        year--;
      }
      this.setData({ year, month });
      this.generateCalendar();
    },

    // 下一个月
    nextMonth() {
      let { year, month } = this.data;
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
      this.setData({ year, month });
      this.generateCalendar();
    },

    // 回到今天
    goToToday() {
      const now = new Date();
      this.setData({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        selectedDateStr: this.formatDate(now)
      });
      this.generateCalendar();
    },

    // 点击日期
    onDayTap(e) {
      const dateStr = e.currentTarget.dataset.date;
      const hasExpense = e.currentTarget.dataset.hasExpense;

      // 更新选中状态
      const days = this.data.days.map(d => ({
        ...d,
        isSelected: d.dateStr === dateStr
      }));
      this.setData({ days, selectedDateStr: dateStr });

      this.updateSelectedDayDetail();

      // 触发事件给父组件
      this.triggerEvent('daytap', { date: dateStr, hasExpense });
    },

    // 获取分类样式
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

    // 获取分类emoji
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
    }
  }
});
