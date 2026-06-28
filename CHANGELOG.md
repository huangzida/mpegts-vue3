# Changelog

## [0.4.1](https://github.com/huangzida/mpegts-vue3/compare/v0.4.0...v0.4.1) (2026-06-28)


### Bug Fixes

* **ci:** apps typecheck 解析 package 源码 (不依赖 dist) + 对齐 JSX 模式 ([3143e58](https://github.com/huangzida/mpegts-vue3/commit/3143e58c0cad913528f210a609e1717d9464a6d3))
* **pkg:** 构建时把根 README 拷进包目录, npm publish 即含 readme ([feb4c27](https://github.com/huangzida/mpegts-vue3/commit/feb4c27f5c96b67a367018dbf68d7a8b3d650840))

# [0.4.0](https://github.com/huangzida/mpegts-vue3/compare/v0.3.2...v0.4.0) (2026-06-28)


### Bug Fixes

* **demo:** stats 浮层下载速度格式化 (整数 KB/s, 过 1024 自动 MB/s) ([72ab6b7](https://github.com/huangzida/mpegts-vue3/commit/72ab6b73e4e7fdcc69545f5236974974c57fce3f))
* **demo:** URL 输入改为点击应用/回车才提交 (不再逐键重连) ([a6d6d30](https://github.com/huangzida/mpegts-vue3/commit/a6d6d30fb8275c6165f06f54c96ff38aba915bf4))
* **demo:** 修 16:9 变形 + 放宽播放区让 tile 更大 ([7d953cb](https://github.com/huangzida/mpegts-vue3/commit/7d953cbf26caae4f52bc0faf19226ba147575e8d))


### Features

* demo P0+P1 改造、展示区放大、README 重写、apps 进 typecheck gate ([331002e](https://github.com/huangzida/mpegts-vue3/commit/331002e873aba540dbeb2de72ca7643135eb1e6b))
* **demo:** 徽章显示 分辨率+fps+友好codec, stats 加 loader tag ([a845b39](https://github.com/huangzida/mpegts-vue3/commit/a845b398c465802bab149d662c3072b0948028fa))
* 从包入口 re-export mpegts.js 命名空间 (getFeatureList/isSupported/Events) ([330ba7a](https://github.com/huangzida/mpegts-vue3/commit/330ba7a45f796e0f048b2c4984748c92b736b698))
* 启用 worker、live 自动重连、statistics/mediaInfo/recovered 事件 ([abb751c](https://github.com/huangzida/mpegts-vue3/commit/abb751c38e7b9421a2fd357b6208fbaffa822b4a))
* 控制栏 API、reuseRedirectedURL 默认、VOD ended 事件、性能文档 ([36af51d](https://github.com/huangzida/mpegts-vue3/commit/36af51d985c4934e87fb8ba93fd367831d2492d9))
* 播放器健壮性增强、ref API 扩展、测试网与发版门禁 ([53011a0](https://github.com/huangzida/mpegts-vue3/commit/53011a02013e2a9dd9202d0f2fece4830943e1af))
* 添加showLoading props以控制连接加载层显示 ([c029092](https://github.com/huangzida/mpegts-vue3/commit/c029092cb052e40772c6d150c4bd75d4f8d1df33))

## [0.3.2](https://github.com/huangzida/mpegts-vue3/compare/v0.3.1...v0.3.2) (2026-06-20)


### Bug Fixes

* 修复FLV流音频丢失问题，规范仓库地址并更新文档 ([4bb4e82](https://github.com/huangzida/mpegts-vue3/commit/4bb4e8269c6a1fbbf45b323866ff12d9ecaf5764))

## [0.3.1](https://github.com/huangzida/mpegts-vue3/compare/v0.3.0...v0.3.1) (2026-06-20)


### Bug Fixes

* **mpegts播放器:** 修复自动播放异常与FLV音频识别问题 ([d85e6d9](https://github.com/huangzida/mpegts-vue3/commit/d85e6d94ebd063d8c3a2817e3901af7696904f24))

# [0.3.0](https://github.com/huangzida/mpegts-vue3/compare/v0.2.0...v0.3.0) (2026-05-18)


### Bug Fixes

* 适配React 17并优化播放器UI样式 ([e5b0dc7](https://github.com/huangzida/mpegts-vue3/commit/e5b0dc7241cf9e80135e498c2ed80cd4d0329e94))


### Features

* **mpegts-player:** 为Mpegts播放器添加objectFit配置支持 ([7878210](https://github.com/huangzida/mpegts-vue3/commit/78782105b983647b106ceb3cbd7daf3e3f614fb4))
* 发布v0.2.0，新增React播放器并优化Vue播放器 ([8f4d9d4](https://github.com/huangzida/mpegts-vue3/commit/8f4d9d4c2c58781f62e71f25e8f2c26d07a21d18))
* 新增视频objectFit配置支持，更新文档与示例 ([e7cad8a](https://github.com/huangzida/mpegts-vue3/commit/e7cad8a386a952d1463746b5e8d9909cf6356fa5))

# [0.2.0](https://github.com/huangzida/mpegts-vue3/compare/v0.1.0...v0.2.0) (2026-05-15)


### Features

* 新增react示例项目并优化播放器组件 ([bc2c5f0](https://github.com/huangzida/mpegts-vue3/commit/bc2c5f0cc96a9fd2866322b0a0169a4dab65293a))
