// 全局变量和配置
const DateTime = luxon.DateTime;
let currentMode = 'today'; // 'today', 'week', 'month', 'custom'
let keystrokeData = [];
let activeDate = DateTime.now();
let calendarDisplayDate = DateTime.now(); // 当前显示的日历月份
let calendarViewMode = 'total'; // 'active' 或 'total' 工作时长视图

// 定义操作超时时间（5分钟，单位：毫秒）
const ACTIVITY_TIMEOUT = 5 * 60 * 1000;

// 键盘布局定义（标准QWERTY键盘）
const keyboardLayout = {
    row1: ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
    row2: ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
    row3: ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
    row4: ['Caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\'', 'Enter'],
    row5: ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Shift_r'],
    row6: ['Ctrl', 'Win', 'Alt', 'Space', 'Alt_r', 'Menu', 'Ctrl_r']
};

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，开始初始化...');
    
    // 检查关键元素是否存在
    const elements = {
        'minute-activity-chart': document.getElementById('minute-activity-chart'),
        'minute-chart-day-selector': document.getElementById('minute-chart-day-selector'),
        'minute-chart-date-picker': document.getElementById('minute-chart-date-picker'),
        'zoom-in': document.getElementById('zoom-in'),
        'zoom-out': document.getElementById('zoom-out'),
        'zoom-reset': document.getElementById('zoom-reset'),
        'date-picker': document.getElementById('date-picker')
    };
    
    // 输出每个元素的状态
    Object.entries(elements).forEach(([id, element]) => {
        console.log(`检查元素 ${id}: ${element ? '已找到' : '未找到'}`);
    });
    
    // 绑定时间选择器事件
    document.getElementById('today-btn').addEventListener('click', () => setTimeMode('today'));
    document.getElementById('week-btn').addEventListener('click', () => setTimeMode('week'));
    document.getElementById('month-btn').addEventListener('click', () => setTimeMode('month'));
    
    // 初始化日期选择器
    const datePicker = document.getElementById('date-picker');
    if (datePicker) {
        // 设置默认值为今天
        datePicker.valueAsDate = new Date();
        
        // 监听日期变化
        datePicker.addEventListener('change', function(e) {
            const selectedDate = DateTime.fromISO(e.target.value);
            activeDate = selectedDate;
            setTimeMode('custom');
            
            // 同步分钟级活动曲线的日期
            const minuteChartDaySelector = document.getElementById('minute-chart-day-selector');
            const minuteChartDatePicker = document.getElementById('minute-chart-date-picker');
            if (minuteChartDaySelector && minuteChartDatePicker) {
                minuteChartDaySelector.value = 'custom';
                minuteChartDatePicker.style.display = 'inline-block';
                minuteChartDatePicker.value = selectedDate.toFormat('yyyy-MM-dd');
                updateMinuteActivityChart(); // 更新分钟级活动曲线
            }
            
            fetchData();
        });
    }
    
    // 绑定日历控制事件
    document.getElementById('prev-month').addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeCalendarMonth(1));
    document.getElementById('active-hours-btn').addEventListener('click', () => setCalendarViewMode('active'));
    document.getElementById('total-hours-btn').addEventListener('click', () => setCalendarViewMode('total'));
    
    // 初始化当前月份显示
    updateCurrentMonthDisplay();
    
    // 绑定分钟级活动图表的事件
    const minuteChartDaySelector = document.getElementById('minute-chart-day-selector');
    const minuteChartDatePicker = document.getElementById('minute-chart-date-picker');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    
    if (minuteChartDaySelector) {
        minuteChartDaySelector.addEventListener('change', handleMinuteChartDayChange);
    }
    
    if (minuteChartDatePicker) {
        minuteChartDatePicker.addEventListener('change', updateMinuteActivityChart);
    }
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => zoomMinuteChart(1.5));
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => zoomMinuteChart(0.75));
    }
    
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', resetMinuteChartZoom);
    }
    
    // 获取数据
    fetchData();
    
    // 确保日历正确显示历史数据
    fetchCalendarData();
});

// 设置时间模式
function setTimeMode(mode) {
    currentMode = mode;
    
    // 更新按钮状态
    document.querySelectorAll('.time-selector button').forEach(btn => btn.classList.remove('active'));
    
    if (mode !== 'custom') {
        document.getElementById(`${mode}-btn`).classList.add('active');
    }
    
    // 如果切换到今日模式，更新日期选择器
    if (mode === 'today') {
        const datePicker = document.getElementById('date-picker');
        if (datePicker) {
            datePicker.valueAsDate = new Date();
        }
        activeDate = DateTime.now();
        
        // 同步分钟级活动曲线的日期选择
        const minuteChartDaySelector = document.getElementById('minute-chart-day-selector');
        const minuteChartDatePicker = document.getElementById('minute-chart-date-picker');
        if (minuteChartDaySelector) {
            minuteChartDaySelector.value = 'today';
            if (minuteChartDatePicker) {
                minuteChartDatePicker.style.display = 'none';
            }
        }
    } else if (mode === 'custom') {
        // 同步分钟级活动曲线的日期选择
        const minuteChartDaySelector = document.getElementById('minute-chart-day-selector');
        const minuteChartDatePicker = document.getElementById('minute-chart-date-picker');
        if (minuteChartDaySelector && minuteChartDatePicker) {
            minuteChartDaySelector.value = 'custom';
            minuteChartDatePicker.style.display = 'inline-block';
            minuteChartDatePicker.value = activeDate.toFormat('yyyy-MM-dd');
        }
    }
    
    console.log(`切换到${mode}模式，正在重新加载数据...`);
    
    // 重新加载数据和更新图表
    fetchData();
}

// 切换日历视图模式（有效工作时长或总工作时长）
function setCalendarViewMode(mode) {
    calendarViewMode = mode;
    
    // 更新按钮状态
    document.querySelectorAll('.view-toggle button').forEach(btn => btn.classList.remove('active'));
    const buttonId = mode === 'active' ? 'active-hours-btn' : 'total-hours-btn';
    document.getElementById(buttonId).classList.add('active');
    
    // 获取完整数据并重新渲染日历
    fetchCalendarData();
}

// 改变日历月份
function changeCalendarMonth(change) {
    calendarDisplayDate = calendarDisplayDate.plus({ months: change });
    updateCurrentMonthDisplay();
    
    // 获取完整数据并重新渲染日历
    fetchCalendarData();
}

// 更新当前月份显示
function updateCurrentMonthDisplay() {
    document.getElementById('current-month').textContent = calendarDisplayDate.toFormat('yyyy年MM月');
}

// 获取数据
async function fetchData() {
    try {
        let apiUrl = '/api/keystroke_data';
        let queryParams = '';
        
        if (currentMode === 'today' || currentMode === 'custom') {
            // 如果是今日模式或自定义日期模式，使用today_data接口
            apiUrl = '/api/today_data';
            if (currentMode === 'custom') {
                // 如果是自定义日期模式，添加日期参数
                const dateStr = activeDate.toFormat('yyyy-MM-dd');
                queryParams = `?date=${dateStr}`;
            }
        }
        
        console.log('正在请求数据:', apiUrl + queryParams);
        const response = await fetch(apiUrl + queryParams);
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API响应数据:', data);
        
        // 检查数据是否有效
        if (data.error) {
            console.error('API返回错误:', data.error);
            showErrorMessage('服务器返回错误: ' + data.error);
            return;
        }
        
        // 处理数据格式
        if ((currentMode === 'today' || currentMode === 'custom') && !Array.isArray(data)) {
            // 如果是today_data或custom模式的响应，它返回的是单个对象
            if (!data.result) {
                console.error('数据格式无效:', data);
                showErrorMessage('数据格式无效');
                return;
            }
            
            // 将单个对象转换为数组
            keystrokeData = [data];
        } else if (Array.isArray(data)) {
            // 检查数组中的数据是否有效
            const validData = data.filter(item => item && item.result);
            if (validData.length === 0) {
                console.error('API返回的数据不包含有效记录');
                showErrorMessage('没有有效的按键记录');
                return;
            }
            keystrokeData = data;
        } else {
            console.error('API返回的数据格式无效');
            showErrorMessage('无法识别的数据格式');
            return;
        }
        
        console.log('处理后的数据:', keystrokeData);
        
        // 根据当前模式过滤数据
        const filteredData = filterDataByTimeMode();
        console.log('过滤后的数据:', filteredData);
        
        // 如果过滤后没有数据
        if (filteredData.length === 0) {
            console.warn('过滤后没有数据');
            showNoDataMessage();
            return;
        }
        
        // 清除之前的错误消息
        clearErrorMessages();
        
        // 更新统计和图表
        updateStatistics(filteredData);
        updateHourlyChart(filteredData);
        updateKeyboardHeatmap(filteredData);
        updateOperationDistributionChart();
        
        // 更新分钟级活动图表
        updateMinuteActivityChart();
        
        // 使用独立的函数获取和更新日历数据
        fetchCalendarData();
    } catch (error) {
        console.error('获取数据失败:', error);
        showErrorMessage('获取数据失败: ' + error.message);
    }
}

