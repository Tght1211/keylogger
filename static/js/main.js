// 全局变量和配置
const DateTime = luxon.DateTime;
let currentMode = 'today'; // 'today', 'week', 'month'
let keystrokeData = [];
let activeDate = DateTime.now();
let calendarDisplayDate = DateTime.now(); // 当前显示的日历月份
let calendarViewMode = 'total'; // 'active' 或 'total' 工作时长视图

// 键盘布局定义（标准QWERTY键盘）
const keyboardLayout = {
    row1: ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
    row2: ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
    row3: ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
    row4: ['Caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\'', 'Enter'],
    row5: ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Shift'],
    row6: ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Menu', 'Ctrl']
};

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    // 绑定时间选择器事件
    document.getElementById('today-btn').addEventListener('click', () => setTimeMode('today'));
    document.getElementById('week-btn').addEventListener('click', () => setTimeMode('week'));
    document.getElementById('month-btn').addEventListener('click', () => setTimeMode('month'));
    
    // 绑定日历控制事件
    document.getElementById('prev-month').addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeCalendarMonth(1));
    document.getElementById('active-hours-btn').addEventListener('click', () => setCalendarViewMode('active'));
    document.getElementById('total-hours-btn').addEventListener('click', () => setCalendarViewMode('total'));
    
    // 更新当前月份显示
    updateCurrentMonthDisplay();
    
    // 初始加载数据
    fetchData();
});

// 设置时间模式
function setTimeMode(mode) {
    currentMode = mode;
    
    // 更新按钮状态
    document.querySelectorAll('.time-selector button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${mode}-btn`).classList.add('active');
    
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
    
    // 重新渲染日历
    updateCalendarHeatmap();
}

// 改变日历月份
function changeCalendarMonth(change) {
    calendarDisplayDate = calendarDisplayDate.plus({ months: change });
    updateCurrentMonthDisplay();
    updateCalendarHeatmap();
}

// 更新当前月份显示
function updateCurrentMonthDisplay() {
    document.getElementById('current-month').textContent = calendarDisplayDate.toFormat('yyyy年MM月');
}

// 获取数据
async function fetchData() {
    try {
        let apiUrl = '/api/keystroke_data';
        
        if (currentMode === 'today') {
            // 如果是今日模式，直接使用today_data接口
            apiUrl = '/api/today_data';
        }
        
        console.log('正在请求数据:', apiUrl);
        const response = await fetch(apiUrl);
        
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
        if (currentMode === 'today' && !Array.isArray(data)) {
            // 检查数据格式是否有效
            if (!data.result) {
                console.error('今日数据格式无效:', data);
                showErrorMessage('今日数据格式无效');
                return;
            }
            
            // 如果获取的是today_data，它返回的是单个对象，我们需要将其转换为数组
            keystrokeData = [data];
        } else if (Array.isArray(data)) {
            // 检查数据数组是否为空
            if (data.length === 0) {
                console.warn('API返回空数据数组');
                keystrokeData = [];
            } else {
                // 检查数组中的数据是否有效
                const validData = data.filter(item => item && item.result);
                if (validData.length === 0) {
                    console.error('API返回的数据不包含有效记录');
                    showErrorMessage('没有有效的按键记录');
                    return;
                }
                keystrokeData = data;
            }
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
        updateCalendarHeatmap();
        updateOperationDistributionChart();
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
    
    // 计算有效工作时长
    // 定义连续活动的时间阈值（毫秒）
    const activityThreshold = 5 * 60 * 1000; // 5分钟
    
    if (allKeystrokes.length > 0) {
        // 按时间排序
        allKeystrokes.sort((a, b) => a.time - b.time);
        
        let activeTime = 0;
        let lastTime = allKeystrokes[0].time;
        
        for (let i = 1; i < allKeystrokes.length; i++) {
            const currentTime = allKeystrokes[i].time;
            const timeDiff = currentTime - lastTime;
            
            if (timeDiff < activityThreshold) {
                activeTime += timeDiff;
            }
            
            lastTime = currentTime;
        }
        
        // 转换为小时和分钟
        const activeHours = Math.floor(activeTime / (60 * 60 * 1000));
        const activeMinutes = Math.floor((activeTime % (60 * 60 * 1000)) / (60 * 1000));
        
        document.getElementById('active-time').textContent = `${activeHours}小时 ${activeMinutes}分钟`;
            
            // 计算总工作时长（从第一次按键到最后一次按键）
            const totalWorkingTime = allKeystrokes[allKeystrokes.length - 1].time - allKeystrokes[0].time;
            const totalHours = Math.floor(totalWorkingTime / (60 * 60 * 1000));
            const totalMinutes = Math.floor((totalWorkingTime % (60 * 60 * 1000)) / (60 * 1000));
            
            document.getElementById('total-time').textContent = `${totalHours}小时 ${totalMinutes}分钟`;
    } else {
        document.getElementById('active-time').textContent = '0小时 0分钟';
            document.getElementById('total-time').textContent = '0小时 0分钟';
        }
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
            } else if (key === 'Tab') {
                keyDiv.classList.add('tab-key');
            } else if (key === 'Caps') {
                keyDiv.classList.add('caps-key');
            } else if (key === 'Ctrl' || key === 'Alt' || key === 'Win' || key === 'Menu') {
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
            keyName.textContent = key;
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
            keyDiv.title = `${key}: ${count} 次`;
            
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
        
        // 计算最大工作时长，用于颜色强度
        let maxHours = 0;
        Object.values(calendarData).forEach(data => {
            if (calendarViewMode === 'active') {
                maxHours = Math.max(maxHours, data.activeHours);
            } else {
                maxHours = Math.max(maxHours, data.totalHours);
            }
        });
        
        // 确保最大值至少为8小时，防止颜色太浅
        maxHours = Math.max(maxHours, 8);
        
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
            emptyCell.style.backgroundColor = 'var(--gray-6)';
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
            const hasData = calendarData[dateStr] && (
                calendarData[dateStr].activeHours > 0 || 
                calendarData[dateStr].totalHours > 0
            );
            
            if (hasData) {
                // 根据视图模式选择要显示的时长
                const displayHours = calendarViewMode === 'active' 
                    ? calendarData[dateStr].activeHours 
                    : calendarData[dateStr].totalHours;
                
                // 设置颜色强度和指示器
                const intensity = Math.min(displayHours / maxHours, 1);
                
                // 如果工作时长足够，直接设置背景色
                if (displayHours >= 0.1) {
                    dayCell.style.backgroundColor = `rgba(0, 122, 255, ${intensity.toFixed(2)})`;
                    dayCell.style.color = intensity > 0.5 ? 'white' : 'var(--dark-color)';
                }
                
                // 添加工作时长统计（如果超过0.1小时才显示）
                if (displayHours >= 0.1) {
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
        legendTitle.textContent = calendarViewMode === 'active' ? '有效工作时长:' : '总工作时长:';
        legend.appendChild(legendTitle);
        
        // 创建图例项
        const legendSteps = [0, 0.25, 0.5, 0.75, 1];
        legendSteps.forEach(step => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = `rgba(0, 122, 255, ${step.toFixed(2)})`;
            item.appendChild(colorBox);
            
            const label = document.createElement('span');
            label.className = 'legend-label';
            label.textContent = `${(step * maxHours).toFixed(1)}h`;
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
        // 根据当前时间模式获取数据
        const response = await fetch(`/api/operation_distribution?mode=${currentMode}`);
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