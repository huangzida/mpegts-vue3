# mpegts-vue3

两个独立发布的 mpegts.js 播放器组件（Vue 3 与 React 17+）共用的领域语言。mpegts.js 封装 FLV/MPEG-TS 流的低延迟直播与点播播放。

## Language

**PlayerEngine**:
框架无关的播放器 module，拥有 mpegts.js 生命周期的全部策略；框架组件只是它的 adapter。
_Avoid_: controller, manager, wrapper

**MSE gate**:
创建 MSE 路播放器前对 mse/mpegts/m2ts/flv 类型的 isSupported 检查；非 MSE 类型（如 mp4 走 NativePlayer）不受此门。
_Avoid_: 兼容性检查, support check

**重建 (rebuild)**:
source 或 config 变化后的 destroy/create 循环；策略默认 300ms 防抖合并连续变更。
_Avoid_: recreate, 重启

**Live 重连**:
直播流瞬态网络错误后的自动重试状态机：指数退避、次数上限、播放成功即复位；HTTP 4xx/5xx 视为永久错误不重试。
_Avoid_: retry, 自动恢复

**保守音轨默认**:
hasAudio/hasVideo 默认 true，规避部分 FLV 流（ZLMediaKit）header flag 漏标导致的黑屏/无声。
_Avoid_: 流探测