// 显示错误消息
function showErrorMessage(message) {
    // 显示错误信息在页面上
    document.getElementById('total-count').textContent = '加载失败';
    document.getElementById('avg-per-hour').textContent = '加载失败';
    document.getElementById('peak-hour').textContent = '加载失败';
    document.getElementById('active-time').textContent = '加载失败';
    
    // 添加错误消息到页面顶部
    const mainElement = document.querySelector('main');
    if (mainElement) {
        // 移除之前的错误消息
        clearErrorMessages();
        
        // 创建新的错误消息
        const errorBox = document.createElement('div');
        errorBox.className = 'error-message';
        errorBox.textContent = message;
        errorBox.style.backgroundColor = '#ff3b30';
        errorBox.style.color = 'white';
        errorBox.style.padding = '10px 15px';
        errorBox.style.borderRadius = '8px';
        errorBox.style.margin = '0 0 20px 0';
        errorBox.style.textAlign = 'center';
        
        // 插入到main元素的开头
        mainElement.insertBefore(errorBox, mainElement.firstChild);
    }
}

// 显示无数据消息
function showNoDataMessage() {
    // 显示无数据信息
    document.getElementById('total-count').textContent = '0';
    document.getElementById('avg-per-hour').textContent = '0';
    document.getElementById('peak-hour').textContent = '无数据';
    document.getElementById('active-time').textContent = '0小时 0分钟';
    
    // 添加无数据消息到页面顶部
    const mainElement = document.querySelector('main');
    if (mainElement) {
        // 移除之前的错误消息
        clearErrorMessages();
        
        // 创建新的消息
        const messageBox = document.createElement('div');
        messageBox.className = 'info-message';
        messageBox.textContent = '当前时间范围内没有按键记录数据';
        messageBox.style.backgroundColor = '#5ac8fa';
        messageBox.style.color = 'white';
        messageBox.style.padding = '10px 15px';
        messageBox.style.borderRadius = '8px';
        messageBox.style.margin = '0 0 20px 0';
        messageBox.style.textAlign = 'center';
        
        // 插入到main元素的开头
        mainElement.insertBefore(messageBox, mainElement.firstChild);
    }
}

// 清除错误消息
function clearErrorMessages() {
    const errorMessages = document.querySelectorAll('.error-message, .info-message');
    errorMessages.forEach(element => element.remove());
}

// 根据时间模式过滤数据
function filterDataByTimeMode() {
    const now = DateTime.now();
    console.log('当前时间:', now.toFormat('yyyy-MM-dd'));
    console.log('当前模式:', currentMode);
    console.log('原始数据长度:', keystrokeData.length);
    
    if (keystrokeData.length === 0) {
        console.error('没有数据可以过滤!');
        return [];
    }
    
    // 检查数据格式
    if (!Array.isArray(keystrokeData)) {
        console.error('数据格式错误! 期望数组但收到:', typeof keystrokeData);
        if (typeof keystrokeData === 'object') {
            // 可能服务器返回了单个对象而不是数组
            return [keystrokeData];
        }
        return [];
    }
    
    let result = [];
    
    switch(currentMode) {
        case 'today':
            const todayStr = now.toFormat('yyyy-MM-dd');
            console.log('过滤今日数据，日期:', todayStr);
            result = keystrokeData.filter(data => data.date === todayStr);
            break;
            
        case 'week':
            const startOfWeek = now.startOf('week');
            const endOfWeek = now.endOf('week');
            console.log('过滤本周数据，开始:', startOfWeek.toFormat('yyyy-MM-dd'), '结束:', endOfWeek.toFormat('yyyy-MM-dd'));
            result = keystrokeData.filter(data => {
                const dataDate = DateTime.fromFormat(data.date, 'yyyy-MM-dd');
                return dataDate >= startOfWeek && dataDate <= endOfWeek;
            });
            break;
            
        case 'month':
            const startOfMonth = now.startOf('month');
            const endOfMonth = now.endOf('month');
            console.log('过滤本月数据，开始:', startOfMonth.toFormat('yyyy-MM-dd'), '结束:', endOfMonth.toFormat('yyyy-MM-dd'));
            result = keystrokeData.filter(data => {
                const dataDate = DateTime.fromFormat(data.date, 'yyyy-MM-dd');
                return dataDate >= startOfMonth && dataDate <= endOfMonth;
            });
            break;
            
        default:
            console.log('使用所有数据');
            result = keystrokeData;
    }
    
    console.log('过滤后数据长度:', result.length);
    return result;
}

// 更新统计信息
function updateStatistics(data) {
    try {
        console.log('开始更新统计信息，数据长度:', data.length);
        // 合并所有数据
        let allKeystrokes = [];
        data.forEach(dayData => {
            if (!dayData || !dayData.result) {
                console.error('日期数据无效:', dayData);
                return;
            }
            allKeystrokes = allKeystrokes.concat(dayData.result);
        });
        
        console.log('合并后的按键数据长度:', allKeystrokes.length);
        
        // 更新总按键次数
        document.getElementById('total-count').textContent = allKeystrokes.length.toLocaleString();
        
        // 如果没有按键，显示0
        if (allKeystrokes.length === 0) {
            document.getElementById('avg-per-hour').textContent = '0';
            document.getElementById('peak-hour').textContent = '无数据';
            document.getElementById('active-time').textContent = '0小时 0分钟';
            document.getElementById('total-time').textContent = '0小时 0分钟';
            return;
        }
        
        // 按小时统计
        const hoursCount = {};
        let peakHour = '0';
        
        allKeystrokes.forEach(stroke => {
            const date = new Date(stroke.time);
            const hour = date.getHours().toString().padStart(2, '0');
            
            if (!hoursCount[hour]) {
                hoursCount[hour] = 0;
            }
            
            hoursCount[hour]++;
        });
        
        // 计算平均每小时的按键次数
        const totalHours = Object.keys(hoursCount).length || 1; // 避免除零
        const avgPerHour = Math.round(allKeystrokes.length / totalHours);
        document.getElementById('avg-per-hour').textContent = avgPerHour.toLocaleString();
        
        // 查找高峰时段
        let peakCount = 0;
        Object.entries(hoursCount).forEach(([hour, count]) => {
            if (count > peakCount) {
                peakCount = count;
                peakHour = hour;
            }
        });
        document.getElementById('peak-hour').textContent = `${peakHour}:00 - ${parseInt(peakHour) + 1}:00`;
        
        // 计算有效工作时长和总工作时长
        let totalActiveTime = 0;
        let totalWorkingTime = 0;
        
        data.forEach(dayData => {
            if (dayData.first_activity_time && dayData.last_activity_time) {
                // 计算总工作时长
                const dayTotalTime = dayData.last_activity_time - dayData.first_activity_time;
                totalWorkingTime += dayTotalTime;
                
                // 计算有效工作时长
                let activeTime = 0;
                const events = dayData.result;
                if (events && events.length > 0) {
                    events.sort((a, b) => a.time - b.time);
                    let lastTime = events[0].time;
                    
                    for (let i = 1; i < events.length; i++) {
                        const currentTime = events[i].time;
                        const timeDiff = currentTime - lastTime;
                        
                        if (timeDiff < ACTIVITY_TIMEOUT) {
                            activeTime += timeDiff;
                        }
                        
                        lastTime = currentTime;
                    }
                }
                totalActiveTime += activeTime;
            }
        });
        
        // 转换为小时和分钟并显示
        const activeHours = Math.floor(totalActiveTime / (60 * 60 * 1000));
        const activeMinutes = Math.floor((totalActiveTime % (60 * 60 * 1000)) / (60 * 1000));
        document.getElementById('active-time').textContent = `${activeHours}小时 ${activeMinutes}分钟`;
        
        const totalHoursWorked = Math.floor(totalWorkingTime / (60 * 60 * 1000));
        const totalMinutesWorked = Math.floor((totalWorkingTime % (60 * 60 * 1000)) / (60 * 1000));
        document.getElementById('total-time').textContent = `${totalHoursWorked}小时 ${totalMinutesWorked}分钟`;
        
    } catch (error) {
        console.error('更新统计信息失败:', error);
        document.getElementById('active-time').textContent = '计算失败';
        document.getElementById('total-time').textContent = '计算失败';
    }
}

