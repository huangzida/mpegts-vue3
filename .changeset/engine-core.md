---
"mpegts-vue3": patch
"mpegts-react": patch
---

重构（公共契约不变）：播放器引擎收拢到共享的 mpegts-core（PlayerEngine），Vue/React 组件退化为薄 adapter。统一重建策略为 300ms 防抖（修复 React 缺失防抖导致连续 prop 变更触发多次 destroy/create 的问题）；url 清空时对齐 Vue 行为上报 nosignal。
