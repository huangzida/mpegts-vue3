import React from 'react'
import ReactDOM from 'react-dom'

import { Mpegts } from 'mpegts-react'

import App from './App'
import './style.css'

// Silence mpegts.js verbose/debug/info/warn logs (FLV demuxer, MP4 remuxer,
// MSE controller, "Large audio timestamp gap" chatter — all self-handling).
// Keep error-level only. Must run before any player is created.
Mpegts.LoggingControl.enableDebug = false
Mpegts.LoggingControl.enableVerbose = false
Mpegts.LoggingControl.enableInfo = false
Mpegts.LoggingControl.enableWarn = false
// enableError stays default true

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')!,
)