// 更新小时分布图表
function updateHourlyChart(data) {
    try {
        console.log('开始更新小时分布图表，数据长度:', data.length);
        // 合并所有数据
        let allKeystrokes = [];
        data.forEach(dayData => {
            if (!dayData || !dayData.result) {
                console.error('日期数据无效:', dayData);
                return;
            }
            allKeystrokes = allKeystrokes.concat(dayData.result);
        });
        
        console.log('合并后的按键数据长度:', allKeystrokes.length);
        
        // 按时间间隔统计 (默认按小时)
        let timeInterval = localStorage.getItem('timeInterval') || 'hour'; // 'halfhour', 'hour', 'twohour'
        let timeLabels = [];
        let timeCounts = [];
        
        // 根据时间间隔设置刻度和数据
        switch(timeInterval) {
            case 'halfhour':
                // 半小时为单位
                timeCounts = Array(48).fill(0);
        allKeystrokes.forEach(stroke => {
            const date = new Date(stroke.time);
            const hour = date.getHours();
                    const minute = date.getMinutes();
                    const halfHourIndex = (hour * 2) + (minute >= 30 ? 1 : 0);
                    timeCounts[halfHourIndex]++;
                });
                timeLabels = Array.from({length: 48}, (_, i) => {
                    const hour = Math.floor(i / 2);
                    const minute = (i % 2) * 30;
                    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                });
                break;
            
            case 'twohour':
                // 两小时为单位
                timeCounts = Array(12).fill(0);
                allKeystrokes.forEach(stroke => {
                    const date = new Date(stroke.time);
                    const hour = date.getHours();
                    const twoHourIndex = Math.floor(hour / 2);
                    timeCounts[twoHourIndex]++;
                });
                timeLabels = Array.from({length: 12}, (_, i) => {
                    const hour = i * 2;
                    return `${hour.toString().padStart(2, '0')}:00`;
                });
                break;
                
            case 'hour':
            default:
                // 小时为单位（默认）
                timeCounts = Array(24).fill(0);
                allKeystrokes.forEach(stroke => {
                    const date = new Date(stroke.time);
                    const hour = date.getHours();
                    timeCounts[hour]++;
                });
                timeLabels = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);
                break;
        }
        
        // 获取时间范围设置
        let timeRangeStart = parseInt(localStorage.getItem('timeRangeStart') || '0');
        let timeRangeEnd = parseInt(localStorage.getItem('timeRangeEnd') || timeLabels.length - 1);
        
        // 确保范围有效
        timeRangeStart = Math.max(0, Math.min(timeRangeStart, timeLabels.length - 1));
        timeRangeEnd = Math.max(timeRangeStart, Math.min(timeRangeEnd, timeLabels.length - 1));
        
        // 裁剪数据到所选范围
        const displayLabels = timeLabels.slice(timeRangeStart, timeRangeEnd + 1);
        const displayCounts = timeCounts.slice(timeRangeStart, timeRangeEnd + 1);
        
        // 找出最大值用于渐变色
        const maxCount = Math.max(...displayCounts, 1);
        
        // 创建条形图数据
        const chartData = {
            x: displayLabels,
            y: displayCounts,
            type: 'bar',
            marker: {
                color: displayCounts.map(count => {
                    const intensity = count / maxCount;
                    return `rgba(0, 122, 255, ${Math.max(0.3, intensity).toFixed(2)})`;
                }),
                line: {
                    width: 0
                }
            },
            hoverinfo: 'y+text',
            hovertext: displayCounts.map((count, index) => {
                const nextLabel = index < displayLabels.length - 1 ? 
                    displayLabels[index + 1] : 
                    timeInterval === 'hour' ? '24:00' : (parseInt(displayLabels[index].split(':')[0]) + (timeInterval === 'halfhour' ? 0.5 : 2)) + ':00';
                return `${displayLabels[index]}-${nextLabel}<br>${count} 次按键`;
            }),
            width: 0.7, // 设置柱宽
            textfont: {
                family: '-apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
                size: 11,
                color: 'white'
            }
        };
        
        // 苹果风格布局
        const layout = {
            margin: { t: 16, r: 10, l: 36, b: 40 },
            xaxis: {
                title: '',
                tickfont: {
                    family: '-apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
                    size: 10,
                    color: 'rgba(60, 60, 67, 0.6)'
                },
                tickmode: 'array',
                tickvals: displayLabels.filter((_, i) => {
                    if (timeInterval === 'halfhour') return i % 2 === 0;
                    if (timeInterval === 'twohour') return true;
                    return i % 2 === 0; // 小时模式
                }),
                gridcolor: 'rgba(60, 60, 67, 0.1)',
                linecolor: 'rgba(60, 60, 67, 0.2)',
                zeroline: false,
                rangeslider: {
                    visible: true,
                    thickness: 0.08,
                    bgcolor: 'rgba(240, 240, 240, 0.7)'
                }
            },
            yaxis: {
                title: '',
                tickfont: {
                    family: '-apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
                    size: 10,
                    color: 'rgba(60, 60, 67, 0.6)'
                },
                gridcolor: 'rgba(60, 60, 67, 0.1)',
                linecolor: 'rgba(60, 60, 67, 0.2)',
                zeroline: false,
                fixedrange: true // 禁止y轴缩放
            },
            autosize: true,
            height: 320,
            plot_bgcolor: 'rgba(255, 255, 255, 0)',
            paper_bgcolor: 'rgba(255, 255, 255, 0)',
            bargap: 0.15,
            hoverlabel: {
                bgcolor: 'rgba(255, 255, 255, 0.95)',
                bordercolor: 'rgba(0, 0, 0, 0.1)',
                font: {
                    family: '-apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
                    size: 12,
                    color: 'rgba(0, 0, 0, 0.8)'
                },
                borderradius: 8
            },
            modebar: {
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                color: 'rgba(0, 0, 0, 0.6)',
                activecolor: 'rgba(0, 122, 255, 1)'
            }
        };
        
        // 配置项
        const config = {
            responsive: true,
            displayModeBar: true, // 显示模式栏
            displaylogo: false,
            staticPlot: false,
            scrollZoom: false,
            modeBarButtonsToAdd: [
                {
                    name: '半小时',
                    icon: {
                        width: 24,
                        height: 24,
                        path: 'M16,12 L19,12 L19,8 L16,8 L16,12 Z M11,12 L14,12 L14,8 L11,8 L11,12 Z M6,12 L9,12 L9,8 L6,8 L6,12 Z'
                    },
                    click: function() {
                        localStorage.setItem('timeInterval', 'halfhour');
                        updateHourlyChart(data);
                    }
                },
                {
                    name: '小时',
                    icon: {
                        width: 24,
                        height: 24,
                        path: 'M13.5,12 L19,12 L19,8 L13.5,8 L13.5,12 Z M6,12 L11.5,12 L11.5,8 L6,8 L6,12 Z'
                    },
                    click: function() {
                        localStorage.setItem('timeInterval', 'hour');
                        updateHourlyChart(data);
                    }
                },
                {
                    name: '两小时',
                    icon: {
                        width: 24,
                        height: 24,
                        path: 'M6,12 L19,12 L19,8 L6,8 L6,12 Z'
                    },
                    click: function() {
                        localStorage.setItem('timeInterval', 'twohour');
                        updateHourlyChart(data);
                    }
                }
            ],
            modeBarButtonsToRemove: ['select2d', 'lasso2d'],
            toImageButtonOptions: {
                format: 'png',
                filename: '按键分布',
                height: 500,
                width: 1200,
                scale: 2
            }
        };
        
        // 检查元素是否存在
        const chartElement = document.getElementById('hourly-chart');
        if (!chartElement) {
            console.error('找不到hourly-chart元素');
            return;
        }
        
        // 添加时间精度选择控件
        const chartContainer = chartElement.parentElement;
        let controlsContainer = document.getElementById('chart-controls');
        
        if (!controlsContainer) {
            controlsContainer = document.createElement('div');
            controlsContainer.id = 'chart-controls';
            controlsContainer.className = 'chart-controls';
            controlsContainer.style.display = 'flex';
            controlsContainer.style.justifyContent = 'space-between';
            controlsContainer.style.marginBottom = '10px';
            controlsContainer.style.fontSize = '12px';
            
            // 时间精度选择
            const precisionSelector = document.createElement('div');
            precisionSelector.className = 'precision-selector';
            precisionSelector.innerHTML = `
                <span style="margin-right: 5px; color: var(--gray-1);">时间精度:</span>
                <select id="time-precision" style="padding: 2px 4px; border-radius: 4px; border: 1px solid var(--gray-4); background: white;">
                    <option value="halfhour">30分钟</option>
                    <option value="hour" selected>1小时</option>
                    <option value="twohour">2小时</option>
                </select>
            `;
            
            // 时间范围选择
            const rangeSelector = document.createElement('div');
            rangeSelector.className = 'range-selector';
            rangeSelector.innerHTML = `
                <span style="margin-right: 5px; color: var(--gray-1);">时间范围:</span>
                <select id="time-range-start" style="padding: 2px 4px; border-radius: 4px; border: 1px solid var(--gray-4); background: white; width: 65px;">
                    ${Array.from({length: 24}, (_, i) => `<option value="${i}">${i.toString().padStart(2, '0')}:00</option>`).join('')}
                </select>
                <span style="margin: 0 5px;">-</span>
                <select id="time-range-end" style="padding: 2px 4px; border-radius: 4px; border: 1px solid var(--gray-4); background: white; width: 65px;">
                    ${Array.from({length: 24}, (_, i) => `<option value="${i}" ${i === 23 ? 'selected' : ''}>${i.toString().padStart(2, '0')}:00</option>`).join('')}
                </select>
            `;
            
            controlsContainer.appendChild(precisionSelector);
            controlsContainer.appendChild(rangeSelector);
            
            chartContainer.insertBefore(controlsContainer, chartElement);
            
            // 添加事件监听器
            document.getElementById('time-precision').addEventListener('change', function(e) {
                localStorage.setItem('timeInterval', e.target.value);
                updateHourlyChart(data);
            });
            
            document.getElementById('time-range-start').addEventListener('change', function(e) {
                localStorage.setItem('timeRangeStart', e.target.value);
                updateHourlyChart(data);
            });
            
            document.getElementById('time-range-end').addEventListener('change', function(e) {
                localStorage.setItem('timeRangeEnd', e.target.value);
                updateHourlyChart(data);
            });
        }
        
        // 设置当前选中的值
        if (document.getElementById('time-precision')) {
            document.getElementById('time-precision').value = timeInterval;
        }
        if (document.getElementById('time-range-start')) {
            document.getElementById('time-range-start').value = timeRangeStart;
        }
        if (document.getElementById('time-range-end')) {
            document.getElementById('time-range-end').value = Math.min(23, timeRangeEnd);
        }
        
        console.log('绘制小时分布图表');
        Plotly.newPlot('hourly-chart', [chartData], layout, config);
        
        // 注册图表更新完成事件
        chartElement.on('plotly_afterplot', function() {
            // 检查范围滑块是否改变了数据范围
            chartElement.on('plotly_relayout', function(eventData) {
                if (eventData['xaxis.range[0]'] !== undefined && eventData['xaxis.range[1]'] !== undefined) {
                    const start = Math.floor(eventData['xaxis.range[0]']);
                    const end = Math.ceil(eventData['xaxis.range[1]']);
                    
                    if (start !== timeRangeStart || end !== timeRangeEnd) {
                        localStorage.setItem('timeRangeStart', start);
                        localStorage.setItem('timeRangeEnd', end);
                    }
                }
            });
        });
    } catch (error) {
        console.error('更新小时分布图表失败:', error);
    }
}

