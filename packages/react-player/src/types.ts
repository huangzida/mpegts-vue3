import type Mpegts from 'mpegts.js'

export type MediaDataSource = Mpegts.MediaDataSource
export type MediaSegment = Mpegts.MediaSegment
export type MpegtsConfig = Mpegts.Config

export type PlayerStatus =
  | 'connecting'
  | 'error'
  | 'nosignal'
  | 'playing'
  | 'stopped'
