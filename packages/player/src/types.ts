import type Mpegts from 'mpegts.js'

export type MediaDataSource = Mpegts.MediaDataSource
export type MediaSegment = Mpegts.MediaSegment
export type MpegtsConfig = Mpegts.Config
export type StatisticsInfo = Mpegts.MSEPlayerStatisticsInfo
export type MediaInfo = Mpegts.MSEPlayerMediaInfo

export interface ReconnectConfig {
  retries?: number
  minDelay?: number
  maxDelay?: number
}

export type PlayerStatus =
  | 'connecting'
  | 'reconnecting'
  | 'error'
  | 'nosignal'
  | 'playing'
  | 'stopped'