// 更新键盘热力图
function updateKeyboardHeatmap(data) {
    try {
        console.log('开始更新键盘热力图，数据长度:', data.length);
        // 合并所有数据
        let allKeystrokes = [];
        data.forEach(dayData => {
            if (!dayData || !dayData.result) {
                console.error('日期数据无效:', dayData);
                return;
            }
            allKeystrokes = allKeystrokes.concat(dayData.result);
        });
        
        console.log('合并后的按键数据长度:', allKeystrokes.length);
        
        // 分离键盘和鼠标数据
        const keyboardData = allKeystrokes.filter(stroke => stroke.type === 'keyboard');
        const mouseData = allKeystrokes.filter(stroke => stroke.type === 'mouse');
        
        console.log('键盘数据长度:', keyboardData.length);
        console.log('鼠标数据长度:', mouseData.length);
        
        // 统计每个按键的次数
        const keyCounts = {};
        keyboardData.forEach(stroke => {
            // 使用action而不是keyboard字段
            const key = stroke.action;
            if (!keyCounts[key]) keyCounts[key] = 0;
            keyCounts[key]++;
        });
        
        // 统计每种鼠标操作的次数
        const mouseCounts = {
            'slide': 0,
            'left_key': 0,
            'right_key': 0,
            'middle_key': 0,
            'roller': 0
        };
        
        mouseData.forEach(stroke => {
            const action = stroke.action;
            if (mouseCounts[action] !== undefined) {
                mouseCounts[action]++;
            }
        });
        
        // 创建键盘热力图
        createKeyboardHeatmap(keyCounts);
        
        // 创建鼠标热力图
        createMouseHeatmap(mouseCounts);
        
    } catch (error) {
        console.error('更新键盘热力图失败:', error);
    }
}

