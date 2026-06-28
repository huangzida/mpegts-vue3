import { createApp } from 'vue'

import { Mpegts } from 'mpegts-vue3'

import App from './App.vue'
import './style.css'

// Silence mpegts.js verbose/info/warn/debug logs (FLVDemuxer / MP4Remuxer /
// MSEController chatter, "Large audio timestamp gap", etc. — these are
// self-handling). Keep errors only. Must run before any player is created.
Mpegts.LoggingControl.enableDebug = false
Mpegts.LoggingControl.enableVerbose = false
Mpegts.LoggingControl.enableInfo = false
Mpegts.LoggingControl.enableWarn = false
// enableError stays default true

createApp(App).mount('#app')
