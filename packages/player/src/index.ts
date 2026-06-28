export { default as MpegtsPlayer } from './components/MpegtsPlayer.vue'
export type { MediaDataSource, MediaInfo, MediaSegment, MpegtsConfig, PlayerStatus, ReconnectConfig, StatisticsInfo } from './types'
// Re-export the mpegts.js namespace as an escape hatch for capability detection
// (getFeatureList: H.265/MSE support), advanced events, and custom loaders.
export { default as Mpegts } from 'mpegts.js'