// 创建键盘热力图
function createKeyboardHeatmap(keyCounts) {
    // 获取所有按键的最大点击次数，用于热力图颜色比例
    const maxCount = Math.max(...Object.values(keyCounts), 1);
    
        const container = document.getElementById('keyboard-container');
        if (!container) {
            console.error('找不到keyboard-container元素');
            return;
        }
        
    // 清空容器内容，但保留标题（如果已存在）
    let existingTitle = container.querySelector('h3');
        container.innerHTML = '';
        
    // 如果还没有标题，创建一个新的
    if (!existingTitle) {
        existingTitle = document.createElement('h3');
        existingTitle.textContent = '键盘热力图';
        container.appendChild(existingTitle);
    } else {
        // 重新添加标题
        container.appendChild(existingTitle);
    }
    
    const keyboardContainer = document.createElement('div');
    keyboardContainer.className = 'keyboard-wrapper';
    container.appendChild(keyboardContainer);
    
    // 为每一行创建一个div
    for (const rowName in keyboardLayout) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';
        
        // 为行中的每个键创建一个div
        keyboardLayout[rowName].forEach(key => {
            const keyDiv = document.createElement('div');
            keyDiv.className = 'keyboard-key';
            
            // 特殊键样式
            if (key === 'Space') {
                keyDiv.classList.add('space-key');
            } else if (key === 'Backspace') {
                keyDiv.classList.add('backspace-key');
            } else if (key === 'Enter') {
                keyDiv.classList.add('enter-key');
            } else if (key === 'Shift') {
                keyDiv.classList.add('shift-key');
            } else if (key === 'Shift_r') {
                keyDiv.classList.add('shift-key');
            } else if (key === 'Tab') {
                keyDiv.classList.add('tab-key');
            } else if (key === 'Caps') {
                keyDiv.classList.add('caps-key');
            } else if (key === 'Ctrl' || key === 'Ctrl_r' || key === 'Alt' || key === 'Alt_r' || key === 'Win' || key === 'Menu') {
                keyDiv.classList.add('mod-key');
            }
            
            // 设置热力图颜色
            const count = keyCounts[key] || 0;
            keyDiv.setAttribute('data-count', count);
                const intensity = count / maxCount;
                
            // 设置颜色渐变，从青绿色到暖橙色
            const hue = Math.max(200 - (intensity * 200), 0); // 200(青绿) -> 0(红)
            const saturation = 70 + (intensity * 30); // 更高的强度有更高的饱和度
            const lightness = Math.max(93 - (intensity * 38), 55); // 更高的强度有更暗的亮度
            
            keyDiv.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            
            // 设置键名和点击次数
            const keyContainer = document.createElement('div');
            keyContainer.className = 'key-content';
            
            const keyName = document.createElement('span');
            keyName.className = 'key-name';
            
            // 修改显示名称，保持数据区分但统一显示
            let displayKey = key;
            if (key === 'Shift_r') displayKey = 'Shift';
            if (key === 'Ctrl_r') displayKey = 'Ctrl';
            if (key === 'Alt_r') displayKey = 'Alt';
            
            keyName.textContent = displayKey;
            keyContainer.appendChild(keyName);
            
            // 添加点击次数显示 (如果大于0)
                if (count > 0) {
                const keyCount = document.createElement('span');
                keyCount.className = 'key-count';
                keyCount.textContent = count;
                keyContainer.appendChild(keyCount);
            }
            
            keyDiv.appendChild(keyContainer);
            
            // 添加点击次数提示
            keyDiv.title = `${displayKey}: ${count} 次`;
            
            // 将键添加到行中
            rowDiv.appendChild(keyDiv);
        });
        
        // 将行添加到容器中
        keyboardContainer.appendChild(rowDiv);
    }
}

// 创建鼠标热力图
function createMouseHeatmap(mouseCounts) {
    // 计算总点击和移动数据
    const totalClicks = mouseCounts.left_key + mouseCounts.right_key + mouseCounts.middle_key;
    const totalMovements = mouseCounts.slide;
    const totalScrolls = mouseCounts.roller;
    
    // 创建鼠标热力图容器
    let section = document.querySelector('.mouse-heatmap');
    if (!section) {
        section = document.createElement('section');
        section.className = 'mouse-heatmap';
        
        // 创建鼠标热力图标题
        const title = document.createElement('h3');
        title.textContent = '鼠标热力图';
        section.appendChild(title);
        
        // 插入到键盘热力图之后
        const keyboardSection = document.querySelector('.keyboard-heatmap');
        if (keyboardSection && keyboardSection.nextElementSibling) {
            keyboardSection.parentNode.insertBefore(section, keyboardSection.nextElementSibling);
        } else if (keyboardSection) {
            keyboardSection.parentNode.appendChild(section);
        } else {
            document.querySelector('.charts-container').appendChild(section);
        }
    } else {
        // 保留标题，清空其他内容
        const title = section.querySelector('h3');
        section.innerHTML = '';
        if (title) section.appendChild(title);
    }
    
    const container = document.createElement('div');
    container.id = 'mouse-container';
    container.className = 'mouse-container';
    section.appendChild(container);
    
    // 获取所有鼠标操作的最大次数，用于热力图颜色比例
    const maxCount = Math.max(...Object.values(mouseCounts), 1);
    
    // 创建主内容区域 - 包含鼠标图标和统计数据的上部分
    const mainContentArea = document.createElement('div');
    mainContentArea.className = 'mouse-main-content';
    container.appendChild(mainContentArea);
    
    // 创建鼠标图标区域 - 左侧
    const mouseIconWrapper = document.createElement('div');
    mouseIconWrapper.className = 'mouse-icon-wrapper';
    mainContentArea.appendChild(mouseIconWrapper);
    
    // 创建更大的鼠标热力图
    createMouseIconHeatmap(mouseIconWrapper, mouseCounts, maxCount);
    
    // 创建鼠标操作分析区域 - 右侧
    const mouseStats = document.createElement('div');
    mouseStats.className = 'mouse-stats';
    mainContentArea.appendChild(mouseStats);
    
    // 计算平均每小时的点击和移动次数
    const activeHours = calculateActiveHours();
    const clicksPerHour = activeHours > 0 ? Math.round(totalClicks / activeHours) : 0;
    const movementsPerHour = activeHours > 0 ? Math.round(totalMovements / activeHours) : 0;
    const scrollsPerHour = activeHours > 0 ? Math.round(totalScrolls / activeHours) : 0;
    
    // 鼠标点击统计
    mouseStats.innerHTML = `
        <div class="mouse-stat-item clicks">
            <h4>点击统计</h4>
            <div class="mouse-stat-value">${totalClicks.toLocaleString()}</div>
            <div class="mouse-stat-details">
                <div class="mouse-stat-detail">
                    <div class="mouse-stat-detail-value">${mouseCounts.left_key.toLocaleString()}</div>
                    <div class="mouse-stat-detail-label">左键</div>
                </div>
                <div class="mouse-stat-detail">
                    <div class="mouse-stat-detail-value">${mouseCounts.right_key.toLocaleString()}</div>
                    <div class="mouse-stat-detail-label">右键</div>
                </div>
                <div class="mouse-stat-detail">
                    <div class="mouse-stat-detail-value">${mouseCounts.middle_key.toLocaleString()}</div>
                    <div class="mouse-stat-detail-label">中键</div>
                </div>
                <div class="mouse-stat-detail">
                    <div class="mouse-stat-detail-value">${clicksPerHour.toLocaleString()}</div>
                    <div class="mouse-stat-detail-label">每小时</div>
                </div>
            </div>
        </div>
        
        <div class="mouse-stat-item movement">
            <h4>移动统计</h4>
            <div class="mouse-stat-value">${totalMovements.toLocaleString()}</div>
            <div class="mouse-stat-details">
                <div class="mouse-stat-detail">
                    <div class="mouse-stat-detail-value">${movementsPerHour.toLocaleString()}</div>
                    <div class="mouse-stat-detail-label">每小时</div>
                </div>
                <div class="mouse-stat-detail">
                    <div class="mouse-stat-detail-value">${formatMovementTime(totalMovements)}</div>
                    <div class="mouse-stat-detail-label">活动时长</div>
                </div>
            </div>
        </div>
        
        <div class="mouse-stat-item scroll">
            <h4>滚动统计</h4>
            <div class="mouse-stat-value">${totalScrolls.toLocaleString()}</div>
            <div class="mouse-stat-details">
                <div class="mouse-stat-detail">
                    <div class="mouse-stat-detail-value">${scrollsPerHour.toLocaleString()}</div>
                    <div class="mouse-stat-detail-label">每小时</div>
                </div>
            </div>
        </div>
    `;
}

