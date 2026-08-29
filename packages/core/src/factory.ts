import Mpegts from 'mpegts.js'

import type { MediaDataSource, MpegtsConfig, MpegtsPlayerLike, PlayerFactory } from './types'

/**
 * The only module that imports mpegts.js at runtime. Keep it that way: the
 * client-only constraint ("mpegts.js touches `window` at module load") has
 * exactly one home, and tests can swap the whole thing via
 * createPlayerEngine's second parameter.
 */
export const mpegtsFactory: PlayerFactory = {
  isSupported: () => Mpegts.isSupported(),
  createPlayer: (source: MediaDataSource, config: MpegtsConfig) =>
    Mpegts.createPlayer(source, config) as unknown as MpegtsPlayerLike,
}