// 创建更大的鼠标图标热力图
function createMouseIconHeatmap(container, mouseCounts, maxCount) {
    const mouseVisualContainer = document.createElement('div');
    mouseVisualContainer.className = 'mouse-visual-container';
    container.appendChild(mouseVisualContainer);
    
    // 使用更大的鼠标图标和更合理的布局
    mouseVisualContainer.innerHTML = `
        <div class="mouse-icon-container">
            <div class="mouse-part left-button" data-count="${mouseCounts.left_key}">
                <div class="key-content">
                    <div class="key-name">左键</div>
                    <div class="key-count">${mouseCounts.left_key}</div>
                </div>
            </div>
            
            <div class="mouse-part right-button" data-count="${mouseCounts.right_key}">
                <div class="key-content">
                    <div class="key-name">右键</div>
                    <div class="key-count">${mouseCounts.right_key}</div>
                </div>
            </div>
            
            <div class="mouse-part middle-button" data-count="${mouseCounts.middle_key}">
                <div class="key-content">
                    <div class="key-name">中键</div>
                    <div class="key-count">${mouseCounts.middle_key}</div>
                </div>
            </div>
            
            <div class="mouse-part scroll-wheel" data-count="${mouseCounts.roller}">
                <div class="key-content">
                    <div class="key-name">滚轮</div>
                    <div class="key-count">${mouseCounts.roller}</div>
                </div>
            </div>
            
            <div class="mouse-part movement" data-count="${mouseCounts.slide}">
                <div class="key-content">
                    <div class="key-name">移动</div>
                    <div class="key-count">${mouseCounts.slide}</div>
                </div>
            </div>
            
            <div class="mouse-icon">
                <svg viewBox="0 0 24 24" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12,4C9.24,4 7,6.24 7,9v6c0,2.76 2.24,5 5,5s5,-2.24 5,-5V9c0,-2.76 -2.24,-5 -5,-5zM12,2c3.86,0 7,3.14 7,7v6c0,3.86 -3.14,7 -7,7s-7,-3.14 -7,-7V9c0,-3.86 3.14,-7 7,-7z" fill="#aaa"/>
                    <path d="M12,10c-0.55,0 -1,0.45 -1,1v3c0,0.55 0.45,1 1,1s1,-0.45 1,-1v-3c0,-0.55 -0.45,-1 -1,-1z" fill="#888"/>
                    <rect x="11" y="4" width="2" height="5" rx="1" fill="#888"/>
                </svg>
            </div>
        </div>
    `;
    
    // 根据点击频率设置颜色
    const parts = [
        { name: 'left-button', count: mouseCounts.left_key },
        { name: 'right-button', count: mouseCounts.right_key },
        { name: 'scroll-wheel', count: mouseCounts.roller },
        { name: 'middle-button', count: mouseCounts.middle_key },
        { name: 'movement', count: mouseCounts.slide }
    ];
    
    parts.forEach(part => {
        const intensity = part.count / maxCount;
        const element = mouseVisualContainer.querySelector(`.mouse-part.${part.name}`);
        if (element) {
            // 设置颜色渐变 - 从浅蓝色到深蓝色
            const hue = Math.max(210 - (intensity * 40), 170);
            const saturation = 65 + (intensity * 35);
            const lightness = Math.max(90 - (intensity * 50), 40);
            
            element.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            
            // 设置阴影强度
            const shadowIntensity = Math.min(intensity * 15, 10);
            element.style.boxShadow = `0 ${Math.max(2, shadowIntensity/2)}px ${shadowIntensity}px rgba(0, 0, 0, 0.${Math.floor(intensity * 5) + 1})`;
        }
    });
}

// 计算活动小时数（用于每小时统计）
function calculateActiveHours() {
    try {
        // 获取当前过滤的数据
        const filteredData = filterDataByTimeMode();
        
        // 如果没有数据，返回0
        if (!filteredData || filteredData.length === 0) {
            return 0;
        }
        
        // 合并所有数据
        let allKeystrokes = [];
        filteredData.forEach(dayData => {
            if (!dayData || !dayData.result) {
                return;
            }
            allKeystrokes = allKeystrokes.concat(dayData.result);
        });
        
        // 如果没有按键数据，返回0
        if (allKeystrokes.length === 0) {
            return 0;
        }
        
        // 按时间排序
        allKeystrokes.sort((a, b) => a.time - b.time);
        
        // 计算开始和结束时间
        const startTime = new Date(allKeystrokes[0].time);
        const endTime = new Date(allKeystrokes[allKeystrokes.length - 1].time);
        
        // 计算活动小时数
        const hoursDiff = (endTime - startTime) / (1000 * 60 * 60);
        
        // 如果时间差小于1小时，返回1（至少1小时）
        return Math.max(1, hoursDiff);
    } catch (error) {
        console.error('计算活动小时数失败:', error);
        return 1; // 默认返回1小时，避免除以0
    }
}

// 格式化移动时长（每次移动约1秒）
function formatMovementTime(movements) {
    // 每次移动算1秒
    const totalSeconds = movements;
    
    if (totalSeconds < 60) {
        return `${totalSeconds}秒`;
    } else if (totalSeconds < 3600) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}分${seconds}秒`;
    } else {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${hours}时${minutes}分`;
    }
}

// 更新日历热力图
function updateCalendarHeatmap() {
    try {
        console.log('开始更新日历热力图'); 
        // 准备日历数据 - 计算每天的工作时长
        const calendarData = {};
        
        if (!keystrokeData || keystrokeData.length === 0) {
            console.warn('没有可用的按键数据');
            const calendarContainer = document.getElementById('calendar-heatmap');
            if (!calendarContainer) {
                console.error('找不到calendar-heatmap元素');
                return;
            }
            
            calendarContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #8e8e93; font-size: 13px;">无可用数据</div>';
            return;
        }
        
        // 处理所有数据
        keystrokeData.forEach(dayData => {
            if (!dayData || !dayData.date || !dayData.result) {
                console.warn('日期数据格式不正确:', dayData);
                return;
            }
            
            const date = dayData.date;
            
            if (dayData.result.length > 0) {
                // 按时间排序
                const sortedKeystrokes = [...dayData.result].sort((a, b) => a.time - b.time);
                
                // 计算工作时长（使用连续活动阈值）
                const activityThreshold = 5 * 60 * 1000; // 5分钟
                let activeTime = 0;
                let lastTime = sortedKeystrokes[0].time;
                
                for (let i = 1; i < sortedKeystrokes.length; i++) {
                    const currentTime = sortedKeystrokes[i].time;
                    const timeDiff = currentTime - lastTime;
                    
                    if (timeDiff < activityThreshold) {
                        activeTime += timeDiff;
                    }
                    
                    lastTime = currentTime;
                }
                
                // 总工作时长
                const totalTime = sortedKeystrokes.length > 1 ? 
                    (sortedKeystrokes[sortedKeystrokes.length - 1].time - sortedKeystrokes[0].time) : 0;
                
                // 转换为小时
                const activeHours = activeTime / (60 * 60 * 1000);
                const totalHours = totalTime / (60 * 60 * 1000);
                
                calendarData[date] = {
                    activeHours: activeHours,
                    totalHours: totalHours,
                    keystrokeCount: sortedKeystrokes.length
                };
            } else {
                calendarData[date] = {
                    activeHours: 0,
                    totalHours: 0,
                    keystrokeCount: 0
                };
            }
        });
        
        console.log('日历数据:', calendarData);
        
        // 创建日历网格
        const calendarContainer = document.getElementById('calendar-heatmap');
        if (!calendarContainer) {
            console.error('找不到calendar-heatmap元素');
            return;
        }
        
        calendarContainer.innerHTML = '';
        
        // 获取选定月份的第一天和最后一天
        const firstDayOfMonth = calendarDisplayDate.startOf('month');
        const lastDayOfMonth = calendarDisplayDate.endOf('month');
        
        // 计算当前视图模式下的最大工作时长，用于颜色强度
        let maxHours = 0;
        Object.values(calendarData).forEach(data => {
            const hours = calendarViewMode === 'active' ? data.activeHours : data.totalHours;
            if (hours > maxHours) {
                maxHours = hours;
            }
        });
        
        // 确保最大值至少为8小时，防止颜色太浅
        maxHours = Math.max(maxHours, 8);
        console.log(`日历最大时长 (${calendarViewMode}模式): ${maxHours}小时`);
        
        // 创建星期标题行
        const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'calendar-grid';
        
        // 添加星期标题
        weekdayNames.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        // 填充月初空白
        const firstDayWeekday = firstDayOfMonth.weekday % 7;
        for (let i = 0; i < firstDayWeekday; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day';
            emptyCell.style.backgroundColor = '#ebedf0'; // GitHub风格的空白单元格颜色
            calendarGrid.appendChild(emptyCell);
        }
        
        // 添加日期单元格
        let currentDay = firstDayOfMonth;
        while (currentDay <= lastDayOfMonth) {
            const dateStr = currentDay.toFormat('yyyy-MM-dd');
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            
            // 是否为今天
            const isToday = dateStr === DateTime.now().toFormat('yyyy-MM-dd');
            if (isToday) {
                dayCell.classList.add('today');
            }
            
            // 日期数字
            const dayNumber = document.createElement('div');
            dayNumber.className = 'calendar-day-number';
            dayNumber.textContent = currentDay.day;
            dayCell.appendChild(dayNumber);
            
            // 工作时长数据
            if (calendarData[dateStr]) {
                // 根据视图模式选择要显示的时长
                const displayHours = calendarViewMode === 'active' 
                    ? calendarData[dateStr].activeHours 
                    : calendarData[dateStr].totalHours;
                
                // 设置颜色强度和指示器
                const intensity = Math.min(displayHours / maxHours, 1);
                
                // 如果工作时长足够，直接设置背景色
                if (displayHours > 0) {  // 只要时间大于0就显示颜色
                    // 使用GitHub风格的绿色渐变
                    const colorIndex = Math.floor(intensity * 4); // 0-4 之间的索引
                    
                    // GitHub风格的绿色渐变色阶
                    const githubColors = [
                        '#ebedf0', // 最浅
                        '#9be9a8',
                        '#40c463',
                        '#30a14e',
                        '#216e39'  // 最深
                    ];
                    
                    // 确保有工作时长的单元格至少显示最浅的绿色
                    const color = displayHours > 0 && colorIndex === 0 ? githubColors[1] : githubColors[colorIndex];
                    dayCell.style.backgroundColor = color;
                    dayCell.style.color = colorIndex >= 3 ? 'white' : 'var(--dark-color)'; // 深色背景用白色文字
                    
                    // 添加工作时长统计
                    const statsContainer = document.createElement('div');
                    statsContainer.className = 'calendar-stats';
                    statsContainer.textContent = `${displayHours.toFixed(1)}h`;
                    dayCell.appendChild(statsContainer);
                }
            }
            
            calendarGrid.appendChild(dayCell);
            currentDay = currentDay.plus({ days: 1 });
        }
        
        calendarContainer.appendChild(calendarGrid);
        
        // 添加图例
        const legend = document.createElement('div');
        legend.className = 'calendar-legend';
        
        const legendTitle = document.createElement('span');
        legendTitle.className = 'legend-title';
        legendTitle.textContent = calendarViewMode === 'active' ? '有效操作时长:' : '总工作时长:';
        legend.appendChild(legendTitle);
        
        // 创建图例项
        const legendSteps = [0, 0.25, 0.5, 0.75, 1];
        const legendLabels = ['无数据', '少量', '中等', '较多', '大量'];
        
        // 为每个级别创建图例项
        legendSteps.forEach((step, index) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            
            // 使用GitHub风格的绿色渐变
            const githubColors = [
                '#ebedf0', // 最浅
                '#9be9a8',
                '#40c463',
                '#30a14e',
                '#216e39'  // 最深
            ];
            
            colorBox.style.backgroundColor = githubColors[index];
            item.appendChild(colorBox);
            
            const label = document.createElement('span');
            label.className = 'legend-label';
            
            // 对第一个级别显示"无数据"
            if (index === 0) {
                label.textContent = legendLabels[0];
            } else {
                // 其他级别显示描述和对应的小时数
                const hours = (step * maxHours).toFixed(1);
                label.textContent = `${legendLabels[index]} (${hours}h)`;
            }
            
            item.appendChild(label);
            legend.appendChild(item);
        });
        
        calendarContainer.appendChild(legend);
        
    } catch (error) {
        console.error('更新日历热力图失败:', error);
        const calendarContainer = document.getElementById('calendar-heatmap');
        if (calendarContainer) {
            calendarContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #8e8e93; font-size: 13px;">加载失败</div>';
        }
    }
}

// 更新操作时间分布图表
async function updateOperationDistributionChart() {
    try {
        let url = '/api/operation_distribution';
        
        // 根据当前模式构建URL
        if (currentMode === 'custom') {
            const dateStr = activeDate.toFormat('yyyy-MM-dd');
            url += `?date=${dateStr}`;
        } else {
            url += `?mode=${currentMode}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('获取操作分布数据失败');
        }
        
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        
        const chartContainer = document.getElementById('operation-distribution-chart');
        if (!chartContainer) return;
        
        // 清除现有内容，避免重叠
        chartContainer.innerHTML = '';
        
        // 创建新的canvas元素
        const canvas = document.createElement('canvas');
        canvas.id = 'operation-chart-canvas';
        canvas.style.width = '100%';
        canvas.style.height = '300px';
        chartContainer.appendChild(canvas);
        
        // 准备数据
        const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
        
        // 根据时间模式设置标题
        let chartTitle = '今日每小时操作类型分布';
        if (currentMode === 'week') {
            chartTitle = '本周每小时操作类型分布';
        } else if (currentMode === 'month') {
            chartTitle = '本月每小时操作类型分布';
        }
        
        // 创建图表
        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [
                    {
                        label: '键盘操作',
                        data: data.keyboard,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '鼠标操作',
                        data: data.mouse,
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '操作次数'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '时间'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: chartTitle
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} 次`;
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('更新操作分布图表失败:', error);
        const chartContainer = document.getElementById('operation-distribution-chart');
        if (chartContainer) {
            chartContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: #ff3b30;">
                加载图表失败: ${error.message}
            </div>`;
        }
    }
}

// 处理分钟图表日期选择器变化
function handleMinuteChartDayChange() {
    const selector = document.getElementById('minute-chart-day-selector');
    const datePicker = document.getElementById('minute-chart-date-picker');
    
    // 如果选择器或日期选择器不存在，退出函数
    if (!selector || !datePicker) {
        console.warn('未找到分钟图表日期选择器元素，跳过处理');
        return;
    }
    
    if (selector.value === 'custom') {
        datePicker.style.display = 'inline-block';
        // 设置日期选择器为今天
        const today = new Date();
        datePicker.value = formatDateForInput(today);
    } else {
        datePicker.style.display = 'none';
    }
    
    updateMinuteActivityChart();
}

// 格式化日期为日期选择器输入格式 (YYYY-MM-DD)
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 分钟图表的缩放状态
let minuteChartZoom = {
    xaxis: {
        autorange: true
    }
};

// 缩放分钟图表
function zoomMinuteChart(factor) {
    const chart = document.getElementById('minute-activity-chart');
    const currentRange = minuteChartZoom.xaxis.range || chart._fullLayout.xaxis.range;
    
    if (!currentRange || currentRange.length !== 2) {
        console.warn('无法获取当前视图范围，无法进行缩放');
        return;
    }
    
    const middle = (currentRange[0] + currentRange[1]) / 2;
    const newSpan = (currentRange[1] - currentRange[0]) / factor;
    const newRange = [middle - newSpan/2, middle + newSpan/2];
    
    minuteChartZoom.xaxis.range = newRange;
    minuteChartZoom.xaxis.autorange = false;
    
    Plotly.relayout(chart, minuteChartZoom);
}

// 重置分钟图表缩放
function resetMinuteChartZoom() {
    minuteChartZoom = {
        xaxis: {
            autorange: true
        }
    };
    
    Plotly.relayout(document.getElementById('minute-activity-chart'), minuteChartZoom);
}

// 生成模拟分钟级数据（用于开发测试）
function generateMockMinuteData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const data = {};
    
    // 生成全天的数据，每分钟一个数据点
    for (let i = 0; i < 24 * 60; i++) {
        const time = new Date(today);
        time.setMinutes(i);
        
        // 早上9点到12点，下午14点到18点工作时间增加数值
        let count = 0;
        const hour = Math.floor(i / 60);
        
        if ((hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)) {
            // 工作时间的基础活动
            const baseActivity = Math.floor(Math.random() * 20) + 10;
            
            // 添加一些随机波动
            const randomVariation = Math.sin(i / 30) * 5 + Math.random() * 10;
            
            // 为10:30和16:00左右创建活动高峰
            const morningPeak = hour === 10 && i % 60 >= 15 && i % 60 <= 45 ? 20 : 0;
            const afternoonPeak = hour === 16 && i % 60 >= 0 && i % 60 <= 30 ? 25 : 0;
            
            count = Math.max(0, Math.round(baseActivity + randomVariation + morningPeak + afternoonPeak));
        } else if (hour >= 12 && hour < 14) {
            // 午休时间，较低活动
            count = Math.floor(Math.random() * 5);
        } else {
            // 非工作时间偶尔有少量活动
            count = Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0;
        }
        
        data[time.getTime()] = count;
    }
    
    return {
        result: {
            minute_data: data
        }
    };
}

// 获取选定日期的分钟级数据
async function getMinuteActivityData() {
    try {
        const selector = document.getElementById('minute-chart-day-selector');
        const datePicker = document.getElementById('minute-chart-date-picker');
        let targetDate;
        
        if (selector.value === 'yesterday') {
            targetDate = DateTime.now().minus({ days: 1 });
        } else if (selector.value === 'custom' && datePicker.value) {
            targetDate = DateTime.fromISO(datePicker.value);
        } else {
            targetDate = DateTime.now();
        }
        
        // 将目标日期转换为 yyyy-MM-dd 格式
        const dateStr = targetDate.toFormat('yyyy-MM-dd');
        console.log('正在获取日期数据:', dateStr);
        
        // 从API获取指定日期的数据
        const response = await fetch(`/api/today_data?date=${dateStr}`);
        if (!response.ok) {
            throw new Error(`获取数据失败: ${response.status}`);
        }
        
        const dayData = await response.json();
        console.log('API返回的日期数据:', dayData);
        
        if (!dayData || !dayData.result) {
            console.warn('未找到所选日期的数据:', dateStr);
            return null;
        }
        
        // 按分钟聚合数据
        const minuteData = {};
        const startTime = DateTime.fromISO(dateStr).startOf('day');
        
        // 初始化每分钟的数据为0
        for (let i = 0; i < 24 * 60; i++) {
            const time = startTime.plus({ minutes: i });
            minuteData[time.toMillis()] = 0;
        }
        
        // 统计每分钟的按键次数
        dayData.result.forEach(stroke => {
            const time = DateTime.fromMillis(stroke.time).startOf('minute');
            const timestamp = time.toMillis();
            minuteData[timestamp] = (minuteData[timestamp] || 0) + 1;
        });
        
        return {
            result: {
                minute_data: minuteData
            }
        };
    } catch (error) {
        console.error('获取分钟级数据失败:', error);
        return null;
    }
}

// 更新分钟级活动图表
async function updateMinuteActivityChart() {
    try {
        console.log('开始更新分钟级活动图表');
        const chartContainer = document.getElementById('minute-activity-chart');
        
        // 如果图表容器不存在，就退出函数
        if (!chartContainer) {
            console.error('未找到分钟级活动图表容器 (id: minute-activity-chart)');
            console.log('当前页面上的所有元素ID:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
            return;
        }
        
        // 显示加载中状态
        // chartContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 300px;"><span>加载中...</span></div>';
        
        const data = await getMinuteActivityData();
        console.log('获取到的分钟级数据:', data);
        
        if (!data || !data.result || !data.result.minute_data) {
            console.error('无效的数据格式:', data);
            chartContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 300px;"><span>无数据</span></div>';
            return;
        }
        
        const minuteData = data.result.minute_data;
        const timestamps = [];
        const counts = [];
        
        // 根据API返回的数据结构进行处理
        Object.keys(minuteData).sort().forEach(timestamp => {
            // 转换时间戳为日期对象
            const date = new Date(parseInt(timestamp));
            timestamps.push(date);
            counts.push(minuteData[timestamp]);
        });
        
        console.log('处理后的数据点数:', timestamps.length);
        console.log('第一个数据点:', { time: timestamps[0], count: counts[0] });
        console.log('最后一个数据点:', { time: timestamps[timestamps.length - 1], count: counts[counts.length - 1] });
        
        // 如果没有数据，显示无数据信息
        if (timestamps.length === 0) {
            console.warn('没有有效的数据点');
            chartContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 300px;"><span>所选日期没有按键记录数据</span></div>';
            return;
        }
        
        // 创建Plotly图表
        const trace = {
            x: timestamps,
            y: counts,
            type: 'scatter',
            mode: 'lines',
            name: '每分钟操作次数',
            line: {
                color: 'rgba(0, 122, 255, 0.8)',
                width: 2,
                shape: 'spline',
                smoothing: 0.5
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 122, 255, 0.1)'
        };
        
        // 创建小时刻度
        const hourTicks = [];
        const startOfDay = new Date(timestamps[0]);
        startOfDay.setHours(0, 0, 0, 0);
        
        for (let i = 0; i <= 24; i++) {
            const hourTime = new Date(startOfDay);
            hourTime.setHours(i);
            hourTicks.push(hourTime);
        }
        
        const layout = {
            title: '',
            height: 350,
            margin: {
                l: 40,
                r: 20,
                t: 10,
                b: 40
            },
            xaxis: {
                type: 'date',
                tickformat: '%H:%M',
                tickvals: hourTicks,
                ticktext: hourTicks.map(date => `${date.getHours()}:00`),
                gridcolor: 'rgba(0, 0, 0, 0.05)',
                gridwidth: 1,
                title: {
                    text: '时间 (小时)',
                    font: {
                        size: 12
                    }
                }
            },
            yaxis: {
                title: {
                    text: '操作次数',
                    font: {
                        size: 12
                    }
                },
                gridcolor: 'rgba(0, 0, 0, 0.05)',
                gridwidth: 1,
                rangemode: 'nonnegative'
            },
            hovermode: 'closest',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            hoverlabel: {
                bgcolor: 'white',
                font: {
                    family: '-apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", Helvetica, Arial, sans-serif',
                    size: 12
                },
                bordercolor: 'rgba(0, 0, 0, 0.1)'
            }
        };
        
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
            displaylogo: false
        };
        
        console.log('开始绘制图表');
        await Plotly.newPlot(chartContainer, [trace], layout, config);
        console.log('图表绘制完成');
        
        // 应用之前的缩放状态（如果有）
        if (!minuteChartZoom.xaxis.autorange) {
            console.log('应用缩放状态:', minuteChartZoom);
            await Plotly.relayout(chartContainer, minuteChartZoom);
        }
    } catch (error) {
        console.error('更新分钟级活动图表时发生错误:', error);
        const chartContainer = document.getElementById('minute-activity-chart');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #ff3b30;">
                    <span>图表加载失败: ${error.message}</span>
                </div>
            `;
        }
    }
}

// 获取日历数据并更新日历热力图
async function fetchCalendarData() {
    try {
        // 获取完整的历史数据用于日历展示
        const calendarApiUrl = '/api/keystroke_data';
        const calendarResponse = await fetch(calendarApiUrl);
        
        if (!calendarResponse.ok) {
            throw new Error(`日历数据API请求失败: ${calendarResponse.status}`);
        }
        
        const calendarData = await calendarResponse.json();
        console.log('日历API响应数据:', calendarData);
        
        // 更新日历热力图 - 使用完整的数据
        if (Array.isArray(calendarData) && calendarData.length > 0) {
            // 临时保存当前keystrokeData
            const tempData = keystrokeData;
            // 使用完整数据更新日历
            keystrokeData = calendarData;
            // 更新日历
            updateCalendarHeatmap();
            // 恢复原始数据
            keystrokeData = tempData;
        } else {
            updateCalendarHeatmap();
        }
    } catch (error) {
        console.error('获取日历数据失败:', error);
        const calendarContainer = document.getElementById('calendar-heatmap');
        if (calendarContainer) {
            calendarContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #8e8e93; font-size: 13px;">加载失败</div>';
        }
    }
} 